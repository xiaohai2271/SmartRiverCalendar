import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SettingsView from '../views/SettingsView.vue'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {}))
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock tauri utilities
vi.mock('../utils/tauri', () => ({
  isTauri: vi.fn(() => false),
  getAutostartEnabled: vi.fn(() => Promise.resolve(false)),
  setAutostart: vi.fn(() => Promise.resolve(true)),
  enableClockHook: vi.fn(() => Promise.resolve('等待中')),
  disableClockHook: vi.fn(() => Promise.resolve()),
  setClockHookBlockPopup: vi.fn(() => Promise.resolve()),
  getClockHookStatus: vi.fn(() => Promise.resolve('等待中')),
  invokeConnectExchange: vi.fn(() => Promise.resolve({ success: false, error: 'mock' })),
  invokeConnectCalDAV: vi.fn(() => Promise.resolve({ success: false, error: 'mock' })),
  invokeSyncCalendar: vi.fn(() => Promise.resolve()),
  invokeDeleteAccount: vi.fn(() => Promise.resolve()),
  invokeGetSyncStatus: vi.fn(() => Promise.resolve(null))
}))

// Mock platform provider
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: { hasLocalDatabase: true, hasOfflineMode: true },
    settingsRepo: {
      loadAppSettings: vi.fn().mockResolvedValue({}),
      saveAppSettings: vi.fn(),
      loadPopupSettings: vi.fn().mockResolvedValue({}),
      savePopupSettings: vi.fn(),
      getUserHolidays: vi.fn().mockResolvedValue([]),
      addUserHoliday: vi.fn(),
      removeUserHoliday: vi.fn(),
    },
    authRepo: {},
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    syncRepo: {},
  }),
  useCapabilities: () => ({
    hasLocalDatabase: true,
    hasOfflineMode: true,
    hasAutoUpdate: true,
    hasSystemTray: true,
    hasBackgroundSync: true,
  }),
}))

// Mock settings service（isDatabaseAvailable 改为同步）
vi.mock('@/services/settings', () => ({
  isDatabaseAvailable: vi.fn(() => true),
  getUserHolidays: vi.fn().mockResolvedValue([]),
  addUserHoliday: vi.fn().mockResolvedValue(undefined),
  removeUserHoliday: vi.fn().mockResolvedValue(false),
  loadFromLocalStorage: vi.fn((key: string) => localStorage.getItem(key)),
}))

// Mock database utilities
vi.mock('../utils/database', () => ({
  saveExternalAccount: vi.fn(() => Promise.resolve()),
  getAccountByServerUrl: vi.fn(() => Promise.resolve(null))
}))

// Mock broadcast utilities
vi.mock('../utils/broadcast', () => ({
  broadcastSettingsChange: vi.fn(),
  broadcastWindowToggleRequest: vi.fn(),
  onSettingsChange: vi.fn(() => () => {}),
  onWindowToggleRequest: vi.fn(() => () => {})
}))

// Mock composables
vi.mock('../composables/useCalendarPopup', () => ({
  setPopupWindowSize: vi.fn(() => Promise.resolve())
}))

describe('SettingsView - Tab 导航结构（RED 测试）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    setActivePinia(createPinia())
  })

  it('渲染 7 个 Tab 标签', async () => {
    const wrapper = mount(SettingsView)

    // 查找 Tab 按钮（预期使用特定选择器，如 class 或 data-testid）
    const tabButtons = wrapper.findAll('[data-testid="settings-tab"]')

    expect(tabButtons.length).toBe(7)
  })

  it('7 个 Tab 分别有正确的标签文本', async () => {
    const wrapper = mount(SettingsView)

    const tabButtons = wrapper.findAll('[data-testid="settings-tab"]')
    const tabLabels = tabButtons.map(btn => btn.text())

    expect(tabLabels).toEqual([
      '日历显示',
      '精简日历',
      '外观',
      '提醒设置',
      '系统',
      '节假日管理',
      '关于'
    ])
  })

  it('默认选中「日历显示」Tab', async () => {
    const wrapper = mount(SettingsView)

    const defaultTab = wrapper.find('[data-testid="settings-tab"][data-active="true"]')

    // RED 阶段：当前没有 Tab 结构，此断言应该失败
    expect(defaultTab.exists()).toBe(true)
    expect(defaultTab.text()).toBe('日历显示')
  })

  it('点击 Tab 切换内容区域', async () => {
    const wrapper = mount(SettingsView)

    // 找到「外观」Tab
    const appearanceTab = wrapper.findAll('[data-testid="settings-tab"]').find(
      btn => btn.text() === '外观'
    )

    expect(appearanceTab).toBeDefined()

    // 点击「外观」Tab
    if (appearanceTab) {
      await appearanceTab.trigger('click')

      // 验证「外观」Tab 被激活
      expect(appearanceTab.attributes('data-active')).toBe('true')

      // 验证显示「外观」设置内容
      const activeContent = wrapper.find('[data-testid="settings-content"][data-tab="外观"]')
      expect(activeContent.exists()).toBe(true)
    }
  })

  it('7 个 Tab 分别展示正确的设置项分组', async () => {
    const wrapper = mount(SettingsView)

    // 测试每个 Tab 对应的内容区域
    const tabs = ['日历显示', '精简日历', '外观', '提醒设置', '系统', '节假日管理', '关于']

    for (const tab of tabs) {
      // 找到对应的 Tab 按钮
      const tabButton = wrapper.findAll('[data-testid="settings-tab"]').find(
        btn => btn.text() === tab
      )

      expect(tabButton).toBeDefined()

      if (tabButton) {
        // 点击 Tab
        await tabButton.trigger('click')

        // 验证对应的内容区域存在
        const content = wrapper.find(`[data-testid="settings-content"][data-tab="${tab}"]`)
        expect(content.exists()).toBe(true)
      }
    }
  })

  it('Tab 切换时只显示一个内容区域', async () => {
    const wrapper = mount(SettingsView)

    // 默认状态：只有一个内容区域可见
    const visibleContents = wrapper.findAll('[data-testid="settings-content"][data-visible="true"]')
    expect(visibleContents.length).toBe(1)

    // 切换到另一个 Tab
    const appearanceTab = wrapper.findAll('[data-testid="settings-tab"]').find(
      btn => btn.text() === '外观'
    )

    if (appearanceTab) {
      await appearanceTab.trigger('click')

      // 仍然只有一个内容区域可见
      const visibleContentsAfterSwitch = wrapper.findAll(
        '[data-testid="settings-content"][data-visible="true"]'
      )
      expect(visibleContentsAfterSwitch.length).toBe(1)
    }
  })
})