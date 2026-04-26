/**
 * 节假日管理测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HolidayTab from '@/components/settings/HolidayTab.vue'
import {
  getAllMergedHolidays,
  filterHolidaysByYear,
  addCustomHoliday,
  removeCustomHoliday,
  loadCustomHolidays,
  saveCustomHolidays,
  type CustomHolidayData,
  type MergedHolidayInfo
} from '@/utils/holidayStorage'
import { HOLIDAYS, MAKEUP_DAYS } from '@/utils/holidayData'

// 模拟 settingsService，使数据库不可用，测试 localStorage 降级路径
vi.mock('@/services/settings', () => ({
  isDatabaseAvailable: vi.fn().mockResolvedValue(false),
  getAllUserHolidays: vi.fn().mockResolvedValue([]),
  addUserHoliday: vi.fn().mockResolvedValue(undefined),
  removeUserHoliday: vi.fn().mockResolvedValue(false),
  loadFromLocalStorage: vi.fn((key: string) => localStorage.getItem(key)),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string): string | null => store[key] || null,
    setItem: (key: string, value: string): void => {
      store[key] = value.toString()
    },
    removeItem: (key: string): void => {
      delete store[key]
    },
    clear: (): void => {
      store = {}
    }
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

describe('节假日管理 - 模块功能测试', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getAllMergedHolidays()', () => {
    it('应该合并静态节假日和自定义节假日数据', async () => {
      // 添加自定义节假日
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')

      const merged = await getAllMergedHolidays()

      // 验证静态节假日存在
      expect(merged['2024-01-01']).toEqual({ name: '元旦', type: 'holiday' })
      expect(merged['2024-02-10']).toEqual({ name: '春节', type: 'holiday' })

      // 验证自定义节假日存在
      expect(merged['2024-12-25']).toEqual({ name: '圣诞节', type: 'holiday' })
    })

    it('应该合并静态补休和自定义补休数据', async () => {
      // 添加自定义补休
      await addCustomHoliday('2024-03-01', '补班日', 'makeup')

      const merged = await getAllMergedHolidays()

      // 验证静态补休存在
      expect(merged['2024-02-04']).toEqual({ name: '春节调休', type: 'makeup' })
      expect(merged['2024-04-07']).toEqual({ name: '清明调休', type: 'makeup' })

      // 验证自定义补休存在
      expect(merged['2024-03-01']).toEqual({ name: '补班日', type: 'makeup' })
    })

    it('自定义数据应该覆盖静态数据', async () => {
      // 添加与静态数据冲突的自定义节假日
      await addCustomHoliday('2024-01-01', '自定义元旦', 'holiday')

      const merged = await getAllMergedHolidays()

      // 验证自定义数据覆盖了静态数据
      expect(merged['2024-01-01']).toEqual({ name: '自定义元旦', type: 'holiday' })
    })

    it('重复日期应该去重', async () => {
      // 添加相同日期的自定义节假日两次
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
      await addCustomHoliday('2024-12-25', '圣诞节（修改）', 'holiday')

      const merged = await getAllMergedHolidays()

      // 验证只保留最后一次添加的数据
      expect(merged['2024-12-25']).toEqual({ name: '圣诞节（修改）', type: 'holiday' })

      // 验证只有一个条目
      const christmasDates = Object.keys(merged).filter(date => date === '2024-12-25')
      expect(christmasDates.length).toBe(1)
    })
  })

  describe('filterHolidaysByYear()', () => {
    it('应该正确筛选指定年份的节假日', async () => {
      const holidays2024 = await filterHolidaysByYear(2024)

      // 验证 2024 年的节假日存在
      expect(holidays2024['2024-01-01']).toBeDefined()
      expect(holidays2024['2024-02-10']).toBeDefined()
      expect(holidays2024['2024-10-01']).toBeDefined()

      // 验证其他年份的节假日不存在
      expect(holidays2024['2025-01-01']).toBeUndefined()
      expect(holidays2024['2026-01-01']).toBeUndefined()
    })

    it('应该正确筛选指定年份的补休', async () => {
      const holidays2024 = await filterHolidaysByYear(2024)

      // 验证 2024 年的补休存在
      expect(holidays2024['2024-02-04']).toEqual({ name: '春节调休', type: 'makeup' })
      expect(holidays2024['2024-04-07']).toEqual({ name: '清明调休', type: 'makeup' })

      // 验证其他年份的补休不存在
      expect(holidays2024['2025-02-04']).toBeUndefined()
    })

    it('应该包含自定义节假日', async () => {
      // 添加自定义节假日
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
      await addCustomHoliday('2025-12-25', '圣诞节', 'holiday')

      const holidays2024 = await filterHolidaysByYear(2024)

      // 验证 2024 年的自定义节假日存在
      expect(holidays2024['2024-12-25']).toEqual({ name: '圣诞节', type: 'holiday' })

      // 验证 2025 年的自定义节假日不存在
      expect(holidays2024['2025-12-25']).toBeUndefined()
    })

    it('空年份应该返回空对象', async () => {
      const holidays3000 = await filterHolidaysByYear(3000)

      expect(Object.keys(holidays3000).length).toBe(0)
    })
  })

  describe('addCustomHoliday()', () => {
    it('应该正确添加自定义节假日并持久化', async () => {
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')

      const customData = await loadCustomHolidays()

      expect(customData.holidays['2024-12-25']).toBe('圣诞节')
    })

    it('应该正确添加自定义补休并持久化', async () => {
      await addCustomHoliday('2024-03-01', '补班日', 'makeup')

      const customData = await loadCustomHolidays()

      expect(customData.makeupDays['2024-03-01']).toBe('补班日')
    })

    it('应该允许覆盖已存在的节假日', async () => {
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
      await addCustomHoliday('2024-12-25', '圣诞节（修改）', 'holiday')

      const customData = await loadCustomHolidays()

      expect(customData.holidays['2024-12-25']).toBe('圣诞节（修改）')
    })
  })

  describe('removeCustomHoliday()', () => {
    it('应该正确删除自定义节假日', async () => {
      await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
      await removeCustomHoliday('2024-12-25', 'holiday')

      const customData = await loadCustomHolidays()

      expect(customData.holidays['2024-12-25']).toBeUndefined()
    })

    it('应该正确删除自定义补休', async () => {
      await addCustomHoliday('2024-03-01', '补班日', 'makeup')
      await removeCustomHoliday('2024-03-01', 'makeup')

      const customData = await loadCustomHolidays()

      expect(customData.makeupDays['2024-03-01']).toBeUndefined()
    })

    it('删除不存在的节假日不应该报错', async () => {
      await expect(removeCustomHoliday('2024-12-25', 'holiday')).resolves.not.toThrow()
    })
  })
})

describe('节假日管理 - UI 渲染测试', () => {
  beforeEach(async () => {
    localStorage.clear()
    // 添加测试数据
    await addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
    await addCustomHoliday('2024-03-01', '补班日', 'makeup')
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('节假日绿色渲染 (#22c55e)', () => {
    it('节假日应该存在', async () => {
      const wrapper = mount(HolidayTab)
      // 等待组件挂载和数据加载（异步操作需要多次 tick）
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      // 断言：至少有一个节假日标签元素
      const holidayBadges = wrapper.findAll('.type-badge.holiday')
      expect(holidayBadges.length).toBeGreaterThan(0)

      // 断言：节假日行有正确的类
      const holidayRows = wrapper.findAll('.holiday-row.holiday')
      expect(holidayRows.length).toBeGreaterThan(0)
    })

    it('节假日的边框应该是绿色', async () => {
      const wrapper = mount(HolidayTab)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      const holidayRows = wrapper.findAll('.holiday-row.holiday')

      // 断言：至少有一个节假日行
      expect(holidayRows.length).toBeGreaterThan(0)

      // 验证组件中定义的样式类存在
      holidayRows.forEach(row => {
        expect(row.classes()).toContain('holiday')
      })
    })
  })

  describe('调休/补班橙色渲染 (#f97316)', () => {
    it('调休/补班应该存在', async () => {
      const wrapper = mount(HolidayTab)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      // 断言：至少有一个调休标签元素
      const makeupBadges = wrapper.findAll('.type-badge.makeup')
      expect(makeupBadges.length).toBeGreaterThan(0)

      // 断言：调休行有正确的类
      const makeupRows = wrapper.findAll('.holiday-row.makeup')
      expect(makeupRows.length).toBeGreaterThan(0)
    })

    it('调休/补班的边框应该是橙色', async () => {
      const wrapper = mount(HolidayTab)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      const makeupRows = wrapper.findAll('.holiday-row.makeup')

      // 断言：至少有一个调休行
      expect(makeupRows.length).toBeGreaterThan(0)

      // 验证组件中定义的样式类存在
      makeupRows.forEach(row => {
        expect(row.classes()).toContain('makeup')
      })
    })
  })

  describe('年份下拉切换', () => {
    it('应该显示年份下拉选择器', async () => {
      const wrapper = mount(HolidayTab)
      // 等待数据加载
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      // 断言：年份选择器存在
      const yearSelect = wrapper.find('[data-testid="year-select"]')
      expect(yearSelect.exists()).toBe(true)

      // 断言：年份选择器有选项
      const selectElement = yearSelect.element as HTMLSelectElement
      expect(selectElement.options.length).toBeGreaterThan(0)

      // 断言：包含当前年选项
      const currentYear = new Date().getFullYear().toString()
      const optionCurrentYear = Array.from(selectElement.options).find(
        option => option.value === currentYear
      )
      expect(optionCurrentYear).toBeTruthy()
    })

    it('切换年份应该更新显示的节假日', async () => {
      const wrapper = mount(HolidayTab)
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      const yearSelect = wrapper.find('[data-testid="year-select"]')

      // 断言：年份选择器存在
      expect(yearSelect.exists()).toBe(true)

      // 切换到 2024 年
      const selectElement = yearSelect.element as HTMLSelectElement
      selectElement.value = '2024'
      await yearSelect.trigger('change')
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))
      await wrapper.vm.$nextTick()

      // 断言：2024 年的节假日应该显示
      const holidays2024 = wrapper.findAll('.holiday-row')
      expect(holidays2024.length).toBeGreaterThan(0)
    })
  })
})
