import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock BroadcastChannel
const mockPostMessage = vi.fn()
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

class MockBroadcastChannel {
  postMessage = mockPostMessage
  addEventListener = mockAddEventListener
  removeEventListener = mockRemoveEventListener
}

// 替换全局 BroadcastChannel
;(globalThis as unknown as { BroadcastChannel: unknown }).BroadcastChannel =
  MockBroadcastChannel

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

describe('popupSettings Store', () => {
  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks()
    localStorageMock.clear()

    // 创建新的 Pinia 实例
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('默认值正确', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    expect(store.settings.popupShowLunar).toBe(true)
    expect(store.settings.popupShowLunarFestival).toBe(true)
    expect(store.settings.popupShowSolarTerm).toBe(true)
    expect(store.settings.popupShowHoliday).toBe(true)
    expect(store.settings.popupShowEvents).toBe(true)
    expect(store.settings.popupCalendarShowLunar).toBe(true)
    expect(store.settings.popupCalendarHolidayColor).toBe('default')
  })

  it('updatePopupSettings 更新单个设置', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    store.updatePopupSettings({ popupShowLunar: false })

    expect(store.settings.popupShowLunar).toBe(false)
    // 其他设置应保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
    expect(store.settings.popupShowSolarTerm).toBe(true)
  })

  it('updatePopupSettings 更新多个设置', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    store.updatePopupSettings({
      popupShowLunar: false,
      popupShowSolarTerm: false,
      popupCalendarHolidayColor: 'high-contrast'
    })

    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    expect(store.settings.popupCalendarHolidayColor).toBe('high-contrast')
    // 未更新的设置保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
  })

  it('localStorage 持久化', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 更新设置
    store.updatePopupSettings({ popupShowEvents: false })

    // 验证 localStorage 被调用
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'popup-settings',
      expect.stringContaining('"popupShowEvents":false')
    )

    // 模拟重新加载
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ popupShowEvents: false }))

    // 创建新的 store 实例（模拟应用重启）
    setActivePinia(createPinia())
    const newStore = usePopupSettingsStore()

    // 验证设置从 localStorage 加载
    expect(newStore.settings.popupShowEvents).toBe(false)
  })

  it('resetPopupSettings 恢复默认值', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 修改多个设置
    store.updatePopupSettings({
      popupShowLunar: false,
      popupShowHoliday: false,
      popupCalendarHolidayColor: 'soft'
    })

    // 重置
    store.resetPopupSettings()

    // 验证恢复默认值
    expect(store.settings.popupShowLunar).toBe(true)
    expect(store.settings.popupShowHoliday).toBe(true)
    expect(store.settings.popupCalendarHolidayColor).toBe('default')
  })

  it('BroadcastChannel 广播设置变更', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 更新设置
    store.updatePopupSettings({ popupShowLunar: false })

    // 验证广播被调用
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'settings-change',
        key: 'popupShowLunar',
        value: false
      })
    )
  })

  it('loadPopupSettings 从 localStorage 加载', async () => {
    // 预设 localStorage 数据
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({
        popupShowLunar: false,
        popupCalendarHolidayColor: 'soft'
      })
    )

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 验证设置被正确加载
    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupCalendarHolidayColor).toBe('soft')
    // 未指定的设置使用默认值
    expect(store.settings.popupShowLunarFestival).toBe(true)
  })

  it('loadPopupSettings 处理无效 JSON', async () => {
    // 设置无效 JSON
    localStorageMock.getItem.mockReturnValue('invalid-json')

    // 不应抛出错误
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 应使用默认值
    expect(store.settings.popupShowLunar).toBe(true)
  })
})

describe('broadcast 工具函数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('broadcastSettingsChange 发送正确的消息', async () => {
    const { broadcastSettingsChange } = await import('../utils/broadcast')

    broadcastSettingsChange('testKey', 'testValue')

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'settings-change',
        key: 'testKey',
        value: 'testValue',
        timestamp: expect.any(Number)
      })
    )
  })

  it('onSettingsChange 注册监听器', async () => {
    const { onSettingsChange } = await import('../utils/broadcast')

    const callback = vi.fn()
    const unsubscribe = onSettingsChange(callback)

    expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    // 测试取消监听
    unsubscribe()
    expect(mockRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('broadcastWindowToggleRequest 发送正确的消息', async () => {
    const { broadcastWindowToggleRequest } = await import('../utils/broadcast')

    broadcastWindowToggleRequest({
      source: 'popup',
      monitorType: 'primary'
    })

    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'window-toggle-request',
        source: 'popup',
        monitorType: 'primary'
      })
    )
  })

  it('onWindowToggleRequest 注册监听器', async () => {
    const { onWindowToggleRequest } = await import('../utils/broadcast')

    const callback = vi.fn()
    const unsubscribe = onWindowToggleRequest(callback)

    expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    // 测试取消监听
    unsubscribe()
    expect(mockRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })
})
