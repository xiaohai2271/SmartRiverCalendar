import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, VueWrapper } from '@vue/test-utils'
import ConfirmPopover from '../ConfirmPopover.vue'

describe('ConfirmPopover 组件', () => {
  // 创建一个模拟的目标元素
  let targetElement: HTMLElement
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    // 创建并添加目标元素到 document.body
    targetElement = document.createElement('button')
    targetElement.textContent = '删除按钮'
    document.body.appendChild(targetElement)
  })

  afterEach(() => {
    // 卸载组件
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    
    // 清理 Teleport 渲染到 body 的 popover
    const popovers = document.querySelectorAll('.confirm-popover')
    popovers.forEach(p => p.remove())
    
    // 清理目标元素
    if (targetElement && document.body.contains(targetElement)) {
      document.body.removeChild(targetElement)
    }
    vi.restoreAllMocks()
  })

  describe('组件渲染', () => {
    it('当 visible 为 false 时不应该渲染', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: false
        }
      })
      
      await flushPromises()
      
      // 组件使用 Teleport，需要检查 body
      const popover = document.querySelector('.confirm-popover')
      expect(popover).toBeNull()
    })

    it('当 visible 为 true 时应该渲染', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const popover = document.querySelector('.confirm-popover')
      expect(popover).not.toBeNull()
    })

    it('应该正确渲染确认和取消按钮', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const cancelBtn = document.querySelector('.confirm-popover__btn--cancel')
      const confirmBtn = document.querySelector('.confirm-popover__btn--confirm')
      
      expect(cancelBtn).not.toBeNull()
      expect(confirmBtn).not.toBeNull()
      expect(cancelBtn?.textContent).toBe('取消')
      expect(confirmBtn?.textContent).toBe('确认')
    })
  })

  describe('提示文案显示', () => {
    it('应该显示默认提示文案', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const title = document.querySelector('.confirm-popover__title')
      expect(title?.textContent).toBe('确定要删除吗？')
    })

    it('应该显示自定义提示文案', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          title: '确定要清空所有数据吗？'
        }
      })
      
      await flushPromises()
      
      const title = document.querySelector('.confirm-popover__title')
      expect(title?.textContent).toBe('确定要清空所有数据吗？')
    })

    it('应该显示自定义按钮文本', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          confirmText: '删除',
          cancelText: '不了'
        }
      })
      
      await flushPromises()
      
      const cancelBtn = document.querySelector('.confirm-popover__btn--cancel')
      const confirmBtn = document.querySelector('.confirm-popover__btn--confirm')
      
      expect(cancelBtn?.textContent).toBe('不了')
      expect(confirmBtn?.textContent).toBe('删除')
    })
  })

  describe('点击事件处理', () => {
    it('点击确认按钮应该触发 confirm 事件', async () => {
      const onConfirm = vi.fn()
      
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          onConfirm
        }
      })
      
      await flushPromises()
      
      const confirmBtn = document.querySelector('.confirm-popover__btn--confirm') as HTMLElement
      confirmBtn?.click()
      
      expect(onConfirm).toHaveBeenCalledTimes(1)
    })

    it('点击确认按钮应该触发 update:visible 事件并设为 false', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const confirmBtn = document.querySelector('.confirm-popover__btn--confirm') as HTMLElement
      confirmBtn?.click()
      
      const emitted = wrapper.emitted()
      expect(emitted['update:visible']).toBeTruthy()
      expect(emitted['update:visible'][0]).toEqual([false])
    })

    it('点击取消按钮应该触发 cancel 事件', async () => {
      const onCancel = vi.fn()
      
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          onCancel
        }
      })
      
      await flushPromises()
      
      const cancelBtn = document.querySelector('.confirm-popover__btn--cancel') as HTMLElement
      cancelBtn?.click()
      
      expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('点击取消按钮应该触发 update:visible 事件并设为 false', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const cancelBtn = document.querySelector('.confirm-popover__btn--cancel') as HTMLElement
      cancelBtn?.click()
      
      const emitted = wrapper.emitted()
      expect(emitted['update:visible']).toBeTruthy()
      expect(emitted['update:visible'][0]).toEqual([false])
    })
  })

  describe('点击外部关闭', () => {
    it('点击气泡外部应该触发 cancel 事件', async () => {
      const onCancel = vi.fn()
      
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          onCancel
        }
      })
      
      await flushPromises()
      
      // 模拟点击外部（document.body）
      document.body.click()
      
      expect(onCancel).toHaveBeenCalled()
    })

    it('点击气泡内部不应该触发 cancel 事件', async () => {
      const onCancel = vi.fn()
      
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          onCancel
        }
      })
      
      await flushPromises()
      
      // 点击气泡内部
      const popover = document.querySelector('.confirm-popover') as HTMLElement
      popover?.click()
      
      expect(onCancel).not.toHaveBeenCalled()
    })

    it('点击目标元素不应该触发 cancel 事件', async () => {
      const onCancel = vi.fn()
      
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement,
          onCancel
        }
      })
      
      await flushPromises()
      
      // 点击目标元素
      targetElement.click()
      
      expect(onCancel).not.toHaveBeenCalled()
    })
  })

  describe('位置计算', () => {
    it('当 visible 变为 true 时应该计算位置', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: false,
          target: targetElement
        }
      })
      
      // 设置目标元素位置
      Object.defineProperty(targetElement, 'getBoundingClientRect', {
        value: () => ({
          top: 100,
          bottom: 130,
          left: 50,
          right: 150,
          width: 100,
          height: 30,
          x: 50,
          y: 100,
          toJSON: () => ({})
        })
      })
      
      // 设置 window 尺寸
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(800)
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600)
      
      await wrapper.setProps({ visible: true })
      await flushPromises()
      
      const popover = document.querySelector('.confirm-popover') as HTMLElement
      expect(popover).not.toBeNull()
      // 位置应该被设置
      expect(popover?.style.position).toBe('fixed')
    })

    it('没有 target 时不应该报错', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: null
        }
      })
      
      await flushPromises()
      
      // 组件应该正常渲染，不报错
      const popover = document.querySelector('.confirm-popover')
      expect(popover).not.toBeNull()
    })
  })

  describe('Props 默认值', () => {
    it('应该使用默认的 title 值', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const title = document.querySelector('.confirm-popover__title')
      expect(title?.textContent).toBe('确定要删除吗？')
    })

    it('应该使用默认的 confirmText 值', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const confirmBtn = document.querySelector('.confirm-popover__btn--confirm')
      expect(confirmBtn?.textContent).toBe('确认')
    })

    it('应该使用默认的 cancelText 值', async () => {
      wrapper = mount(ConfirmPopover, {
        props: {
          visible: true,
          target: targetElement
        }
      })
      
      await flushPromises()
      
      const cancelBtn = document.querySelector('.confirm-popover__btn--cancel')
      expect(cancelBtn?.textContent).toBe('取消')
    })
  })
})
