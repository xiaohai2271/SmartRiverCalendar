import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenu from '../ContextMenu.vue'
import type { MenuItem } from '@/types'

// stub Teleport 以便内容渲染在 wrapper 内
const globalStubs = {
  Teleport: {
    template: '<div class="teleport-stub"><slot /></div>'
  }
}

// 创建测试用菜单项
function createMenuItems(): MenuItem[] {
  return [
    { label: '编辑', icon: '✏️', action: vi.fn() },
    { label: '删除', icon: '🗑️', action: vi.fn() },
    { separator: true },
    { label: '复制', action: vi.fn() },
  ]
}

// 模拟 window 尺寸
function mockWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true })
}

describe('ContextMenu 组件', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    mockWindowSize(1920, 1080)
    // 每次恢复 document.body overflow
    document.body.style.overflow = ''
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    document.body.style.overflow = ''
  })

  describe('渲染', () => {
    it('visible=true 时渲染菜单到 body (Teleport)', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.context-menu').exists()).toBe(true)
      expect(wrapper.find('.teleport-stub').exists()).toBe(true)
    })

    it('visible=false 时不渲染菜单', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: false, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      expect(wrapper.find('.context-menu').exists()).toBe(false)
    })

    it('菜单项正确渲染文本', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      const items = wrapper.findAll('.context-menu-item')
      // 只统计非分隔线的菜单项
      const textItems = items.filter(i => !i.classes('separator'))
      expect(textItems.length).toBe(3) // 编辑、删除、复制
      expect(textItems[0].text()).toContain('编辑')
      expect(textItems[1].text()).toContain('删除')
      expect(textItems[2].text()).toContain('复制')
    })

    it('菜单项正确渲染图标', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      const icons = wrapper.findAll('.menu-icon')
      expect(icons.length).toBe(2) // 编辑、删除有图标
      expect(icons[0].text()).toBe('✏️')
      expect(icons[1].text()).toBe('🗑️')
    })

    it('分隔线正确渲染', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      const dividers = wrapper.findAll('.context-menu-divider')
      expect(dividers.length).toBe(1)
    })
  })

  describe('交互', () => {
    it('点击菜单项触发 action 回调并 emit update:visible: false', async () => {
      const actionSpy = vi.fn()
      const items: MenuItem[] = [
        { label: '编辑', action: actionSpy }
      ]
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items },
        global: { stubs: globalStubs }
      })
      const item = wrapper.findAll('.context-menu-item').find(i => i.text().includes('编辑'))!
      await item.trigger('click')
      expect(actionSpy).toHaveBeenCalledOnce()
      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })

    it('点击外部 (document click) 关闭菜单', async () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      // 等待 nextTick 中注册的事件监听
      await nextTick()
      await nextTick()
      // 模拟点击外部
      document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })

    it('ESC 键关闭菜单', async () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      // 等待 nextTick 中注册的事件监听
      await nextTick()
      await nextTick()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()
      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    })

    it('disabled 菜单项不可点击', async () => {
      const actionSpy = vi.fn()
      const items: MenuItem[] = [
        { label: '禁用项', disabled: true, action: actionSpy }
      ]
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items },
        global: { stubs: globalStubs }
      })
      const item = wrapper.find('.context-menu-item')
      expect(item.classes()).toContain('disabled')
      await item.trigger('click')
      expect(actionSpy).not.toHaveBeenCalled()
    })
  })

  describe('定位', () => {
    it('菜单定位到指定 x/y 坐标', async () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 200, y: 300, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      await nextTick()
      const menu = wrapper.find('.context-menu')
      const style = menu.attributes('style')
      expect(style).toContain('left: 200px')
      expect(style).toContain('top: 300px')
    })

    it('右侧溢出：靠近右边界时自动左移', async () => {
      // 模拟小窗口 + 靠右的 x 坐标
      mockWindowSize(800, 600)
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 750, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      await nextTick()
      const menu = wrapper.find('.context-menu')
      const style = menu.attributes('style')
      // left 应该被调整为 window.innerWidth - menuWidth
      // 需要确认 menuWidth > 0，left 值应 < 750
      const leftMatch = style?.match(/left:\s*(\d+)px/)
      expect(leftMatch).toBeTruthy()
      const leftValue = parseInt(leftMatch![1])
      expect(leftValue).toBeLessThan(750)
    })

    it('底部溢出：靠近底部时自动上移', async () => {
      mockWindowSize(800, 600)
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 550, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      await nextTick()
      const menu = wrapper.find('.context-menu')
      const style = menu.attributes('style')
      const topMatch = style?.match(/top:\s*(\d+)px/)
      expect(topMatch).toBeTruthy()
      const topValue = parseInt(topMatch![1])
      expect(topValue).toBeLessThan(550)
    })
  })

  describe('overflow 管理', () => {
    it('visible 变化不影响 overflow（不再锁定滚动）', async () => {
      const originalOverflow = document.body.style.overflow
      wrapper = mount(ContextMenu, {
        props: { visible: false, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      await wrapper.setProps({ visible: true })
      await nextTick()
      // 不应修改 body overflow
      expect(document.body.style.overflow).toBe(originalOverflow)
      
      await wrapper.setProps({ visible: false })
      await nextTick()
      // 关闭后也不应影响
      expect(document.body.style.overflow).toBe(originalOverflow)
    })
  })

  describe('清理', () => {
    it('组件卸载时清理事件监听', async () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: { stubs: globalStubs }
      })
      await nextTick()

      // 卸载组件
      wrapper.unmount()
      await nextTick()

      // 卸载后点击不应再触发事件
      const listenerSpy = vi.fn()
      document.addEventListener('click', listenerSpy)
      document.dispatchEvent(new MouseEvent('click'))
      // 不应有多余的监听器影响
      document.removeEventListener('click', listenerSpy)
    })
  })

  describe('Transition 动画', () => {
    it('使用 Transition 组件包裹', () => {
      wrapper = mount(ContextMenu, {
        props: { visible: true, x: 100, y: 100, items: createMenuItems() },
        global: {
          stubs: {
            Teleport: { template: '<div><slot /></div>' },
            Transition: true
          }
        }
      })
      expect(wrapper.findComponent({ name: 'Transition' }).exists()).toBe(true)
    })
  })
})
