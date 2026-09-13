/**
 * 端到端同步流程测试
 *
 * 验证完整的认证 → 同步触发 → 状态更新流程，
 * 模拟用户从登录到触发同步再到状态变更的完整链路。
 *
 * 使用 Repository + PlatformCapabilities 架构的 mock 模式。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// ===== Mock 依赖 =====

// Mock @tauri-apps/api/event（cloudSync 事件监听依赖）
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

// ===== Repository Mocks =====

const mockAuthRepo = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  checkAuthStatus: vi.fn(),
  refreshToken: vi.fn(),
  getPublicKey: vi.fn(),
}

const mockSyncRepo = {
  triggerCloudSync: vi.fn().mockResolvedValue(false),
  connectExchange: vi.fn(),
  connectCalDAV: vi.fn(),
  getAllAccounts: vi.fn().mockResolvedValue([]),
  deleteAccount: vi.fn(),
  getExternalCalendars: vi.fn().mockResolvedValue([]),
  getExternalEvents: vi.fn().mockResolvedValue([]),
  createExternalEvent: vi.fn(),
  updateExternalEvent: vi.fn(),
  deleteExternalEvent: vi.fn(),
  getSyncStatus: vi.fn().mockResolvedValue({ status: 'idle', lastSyncAt: null, pendingChanges: 0 }),
  startAutoSync: vi.fn(),
  stopAutoSync: vi.fn(),
}

const mockCalendarRepo = {
  getAll: vi.fn().mockResolvedValue([]),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockEventRepo = {
  getByDateRange: vi.fn().mockResolvedValue([]),
  getByCalendarId: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockTodoRepo = {
  getAll: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  toggleComplete: vi.fn(),
}

const mockSettingsRepo = {
  loadAppSettings: vi.fn().mockResolvedValue({}),
  saveAppSettings: vi.fn(),
  loadPopupSettings: vi.fn().mockResolvedValue({}),
  savePopupSettings: vi.fn(),
  getUserHolidays: vi.fn().mockResolvedValue([]),
  addUserHoliday: vi.fn(),
  removeUserHoliday: vi.fn(),
}

// ===== 能力声明 Mock =====

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
  hasOAuthCallback: true,
  hasSsoLogin: false,
  hasExchangeSupport: true,
  hasCalDavSupport: true,
  hasExternalSync: true,
  hasAlwaysOnTop: true,
  hasBackgroundSync: true,
  hasIncrementalSync: false,
  hasClientConflictResolution: true,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    authRepo: mockAuthRepo,
    calendarRepo: mockCalendarRepo,
    eventRepo: mockEventRepo,
    todoRepo: mockTodoRepo,
    settingsRepo: mockSettingsRepo,
    syncRepo: mockSyncRepo,
  }),
  useCapabilities: () => mockCapabilities,
}))

// Mock encryptPassword（auth store 依赖）
vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  clearCachedPublicKey: vi.fn(),
}))

// Mock calendar/todo stores（同步后刷新用 + loginTransition）
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: vi.fn(() => ({
    reloadFromDatabase: vi.fn().mockResolvedValue(undefined),
    loginTransition: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock('@/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    reloadFromDatabase: vi.fn().mockResolvedValue(undefined),
  })),
}))

// 使用 importOriginal 让 auth store 正常工作（Pinia store 需要）

describe('同步流程 E2E 测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // 默认桌面端能力
    mockCapabilities.hasOfflineMode = true
    mockCapabilities.hasLocalDatabase = true
  })

  // ===== 1. 登录流程 =====

  describe('登录流程', () => {
    it('未登录时 store 状态为初始值', async () => {
      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('登录成功后更新 store 状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'password' })

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('登录失败保持未登录状态', async () => {
      mockAuthRepo.login.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.VALIDATION_ERROR,
          message: '登录失败：无效的认证响应',
          platform: 'tauri',
        })
      )

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'wrong' })

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('登出后清除认证和同步状态', async () => {
      mockAuthRepo.logout.mockResolvedValueOnce(undefined)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      // 模拟已登录状态
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }
      store.isAuthenticated = true
      store.syncStatus = 'success'
      store.lastSyncAt = 1234567890

      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })
  })

  // ===== 2. 同步状态管理 =====

  describe('同步状态管理', () => {
    it('同步状态初始为 idle', async () => {
      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      expect(store.syncStatus).toBe('idle')
    })

    it('已登录用户调用 startSync 后状态变为 success', async () => {
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true
      await store.startSync()

      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()
    })

    it('未登录用户调用 startSync 状态保持 idle', async () => {
      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = false
      await store.startSync()

      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('stopSync 将同步状态重置为 idle', async () => {
      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.syncStatus = 'syncing'
      store.stopSync()

      expect(store.syncStatus).toBe('idle')
    })
  })

  // ===== 3. cloudSync 服务（Web 端） =====

  describe('cloudSync 服务 - Web 端', () => {
    beforeEach(() => {
      // Web 端能力
      mockCapabilities.hasOfflineMode = false
      mockCapabilities.hasLocalDatabase = false
    })

    it('triggerSync 通过 syncRepo 同步（需已登录）', async () => {
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)

      // cloudSync 现在统一通过 syncRepo 同步，需已登录
      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      store.isAuthenticated = true

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()
      expect(result).toBe(true)
      expect(mockSyncRepo.triggerCloudSync).toHaveBeenCalled()
    })

    it('triggerSync 失败时返回 false', async () => {
      mockSyncRepo.triggerCloudSync.mockRejectedValueOnce(new Error('网络错误'))

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      store.isAuthenticated = true

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()
      expect(result).toBe(false)
    })

    it('getSyncStatus 通过 syncRepo 获取状态', async () => {
      mockSyncRepo.getSyncStatus.mockResolvedValueOnce({
        status: 'idle',
        lastSyncAt: null,
        pendingChanges: 0,
      })

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()
      expect(mockSyncRepo.getSyncStatus).toHaveBeenCalled()
      expect(result).toEqual({
        status: 'idle',
        lastSyncAt: null,
        pendingChanges: 0,
      })
    })

    it('startAutoSync 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.startAutoSync(5)).not.toThrow()
    })

    it('initEventListeners 在非后台同步平台不执行', async () => {
      mockCapabilities.hasBackgroundSync = false

      const { cloudSyncService } = await import('@/services/cloudSync')
      await expect(cloudSyncService.initEventListeners()).resolves.toBeUndefined()
      // 不应调用 listen
      const { listen } = await import('@tauri-apps/api/event')
      expect(listen).not.toHaveBeenCalled()
    })

    it('stopAutoSync 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.stopAutoSync()).not.toThrow()
    })

    it('cleanupEventListeners 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.cleanupEventListeners()).not.toThrow()
    })
  })

  // ===== 4. cloudSync 服务（桌面端） =====

  describe('cloudSync 服务 - 桌面端', () => {
    beforeEach(() => {
      // 桌面端能力
      mockCapabilities.hasOfflineMode = true
      mockCapabilities.hasLocalDatabase = true
    })

    it('未登录时 triggerSync 返回 false', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()
      expect(result).toBe(false)
    })

    it('已登录且同步成功时更新 store 状态', async () => {
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      // 模拟已登录
      store.isAuthenticated = true
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(true)
      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()
    })

    it('同步失败时返回 false', async () => {
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(false)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(false)
      expect(store.syncStatus).not.toBe('success')
    })

    it('同步异常时返回 false', async () => {
      mockSyncRepo.triggerCloudSync.mockRejectedValueOnce(new Error('网络错误'))

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(false)
      expect(store.syncStatus).not.toBe('success')
    })

    it('getSyncStatus 通过 syncRepo 获取状态', async () => {
      mockSyncRepo.getSyncStatus.mockResolvedValueOnce({
        status: 'success',
        lastSyncAt: 1234567890,
        pendingChanges: 0,
      })

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()

      expect(mockSyncRepo.getSyncStatus).toHaveBeenCalled()
      expect(result).toEqual({
        status: 'success',
        lastSyncAt: 1234567890,
        pendingChanges: 0,
      })
    })

    it('getSyncStatus 失败返回 null', async () => {
      mockSyncRepo.getSyncStatus.mockRejectedValueOnce(new Error('获取状态失败'))

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()

      expect(result).toBeNull()
    })
  })

  // ===== 5. 完整同步流程（登录 → 同步 → 登出） =====

  describe('完整同步流程', () => {
    beforeEach(() => {
      // 桌面端能力
      mockCapabilities.hasOfflineMode = true
      mockCapabilities.hasLocalDatabase = true
    })

    it('登录 → 触发同步 → 登出 完整链路', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      // 步骤 1: 登录
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const loginResult = await store.login({ username: 'testuser', password: 'password' })
      expect(loginResult).toBe(true)
      expect(store.isAuthenticated).toBe(true)

      // 步骤 2: 触发云同步（通过 syncRepo）
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)
      const { cloudSyncService } = await import('@/services/cloudSync')
      const syncResult = await cloudSyncService.triggerSync()
      expect(syncResult).toBe(true)
      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()

      // 步骤 3: 登出
      mockAuthRepo.logout.mockResolvedValueOnce(undefined)
      await store.logout()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('登录 → 同步失败 → 重试 → 成功 流程', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      // 登录
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      await store.login({ username: 'testuser', password: 'password' })

      // 第一次同步失败
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(false)
      const { cloudSyncService } = await import('@/services/cloudSync')
      const firstResult = await cloudSyncService.triggerSync()
      expect(firstResult).toBe(false)
      expect(['error', 'offline']).toContain(store.syncStatus)

      // 重试同步成功
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)
      const secondResult = await cloudSyncService.triggerSync()
      expect(secondResult).toBe(true)
      expect(store.syncStatus).toBe('success')
    })

    it('Token 过期触发登出', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }

      // 登录
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      await store.login({ username: 'testuser', password: 'password' })
      expect(store.isAuthenticated).toBe(true)

      // Token 刷新失败
      mockAuthRepo.refreshToken.mockResolvedValueOnce(false)
      const refreshResult = await store.refreshToken()
      expect(refreshResult).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })
})
