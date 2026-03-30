import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EventDetailModal from '../EventDetailModal.vue'
import type { CalendarEvent, Calendar } from '@/types'

// Mock date 工具函数
vi.mock('@/utils/date', () => ({
  formatDateLocale: vi.fn((date: Date) => {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }),
  formatTime: vi.fn((date: Date) => {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  })
}))

// Mock calendar store
const mockCalendars: Calendar[] = [
  {
    id: 'cal-1',
    name: '工作日历',
    color: '#3b82f6',
    type: 'local',
    visible: true,
    syncEnabled: false
  },
  {
    id: 'cal-2',
    name: '个人日历',
    color: '#10b981',
    type: 'local',
    visible: true,
    syncEnabled: false
  }
]

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => ({
    calendars: mockCalendars
  })
}))

describe('EventDetailModal 组件', () => {
  let wrapper: VueWrapper

  const mockEvent: CalendarEvent = {
    id: 'event-1',
    title: '测试日程事件',
    description: '这是日程描述',
    startTime: new Date('2024-03-15T10:00:00').getTime(),
    endTime: new Date('2024-03-15T11:30:00').getTime(),
    allDay: false,
    calendarId: 'cal-1',
    createdAt: new Date('2024-03-01').getTime(),
    updatedAt: new Date('2024-03-01').getTime()
  }

  const allDayEvent: CalendarEvent = {
    id: 'event-2',
    title: '全天事件',
    description: '全天事件描述',
    startTime: new Date('2024-03-15T00:00:00').getTime(),
    endTime: new Date('2024-03-15T23:59:59').getTime(),
    allDay: true,
    calendarId: 'cal-2',
    createdAt: new Date('2024-03-01').getTime(),
    updatedAt: new Date('2024-03-01').getTime()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mountComponent = (props = {}) => {
    return mount(EventDetailModal, {
      props: {
        visible: true,
        event: mockEvent,
        ...props
      },
      global: {
        stubs: {
          Teleport: {
            template: '<div><slot /></div>'
          }
        }
      }
    })
  }

  describe('数据显示测试', () => {
    it('应该正确显示事件标题', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.title-value').text()).toBe('测试日程事件')
    })

    it('应该正确显示开始时间（非全天事件）', () => {
      wrapper = mountComponent()
      const detailRows = wrapper.findAll('.detail-row')
      const startTimeRow = detailRows.find(row => 
        row.find('.detail-label').text() === '开始时间'
      )
      expect(startTimeRow).toBeDefined()
      const value = startTimeRow!.find('.detail-value').text()
      expect(value).toContain('2024/3/15')
      expect(value).toContain('10:00')
    })

    it('应该正确显示结束时间', () => {
      wrapper = mountComponent()
      const detailRows = wrapper.findAll('.detail-row')
      const endTimeRow = detailRows.find(row => 
        row.find('.detail-label').text() === '结束时间'
      )
      expect(endTimeRow).toBeDefined()
      const value = endTimeRow!.find('.detail-value').text()
      expect(value).toContain('2024/3/15')
      expect(value).toContain('11:30')
    })

    it('应该正确显示全天事件的时间', () => {
      wrapper = mountComponent({
        event: allDayEvent
      })
      const detailRows = wrapper.findAll('.detail-row')
      const startTimeRow = detailRows.find(row => 
        row.find('.detail-label').text() === '开始时间'
      )
      // 全天事件不显示时间，只显示日期
      expect(startTimeRow!.find('.detail-value').text()).toContain('2024/3/15')
      // 应该显示全天标签
      expect(startTimeRow!.find('.all-day-tag').exists()).toBe(true)
      expect(startTimeRow!.find('.all-day-tag').text()).toBe('全天')
    })

    it('应该正确显示日历名称和颜色', () => {
      wrapper = mountComponent()
      const detailRows = wrapper.findAll('.detail-row')
      const calendarRow = detailRows.find(row => 
        row.find('.detail-label').text() === '日历'
      )
      expect(calendarRow).toBeDefined()
      const calendarBadge = calendarRow!.find('.calendar-badge')
      expect(calendarBadge.text()).toBe('工作日历')
      // 检查边框颜色样式（CSS 属性使用 kebab-case）
      expect(calendarBadge.attributes('style')).toContain('border-left-color')
    })

    it('应该正确显示描述内容', () => {
      wrapper = mountComponent()
      const detailRows = wrapper.findAll('.detail-row')
      const descRow = detailRows.find(row => 
        row.find('.detail-label').text() === '描述'
      )
      expect(descRow).toBeDefined()
      expect(descRow!.find('.detail-value').text()).toBe('这是日程描述')
    })

    it('当没有描述时显示无', () => {
      wrapper = mountComponent({
        event: { ...mockEvent, description: undefined }
      })
      const detailRows = wrapper.findAll('.detail-row')
      const descRow = detailRows.find(row => 
        row.find('.detail-label').text() === '描述'
      )
      expect(descRow!.find('.detail-value').text()).toBe('无')
    })

    it('当日历不存在时显示未知日历', () => {
      wrapper = mountComponent({
        event: { ...mockEvent, calendarId: 'non-existent' }
      })
      const detailRows = wrapper.findAll('.detail-row')
      const calendarRow = detailRows.find(row => 
        row.find('.detail-label').text() === '日历'
      )
      expect(calendarRow!.find('.detail-value').text()).toContain('未知日历')
    })

    it('当 event 为 null 时不显示弹窗内容', () => {
      wrapper = mountComponent({
        event: null
      })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })
  })

  describe('关闭功能测试', () => {
    it('点击关闭按钮应该触发 close 事件', async () => {
      wrapper = mountComponent()
      const closeBtn = wrapper.find('.close-btn')
      await closeBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('点击底部关闭按钮应该触发 close 事件', async () => {
      wrapper = mountComponent()
      const footerCloseBtn = wrapper.find('.modal-footer .fluent-button')
      await footerCloseBtn.trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击遮罩层应该触发 close 事件', async () => {
      wrapper = mountComponent()
      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click.self')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('按 Escape 键应该触发 close 事件', async () => {
      wrapper = mountComponent()
      const modal = wrapper.find('.event-modal')
      await modal.trigger('keydown.escape')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('显示控制测试', () => {
    it('visible 为 false 时不显示弹窗', () => {
      wrapper = mountComponent({ visible: false })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('visible 为 true 且 event 不为 null 时显示弹窗', () => {
      wrapper = mountComponent({ visible: true, event: mockEvent })
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })

    it('visible 为 true 但 event 为 null 时不显示弹窗', () => {
      wrapper = mountComponent({ visible: true, event: null })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })
  })
})
