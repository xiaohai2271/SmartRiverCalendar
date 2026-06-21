import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// ── 可变能力对象 ──
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
  hasExternalSync: true,
}

// ── Mock 函数 ──
const mockCalendarGetAll = vi.fn()
const mockEventGetAll = vi.fn().mockResolvedValue([])
const mockEventGetByTimeRangeAndCalendars = vi.fn().mockResolvedValue([])
const mockEventGetCount = vi.fn().mockResolvedValue(0)
const mockEventCreate = vi.fn()
const mockEventUpdate = vi.fn()
const mockEventDelete = vi.fn()
const mockEventCreateWithSync = vi.fn()
const mockEventUpdateWithSync = vi.fn()
const mockEventDeleteWithSync = vi.fn()
const mockTriggerCloudSync = vi.fn().mockResolvedValue(true)

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      triggerCloudSync: mockTriggerCloudSync,
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
      getAllAccounts: vi.fn().mockResolvedValue([]),
      getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
      startAutoSync: vi.fn(),
      stopAutoSync: vi.fn(),
      getExternalCalendars: vi.fn().mockResolvedValue([]),
      getExternalEvents: vi.fn().mockResolvedValue([]),
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
      updateType: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    eventRepo: {
      getAll: mockEventGetByTimeRangeAndCalendars,
      getByTimeRangeAndCalendars: mockEventGetByTimeRangeAndCalendars,
      getCount: mockEventGetCount,
      getUpcoming: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      create: mockEventCreate,
      update: mockEventUpdate,
      delete: mockEventDelete,
      createWithSync: mockEventCreateWithSync,
      updateWithSync: mockEventUpdateWithSync,
      deleteWithSync: mockEventDeleteWithSync,
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

vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  clearCachedPublicKey: vi.fn(),
}))

vi.mock('@/services/cloudSync', () => ({
  cloudSyncService: {
    triggerSync: mockTriggerCloudSync,
  },
}))

describe('事件 CRUD 下沉后的 Store 行为', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    capabilitiesMock.dataPriority = 'local-first'
    capabilitiesMock.hasOfflineMode = true
    capabilitiesMock.hasLocalDatabase = true
  })

  // ── addEvent ──
  describe('addEvent', () => {
    it('local 日历应调 createWithSync 且不触发云同步', async () => {
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventCreateWithSync.mockResolvedValue({
        id: '101', title: '测试事件', calendarId: '1',
        startTime: Date.now(), endTime: Date.now() + 3600000,
        allDay: false, createdAt: Date.now(), updatedAt: Date.now(),
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: '测试事件',
        calendarId: '1',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
      })

      expect(mockEventCreateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
    })

    it('online 日历应调 createWithSync 并触发云同步', async () => {
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventCreateWithSync.mockResolvedValue({
        id: '101', title: '测试事件', calendarId: '1',
        startTime: Date.now(), endTime: Date.now() + 3600000,
        allDay: false, createdAt: Date.now(), updatedAt: Date.now(),
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: '测试事件',
        calendarId: '1',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
      })

      expect(mockEventCreateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).toHaveBeenCalled()
    })

    it('exchange 日历应调 createWithSync（外部同步路由在 Rust 端）', async () => {
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '10', name: 'Exchange日历', color: '#6B7280', type: 'exchange',
          visible: true, syncEnabled: true, accountId: 'acc1',
          accountType: 'exchange', serverUrl: 'https://mail.example.com',
          username: 'user@example.com', encryptedPassword: 'enc',
          calendarUrl: 'https://mail.example.com/cal', readOnly: false,
        },
      ])
      mockEventCreateWithSync.mockResolvedValue({
        id: '101', title: 'Exchange事件', calendarId: '10',
        startTime: Date.now(), endTime: Date.now() + 3600000,
        allDay: false, createdAt: Date.now(), updatedAt: Date.now(),
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: 'Exchange事件',
        calendarId: '10',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
      })

      expect(mockEventCreateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
    })

    it('caldav 日历应调 createWithSync（外部同步路由在 Rust 端）', async () => {
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '11', name: 'CalDAV日历', color: '#8B5CF6', type: 'caldav',
          visible: true, syncEnabled: true, accountId: 'acc2',
          accountType: 'caldav', serverUrl: 'https://caldav.example.com',
          username: 'user@caldav.com', encryptedPassword: 'enc2',
          calendarUrl: 'https://caldav.example.com/cal', readOnly: false,
        },
      ])
      mockEventCreateWithSync.mockResolvedValue({
        id: '102', title: 'CalDAV事件', calendarId: '11',
        startTime: Date.now(), endTime: Date.now() + 3600000,
        allDay: false, createdAt: Date.now(), updatedAt: Date.now(),
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: 'CalDAV事件',
        calendarId: '11',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
      })

      expect(mockEventCreateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
    })

    it('createWithSync 抛出 RepositoryError 时应向上传播', async () => {
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventCreateWithSync.mockRejectedValue(new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法创建事件',
        platform: 'web',
      }))

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await expect(store.addEvent({
        title: '测试事件',
        calendarId: '1',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
      })).rejects.toThrow('网络不可用，无法创建事件')
    })
  })

  // ── updateEvent ──
  describe('updateEvent', () => {
    it('local 日历应调 updateWithSync 且不触发云同步', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdateWithSync.mockResolvedValue({
        id: '101', title: '更新后事件', calendarId: '1',
        startTime: now - 3600000, endTime: now,
        allDay: false, createdAt: now, updatedAt: now,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新后事件' })

      expect(mockEventUpdateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
    })

    it('online 日历应调 updateWithSync 并触发云同步', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdateWithSync.mockResolvedValue({
        id: '101', title: '更新后事件', calendarId: '1',
        startTime: now - 3600000, endTime: now,
        allDay: false, createdAt: now, updatedAt: now,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新后事件' })

      expect(mockEventUpdateWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).toHaveBeenCalled()
    })

    it('updateWithSync 抛出 RepositoryError 时应向上传播', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdateWithSync.mockRejectedValue(new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法更新事件',
        platform: 'web',
      }))

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await expect(store.updateEvent('101', { title: '更新后事件' }))
        .rejects.toThrow('网络不可用，无法更新事件')
    })
  })

  // ── deleteEvent ──
  describe('deleteEvent', () => {
    it('local 日历应调 deleteWithSync 且不触发云同步', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDeleteWithSync.mockResolvedValue(undefined)

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockEventDeleteWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).not.toHaveBeenCalled()
    })

    it('online 日历应调 deleteWithSync 并触发云同步', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDeleteWithSync.mockResolvedValue(undefined)

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockEventDeleteWithSync).toHaveBeenCalled()
      expect(mockTriggerCloudSync).toHaveBeenCalled()
    })

    it('deleteWithSync 抛出 RepositoryError 时应向上传播', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetByTimeRangeAndCalendars.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDeleteWithSync.mockRejectedValue(new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法删除事件',
        platform: 'web',
      }))

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await expect(store.deleteEvent('101'))
        .rejects.toThrow('网络不可用，无法删除事件')
    })
  })
})
