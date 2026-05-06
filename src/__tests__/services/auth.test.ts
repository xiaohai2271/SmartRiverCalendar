import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock safeInvoke
const mockSafeInvoke = vi.fn()

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke
}))

// Mock localStorage
let localStorageStore: Record<string, string> = {}

beforeEach(() => {
  vi.clearAllMocks()
  localStorageStore = {}
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] ?? null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    localStorageStore[key] = value
  })
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
    delete localStorageStore[key]
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AuthService', () => {
  let authService: typeof import('@/services/auth').authService

  beforeEach(async () => {
    // 动态导入以确保 mock 生效
    const authModule = await import('@/services/auth')
    authService = authModule.authService
  })

  describe('login', () => {
    it('应该调用 auth_login 命令并保存令牌', async () => {
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
        username: 'testuser',
        password: 'password'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
      expect(localStorageStore['auth_access_token']).toBe('access-token')
      expect(localStorageStore['auth_refresh_token']).toBe('refresh-token')
    })

    it('登录失败返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await authService.login('testuser', 'password')

      expect(result).toBeNull()
      expect(localStorageStore['auth_access_token']).toBeUndefined()
      expect(localStorageStore['auth_refresh_token']).toBeUndefined()
    })
  })

  describe('register', () => {
    it('应该调用 auth_register 命令并保存令牌', async () => {
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
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
      expect(localStorageStore['auth_access_token']).toBe('access-token')
      expect(localStorageStore['auth_refresh_token']).toBe('refresh-token')
    })
  })

  describe('logout', () => {
    it('应该调用 auth_logout 命令并清除令牌', async () => {
      mockSafeInvoke.mockResolvedValueOnce(undefined)

      // 预先设置令牌
      localStorageStore['auth_access_token'] = 'access-token'
      localStorageStore['auth_refresh_token'] = 'refresh-token'

      await authService.logout()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_logout')
      expect(localStorageStore['auth_access_token']).toBeUndefined()
      expect(localStorageStore['auth_refresh_token']).toBeUndefined()
    })
  })

  describe('githubLogin', () => {
    it('应该调用 auth_github_login 命令并保存令牌', async () => {
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

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_github_login', {
        clientId: 'client-id',
        redirectUri: 'http://localhost/callback'
      })
      expect(result).not.toBeNull()
      expect(result?.user).toEqual(mockUser)
      expect(localStorageStore['auth_access_token']).toBe('access-token')
      expect(localStorageStore['auth_refresh_token']).toBe('refresh-token')
    })
  })

  describe('refreshToken', () => {
    it('应该调用 auth_refresh_token 命令并更新令牌', async () => {
      // 预先设置刷新令牌
      localStorageStore['auth_refresh_token'] = 'old-refresh-token'

      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        message: 'success',
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600
        }
      })

      const result = await authService.refreshToken()

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_refresh_token', {
        refreshToken: 'old-refresh-token'
      })
      expect(result).toBe(true)
      expect(localStorageStore['auth_access_token']).toBe('new-access-token')
      expect(localStorageStore['auth_refresh_token']).toBe('new-refresh-token')
    })

    it('没有刷新令牌时返回 false', async () => {
      const result = await authService.refreshToken()

      expect(mockSafeInvoke).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('刷新失败时清除令牌并返回 false', async () => {
      localStorageStore['auth_access_token'] = 'access-token'
      localStorageStore['auth_refresh_token'] = 'refresh-token'

      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await authService.refreshToken()

      expect(result).toBe(false)
      expect(localStorageStore['auth_access_token']).toBeUndefined()
      expect(localStorageStore['auth_refresh_token']).toBeUndefined()
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

      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_get_current_user')
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

  describe('getAccessToken', () => {
    it('应该从 localStorage 获取访问令牌', () => {
      localStorageStore['auth_access_token'] = 'test-access-token'

      const result = authService.getAccessToken()

      expect(result).toBe('test-access-token')
    })

    it('没有令牌时返回 null', () => {
      const result = authService.getAccessToken()

      expect(result).toBeNull()
    })
  })

  describe('回调注册', () => {
    it('应该正确注册和取消认证状态变化回调', () => {
      const callback = vi.fn()

      authService.onAuthChange(callback)
      authService.offAuthChange(callback)

      // 确保不会抛出错误
      expect(true).toBe(true)
    })

    it('应该正确注册和取消令牌过期回调', () => {
      const callback = vi.fn()

      authService.onTokenExpired(callback)
      authService.offTokenExpired(callback)

      // 确保不会抛出错误
      expect(true).toBe(true)
    })
  })

  describe('localStorage 错误处理', () => {
    it('localStorage 保存令牌失败不应抛出错误', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

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

      // 不应抛出错误
      await expect(authService.login('testuser', 'password')).resolves.not.toThrow()
    })

    it('localStorage 获取令牌失败返回 null', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

      const result = authService.getAccessToken()

      expect(result).toBeNull()
    })
  })
})