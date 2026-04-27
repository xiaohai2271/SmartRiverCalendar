/**
 * ConfirmPopover 组件测试
 * 气泡确认框 - 轻量级非模态确认组件，用于删除等危险操作
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ConfirmPopover from '@/components/common/ConfirmPopover.vue'

describe('ConfirmPopover 组件', () => {
  // 默认的 targetRect
  const defaultTargetRect: DOMRect = {
    x: 100,
    y: 200,
    width: 120,
    height: 32,
    top: 200,
    left: 100,
    right: 220,
    bottom: 232,
    toJSON: () => ({})
  }

  // 每个测试前清理 DOM
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // 每个测试后清理
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /**
   * 测试1: visible=true 时显示气泡
   */
  it('当 visible=true 时应该显示气泡', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    expect(document.body.querySelector('.confirm-popover')).not.toBeNull()
  })

  /**
   * 测试2: visible=false 时不显示气泡
   */
  it('当 visible=false 时不应该显示气泡', () => {
    mount(ConfirmPopover, {
      props: {
        visible: false,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    expect(document.body.querySelector('.confirm-popover')).toBeNull()
  })

  /**
   * 测试3: 正确渲染确认消息
   */
  it('应该正确渲染确认消息', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除此日程？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const messageEl = document.body.querySelector('.confirm-popover-message')
    expect(messageEl).not.toBeNull()
    expect(messageEl!.textContent).toBe('确认删除此日程？')
  })

  /**
   * 测试4: 默认按钮文本为"确认"和"取消"
   */
  it('默认按钮文本应该为"确认"和"取消"', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const confirmBtn = document.body.querySelector('.confirm-popover-btn-confirm') as HTMLButtonElement
    const cancelBtn = document.body.querySelector('.confirm-popover-btn-cancel') as HTMLButtonElement

    expect(confirmBtn).not.toBeNull()
    expect(cancelBtn).not.toBeNull()
    expect(confirmBtn.textContent?.trim()).toBe('确认')
    expect(cancelBtn.textContent?.trim()).toBe('取消')
  })

  /**
   * 测试5: 自定义按钮文本
   */
  it('应该支持自定义按钮文本', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect,
        confirmText: '删除',
        cancelText: '再想想'
      },
      attachTo: document.body
    })

    const confirmBtn = document.body.querySelector('.confirm-popover-btn-confirm') as HTMLButtonElement
    const cancelBtn = document.body.querySelector('.confirm-popover-btn-cancel') as HTMLButtonElement

    expect(confirmBtn.textContent?.trim()).toBe('删除')
    expect(cancelBtn.textContent?.trim()).toBe('再想想')
  })

  /**
   * 测试6: 点击确认按钮触发 confirm 事件
   */
  it('点击确认按钮应该触发 confirm 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const confirmBtn = document.body.querySelector('.confirm-popover-btn-confirm') as HTMLButtonElement
    expect(confirmBtn).not.toBeNull()

    await confirmBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('confirm')).toBeTruthy()
    expect(wrapper.emitted('confirm')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试7: 点击取消按钮触发 cancel 事件
   */
  it('点击取消按钮应该触发 cancel 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const cancelBtn = document.body.querySelector('.confirm-popover-btn-cancel') as HTMLButtonElement
    expect(cancelBtn).not.toBeNull()

    await cancelBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()
    expect(wrapper.emitted('cancel')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试8: 点击确认按钮触发 update:visible 事件 (false)
   */
  it('点击确认按钮应该触发 update:visible 事件并传 false', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const confirmBtn = document.body.querySelector('.confirm-popover-btn-confirm') as HTMLButtonElement
    await confirmBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])

    wrapper.unmount()
  })

  /**
   * 测试9: 点击取消按钮触发 update:visible 事件 (false)
   */
  it('点击取消按钮应该触发 update:visible 事件并传 false', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const cancelBtn = document.body.querySelector('.confirm-popover-btn-cancel') as HTMLButtonElement
    await cancelBtn.dispatchEvent(new Event('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('update:visible')).toBeTruthy()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])

    wrapper.unmount()
  })

  /**
   * 测试10: 使用 Teleport 渲染到 body
   */
  it('应该使用 Teleport 将气泡渲染到 body', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    // 气泡应该渲染到 body 层级，不在组件挂载点内
    expect(document.body.querySelector('.confirm-popover')).not.toBeNull()
  })

  /**
   * 测试11: 气泡位置基于 targetRect 定位
   */
  it('气泡位置应该基于 targetRect 定位', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: { x: 300, y: 400, width: 120, height: 32, top: 400, left: 300, right: 420, bottom: 432, toJSON: () => ({}) } as DOMRect
      },
      attachTo: document.body
    })

    const popover = document.body.querySelector('.confirm-popover') as HTMLElement
    expect(popover).not.toBeNull()
    // 应该有 position: fixed 样式
    const style = popover.style
    expect(style.position).toBe('fixed')
    // left 值应该基于 targetRect.x 计算
    expect(style.left).toBeTruthy()
    expect(style.top).toBeTruthy()
  })

  /**
   * 测试12: targetRect 为 null 时不显示气泡
   */
  it('当 targetRect 为 null 时不应该显示气泡', () => {
    mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: null
      },
      attachTo: document.body
    })

    expect(document.body.querySelector('.confirm-popover')).toBeNull()
  })

  /**
   * 测试13: 点击气泡外部触发 cancel 事件
   */
  it('点击气泡外部应该触发 cancel 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    // 模拟点击气泡外部（document 上的点击事件）
    // 使用 capture 阶段触发，与 PopupContextMenu 模式一致
    const outsideEl = document.createElement('div')
    document.body.appendChild(outsideEl)
    await outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()

    wrapper.unmount()
  })

  /**
   * 测试14: 按 ESC 键触发 cancel 事件
   */
  it('按 ESC 键应该触发 cancel 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const popover = document.body.querySelector('.confirm-popover') as HTMLElement
    expect(popover).not.toBeNull()

    // 触发 ESC 键盘事件
    await popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('cancel')).toBeTruthy()

    wrapper.unmount()
  })

  /**
   * 测试15: ESC 不触发 confirm 事件（只触发 cancel）
   */
  it('按 ESC 键不应该触发 confirm 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    const popover = document.body.querySelector('.confirm-popover') as HTMLElement
    await popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    // confirm 不应该被触发
    expect(wrapper.emitted('confirm')).toBeFalsy()
    // cancel 应该被触发
    expect(wrapper.emitted('cancel')).toBeTruthy()

    wrapper.unmount()
  })

  /**
   * 测试16: 点击外部不触发 confirm 事件（只触发 cancel）
   */
  it('点击外部不应该触发 confirm 事件', async () => {
    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    // 点击外部
    const outsideEl = document.createElement('div')
    document.body.appendChild(outsideEl)
    await outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    // confirm 不应该被触发
    expect(wrapper.emitted('confirm')).toBeFalsy()
    // cancel 应该被触发
    expect(wrapper.emitted('cancel')).toBeTruthy()

    wrapper.unmount()
  })

  /**
   * 测试17: 组件卸载时清理事件监听
   */
  it('组件卸载时应该清理 click-outside 事件监听', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const wrapper = mount(ConfirmPopover, {
      props: {
        visible: true,
        message: '确认删除？',
        targetRect: defaultTargetRect
      },
      attachTo: document.body
    })

    // 应该注册了 click 事件监听
    const clickCalls = addSpy.mock.calls.filter(call => call[0] === 'click')
    expect(clickCalls.length).toBeGreaterThan(0)

    // 卸载组件
    wrapper.unmount()

    // 应该移除了 click 事件监听
    const removeClickCalls = removeSpy.mock.calls.filter(call => call[0] === 'click')
    expect(removeClickCalls.length).toBeGreaterThan(0)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
