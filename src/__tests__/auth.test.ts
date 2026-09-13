import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// Mock authRepo
const mockAuthRepo = {
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  checkAuthStatus: vi.fn(),
  refreshToken: vi.fn(),
  getPublicKey: vi.fn(),
  loginWithOAuth: vi.fn(),
}

// Mock syncRepo
const mockSyncRepo = {
  triggerCloudSync: vi.fn(),
  connectExchange: vi.fn(),
  connectCalDAV: vi.fn(),
  getAllAccounts: vi.fn(),
  deleteAccount: vi.fn(),
  getExternalCalendars: vi.fn(),
  getExternalEvents: vi.fn(),
  createExternalEvent: vi.fn(),
  updateExternalEvent: vi.fn(),
  deleteExternalEvent: vi.fn(),
  getSyncStatus: vi.fn(),
  startAutoSync: vi.fn(),
  stopAutoSync: vi.fn(),
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
  hasOAuthCallback: true,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    authRepo: mockAuthRepo,
    calendarRepo: {},
    eventRepo: {
      getByTimeRangeAndCalendars: vi.fn().mockResolvedValue([]),
      getCount: vi.fn().mockResolvedValue(0),
      getUpcoming: vi.fn().mockResolvedValue([]),
      search: vi.fn().mockResolvedValue([]),
    },
    todoRepo: {},
    settingsRepo: {},
    syncRepo: mockSyncRepo,
  }),
  useCapabilities: () => mockCapabilities,
}))

// Mock encryptPassword
const mockEncryptPassword = vi.fn()

vi.mock('@/services/rsa', () => ({
  encryptPassword: mockEncryptPassword,
  clearCachedPublicKey: vi.fn(),
}))

describe('auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('默认认证状态为未登录', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
      expect(store.isInitialized).toBe(false)
    })

    it('authState 计算属性正确反映状态', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      expect(store.authState).toEqual({
        isAuthenticated: false,
        user: null,
        syncStatus: 'idle',
        lastSyncAt: null,
        isInitialized: false,
      })
    })
  })

  describe('initialize', () => {
    it('从 authRepo 恢复认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local' as const,
      }
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(true)
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()

      expect(mockAuthRepo.checkAuthStatus).toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(store.isInitialized).toBe(true)
    })

    it('认证失败时保持未登录状态', async () => {
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(false)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.isInitialized).toBe(true)
    })

    it('getCurrentUser 抛出 NOT_FOUND 时清除认证状态', async () => {
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(true)
      mockAuthRepo.getCurrentUser.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.NOT_FOUND,
          message: '未找到当前用户',
          platform: 'tauri',
        })
      )

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.isInitialized).toBe(true)
    })

    it('只初始化一次', async () => {
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(false)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()
      await store.initialize()

      expect(mockAuthRepo.checkAuthStatus).toHaveBeenCalledTimes(1)
    })
  })

  describe('login', () => {
    it('登录成功更新认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local' as const,
      }
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'password' })

      expect(mockEncryptPassword).toHaveBeenCalledWith('password')
      expect(mockAuthRepo.login).toHaveBeenCalledWith('testuser', 'encrypted-password')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('登录成功但获取用户信息失败时回滚认证状态', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.NOT_FOUND,
          message: '未找到当前用户',
          platform: 'tauri',
        })
      )

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'password' })

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('登录失败保持未登录状态', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockAuthRepo.login.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.VALIDATION_ERROR,
          message: '登录失败：无效的认证响应',
          platform: 'tauri',
        })
      )

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'wrong-password' })

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  describe('register', () => {
    it('注册成功更新认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'newuser@example.com',
        displayName: '新用户',
        provider: 'local' as const,
      }
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockAuthRepo.register.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.register({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password',
      })

      expect(mockAuthRepo.register).toHaveBeenCalledWith('newuser@example.com', 'encrypted-password', 'newuser')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('loginWithGithub', () => {
    it('GitHub 登录成功更新认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'github@example.com',
        displayName: 'GitHub 用户',
        provider: 'github' as const,
      }
      mockAuthRepo.loginWithOAuth.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.loginWithGithub('client-id', 'http://localhost/callback')

      expect(mockAuthRepo.loginWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        clientId: 'client-id',
        redirectUri: 'http://localhost/callback',
      })
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('登出清除认证状态', async () => {
      mockAuthRepo.logout.mockResolvedValueOnce(undefined)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      }
      store.isAuthenticated = true
      store.syncStatus = 'syncing'
      store.lastSyncAt = 1234567890

      await store.logout()

      expect(mockAuthRepo.logout).toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('登出失败仍清除本地状态', async () => {
      mockAuthRepo.logout.mockRejectedValueOnce(new Error('登出失败'))

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      }
      store.isAuthenticated = true

      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('刷新成功保持认证状态', async () => {
      mockAuthRepo.refreshToken.mockResolvedValueOnce(true)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      }
      store.isAuthenticated = true

      const result = await store.refreshToken()

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).not.toBeNull()
    })

    it('刷新失败清除认证状态', async () => {
      mockAuthRepo.refreshToken.mockResolvedValueOnce(false)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      }
      store.isAuthenticated = true

      const result = await store.refreshToken()

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  describe('checkAuthStatus', () => {
    it('检查成功更新认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local' as const,
      }
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.checkAuthStatus()

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('检查失败清除认证状态', async () => {
      mockAuthRepo.getCurrentUser.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.NOT_FOUND,
          message: '未找到当前用户',
          platform: 'tauri',
        })
      )

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.checkAuthStatus()

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  describe('startSync/stopSync', () => {
    it('startSync 更新同步状态为 success', async () => {
      mockSyncRepo.triggerCloudSync.mockResolvedValueOnce(true)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true

      await store.startSync()

      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()
    })

    it('startSync 未登录时跳过', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = false

      await store.startSync()

      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('stopSync 重置同步状态', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      store.syncStatus = 'syncing'

      store.stopSync()

      expect(store.syncStatus).toBe('idle')
    })
  })
})
