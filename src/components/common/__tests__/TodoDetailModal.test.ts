/**
 * TodoDetailModal 组件测试
 * 按照 TDD 流程编写 - 先写测试，再实现
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TodoDetailModal from '@/components/common/TodoDetailModal.vue'
import type { Todo } from '@/types'

describe('TodoDetailModal 组件', () => {
  // 测试数据 - 完整的 Todo
  const mockTodo: Todo = {
    id: 'todo-1',
    title: '完成项目报告',
    description: '需要整理 Q4 数据并撰写年度总结报告',
    dueDate: new Date(2026, 3, 30).getTime(), // 2026-04-30
    completed: false,
    priority: 'high',
    calendarId: 'cal-1',
    createdAt: new Date(2026, 3, 1).getTime(),
    updatedAt: new Date(2026, 3, 15).getTime()
  }

  // 最小 Todo - 无可选字段
  const minimalTodo: Todo = {
    id: 'todo-2',
    title: '简单待办',
    description: '',
    completed: true,
    priority: 'low',
    calendarId: 'cal-1',
    createdAt: new Date(2026, 3, 1).getTime(),
    updatedAt: new Date(2026, 3, 1).getTime()
  }

  // 每个测试前清理 DOM
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  /**
   * 测试1: visible=true 时显示模态框
   */
  it('当 visible=true 时应该显示模态框', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    expect(document.body.querySelector('.modal-overlay')).not.toBeNull()
    expect(document.body.querySelector('.todo-detail-modal')).not.toBeNull()
  })

  /**
   * 测试2: visible=false 时不显示模态框
   */
  it('当 visible=false 时不应该显示模态框', () => {
    mount(TodoDetailModal, {
      props: {
        visible: false,
        todo: mockTodo
      },
      attachTo: document.body
    })

    expect(document.body.querySelector('.modal-overlay')).toBeNull()
    expect(document.body.querySelector('.todo-detail-modal')).toBeNull()
  })

  /**
   * 测试3: 使用 Teleport 渲染到 body
   */
  it('应该使用 Teleport 将模态框渲染到 body', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    // 内容应该渲染到 body 下，而非组件挂载点内
    expect(document.body.querySelector('.modal-overlay')).not.toBeNull()
  })

  /**
   * 测试4: 正确显示标题
   */
  it('应该正确显示待办标题', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const titleEl = document.body.querySelector('.todo-title')
    expect(titleEl).not.toBeNull()
    expect(titleEl!.textContent?.trim()).toBe('完成项目报告')
  })

  /**
   * 测试5: 正确显示描述（有描述时）
   */
  it('当有待办描述时应该正确显示', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const descEl = document.body.querySelector('.todo-description')
    expect(descEl).not.toBeNull()
    expect(descEl!.textContent?.trim()).toBe('需要整理 Q4 数据并撰写年度总结报告')
  })

  /**
   * 测试6: 无描述时隐藏描述区域
   */
  it('当无待办描述时不应该显示描述区域', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: minimalTodo
      },
      attachTo: document.body
    })

    const descEl = document.body.querySelector('.todo-description')
    // 描述为空时不应该渲染
    expect(descEl).toBeNull()
  })

  /**
   * 测试7: 优先级显示为中文标签
   */
  it('应该将优先级显示为中文标签', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const badge = document.body.querySelector('.priority-badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent?.trim()).toBe('高')
    expect(badge!.classList.contains('high')).toBe(true)
  })

  /**
   * 测试8: 低优先级显示"低"
   */
  it('应该将低优先级显示为"低"', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: minimalTodo
      },
      attachTo: document.body
    })

    const badge = document.body.querySelector('.priority-badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent?.trim()).toBe('低')
    expect(badge!.classList.contains('low')).toBe(true)
  })

  /**
   * 测试9: 中优先级显示"中"
   */
  it('应该将中优先级显示为"中"', () => {
    const mediumTodo: Todo = { ...mockTodo, priority: 'medium' }
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mediumTodo
      },
      attachTo: document.body
    })

    const badge = document.body.querySelector('.priority-badge')
    expect(badge).not.toBeNull()
    expect(badge!.textContent?.trim()).toBe('中')
    expect(badge!.classList.contains('medium')).toBe(true)
  })

  /**
   * 测试10: 截止日期格式化显示
   */
  it('应该格式化显示截止日期', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const dueDateEl = document.body.querySelector('.todo-due-date')
    expect(dueDateEl).not.toBeNull()
    // formatDate 将 Date 格式化为 YYYY-MM-DD
    expect(dueDateEl!.textContent?.trim()).toContain('2026-04-30')
  })

  /**
   * 测试11: 无截止日期时隐藏
   */
  it('当无截止日期时不应该显示截止日期区域', () => {
    const noDueDateTodo: Todo = { ...mockTodo, dueDate: undefined }
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: noDueDateTodo
      },
      attachTo: document.body
    })

    const dueDateEl = document.body.querySelector('.todo-due-date')
    expect(dueDateEl).toBeNull()
  })

  /**
   * 测试12: 已完成状态显示"已完成"
   */
  it('应该将已完成待办显示为"已完成"', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: minimalTodo
      },
      attachTo: document.body
    })

    const statusEl = document.body.querySelector('.todo-status')
    expect(statusEl).not.toBeNull()
    expect(statusEl!.textContent?.trim()).toBe('已完成')
    expect(statusEl!.classList.contains('completed')).toBe(true)
  })

  /**
   * 测试13: 未完成状态显示"未完成"
   */
  it('应该将未完成待办显示为"未完成"', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const statusEl = document.body.querySelector('.todo-status')
    expect(statusEl).not.toBeNull()
    expect(statusEl!.textContent?.trim()).toBe('未完成')
    expect(statusEl!.classList.contains('pending')).toBe(true)
  })

  /**
   * 测试14: 点击遮罩层触发 close 事件
   */
  it('点击遮罩层应该触发 close 事件', async () => {
    const wrapper = mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const overlay = document.body.querySelector('.modal-overlay')
    expect(overlay).not.toBeNull()

    await overlay!.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试15: 按 ESC 触发 close 事件
   */
  it('按 ESC 键应该触发 close 事件', async () => {
    const wrapper = mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const modal = document.body.querySelector('.todo-detail-modal')
    expect(modal).not.toBeNull()

    // 触发 keydown Escape 事件
    await modal!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()

    wrapper.unmount()
  })

  /**
   * 测试16: 点击关闭按钮触发 close 事件
   */
  it('点击关闭按钮应该触发 close 事件', async () => {
    const wrapper = mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const closeBtn = document.body.querySelector('.close-btn')
    expect(closeBtn).not.toBeNull()

    await closeBtn!.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试17: todo 为 null 时不崩溃
   */
  it('当 todo 为 null 时不应该崩溃', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: null
      },
      attachTo: document.body
    })

    // 模态框应该仍然渲染
    expect(document.body.querySelector('.modal-overlay')).not.toBeNull()
    expect(document.body.querySelector('.todo-detail-modal')).not.toBeNull()
  })

  /**
   * 测试18: 使用 fluent-card 样式
   */
  it('模态框应该使用 fluent-card 样式', () => {
    mount(TodoDetailModal, {
      props: {
        visible: true,
        todo: mockTodo
      },
      attachTo: document.body
    })

    const modal = document.body.querySelector('.todo-detail-modal')
    expect(modal).not.toBeNull()
    expect(modal!.classList.contains('fluent-card')).toBe(true)
  })
})
