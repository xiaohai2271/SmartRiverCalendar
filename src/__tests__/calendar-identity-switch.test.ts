import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── 可变能力对象，方便在测试中切换 local-first / remote-first ──
const capabilitiesMock = {
  dataPriority: 'local-first' as 'local-first' | 'remote-first',
  hasOfflineMode: true,
  hasLocalDatabase: true,
  hasBackgroundSync: true,
  hasIncrementalSync: false,
  hasClientConflictResolution: true,
  hasReminderPopup: false,
  hasSystemNotification: true,
  hasSnoozeReminder: false,
  hasExchangeSupport: true,
  hasCalDavSupport: true,
  hasExternalSync: true,
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasAlwaysOnTop: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,
}

// ── Mock 函数 ──
const mockTriggerCloudSync = vi.fn().mockResolvedValue(true)
const mockUpdateType = vi.fn()
const mockRecordPendingChange = vi.fn().mockResolvedValue(undefined)
const mockPushPendingChanges = vi.fn().mockResolvedValue({ pushed: 0, failed: 0 })
const mockCalendarGetAll = vi.fn()
const mockEventGetAll = vi.fn().mockResolvedValue([])
const mockCalendarUpdate = vi.fn().mockResolvedValue(undefined)
const mockCalendarDelete = vi.fn().mockResolvedValue(undefined)

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      triggerCloudSync: mockTriggerCloudSync,
      recordPendingChange: mockRecordPendingChange,
      pushPendingChanges: mockPushPendingChanges,
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
      getAllAccounts: vi.fn().mockResolvedValue([]),
      getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
      startAutoSync: vi.fn(),
      stopAutoSync: vi.fn(),
      triggerExternalSync: vi.fn().mockResolvedValue(true),
      startExternalSync: vi.fn().mockResolvedValue(true),
      stopExternalSync: vi.fn().mockResolvedValue(true),
      onExternalSyncComplete: vi.fn().mockResolvedValue(() => {}),
      onSyncComplete: vi.fn().mockResolvedValue(() => {}),
      onSyncError: vi.fn().mockResolvedValue(() => {}),
      onAuthTokenExpired: vi.fn().mockResolvedValue(() => {}),
    },
    calendarRepo: {
      getAll: mockCalendarGetAll,
      create: vi.fn().mockResolvedValue({ id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false }),
      updateType: mockUpdateType,
      update: mockCalendarUpdate,
      delete: mockCalendarDelete,
    },
    eventRepo: {
      getAll: mockEventGetAll,
      getByTimeRangeAndCalendars: vi.fn().mockResolvedValue([]),
      getCount: vi.fn().mockResolvedValue(0),
      getUpcoming: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    todoRepo: {
      getAll: vi.fn().mockResolvedValue([]),
    },
    settingsRepo: {
      getSetting: vi.fn(),
      setSetting: vi.fn(),
    },
    authRepo: {
      login: vi.fn().mockResolvedValue({ userId: 1, accessToken: 'token', refreshToken: 'refresh', expiresIn: 3600 }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com', displayName: '测试用户' }),
      getPublicKey: vi.fn().mockResolvedValue('mock-public-key'),
    },
  }),
  useCapabilities: () => capabilitiesMock,
}))

// Mock RSA 服务
vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  clearCachedPublicKey: vi.fn(),
}))

vi.mock('@/services/cloudSync', () => ({
  cloudSyncService: {
    triggerSync: mockTriggerCloudSync,
  },
}))

describe('日历账户身份切换', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 重置能力为 local-first
    capabilitiesMock.dataPriority = 'local-first'
    capabilitiesMock.hasOfflineMode = true
    capabilitiesMock.hasLocalDatabase = true
  })

  describe('loginTransition', () => {
    it('登录后应触发同步并切换日历类型为 online', async () => {
      // 初始状态：有一个 local 日历
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      // reloadFromDatabase 后重新加载：日历已变为 online
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'online', visible: true, syncEnabled: true },
      ])
      mockUpdateType.mockResolvedValue({
        id: '1', name: '我的日历', color: '#4A90D9', type: 'online', visible: true, syncEnabled: true,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.loginTransition()

      // 验证同步触发
      expect(mockTriggerCloudSync).toHaveBeenCalled()
      // 验证日历类型切换
      expect(mockUpdateType).toHaveBeenCalledWith({
        id: 1,
        type: 'online',
        syncEnabled: true,
      })
    })

    it('Web端（remote-first）不应触发切换', async () => {
      // 切换为 remote-first
      capabilitiesMock.dataPriority = 'remote-first'
      capabilitiesMock.hasOfflineMode = false
      capabilitiesMock.hasLocalDatabase = false

      mockCalendarGetAll.mockResolvedValue([])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.loginTransition()

      // Web端不应触发同步和切换
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
      expect(mockUpdateType).not.toHaveBeenCalled()
    })

    it('没有 local 日历时不应调用 updateType', async () => {
      // 初始状态：没有 local 日历
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '2', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.loginTransition()

      // 同步仍会触发
      expect(mockTriggerCloudSync).toHaveBeenCalled()
      // 但不调用 updateType（没有 local 日历需要切换）
      expect(mockUpdateType).not.toHaveBeenCalled()
    })
  })

  describe('logoutTransition', () => {
    it('退出前应同步并切换日历类型为 local', async () => {
      // 初始状态：有一个 online 日历
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'online', visible: true, syncEnabled: true },
      ])
      // reloadFromDatabase 后重新加载
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockUpdateType.mockResolvedValue({
        id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.logoutTransition()

      // 验证同步触发
      expect(mockTriggerCloudSync).toHaveBeenCalled()
      // 验证日历类型切换回 local
      expect(mockUpdateType).toHaveBeenCalledWith({
        id: 1,
        type: 'local',
        syncEnabled: false,
      })
    })

    it('同步失败不应阻塞退出', async () => {
      mockTriggerCloudSync.mockRejectedValueOnce(new Error('网络错误'))
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'online', visible: true, syncEnabled: true },
      ])
      mockUpdateType.mockResolvedValue({
        id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      // 不应抛出错误
      await expect(store.logoutTransition()).resolves.toBeUndefined()
      // 仍应切换类型
      expect(mockUpdateType).toHaveBeenCalled()
    })

    it('Web端（remote-first）退出不应触发同步和切换', async () => {
      capabilitiesMock.dataPriority = 'remote-first'
      capabilitiesMock.hasOfflineMode = false
      capabilitiesMock.hasLocalDatabase = false

      mockCalendarGetAll.mockResolvedValue([])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.logoutTransition()

      // Web端不应触发同步和切换
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
      expect(mockUpdateType).not.toHaveBeenCalled()
    })

    it('没有 online 日历时不应调用 updateType', async () => {
      // 初始状态：没有 online 日历
      mockCalendarGetAll.mockResolvedValueOnce([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()
      await store.logoutTransition()

      // 同步仍会触发（确保最终同步）
      expect(mockTriggerCloudSync).toHaveBeenCalled()
      // 但不调用 updateType（没有 online 日历需要切换）
      expect(mockUpdateType).not.toHaveBeenCalled()
    })
  })
})
