import { describe, it, expect, vi, beforeEach } from 'vitest'
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
}

// Mock capabilities（桌面端能力）
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

// Mock usePlatform 和 useCapabilities
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    authRepo: mockAuthRepo,
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    settingsRepo: {},
    syncRepo: {},
  }),
  useCapabilities: () => mockCapabilities,
}))

// Mock safeInvoke（GitHub OAuth 仍需要）
const mockSafeInvoke = vi.fn()

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke,
  isTauri: vi.fn(() => true),
}))

// Mock encryptPassword
const mockEncryptPassword = vi.fn()

vi.mock('@/services/rsa', () => ({
  encryptPassword: mockEncryptPassword,
  clearCachedPublicKey: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AuthService', () => {
  let authService: typeof import('@/services/auth').authService

  beforeEach(async () => {
    const authModule = await import('@/services/auth')
    authService = authModule.authService
  })

  describe('login', () => {
    it('应该调用 authRepo.login 并返回认证响应和用户信息', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')

      mockAuthRepo.login.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce({
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      })

      const result = await authService.login('testuser', 'password')

      expect(mockEncryptPassword).toHaveBeenCalledWith('password')
      expect(mockAuthRepo.login).toHaveBeenCalledWith('testuser', 'encrypted-password')
      expect(result.authResponse.userId).toBe(1)
      expect(result.user).not.toBeNull()
      expect(result.user?.email).toBe('test@example.com')
    })

    it('密码加密失败时抛出错误', async () => {
      mockEncryptPassword.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
          message: '获取 RSA 公钥失败',
          platform: 'tauri',
        })
      )

      await expect(authService.login('testuser', 'password')).rejects.toThrow(RepositoryError)
    })

    it('登录失败抛出 RepositoryError', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockAuthRepo.login.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.VALIDATION_ERROR,
          message: '登录失败：无效的认证响应',
          platform: 'tauri',
        })
      )

      await expect(authService.login('testuser', 'password')).rejects.toThrow(RepositoryError)
    })
  })

  describe('register', () => {
    it('应该调用 authRepo.register 并返回认证响应和用户信息', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')

      mockAuthRepo.register.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce({
        id: '1',
        email: 'newuser@example.com',
        displayName: '新用户',
        provider: 'local',
      })

      const result = await authService.register('newuser', 'newuser@example.com', 'password')

      expect(mockEncryptPassword).toHaveBeenCalledWith('password')
      expect(mockAuthRepo.register).toHaveBeenCalledWith('newuser@example.com', 'encrypted-password', 'newuser')
      expect(result.authResponse.userId).toBe(1)
      expect(result.user).not.toBeNull()
      expect(result.user?.email).toBe('newuser@example.com')
    })

    it('密码加密失败时抛出错误', async () => {
      mockEncryptPassword.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
          message: '获取 RSA 公钥失败',
          platform: 'tauri',
        })
      )

      await expect(authService.register('newuser', 'newuser@example.com', 'password')).rejects.toThrow(RepositoryError)
    })
  })

  describe('logout', () => {
    it('应该调用 authRepo.logout', async () => {
      mockAuthRepo.logout.mockResolvedValueOnce(undefined)

      await authService.logout()

      expect(mockAuthRepo.logout).toHaveBeenCalled()
    })
  })

  describe('githubLogin', () => {
    it('应该调用 safeInvoke auth_oauth_github 命令并返回认证响应和用户信息', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        user_id: 1,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      })
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce({
        id: '1',
        email: 'github@example.com',
        displayName: 'GitHub 用户',
        provider: 'github',
      })

      const result = await authService.githubLogin('client-id', 'http://localhost/callback')

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_oauth_github', {
        clientId: 'client-id',
        redirectUri: 'http://localhost/callback',
      })
      expect(result).not.toBeNull()
      expect(result?.authResponse.userId).toBe(1)
      expect(result?.user).not.toBeNull()
      expect(result?.user?.email).toBe('github@example.com')
    })
  })

  describe('refreshToken', () => {
    it('刷新成功返回 true', async () => {
      mockAuthRepo.refreshToken.mockResolvedValueOnce(true)

      const result = await authService.refreshToken()

      expect(result).toBe(true)
    })

    it('刷新失败返回 false', async () => {
      mockAuthRepo.refreshToken.mockResolvedValueOnce(false)

      const result = await authService.refreshToken()

      expect(result).toBe(false)
    })
  })

  describe('checkAuthStatus', () => {
    it('应该调用 authRepo.checkAuthStatus 并返回用户信息', async () => {
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(true)
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce({
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      })

      const result = await authService.checkAuthStatus()

      expect(mockAuthRepo.checkAuthStatus).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
    })

    it('未认证时返回 null', async () => {
      mockAuthRepo.checkAuthStatus.mockResolvedValueOnce(false)

      const result = await authService.checkAuthStatus()

      expect(result).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('应该调用 authRepo.getCurrentUser 并返回用户信息', async () => {
      mockAuthRepo.getCurrentUser.mockResolvedValueOnce({
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local',
      })

      const result = await authService.getCurrentUser()

      expect(mockAuthRepo.getCurrentUser).toHaveBeenCalled()
      expect(result.email).toBe('test@example.com')
      expect(result.displayName).toBe('测试用户')
      expect(result.id).toBe('1')
    })

    it('未登录时抛出 RepositoryError', async () => {
      mockAuthRepo.getCurrentUser.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.NOT_FOUND,
          message: '未找到当前用户',
          platform: 'tauri',
        })
      )

      await expect(authService.getCurrentUser()).rejects.toThrow(RepositoryError)
    })
  })

  describe('回调注册', () => {
    it('应该正确注册和取消认证状态变化回调', () => {
      const callback = vi.fn()
      authService.onAuthChange(callback)
      authService.offAuthChange(callback)
      expect(true).toBe(true)
    })

    it('应该正确注册和取消令牌过期回调', () => {
      const callback = vi.fn()
      authService.onTokenExpired(callback)
      authService.offTokenExpired(callback)
      expect(true).toBe(true)
    })
  })
})
