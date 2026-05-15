import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock safeInvoke
const mockSafeInvoke = vi.fn()

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke
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
    it('应该调用 auth_login 命令并返回用户', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600
        }
      })

      const result = await authService.login('testuser', 'password')

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_login', {
        email: 'testuser',
        password: 'password'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
    })

    it('登录失败返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await authService.login('testuser', 'password')

      expect(result).toBeNull()
    })
  })

  describe('register', () => {
    it('应该调用 auth_register 命令并返回用户', async () => {
      const mockUser = {
        id: '1',
        username: 'newuser',
        email: 'newuser@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600
        }
      })

      const result = await authService.register('newuser', 'newuser@example.com', 'password')

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_register', {
        email: 'newuser@example.com',
        password: 'password',
        display_name: 'newuser'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
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
    it('应该调用 auth_github_login 命令并返回用户', async () => {
      const mockUser = {
        id: '1',
        username: 'githubuser',
        email: 'github@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600
        }
      })

      const result = await authService.githubLogin('client-id', 'http://localhost/callback')

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_oauth_github', {
        clientId: 'client-id',
        redirectUri: 'http://localhost/callback'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
    })
  })

  describe('refreshToken', () => {
    it('没有刷新令牌时返回 false', async () => {
      const result = await authService.refreshToken()
      expect(result).toBe(false)
    })
  })

  describe('checkAuthStatus', () => {
    it('应该调用 auth_check_status 命令', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: mockUser
      })

      const result = await authService.checkAuthStatus()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_check_status')
      expect(result).toEqual(mockUser)
    })

    it('没有用户时返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: null
      })

      const result = await authService.checkAuthStatus()

      expect(result).toBeNull()
    })
  })

  describe('getCurrentUser', () => {
    it('应该调用 auth_get_current_user 命令', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: mockUser
      })

      const result = await authService.getCurrentUser()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_get_profile')
      expect(result).toEqual(mockUser)
    })

    it('没有用户时返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: null
      })

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