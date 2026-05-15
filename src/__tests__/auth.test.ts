import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock authService
const mockGetCurrentUser = vi.fn()
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockGithubLogin = vi.fn()
const mockLogout = vi.fn()
const mockRefreshToken = vi.fn()

vi.mock('@/services/auth', () => ({
  authService: {
    getCurrentUser: mockGetCurrentUser,
    login: mockLogin,
    register: mockRegister,
    githubLogin: mockGithubLogin,
    logout: mockLogout,
    refreshToken: mockRefreshToken
  }
}))

describe('auth Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
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
        isInitialized: false
      })
    })
  })

  describe('initialize', () => {
    it('从 authService 恢复认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local' as const
      }
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()

      expect(mockGetCurrentUser).toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(store.isInitialized).toBe(true)
    })

    it('认证失败时保持未登录状态', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.isInitialized).toBe(true)
    })

    it('只初始化一次', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      await store.initialize()
      await store.initialize() // 第二次调用

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('login', () => {
    it('登录成功更新认证状态', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local' as const
      }
      mockLogin.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'password' })

      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('登录失败保持未登录状态', async () => {
      mockLogin.mockResolvedValueOnce(null)

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
        provider: 'local' as const
      }
      mockRegister.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.register({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password'
      })

      expect(mockRegister).toHaveBeenCalledWith('newuser', 'newuser@example.com', 'password')
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
        provider: 'github' as const
      }
      mockGithubLogin.mockResolvedValueOnce({
        userId: 1,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.loginWithGithub('client-id', 'http://localhost/callback')

      expect(mockGithubLogin).toHaveBeenCalledWith('client-id', 'http://localhost/callback')
      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })
  })

  describe('logout', () => {
    it('登出清除认证状态', async () => {
      // 先登录
      mockLogout.mockResolvedValueOnce(undefined)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 手动设置已登录状态
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }
      store.isAuthenticated = true
      store.syncStatus = 'syncing'
      store.lastSyncAt = 1234567890

      await store.logout()

      expect(mockLogout).toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('登出失败仍清除本地状态', async () => {
      mockLogout.mockRejectedValueOnce(new Error('登出失败'))

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 手动设置已登录状态
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }
      store.isAuthenticated = true

      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })

  describe('refreshToken', () => {
    it('刷新成功保持认证状态', async () => {
      mockRefreshToken.mockResolvedValueOnce(true)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 手动设置已登录状态
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
      }
      store.isAuthenticated = true

      const result = await store.refreshToken()

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).not.toBeNull()
    })

    it('刷新失败清除认证状态', async () => {
      mockRefreshToken.mockResolvedValueOnce(false)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 手动设置已登录状态
      store.user = {
        id: '1',
        email: 'test@example.com',
        displayName: '测试用户',
        provider: 'local'
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
        provider: 'local' as const
      }
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      const result = await store.checkAuthStatus()

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('检查失败清除认证状态', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null)

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
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 设置已登录状态
      store.isAuthenticated = true

      await store.startSync()

      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()
    })

    it('startSync 未登录时跳过', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 保持未登录状态
      store.isAuthenticated = false

      await store.startSync()

      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('stopSync 重置同步状态', async () => {
      const { useAuthStore } = await import('../stores/auth')
      const store = useAuthStore()

      // 设置同步状态
      store.syncStatus = 'syncing'

      store.stopSync()

      expect(store.syncStatus).toBe('idle')
    })
  })
})