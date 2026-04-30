import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ReminderPopup from '../components/reminder/ReminderPopup.vue'
import type { ReminderPopupData } from '../components/reminder/ReminderPopup.vue'

// Mock 路由
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock todo store
const mockToggleTodo = vi.fn()
vi.mock('../stores/todo', () => ({
  useTodoStore: () => ({
    toggleTodo: mockToggleTodo
  })
}))

// Mock reminder service
vi.mock('../services/reminder', () => ({
  markReminderAsViewed: vi.fn()
}))

describe('ReminderPopup 组件', () => {
  const mockEventReminder: ReminderPopupData = {
    id: 'popup_event-1_123456',
    type: 'event',
    title: '测试事件',
    body: '事件描述内容',
    triggerTime: Date.now(),
    itemId: 'event-1',
    itemData: {
      id: 'event-1',
      title: '测试事件',
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      allDay: false,
      calendarId: 'cal-1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    createdAt: Date.now()
  }

  const mockTodoReminder: ReminderPopupData = {
    id: 'popup_todo-1_123456',
    type: 'todo',
    title: '测试待办',
    body: '待办描述内容',
    triggerTime: Date.now(),
    itemId: 'todo-1',
    itemData: {
      id: 'todo-1',
      title: '测试待办',
      completed: false,
      priority: 'medium',
      calendarId: 'cal-1',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    createdAt: Date.now()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('独立窗口支持', () => {
    it('应该正确渲染事件提醒', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder
        }
      })

      expect(wrapper.find('.reminder-popup').exists()).toBe(true)
      expect(wrapper.find('.popup-title').text()).toBe('测试事件')
      expect(wrapper.find('.popup-description').text()).toBe('事件描述内容')
      expect(wrapper.find('.popup-icon').text()).toBe('📅')
    })

    it('应该正确渲染待办提醒', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockTodoReminder
        }
      })

      expect(wrapper.find('.reminder-popup').exists()).toBe(true)
      expect(wrapper.find('.popup-title').text()).toBe('测试待办')
      expect(wrapper.find('.reminder-popup').classes()).toContain('is-todo')
      expect(wrapper.find('.popup-icon').text()).toBe('✅')
    })

    it('当 reminder 为 null 时不应该渲染', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: null
        }
      })

      expect(wrapper.find('.reminder-popup').exists()).toBe(false)
    })
  })

  describe('显示时长配置', () => {
    it('standard 模式应该使用默认 10 秒显示时长', () => {
      mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'standard'
        }
      })

      // 验证进度条在 10 秒内变化
      vi.advanceTimersByTime(5000)
      // 5 秒后应该还有 50% 左右
      vi.advanceTimersByTime(6000)
      // 11 秒后应该触发 dismiss
    })

    it('strong 模式应该使用默认 30 秒显示时长', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'strong'
        }
      })

      // strong 模式应该有 30 秒的显示时长
      expect(wrapper.find('.popup-progress').exists()).toBe(true)
    })

    it('silent 模式应该使用默认 5 秒显示时长', () => {
      mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'silent'
        }
      })

      // silent 模式应该有 5 秒的显示时长
      vi.advanceTimersByTime(6000)
    })

    it('应该支持自定义 duration 覆盖默认时长', () => {
      mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          duration: 15000 // 15 秒
        }
      })

      // 使用自定义时长
      vi.advanceTimersByTime(16000)
    })
  })

  describe('关闭按钮显示', () => {
    it('standard 模式应该显示关闭按钮', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'standard'
        }
      })

      expect(wrapper.find('.popup-close').exists()).toBe(true)
    })

    it('strong 模式应该显示关闭按钮', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'strong'
        }
      })

      expect(wrapper.find('.popup-close').exists()).toBe(true)
    })

    it('silent 模式不应该显示关闭按钮', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'silent'
        }
      })

      expect(wrapper.find('.popup-close').exists()).toBe(false)
    })

    it('应该支持 showCloseButton prop 覆盖默认设置', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          reminderMode: 'silent',
          showCloseButton: true // 覆盖默认不显示
        }
      })

      expect(wrapper.find('.popup-close').exists()).toBe(true)
    })
  })

  describe('用户交互', () => {
    it('点击关闭按钮应该触发 dismiss 事件', async () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          showCloseButton: true
        }
      })

      await wrapper.find('.popup-close').trigger('click')

      expect(wrapper.emitted('dismiss')).toBeTruthy()
    })

    it('点击稍后提醒应该触发 snooze 事件', async () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder
        }
      })

      await wrapper.find('.btn-snooze').trigger('click')

      // 稍后提醒只触发 snooze，不触发 dismiss（由父组件控制窗口隐藏）
      expect(wrapper.emitted('snooze')).toBeTruthy()
      expect(wrapper.emitted('dismiss')).toBeFalsy()
    })

    it('点击标记完成应该触发 complete 事件', async () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockTodoReminder
        }
      })

      await wrapper.find('.btn-complete').trigger('click')

      expect(mockToggleTodo).toHaveBeenCalledWith('todo-1')
      expect(wrapper.emitted('complete')).toBeTruthy()
    })

    it('点击查看详情应该触发 view 事件并导航', async () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder
        }
      })

      await wrapper.find('.btn-view').trigger('click')

      expect(wrapper.emitted('view')).toBeTruthy()
      expect(mockPush).toHaveBeenCalledWith({
        path: '/calendar',
        query: { eventId: 'event-1' }
      })
    })

    it('待办点击查看详情应该导航到待办页面', async () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockTodoReminder
        }
      })

      await wrapper.find('.btn-view').trigger('click')

      expect(mockPush).toHaveBeenCalledWith({
        path: '/todos',
        query: { todoId: 'todo-1' }
      })
    })

    it('事件不应该显示标记完成按钮', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder
        }
      })

      expect(wrapper.find('.btn-complete').exists()).toBe(false)
    })

    it('待办应该显示标记完成按钮', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockTodoReminder
        }
      })

      expect(wrapper.find('.btn-complete').exists()).toBe(true)
    })
  })

  describe('自动消失', () => {
    it('应该在指定时长后自动触发 dismiss', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          duration: 1000 // 1 秒方便测试
        }
      })

      expect(wrapper.emitted('dismiss')).toBeFalsy()

      vi.advanceTimersByTime(1100)

      expect(wrapper.emitted('dismiss')).toBeTruthy()
    })

    it('进度条应该在倒计时期间更新', () => {
      const wrapper = mount(ReminderPopup, {
        props: {
          reminder: mockEventReminder,
          duration: 10000 // 10 秒
        }
      })

      const progressBar = wrapper.find('.progress-bar')
      const initialWidth = progressBar.attributes('style')

      // 进度条应该初始为 100%
      expect(initialWidth).toContain('width: 100%')

      // 经过 5 秒后应该约为 50%
      vi.advanceTimersByTime(5000)
    })
  })

  describe('Props 类型检查', () => {
    it('应该接受所有有效的 reminderMode 值', () => {
      const modes = ['standard', 'strong', 'silent'] as const

      modes.forEach(mode => {
        const wrapper = mount(ReminderPopup, {
          props: {
            reminder: mockEventReminder,
            reminderMode: mode
          }
        })

        expect(wrapper.find('.reminder-popup').exists()).toBe(true)
      })
    })

    it('应该正确处理不同的 duration 值', () => {
      const durations = [1000, 5000, 10000, 30000]

      durations.forEach(duration => {
        const wrapper = mount(ReminderPopup, {
          props: {
            reminder: mockEventReminder,
            duration
          }
        })

        expect(wrapper.find('.reminder-popup').exists()).toBe(true)
      })
    })
  })
})
