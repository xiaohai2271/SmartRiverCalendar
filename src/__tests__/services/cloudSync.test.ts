import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

// Mock syncRepo
const mockSyncRepo = {
  triggerCloudSync: vi.fn().mockResolvedValue(false),
  getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
  connectExchange: vi.fn(),
  connectCalDAV: vi.fn(),
  getAllAccounts: vi.fn().mockResolvedValue([]),
  deleteAccount: vi.fn(),
  getExternalCalendars: vi.fn().mockResolvedValue([]),
  getExternalEvents: vi.fn().mockResolvedValue([]),
  createExternalEvent: vi.fn(),
  updateExternalEvent: vi.fn(),
  deleteExternalEvent: vi.fn(),
  startAutoSync: vi.fn(),
  stopAutoSync: vi.fn(),
}

// Web 端能力（无离线模式）
const webCapabilities = {
  hasLocalDatabase: false,
  hasOfflineMode: false,
  dataPriority: 'remote-first' as const,
  hasReminderPopup: false,
  hasSystemNotification: true,
  hasSnoozeReminder: false,
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,
  hasSsoLogin: false,
  hasExchangeSupport: false,
  hasCalDavSupport: false,
  hasExternalSync: false,
  hasAlwaysOnTop: false,
  hasBackgroundSync: false,
  hasIncrementalSync: false,
  hasClientConflictResolution: false,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: webCapabilities,
    authRepo: {},
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    settingsRepo: {},
    syncRepo: mockSyncRepo,
  }),
  useCapabilities: () => webCapabilities,
}))

// Mock Pinia stores
const mockAuthStore = {
  isAuthenticated: true,
  syncStatus: 'idle',
  lastSyncAt: null as number | null,
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

// Mock calendar/todo stores（同步后刷新用）
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: vi.fn(() => ({
    reloadFromDatabase: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    reloadFromDatabase: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('cloudSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('通过 syncRepo 触发同步', async () => {
    mockAuthStore.isAuthenticated = true
    mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)

    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.triggerSync()

    expect(mockSyncRepo.triggerCloudSync).toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('syncRepo 同步失败返回 false', async () => {
    mockAuthStore.isAuthenticated = true
    mockSyncRepo.triggerCloudSync.mockRejectedValueOnce(new Error('网络错误'))

    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.triggerSync()

    expect(result).toBe(false)
  })

  it('未登录时返回 false', async () => {
    mockAuthStore.isAuthenticated = false

    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.triggerSync()

    expect(result).toBe(false)
  })

  it('getSyncStatus 通过 syncRepo 获取状态', async () => {
    mockSyncRepo.getSyncStatus.mockResolvedValueOnce({
      status: 'idle',
      lastSyncAt: null,
      pendingChanges: 0,
    })

    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.getSyncStatus()

    expect(mockSyncRepo.getSyncStatus).toHaveBeenCalled()
    expect(result).toEqual({
      status: 'idle',
      lastSyncAt: null,
      pendingChanges: 0,
    })
  })

  it('startAutoSync 不抛出错误', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.startAutoSync(5)).not.toThrow()
  })

  it('stopAutoSync 正常执行', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.stopAutoSync()).not.toThrow()
  })

  it('cleanupEventListeners 正常执行', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.cleanupEventListeners()).not.toThrow()
  })
})
