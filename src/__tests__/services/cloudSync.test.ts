import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri 依赖
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

vi.mock('@/utils/tauri', () => ({
  safeInvoke: vi.fn().mockResolvedValue({}),
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

describe('cloudSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('在非 Tauri 环境下 triggerSync 通过 syncRepo 同步', async () => {
    mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(false)

    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.triggerSync()

    // Web 端通过 syncRepo 同步，mock 返回 false
    expect(result).toBe(false)
  })

  it('在非 Tauri 环境下 getSyncStatus 返回默认状态', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.getSyncStatus()

    // Web 端不支持详细同步状态
    expect(result).toBeNull()
  })

  it('在非 Tauri 环境下 startAutoSync 不抛出错误', async () => {
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
