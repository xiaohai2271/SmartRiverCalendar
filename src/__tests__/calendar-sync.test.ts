import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock 平台依赖
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
      triggerCloudSync: vi.fn().mockResolvedValue(true),
      recordPendingChange: vi.fn().mockResolvedValue(undefined),
      pushPendingChanges: vi.fn().mockResolvedValue({ pushed: 0, failed: 0 }),
      triggerExternalSync: vi.fn().mockResolvedValue(true),
      startExternalSync: vi.fn().mockResolvedValue(true),
      stopExternalSync: vi.fn().mockResolvedValue(true),
      onExternalSyncComplete: vi.fn().mockResolvedValue(() => {}),
      onSyncComplete: vi.fn().mockResolvedValue(() => {}),
      onSyncError: vi.fn().mockResolvedValue(() => {}),
      onAuthTokenExpired: vi.fn().mockResolvedValue(() => {}),
      getAllAccounts: vi.fn().mockResolvedValue([]),
      getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
      startAutoSync: vi.fn(),
      stopAutoSync: vi.fn(),
    },
    calendarRepo: {
      getAll: vi.fn().mockResolvedValue([
        { id: '1', name: '本地日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
        { id: '2', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ]),
      create: vi.fn().mockResolvedValue({ id: '1', name: '本地日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false }),
      updateType: vi.fn().mockResolvedValue({ id: '1', name: '本地日历', color: '#4A90D9', type: 'online', visible: true, syncEnabled: true }),
    },
    eventRepo: {
      getAll: vi.fn().mockResolvedValue([]),
      getByTimeRangeAndCalendars: vi.fn().mockResolvedValue([]),
      getCount: vi.fn().mockResolvedValue(0),
      getUpcoming: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: '1', title: 'test', calendarId: '1', startTime: 0, endTime: 0, allDay: false, createdAt: 0, updatedAt: 0 }),
      update: vi.fn().mockResolvedValue({ id: '1', title: 'test', calendarId: '1', startTime: 0, endTime: 0, allDay: false, createdAt: 0, updatedAt: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
      createWithSync: vi.fn().mockResolvedValue({ id: '1', title: 'test', calendarId: '1', startTime: 0, endTime: 0, allDay: false, createdAt: 0, updatedAt: 0 }),
      updateWithSync: vi.fn().mockResolvedValue({ id: '1', title: 'test', calendarId: '1', startTime: 0, endTime: 0, allDay: false, createdAt: 0, updatedAt: 0 }),
      deleteWithSync: vi.fn().mockResolvedValue(undefined),
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
  useCapabilities: () => ({
    dataPriority: 'local-first',
    hasOfflineMode: true,
    hasLocalDatabase: true,
    hasSystemTray: false,
    hasReminderPopup: false,
    hasSystemNotification: true,
    hasSnoozeReminder: false,
    hasAutoStart: false,
    hasClockHook: false,
    hasMultiWindow: false,
    hasAutoUpdate: false,
    hasMinimizeToTray: false,
    hasProxySettings: false,
    hasOAuthCallback: false,
    hasExternalSync: true,
    hasBackgroundSync: true,
    hasIncrementalSync: false,
    hasClientConflictResolution: true,
  }),
}))

// Mock RSA 加密服务
vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  clearCachedPublicKey: vi.fn(),
}))

describe('Calendar Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should sync calendars after login', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const { useCalendarStore } = await import('@/stores/calendar')

    const authStore = useAuthStore()
    const calendarStore = useCalendarStore()

    await authStore.login({ username: 'test@example.com', password: 'password' })

    expect(calendarStore.calendars.length).toBeGreaterThan(1)

    const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
    expect(localCalendar).toBeDefined()

    const serverCalendars = calendarStore.calendars.filter(c => c.type === 'online')
    expect(serverCalendars.length).toBeGreaterThan(0)
  })

  it('should return valid calendar ID', async () => {
    const { useCalendarStore } = await import('@/stores/calendar')
    const calendarStore = useCalendarStore()

    await calendarStore.initialize()

    const validId = calendarStore.getValidCalendarId(undefined)
    expect(validId).toBeGreaterThan(0)
  })

  it('should return specific calendar ID when provided', async () => {
    const { useCalendarStore } = await import('@/stores/calendar')
    const calendarStore = useCalendarStore()

    await calendarStore.initialize()

    const validId = calendarStore.getValidCalendarId('2')
    expect(validId).toBe(2)
  })
})
