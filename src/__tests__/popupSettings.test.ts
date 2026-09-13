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

// Mock settingsRepo
const mockSettingsRepo = {
  loadPopupSettings: vi.fn().mockResolvedValue(null),
  savePopupSettings: vi.fn().mockResolvedValue(undefined),
  loadAllSettings: vi.fn().mockResolvedValue({}),
  saveSetting: vi.fn().mockResolvedValue(undefined),
  getSetting: vi.fn().mockResolvedValue(null),
  migrateFromLocalStorage: vi.fn().mockResolvedValue(undefined),
}

// Mock capabilities
const mockCapabilities = {
  hasLocalDatabase: true,
  hasOfflineMode: true,
  dataPriority: 'local-first' as const,
  hasReminderPopup: true,
  hasSystemNotification: true,
  hasSnoozeReminder: true,
  hasSystemTray: true,
  hasAutoStart: true,
  hasClockHook: true,
  hasMultiWindow: true,
  hasAutoUpdate: true,
  hasMinimizeToTray: true,
  hasProxySettings: true,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    authRepo: {},
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    settingsRepo: mockSettingsRepo,
    syncRepo: {},
  }),
  useCapabilities: () => mockCapabilities,
}))

describe('popupSettings Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSettingsRepo.loadPopupSettings.mockResolvedValue(null)
    mockSettingsRepo.savePopupSettings.mockResolvedValue(undefined)

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

    // 等待初始化 loadPopupSettings 完成
    await store.loadPopupSettings()

    await store.updatePopupSettings({ popupShowLunar: false })

    expect(store.settings.popupShowLunar).toBe(false)
    // 其他设置应保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
    expect(store.settings.popupShowSolarTerm).toBe(true)
  })

  it('updatePopupSettings 更新多个设置', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    await store.updatePopupSettings({
      popupShowLunar: false,
      popupShowSolarTerm: false,
    })

    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    // 未更新的设置保持不变
    expect(store.settings.popupShowLunarFestival).toBe(true)
  })

  it('通过 settingsRepo 持久化', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    // 更新设置
    await store.updatePopupSettings({ popupShowEvents: false })

    // 验证 settingsRepo.savePopupSettings 被调用
    expect(mockSettingsRepo.savePopupSettings).toHaveBeenCalledWith(
      expect.objectContaining({ popupShowEvents: false })
    )
  })

  it('从 settingsRepo 加载设置', async () => {
    // 第一次 mock 值给 store 初始化，第二次给测试中的显式调用
    mockSettingsRepo.loadPopupSettings
      .mockResolvedValueOnce(null) // store 初始化时消费
      .mockResolvedValueOnce({
        popupShowLunar: false,
        popupShowSolarTerm: false,
      })

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    // 验证设置从 repo 加载
    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    // 未指定的设置使用默认值
    expect(store.settings.popupShowHoliday).toBe(true)
  })

  it('resetPopupSettings 恢复默认值', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    // 修改多个设置
    await store.updatePopupSettings({
      popupShowLunar: false,
      popupShowHoliday: false,
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

    await store.loadPopupSettings()

    // 更新设置
    await store.updatePopupSettings({ popupShowLunar: false })

    // 验证广播被调用
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'settings-change',
        key: 'popupShowLunar',
        value: false,
      })
    )
  })

  it('loadPopupSettings 合并默认值与存储值', async () => {
    // 第一次 mock 值给 store 初始化，第二次给测试中的显式调用
    mockSettingsRepo.loadPopupSettings
      .mockResolvedValueOnce(null) // store 初始化时消费
      .mockResolvedValueOnce({
        popupShowLunar: false,
        popupShowSolarTerm: false,
      })

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    // 指定的设置从 repo 加载
    expect(store.settings.popupShowLunar).toBe(false)
    expect(store.settings.popupShowSolarTerm).toBe(false)
    // 未指定的设置使用默认值
    expect(store.settings.popupShowHoliday).toBe(true)
    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('loadPopupSettings repo 返回 null 时使用默认值', async () => {
    mockSettingsRepo.loadPopupSettings.mockResolvedValueOnce(null)

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    // 全部使用默认值
    expect(store.settings.popupShowLunar).toBe(true)
    expect(store.settings.popupShowSolarTerm).toBe(true)
    expect(store.settings.popupWindowSize).toBe('medium')
  })

  it('loadPopupSettings repo 抛出异常时不崩溃', async () => {
    mockSettingsRepo.loadPopupSettings.mockRejectedValueOnce(new Error('加载失败'))

    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    // 不应抛出异常
    await expect(store.loadPopupSettings()).resolves.toBeUndefined()

    // 使用默认值
    expect(store.settings.popupShowLunar).toBe(true)
  })

  it('popupWindowSize 设置为 large', async () => {
    const { usePopupSettingsStore } = await import('../stores/popupSettings')
    const store = usePopupSettingsStore()

    await store.loadPopupSettings()

    await store.updatePopupSettings({ popupWindowSize: 'large' })

    expect(store.settings.popupWindowSize).toBe('large')
    expect(mockSettingsRepo.savePopupSettings).toHaveBeenCalledWith(
      expect.objectContaining({ popupWindowSize: 'large' })
    )
  })
})
