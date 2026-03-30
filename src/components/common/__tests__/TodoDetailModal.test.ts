import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TodoDetailModal from '../TodoDetailModal.vue'
import type { Todo } from '@/types'

// Mock formatDateLocale 工具函数
vi.mock('@/utils/date', () => ({
  formatDateLocale: vi.fn((date: Date) => {
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  })
}))

describe('TodoDetailModal 组件', () => {
  let wrapper: VueWrapper

  const mockTodo: Todo = {
    id: 'todo-1',
    title: '测试待办事项',
    description: '这是待办描述',
    dueDate: new Date('2024-03-15').getTime(),
    completed: false,
    priority: 'high',
    calendarId: 'cal-1',
    createdAt: new Date('2024-03-01T10:00:00').getTime(),
    updatedAt: new Date('2024-03-01T10:00:00').getTime()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mountComponent = (props = {}) => {
    return mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo,
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
    it('应该正确显示待办标题', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.title-value').text()).toBe('测试待办事项')
    })

    it('应该正确显示完成状态（未完成）', () => {
      wrapper = mountComponent()
      const statusBadge = wrapper.find('.status-badge')
      expect(statusBadge.exists()).toBe(true)
      expect(statusBadge.text()).toBe('未完成')
      expect(statusBadge.classes()).toContain('pending')
    })

    it('应该正确显示完成状态（已完成）', () => {
      wrapper = mountComponent({
        todo: { ...mockTodo, completed: true }
      })
      const statusBadge = wrapper.find('.status-badge')
      expect(statusBadge.text()).toBe('已完成')
      expect(statusBadge.classes()).toContain('completed')
    })

    it('应该正确显示高优先级标签', () => {
      wrapper = mountComponent()
      const priorityBadge = wrapper.find('.priority-badge')
      expect(priorityBadge.text()).toBe('高')
      expect(priorityBadge.classes()).toContain('priority-high')
    })

    it('应该正确显示中优先级标签', () => {
      wrapper = mountComponent({
        todo: { ...mockTodo, priority: 'medium' }
      })
      const priorityBadge = wrapper.find('.priority-badge')
      expect(priorityBadge.text()).toBe('中')
      expect(priorityBadge.classes()).toContain('priority-medium')
    })

    it('应该正确显示低优先级标签', () => {
      wrapper = mountComponent({
        todo: { ...mockTodo, priority: 'low' }
      })
      const priorityBadge = wrapper.find('.priority-badge')
      expect(priorityBadge.text()).toBe('低')
      expect(priorityBadge.classes()).toContain('priority-low')
    })

    it('应该正确显示截止日期', () => {
      wrapper = mountComponent()
      const detailItems = wrapper.findAll('.detail-item')
      // 查找截止日期项
      const dueDateItem = detailItems.find(item => 
        item.find('.detail-label').text() === '截止日期'
      )
      expect(dueDateItem).toBeDefined()
      expect(dueDateItem!.find('.detail-value').text()).toContain('2024/3/15')
    })

    it('应该正确显示描述内容', () => {
      wrapper = mountComponent()
      const descriptionItem = wrapper.findAll('.detail-item').find(
        item => item.find('.detail-label').text() === '描述'
      )
      expect(descriptionItem).toBeDefined()
      expect(descriptionItem!.find('.description-value').text()).toBe('这是待办描述')
    })

    it('当没有描述时不显示描述项', () => {
      wrapper = mountComponent({
        todo: { ...mockTodo, description: undefined }
      })
      const detailItems = wrapper.findAll('.detail-item')
      const descriptionItem = detailItems.find(item => 
        item.find('.detail-label').text() === '描述'
      )
      expect(descriptionItem).toBeUndefined()
    })

    it('当没有截止日期时显示未设置', () => {
      wrapper = mountComponent({
        todo: { ...mockTodo, dueDate: undefined }
      })
      const detailItems = wrapper.findAll('.detail-item')
      const dueDateItem = detailItems.find(item => 
        item.find('.detail-label').text() === '截止日期'
      )
      expect(dueDateItem!.find('.detail-value').text()).toBe('未设置')
    })

    it('当 todo 为 null 时不显示内容', () => {
      wrapper = mountComponent({
        todo: null
      })
      expect(wrapper.find('.modal-body').exists()).toBe(false)
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
      const modal = wrapper.find('.detail-modal')
      await modal.trigger('keydown.escape')
      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('显示控制测试', () => {
    it('visible 为 false 时不显示弹窗', () => {
      wrapper = mountComponent({ visible: false })
      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('visible 为 true 时显示弹窗', () => {
      wrapper = mountComponent({ visible: true })
      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    })
  })
})
