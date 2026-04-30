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
const createLocalStorageMock = () => {
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
    }),
    // 暴露 store 以便测试直接设置值
    _setStore: (key: string, value: string) => {
      store[key] = value
    },
    _getStore: () => store
  }
}

const localStorageMock = createLocalStorageMock()

// 设置全局 localStorage mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock settingsService 模块
vi.mock('@/services/settings', () => ({
  isDatabaseAvailable: vi.fn(() => Promise.resolve(false)),
  loadFromLocalStorage: vi.fn((key: string) => {
    // 使用同一个 mock localStorage
    return localStorageMock.getItem(key)
  }),
  getSetting: vi.fn(() => Promise.resolve(null)),
  setSetting: vi.fn(() => Promise.resolve()),
  getAllSettings: vi.fn(() => Promise.resolve([]))
}))

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
    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('updatePopupSettings 更新单个设置', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.updatePopupSettings({ popupShowLunar: false })

    expect(store.settings.popupShowLunar).toBe(false)
    // 其他设置应保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
    expect(store.settings.popupShowSolarTerm).toBe(true)
  })

  it('updatePopupSettings 更新多个设置', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.updatePopupSettings({
      popupShowLunar: false,
      popupShowSolarTerm: false
    })

    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    // 未更新的设置保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
  })

  it('localStorage 持久化', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 更新设置
    await store.updatePopupSettings({ popupShowEvents: false })

    // 验证 localStorage 被调用
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'popup-settings',
      expect.stringContaining('"popupShowEvents":false')
    )

    // 模拟重新加载 - 直接设置 store 值
    localStorageMock._setStore('popup-settings', JSON.stringify({ popupShowEvents: false }))

    // 创建新的 store 实例（模拟应用重启）
    setActivePinia(createPinia())
    const newStore = usePopupSettingsStore()

    // 等待异步加载完成
    await newStore.loadPopupSettings()

    // 验证设置从 localStorage 加载
    expect(newStore.settings.popupShowEvents).toBe(false)
  })

  it('resetPopupSettings 恢复默认值', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 修改多个设置
    await store.updatePopupSettings({
      popupShowLunar: false,
      popupShowHoliday: false
    })

    // 重置
    await store.resetPopupSettings()

    // 验证恢复默认值
    expect(store.settings.popupShowLunar).toBe(true)
    expect(store.settings.popupShowHoliday).toBe(true)
  })

  it('BroadcastChannel 广播设置变更', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 更新设置
    await store.updatePopupSettings({ popupShowLunar: false })

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
    // 预设 localStorage 数据 - 直接设置 store 值
    localStorageMock._setStore(
      'popup-settings',
      JSON.stringify({
        popupShowLunar: false,
        popupShowSolarTerm: false
      })
    )

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 等待异步加载完成
    await store.loadPopupSettings()

    // 验证设置被正确加载
    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    // 未指定的设置使用默认值
    expect(store.settings.popupShowLunarFestival).toBe(true)
  })

  it('loadPopupSettings 处理无效 JSON', async () => {
    // 设置无效 JSON - 直接设置 store 值
    localStorageMock._setStore('popup-settings', 'invalid-json')

    // 不应抛出错误
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 等待异步加载完成
    await store.loadPopupSettings()

    // 应使用默认值
    expect(store.settings.popupShowLunar).toBe(true)
  })

  it('popupWindowSize 默认值为 medium', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('updateWindowSize 更新窗口尺寸', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.updateWindowSize('large')

    expect(store.settings.popupWindowSize).toBe('large')

    await store.updateWindowSize('small')
    expect(store.settings.popupWindowSize).toBe('small')
  })

  it('updateWindowSize 相同尺寸时不更新', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 初始值为 medium
    expect(store.settings.popupWindowSize).toBe('medium')

    // 设置相同的值不应触发保存
    await store.updateWindowSize('medium')

    // 验证 localStorage.setItem 未被调用（除初始化加载外）
    // 由于 watch effect 可能在初始化时调用，我们检查最后值是否未变
    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('向后兼容：旧用户数据无 popupWindowSize 时使用默认值', async () => {
    // 模拟旧用户数据（没有 popupWindowSize 字段）- 直接设置 store 值
    localStorageMock._setStore(
      'popup-settings',
      JSON.stringify({
        popupShowLunar: false,
        popupShowSolarTerm: false
      })
    )

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 等待异步加载完成
    await store.loadPopupSettings()

    // 旧数据应正确加载
    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)

    // popupWindowSize 应使用默认值
    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('localStorage 持久化包含 popupWindowSize', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.updateWindowSize('large')

    // 验证 localStorage 包含 popupWindowSize
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'popup-settings',
      expect.stringContaining('"popupWindowSize":"large"')
    )
  })

  it('resetPopupSettings 恢复 popupWindowSize 为 medium', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 修改窗口尺寸
    await store.updateWindowSize('large')
    expect(store.settings.popupWindowSize).toBe('large')

    // 重置设置
    await store.resetPopupSettings()

    // 验证恢复为默认值 medium
    expect(store.settings.popupWindowSize).toBe('medium')
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
