import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  loadCustomHolidays,
  saveCustomHolidays,
  addCustomHoliday,
  removeCustomHoliday,
  getAllMergedHolidays,
  filterHolidaysByYear,
  getAvailableYears,
  exportCustomHolidays,
  importCustomHolidays,
} from '../utils/holidayStorage'

describe('holidayStorage', () => {
  beforeEach(() => {
    // 清空 localStorage
    localStorage.clear()
  })

  afterEach(() => {
    // 清空 localStorage
    localStorage.clear()
  })

  describe('loadCustomHolidays', () => {
    it('应该返回空对象当没有数据时', () => {
      const result = loadCustomHolidays()
      expect(result).toEqual({ holidays: {}, makeupDays: {} })
    })

    it('应该正确加载已保存的数据', () => {
      const testData = {
        holidays: { '2024-01-02': '测试节日' },
        makeupDays: { '2024-01-03': '测试调休' }
      }
      localStorage.setItem('user-holidays', JSON.stringify(testData))

      const result = loadCustomHolidays()
      expect(result).toEqual(testData)
    })
  })

  describe('saveCustomHolidays', () => {
    it('应该正确保存数据到 localStorage', () => {
      const testData = {
        holidays: { '2024-01-02': '测试节日' },
        makeupDays: { '2024-01-03': '测试调休' }
      }
      saveCustomHolidays(testData)

      const stored = localStorage.getItem('user-holidays')
      expect(stored).toBe(JSON.stringify(testData))
    })
  })

  describe('addCustomHoliday', () => {
    it('应该添加自定义节假日', () => {
      addCustomHoliday('2024-01-02', '自定义节日', 'holiday')

      const result = loadCustomHolidays()
      expect(result.holidays['2024-01-02']).toBe('自定义节日')
      expect(result.makeupDays).toEqual({})
    })

    it('应该添加自定义补休', () => {
      addCustomHoliday('2024-01-03', '自定义调休', 'makeup')

      const result = loadCustomHolidays()
      expect(result.makeupDays['2024-01-03']).toBe('自定义调休')
      expect(result.holidays).toEqual({})
    })

    it('应该更新已存在的节假日', () => {
      addCustomHoliday('2024-01-02', '第一次', 'holiday')
      addCustomHoliday('2024-01-02', '第二次', 'holiday')

      const result = loadCustomHolidays()
      expect(result.holidays['2024-01-02']).toBe('第二次')
    })
  })

  describe('removeCustomHoliday', () => {
    it('应该删除自定义节假日', () => {
      addCustomHoliday('2024-01-02', '测试节日', 'holiday')
      removeCustomHoliday('2024-01-02', 'holiday')

      const result = loadCustomHolidays()
      expect(result.holidays['2024-01-02']).toBeUndefined()
    })

    it('应该删除自定义补休', () => {
      addCustomHoliday('2024-01-03', '测试调休', 'makeup')
      removeCustomHoliday('2024-01-03', 'makeup')

      const result = loadCustomHolidays()
      expect(result.makeupDays['2024-01-03']).toBeUndefined()
    })
  })

  describe('getAllMergedHolidays', () => {
    it('应该包含静态节假日数据', () => {
      const result = getAllMergedHolidays()
      expect(result['2024-01-01']).toEqual({ name: '元旦', type: 'holiday' })
    })

    it('应该包含静态补休数据', () => {
      const result = getAllMergedHolidays()
      expect(result['2024-02-04']).toEqual({ name: '春节调休', type: 'makeup' })
    })

    it('自定义数据应该覆盖静态数据', () => {
      addCustomHoliday('2024-01-01', '自定义元旦', 'holiday')
      const result = getAllMergedHolidays()
      expect(result['2024-01-01']).toEqual({ name: '自定义元旦', type: 'holiday' })
    })
  })

  describe('filterHolidaysByYear', () => {
    it('应该只返回指定年份的节假日', () => {
      const result = filterHolidaysByYear(2024)
      const dates = Object.keys(result)

      expect(dates.every(date => date.startsWith('2024-'))).toBe(true)
      expect(result['2024-01-01']).toBeDefined()
      expect(result['2025-01-01']).toBeUndefined()
    })

    it('应该包含自定义节假日', () => {
      addCustomHoliday('2024-12-25', '圣诞节', 'holiday')
      const result = filterHolidaysByYear(2024)

      expect(result['2024-12-25']).toEqual({ name: '圣诞节', type: 'holiday' })
    })
  })

  describe('getAvailableYears', () => {
    it('应该返回所有有数据的年份', () => {
      const years = getAvailableYears()

      expect(years).toContain(2024)
      expect(years).toContain(2025)
      expect(years).toContain(2026)
    })

    it('应该包含自定义数据的年份', () => {
      addCustomHoliday('2023-01-01', '自定义', 'holiday')
      const years = getAvailableYears()

      expect(years).toContain(2023)
    })

    it('应该按降序排列', () => {
      const years = getAvailableYears()

      for (let i = 0; i < years.length - 1; i++) {
        expect(years[i]).toBeGreaterThan(years[i + 1])
      }
    })
  })

  describe('exportCustomHolidays', () => {
    it('应该导出自定义数据', () => {
      addCustomHoliday('2024-01-02', '测试', 'holiday')
      addCustomHoliday('2024-01-03', '测试', 'makeup')

      const exported = exportCustomHolidays()
      expect(exported.holidays['2024-01-02']).toBe('测试')
      expect(exported.makeupDays['2024-01-03']).toBe('测试')
    })
  })

  describe('importCustomHolidays', () => {
    it('应该导入自定义数据', () => {
      const data = {
        holidays: { '2024-01-02': '导入节日' },
        makeupDays: { '2024-01-03': '导入调休' }
      }
      importCustomHolidays(data)

      const result = loadCustomHolidays()
      expect(result).toEqual(data)
    })
  })
})