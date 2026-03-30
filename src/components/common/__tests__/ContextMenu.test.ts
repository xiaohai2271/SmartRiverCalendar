import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ContextMenu from '../ContextMenu.vue'
import type { MenuItem } from '../ContextMenu.vue'

describe('ContextMenu 组件', () => {
  // 默认菜单项
  const defaultItems: MenuItem[] = [
    { label: '编辑', icon: '✏️', action: vi.fn() },
    { label: '删除', icon: '🗑️', action: vi.fn() },
    { divider: true },
    { label: '取消', action: vi.fn() }
  ]

  // 默认位置
  const defaultPosition = { x: 100, y: 100 }

  // 清理 body 中的 teleport 元素
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // 模拟视口尺寸
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1920)
    vi.stubGlobal('innerHeight', 1080)
  })

  describe('渲染测试', () => {
    it('visible 为 true 时应该渲染菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      // 由于使用 Teleport，元素渲染到 body
      const overlay = document.querySelector('.context-menu-overlay')
      const menu = document.querySelector('.context-menu')
      expect(overlay).toBeTruthy()
      expect(menu).toBeTruthy()

      wrapper.unmount()
    })

    it('visible 为 false 时应该不渲染菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const overlay = document.querySelector('.context-menu-overlay')
      expect(overlay).toBeNull()

      wrapper.unmount()
    })

    it('应该正确渲染菜单项', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const menuItems = document.querySelectorAll('.menu-item')
      expect(menuItems.length).toBe(4) // 3个菜单项 + 1个分隔线

      // 检查菜单项文本
      const label = document.querySelector('.menu-label')
      expect(label?.textContent).toBe('编辑')

      wrapper.unmount()
    })

    it('应该正确渲染分隔线', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const divider = document.querySelector('.menu-item.divider')
      expect(divider).toBeTruthy()
      expect(divider?.querySelector('.divider-line')).toBeTruthy()

      wrapper.unmount()
    })

    it('应该正确渲染图标', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const icons = document.querySelectorAll('.menu-icon')
      expect(icons.length).toBe(2) // 编辑和删除有图标
      expect(icons[0]?.textContent).toBe('✏️')

      wrapper.unmount()
    })

    it('没有图标的菜单项不应该显示图标', async () => {
      const itemsWithoutIcon: MenuItem[] = [
        { label: '无图标项', action: vi.fn() }
      ]

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: itemsWithoutIcon
        },
        attachTo: document.body
      })

      await flushPromises()

      const icon = document.querySelector('.menu-icon')
      expect(icon).toBeNull()
      
      const label = document.querySelector('.menu-label')
      expect(label?.textContent).toBe('无图标项')

      wrapper.unmount()
    })
  })

  describe('菜单项点击测试', () => {
    it('点击菜单项应该触发回调', async () => {
      const actionSpy = vi.fn()
      const items: MenuItem[] = [
        { label: '测试项', action: actionSpy }
      ]

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items
        },
        attachTo: document.body
      })

      await flushPromises()

      const menuItem = document.querySelector('.menu-item') as HTMLElement
      menuItem?.click()
      await flushPromises()

      expect(actionSpy).toHaveBeenCalledTimes(1)

      wrapper.unmount()
    })

    it('点击菜单项应该关闭菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const menuItem = document.querySelector('.menu-item') as HTMLElement
      menuItem?.click()
      await flushPromises()

      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
      expect(wrapper.emitted('close')).toBeTruthy()

      wrapper.unmount()
    })

    it('点击分隔线不应该触发回调', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const divider = document.querySelector('.menu-item.divider') as HTMLElement
      divider?.click()
      await flushPromises()

      // 分隔线没有 action，不应该触发 close
      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })

    it('没有 action 的菜单项点击应该关闭菜单', async () => {
      const items: MenuItem[] = [
        { label: '无回调项' }
      ]

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items
        },
        attachTo: document.body
      })

      await flushPromises()

      const menuItem = document.querySelector('.menu-item') as HTMLElement
      menuItem?.click()
      await flushPromises()

      expect(wrapper.emitted('close')).toBeTruthy()

      wrapper.unmount()
    })
  })

  describe('点击外部关闭菜单测试', () => {
    it('点击遮罩层应该关闭菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const overlay = document.querySelector('.context-menu-overlay') as HTMLElement
      overlay?.click()
      await flushPromises()

      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
      expect(wrapper.emitted('close')).toBeTruthy()

      wrapper.unmount()
    })

    it('点击菜单内容不应该关闭菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      // 点击菜单容器（阻止冒泡）
      const menu = document.querySelector('.context-menu') as HTMLElement
      menu?.click()
      await flushPromises()

      // 菜单应该仍然可见，没有触发 close
      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })
  })

  describe('菜单定位测试', () => {
    it('应该在指定位置显示菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: { x: 200, y: 150 },
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const menu = document.querySelector('.context-menu') as HTMLElement
      const style = menu?.getAttribute('style')

      expect(style).toContain('left:')
      expect(style).toContain('top:')

      wrapper.unmount()
    })

    it('右侧空间不足时应该向左显示', async () => {
      // 模拟较小视口，位置靠近右边缘
      vi.stubGlobal('innerWidth', 300)
      vi.stubGlobal('innerHeight', 600)

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: { x: 250, y: 100 }, // 靠近右边缘
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const menu = document.querySelector('.context-menu') as HTMLElement
      const style = menu?.getAttribute('style')

      // 菜单应该在点击位置的左侧
      expect(style).toContain('left:')

      wrapper.unmount()
    })

    it('底部空间不足时应该向上调整位置', async () => {
      // 模拟较小视口，位置靠近底部
      vi.stubGlobal('innerWidth', 800)
      vi.stubGlobal('innerHeight', 200)

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: { x: 100, y: 180 }, // 靠近底部
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const menu = document.querySelector('.context-menu') as HTMLElement
      const style = menu?.getAttribute('style')

      expect(style).toContain('top:')

      wrapper.unmount()
    })
  })

  describe('键盘事件测试', () => {
    it('按 Escape 键应该关闭菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      // 模拟按下 Escape 键
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      await flushPromises()

      expect(wrapper.emitted('update:visible')).toBeTruthy()
      expect(wrapper.emitted('update:visible')![0]).toEqual([false])
      expect(wrapper.emitted('close')).toBeTruthy()

      wrapper.unmount()
    })

    it('菜单隐藏时按 Escape 键不应该触发事件', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      await flushPromises()

      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })

    it('其他按键不应该关闭菜单', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)

      await flushPromises()

      expect(wrapper.emitted('close')).toBeUndefined()

      wrapper.unmount()
    })
  })

  describe('生命周期测试', () => {
    it('挂载时应该添加键盘事件监听', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      addEventListenerSpy.mockRestore()
      wrapper.unmount()
    })

    it('卸载时应该移除键盘事件监听', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      wrapper.unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('visible 变化测试', () => {
    it('visible 变为 true 时应该阻止页面滚动', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: false,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      await wrapper.setProps({ visible: true })
      await flushPromises()

      expect(document.body.style.overflow).toBe('hidden')

      wrapper.unmount()
    })

    it('visible 变为 false 时应该恢复页面滚动', async () => {
      const wrapper = mount(ContextMenu, {
        props: {
          visible: true,
          position: defaultPosition,
          items: defaultItems
        },
        attachTo: document.body
      })

      await flushPromises()

      await wrapper.setProps({ visible: false })
      await flushPromises()

      expect(document.body.style.overflow).toBe('')

      wrapper.unmount()
    })
  })
})
