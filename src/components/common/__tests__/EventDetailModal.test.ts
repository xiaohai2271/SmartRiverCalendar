import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EventDetailModal from '../EventDetailModal.vue'
import type { CalendarEvent } from '@/types'

// 创建测试用事件数据
function createMockEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  const baseTime = new Date(2024, 5, 15, 10, 0, 0).getTime() // 2024-06-15 10:00
  return {
    id: '1',
    title: '团队周会',
    description: '讨论本周进度和下周计划',
    startTime: baseTime,
    endTime: baseTime + 3600000, // 1小时后
    allDay: false,
    calendarId: '1',
    createdAt: baseTime - 86400000,
    updatedAt: baseTime - 86400000,
    ...overrides
  }
}

// 默认全局配置：stub Teleport 以便内容渲染在 wrapper 内
const globalStubs = {
  Teleport: {
    template: '<div class="teleport-stub"><slot /></div>'
  }
}

describe('EventDetailModal 组件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('渲染', () => {
    it('当 visible 为 false 时不渲染模态框', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: false, event: null },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('当 visible 为 true 且有事件时渲染模态框', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })

    it('显示事件标题', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ title: '项目评审' }) },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.detail-title').text()).toBe('项目评审')
    })

    it('显示事件描述', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ description: '这是一个重要会议' }) },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.detail-description').text()).toBe('这是一个重要会议')
    })

    it('当描述为空时不显示描述区域', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ description: undefined }) },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.detail-description').exists()).toBe(false)
    })

    it('当描述为空字符串时不显示描述区域', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ description: '' }) },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.detail-description').exists()).toBe(false)
    })
  })

  describe('时间显示', () => {
    it('全天事件显示"全天"', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ allDay: true }) },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.detail-time').text()).toContain('全天')
    })

    it('非全天事件显示时间范围', () => {
      const startTime = new Date(2024, 5, 15, 10, 0, 0).getTime()
      const endTime = new Date(2024, 5, 15, 11, 30, 0).getTime()
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ allDay: false, startTime, endTime }) },
        global: { stubs: globalStubs }
      })
      const timeText = wrapper.find('.detail-time').text()
      expect(timeText).toContain('2024-06-15')
      expect(timeText).toContain('10:00')
      expect(timeText).toContain('11:30')
    })
  })

  describe('日历颜色条', () => {
    it('显示日历颜色条', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.calendar-color-bar').exists()).toBe(true)
    })

    it('使用日历 store 中的颜色', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ calendarId: '1' }) },
        global: { stubs: globalStubs }
      })
      const bar = wrapper.find('.calendar-color-bar')
      // 默认日历颜色为 #4A90D9
      expect(bar.attributes('style')).toContain('#4A90D9')
    })

    it('当日历不存在时使用默认颜色', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent({ calendarId: 'nonexistent' }) },
        global: { stubs: globalStubs }
      })
      const bar = wrapper.find('.calendar-color-bar')
      expect(bar.attributes('style')).toContain('#4A90D9')
    })
  })

  describe('交互', () => {
    it('点击遮罩层关闭模态框', async () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      await wrapper.find('.modal-overlay').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击关闭按钮关闭模态框', async () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      await wrapper.find('.close-btn').trigger('click')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('按 ESC 键关闭模态框', async () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      await wrapper.find('.event-detail-modal').trigger('keydown.escape')
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('点击模态框内容区域不关闭', async () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      await wrapper.find('.event-detail-modal').trigger('click')
      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('Teleport', () => {
    it('使用 Teleport 渲染到 body', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.teleport-stub').exists()).toBe(true)
    })
  })

  describe('过渡动画', () => {
    it('使用 Transition 组件包裹', () => {
      const wrapper = mount(EventDetailModal, {
        props: { visible: true, event: createMockEvent() },
        global: {
          stubs: {
            Teleport: {
              template: '<div><slot /></div>'
            },
            Transition: true // 使用浅 stub，Vue 会渲染为 transition-stub
          }
        }
      })
      // Transition stub 会渲染为 <transition-stub> 自闭合标签
      expect(wrapper.findComponent({ name: 'Transition' }).exists()).toBe(true)
    })
  })
})
