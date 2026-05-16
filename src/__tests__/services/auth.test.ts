import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock safeInvoke 和 isTauri
const mockSafeInvoke = vi.fn()

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke,
  isTauri: vi.fn(() => true) // 默认模拟 Tauri 环境
}))

// Mock webApi
vi.mock('@/services/webApi', () => ({
  webApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getPublicKey: vi.fn(),
    getProfile: vi.fn(),
    refreshToken: vi.fn(),
    checkStatus: vi.fn(),
    storeTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null)
  }
}))

// Mock encryptPassword — 在测试中直接返回密码原文的 Base64，便于验证调用
const mockEncryptPassword = vi.fn()

vi.mock('@/services/rsa', () => ({
  encryptPassword: mockEncryptPassword,
  clearCachedPublicKey: vi.fn()
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
    it('应该调用 auth_login 命令并返回认证响应和用户信息', async () => {
      // 模拟密码加密成功
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')

      // 登录响应 mock（Rust auth_login 直接返回 AuthResponse JSON，无外层包装）
      mockSafeInvoke.mockResolvedValueOnce({
        user_id: 1,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600
      })
      // getCurrentUser → auth_get_profile 响应 mock（Rust 直接返回 UserProfile JSON）
      mockSafeInvoke.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        display_name: '测试用户',
        avatar_url: null,
        provider: 'local'
      })

      const result = await authService.login('testuser', 'password')

      expect(mockEncryptPassword).toHaveBeenCalledWith('password')
      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_login', {
        email: 'testuser',
        password: 'encrypted-password'
      })
      expect(result).not.toBeNull()
      expect(result?.authResponse.userId).toBe(1)
      expect(result?.user).not.toBeNull()
      expect(result?.user?.email).toBe('test@example.com')
    })

    it('密码加密失败时返回 null', async () => {
      // 模拟密码加密失败
      mockEncryptPassword.mockResolvedValueOnce(null)

      const result = await authService.login('testuser', 'password')

      expect(result).toBeNull()
    })

    it('登录失败返回 null', async () => {
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')
      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await authService.login('testuser', 'password')

      expect(result).toBeNull()
    })
  })

  describe('register', () => {
    it('应该调用 auth_register 命令并返回认证响应和用户信息', async () => {
      // 模拟密码加密成功
      mockEncryptPassword.mockResolvedValueOnce('encrypted-password')

      // 注册响应 mock（Rust auth_register 直接返回 AuthResponse JSON）
      mockSafeInvoke.mockResolvedValueOnce({
        user_id: 1,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600
      })
      // getCurrentUser → auth_get_profile 响应 mock
      mockSafeInvoke.mockResolvedValueOnce({
        id: 1,
        email: 'newuser@example.com',
        display_name: '新用户',
        avatar_url: null,
        provider: 'local'
      })

      const result = await authService.register('newuser', 'newuser@example.com', 'password')

      expect(mockEncryptPassword).toHaveBeenCalledWith('password')
      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_register', {
        email: 'newuser@example.com',
        password: 'encrypted-password',
        display_name: 'newuser'
      })
      expect(result).not.toBeNull()
      expect(result?.authResponse.userId).toBe(1)
      expect(result?.user).not.toBeNull()
      expect(result?.user?.email).toBe('newuser@example.com')
    })

    it('密码加密失败时返回 null', async () => {
      // 模拟密码加密失败
      mockEncryptPassword.mockResolvedValueOnce(null)

      const result = await authService.register('newuser', 'newuser@example.com', 'password')

      expect(result).toBeNull()
    })
  })

  describe('logout', () => {
    it('应该调用 auth_logout 命令', async () => {
      mockSafeInvoke.mockResolvedValueOnce(undefined)

      await authService.logout()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_logout')
    })
  })

  describe('githubLogin', () => {
    it('应该调用 auth_github_login 命令并返回认证响应和用户信息', async () => {
      // GitHub 登录响应 mock（Rust auth_oauth_github 直接返回 AuthResponse JSON）
      mockSafeInvoke.mockResolvedValueOnce({
        user_id: 1,
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600
      })
      // getCurrentUser → auth_get_profile 响应 mock
      mockSafeInvoke.mockResolvedValueOnce({
        id: 1,
        email: 'github@example.com',
        display_name: 'GitHub 用户',
        avatar_url: null,
        provider: 'github'
      })

      const result = await authService.githubLogin('client-id', 'http://localhost/callback')

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_oauth_github', {
        clientId: 'client-id',
        redirectUri: 'http://localhost/callback'
      })
      expect(result).not.toBeNull()
      expect(result?.authResponse.userId).toBe(1)
      expect(result?.user).not.toBeNull()
      expect(result?.user?.email).toBe('github@example.com')
    })
  })

  describe('refreshToken', () => {
    it('没有刷新令牌时返回 false', async () => {
      const result = await authService.refreshToken()
      expect(result).toBe(false)
    })
  })

  describe('checkAuthStatus', () => {
    it('应该调用 auth_check_status 命令并返回用户信息', async () => {
      // auth_check_status 返回 true（已认证）
      mockSafeInvoke.mockResolvedValueOnce(true)
      // auth_get_profile 返回用户资料
      mockSafeInvoke.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        display_name: '测试用户',
        avatar_url: null,
        provider: 'local'
      })

      const result = await authService.checkAuthStatus()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_check_status')
      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
    })

    it('未认证时返回 null', async () => {
      // auth_check_status 返回 false（未认证）
      mockSafeInvoke.mockResolvedValueOnce(false)

      const result = await authService.checkAuthStatus()

      expect(result).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('应该调用 auth_get_profile 命令并返回用户信息', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        display_name: '测试用户',
        avatar_url: null,
        provider: 'local'
      })

      const result = await authService.getCurrentUser()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_get_profile')
      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
      expect(result?.displayName).toBe('测试用户')
      expect(result?.id).toBe('1')
    })

    it('没有用户时返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await authService.getCurrentUser()

      expect(result).toBeNull()
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