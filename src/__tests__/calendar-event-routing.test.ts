import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { RepositoryError } from '@/platform/errors'

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
}

// ── Mock 函数 ──
const mockCalendarGetAll = vi.fn()
const mockEventGetAll = vi.fn().mockResolvedValue([])
const mockEventCreate = vi.fn()
const mockEventUpdate = vi.fn()
const mockEventDelete = vi.fn()
const mockRecordPendingChange = vi.fn().mockResolvedValue(undefined)
const mockPushPendingChanges = vi.fn().mockResolvedValue({ pushed: 0, failed: 0 })
const mockTriggerCloudSync = vi.fn().mockResolvedValue(true)
const mockCreateExternalEvent = vi.fn()
const mockUpdateExternalEvent = vi.fn()
const mockDeleteExternalEvent = vi.fn()
const mockCalendarUpdateType = vi.fn()

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      triggerCloudSync: mockTriggerCloudSync,
      recordPendingChange: mockRecordPendingChange,
      pushPendingChanges: mockPushPendingChanges,
      createExternalEvent: mockCreateExternalEvent,
      updateExternalEvent: mockUpdateExternalEvent,
      deleteExternalEvent: mockDeleteExternalEvent,
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
      getAllAccounts: vi.fn().mockResolvedValue([]),
      getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
      startAutoSync: vi.fn(),
      stopAutoSync: vi.fn(),
    },
    calendarRepo: {
      getAll: mockCalendarGetAll,
      create: vi.fn().mockResolvedValue({ id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false }),
      updateType: mockCalendarUpdateType,
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    eventRepo: {
      getAll: mockEventGetAll,
      create: mockEventCreate,
      update: mockEventUpdate,
      delete: mockEventDelete,
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

describe('事件操作分流', () => {
  let originalOnLine: boolean | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // 保存原始 navigator.onLine
    originalOnLine = navigator.onLine
    // 重置能力
    capabilitiesMock.dataPriority = 'local-first'
    capabilitiesMock.hasOfflineMode = true
    capabilitiesMock.hasLocalDatabase = true
  })

  afterEach(() => {
    // 恢复 navigator.onLine
    if (originalOnLine !== undefined) {
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true,
      })
    }
  })

  // ── addEvent 分流 ──
  describe('addEvent 分流', () => {
    it('local 日历应只写本地', async () => {
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventCreate.mockResolvedValue({
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

      // 验证只调了本地写入
      expect(mockEventCreate).toHaveBeenCalled()
      // 不应记录 sync_log
      expect(mockRecordPendingChange).not.toHaveBeenCalled()
      // 不应推送
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
      // 不应调外部事件创建
      expect(mockCreateExternalEvent).not.toHaveBeenCalled()
    })

    it('online 日历在线时应写本地+记录sync_log+推送', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventCreate.mockResolvedValue({
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

      // 验证三步都执行
      expect(mockEventCreate).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'event',
        })
      )
      expect(mockPushPendingChanges).toHaveBeenCalled()
    })

    it('online 日历离线+hasOfflineMode 应写本地+记录sync_log', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = true

      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventCreate.mockResolvedValue({
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

      // 验证写本地+记录 sync_log
      expect(mockEventCreate).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          entityType: 'event',
        })
      )
      // 不应推送（离线模式）
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
    })

    it('online 日历离线+!hasOfflineMode 应抛出错误', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = false

      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])

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

      // 恢复
      capabilitiesMock.hasOfflineMode = true
    })

    it('exchange 日历应走 createExternalEvent', async () => {
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '10', name: 'Exchange日历', color: '#6B7280', type: 'exchange',
          visible: true, syncEnabled: true, accountId: 'acc1',
          accountType: 'exchange', serverUrl: 'https://mail.example.com',
          username: 'user@example.com', encryptedPassword: 'enc',
          calendarUrl: 'https://mail.example.com/cal', readOnly: false,
        },
      ])
      mockCreateExternalEvent.mockResolvedValue({
        success: true,
        externalId: 'ext-101',
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

      // 验证走外部日历路径
      expect(mockCreateExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          accountType: 'exchange',
        })
      )
      // 不应走本地事件创建路径
      expect(mockEventCreate).not.toHaveBeenCalled()
      expect(mockRecordPendingChange).not.toHaveBeenCalled()
    })

    it('caldav 日历应走 createExternalEvent', async () => {
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '11', name: 'CalDAV日历', color: '#8B5CF6', type: 'caldav',
          visible: true, syncEnabled: true, accountId: 'acc2',
          accountType: 'caldav', serverUrl: 'https://caldav.example.com',
          username: 'user@caldav.com', encryptedPassword: 'enc2',
          calendarUrl: 'https://caldav.example.com/cal', readOnly: false,
        },
      ])
      mockCreateExternalEvent.mockResolvedValue({
        success: true,
        externalId: 'ext-102',
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

      // 验证走外部日历路径
      expect(mockCreateExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc2',
          accountType: 'caldav',
        })
      )
      expect(mockEventCreate).not.toHaveBeenCalled()
    })
  })

  // ── updateEvent 分流 ──
  describe('updateEvent 分流', () => {
    it('local 日历更新应只写本地', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdate.mockResolvedValue({
        id: '101', title: '更新后事件', calendarId: '1',
        startTime: now - 3600000, endTime: now,
        allDay: false, createdAt: now, updatedAt: now,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新后事件' })

      expect(mockEventUpdate).toHaveBeenCalled()
      expect(mockRecordPendingChange).not.toHaveBeenCalled()
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
    })

    it('online 日历在线更新应写本地+记录sync_log+推送', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdate.mockResolvedValue({
        id: '101', title: '更新后事件', calendarId: '1',
        startTime: now - 3600000, endTime: now,
        allDay: false, createdAt: now, updatedAt: now,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新后事件' })

      expect(mockEventUpdate).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'event',
        })
      )
      expect(mockPushPendingChanges).toHaveBeenCalled()
    })

    it('online 日历离线+hasOfflineMode 更新应写本地+记录sync_log', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = true

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventUpdate.mockResolvedValue({
        id: '101', title: '更新后事件', calendarId: '1',
        startTime: now - 3600000, endTime: now,
        allDay: false, createdAt: now, updatedAt: now,
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新后事件' })

      expect(mockEventUpdate).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'event',
        })
      )
      // 离线不应推送
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
    })

    it('online 日历离线+!hasOfflineMode 更新应抛出错误', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = false

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '旧事件', calendarId: '1', startTime: now - 3600000, endTime: now, allDay: false, createdAt: now, updatedAt: now },
      ])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await expect(store.updateEvent('101', { title: '更新后事件' }))
        .rejects.toThrow('网络不可用，无法更新事件')

      capabilitiesMock.hasOfflineMode = true
    })

    it('exchange 日历更新应走 updateExternalEvent', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '10', name: 'Exchange日历', color: '#6B7280', type: 'exchange',
          visible: true, syncEnabled: true, accountId: 'acc1',
          accountType: 'exchange', serverUrl: 'https://mail.example.com',
          username: 'user@example.com', encryptedPassword: 'enc',
          calendarUrl: 'https://mail.example.com/cal', readOnly: false,
        },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: 'Exchange事件', calendarId: '10', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockUpdateExternalEvent.mockResolvedValue({
        success: true,
        externalId: 'ext-101',
      })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('101', { title: '更新Exchange事件' })

      expect(mockUpdateExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          accountType: 'exchange',
        })
      )
    })
  })

  // ── deleteEvent 分流 ──
  describe('deleteEvent 分流', () => {
    it('local 日历删除应只删本地', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '我的日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDelete.mockResolvedValue(undefined)

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockEventDelete).toHaveBeenCalled()
      expect(mockRecordPendingChange).not.toHaveBeenCalled()
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
    })

    it('online 日历在线删除应删本地+记录sync_log+推送', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDelete.mockResolvedValue(undefined)

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockEventDelete).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'event',
        })
      )
      expect(mockPushPendingChanges).toHaveBeenCalled()
    })

    it('online 日历离线+hasOfflineMode 删除应删本地+记录sync_log', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = true

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])
      mockEventDelete.mockResolvedValue(undefined)

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockEventDelete).toHaveBeenCalled()
      expect(mockRecordPendingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          entityType: 'event',
        })
      )
      // 离线不应推送
      expect(mockPushPendingChanges).not.toHaveBeenCalled()
    })

    it('online 日历离线+!hasOfflineMode 删除应抛出错误', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      capabilitiesMock.hasOfflineMode = false

      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        { id: '1', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: '待删事件', calendarId: '1', startTime: now, endTime: now + 3600000, allDay: false, createdAt: now, updatedAt: now },
      ])

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await expect(store.deleteEvent('101'))
        .rejects.toThrow('网络不可用，无法删除事件')

      capabilitiesMock.hasOfflineMode = true
    })

    it('exchange 日历删除应走 deleteExternalEvent', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '10', name: 'Exchange日历', color: '#6B7280', type: 'exchange',
          visible: true, syncEnabled: true, accountId: 'acc1',
          accountType: 'exchange', serverUrl: 'https://mail.example.com',
          username: 'user@example.com', encryptedPassword: 'enc',
          calendarUrl: 'https://mail.example.com/cal', readOnly: false,
        },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '101', title: 'Exchange事件', calendarId: '10', startTime: now, endTime: now + 3600000, allDay: false, externalId: 'ext-101', createdAt: now, updatedAt: now },
      ])
      mockDeleteExternalEvent.mockResolvedValue({ success: true })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('101')

      expect(mockDeleteExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc1',
          accountType: 'exchange',
          eventId: 'ext-101',
        })
      )
    })

    it('caldav 日历删除应走 deleteExternalEvent', async () => {
      const now = Date.now()
      mockCalendarGetAll.mockResolvedValue([
        {
          id: '11', name: 'CalDAV日历', color: '#8B5CF6', type: 'caldav',
          visible: true, syncEnabled: true, accountId: 'acc2',
          accountType: 'caldav', serverUrl: 'https://caldav.example.com',
          username: 'user@caldav.com', encryptedPassword: 'enc2',
          calendarUrl: 'https://caldav.example.com/cal', readOnly: false,
        },
      ])
      mockEventGetAll.mockResolvedValue([
        { id: '102', title: 'CalDAV事件', calendarId: '11', startTime: now, endTime: now + 3600000, allDay: false, externalId: 'ext-102', createdAt: now, updatedAt: now },
      ])
      mockDeleteExternalEvent.mockResolvedValue({ success: true })

      const { useCalendarStore } = await import('@/stores/calendar')
      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('102')

      expect(mockDeleteExternalEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'acc2',
          accountType: 'caldav',
          eventId: 'ext-102',
        })
      )
    })
  })
})
