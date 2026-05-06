/**
 * 端到端同步流程测试
 *
 * 验证完整的认证 → 同步触发 → 状态更新流程，
 * 模拟用户从登录到触发同步再到状态变更的完整链路。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ===== Mock 依赖 =====

// Mock @tauri-apps/api/event（cloudSync 事件监听依赖）
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

// Mock Tauri 工具函数
const mockSafeInvoke = vi.fn()
const mockIsTauri = vi.fn().mockReturnValue(false)

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke,
  isTauri: mockIsTauri
}))

// Mock authService（auth store 依赖）
const mockLogin = vi.fn()
const mockRegister = vi.fn()
const mockLogout = vi.fn()
const mockGetCurrentUser = vi.fn()
const mockRefreshToken = vi.fn()

vi.mock('@/services/auth', () => ({
  authService: {
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
    getCurrentUser: mockGetCurrentUser,
    refreshToken: mockRefreshToken,
    githubLogin: vi.fn().mockResolvedValue(null),
    checkAuthStatus: vi.fn().mockResolvedValue(null)
  }
}))

describe('同步流程 E2E 测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    // 默认非 Tauri 环境
    mockIsTauri.mockReturnValue(false)
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
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }
      mockLogin.mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'password' })

      expect(result).toBe(true)
      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
    })

    it('登录失败保持未登录状态', async () => {
      mockLogin.mockResolvedValueOnce(null)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const result = await store.login({ username: 'testuser', password: 'wrong' })

      expect(result).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('登出后清除认证和同步状态', async () => {
      mockLogout.mockResolvedValueOnce(undefined)

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      // 模拟已登录状态
      store.user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
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

  // ===== 3. cloudSync 服务（非 Tauri 环境） =====

  describe('cloudSync 服务 - 非 Tauri 环境', () => {
    it('triggerSync 返回 false', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()
      expect(result).toBe(false)
    })

    it('getSyncStatus 返回 null', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()
      expect(result).toBeNull()
    })

    it('startAutoSync 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.startAutoSync(5)).not.toThrow()
    })

    it('stopAutoSync 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.stopAutoSync()).not.toThrow()
    })

    it('cleanupEventListeners 不抛出错误', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      expect(() => cloudSyncService.cleanupEventListeners()).not.toThrow()
    })

    it('initEventListeners 在非 Tauri 环境下不执行', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      await cloudSyncService.initEventListeners()
      // 不应调用 listen
      const { listen } = await import('@tauri-apps/api/event')
      expect(listen).not.toHaveBeenCalled()
    })
  })

  // ===== 4. cloudSync 服务（Tauri 环境） =====

  describe('cloudSync 服务 - Tauri 环境', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true)
    })

    it('未登录时 triggerSync 返回 false', async () => {
      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()
      expect(result).toBe(false)
    })

    it('已登录且同步成功时更新 store 状态', async () => {
      mockSafeInvoke.mockResolvedValueOnce({ success: true })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      // 模拟已登录
      store.isAuthenticated = true
      store.user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(true)
      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()
    })

    it('同步失败时返回 false', async () => {
      mockSafeInvoke.mockResolvedValueOnce({ success: false })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true
      store.user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(false)
      // 同步失败状态应非 success
      expect(store.syncStatus).not.toBe('success')
    })

    it('同步异常时返回 false', async () => {
      mockSafeInvoke.mockRejectedValueOnce(new Error('网络错误'))

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      store.isAuthenticated = true
      store.user = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.triggerSync()

      expect(result).toBe(false)
      // 同步异常状态应非 success
      expect(store.syncStatus).not.toBe('success')
    })

    it('getSyncStatus 调用 cloud_sync_get_status', async () => {
      const mockStatus = {
        status: 'success' as const,
        lastSyncAt: 1234567890,
        pendingChanges: 0
      }
      mockSafeInvoke.mockResolvedValueOnce(mockStatus)

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()

      expect(mockSafeInvoke).toHaveBeenCalledWith('cloud_sync_get_status')
      expect(result).toEqual(mockStatus)
    })

    it('getSyncStatus 失败返回 null', async () => {
      mockSafeInvoke.mockRejectedValueOnce(new Error('获取状态失败'))

      const { cloudSyncService } = await import('@/services/cloudSync')
      const result = await cloudSyncService.getSyncStatus()

      expect(result).toBeNull()
    })
  })

  // ===== 5. 完整同步流程（登录 → 同步 → 登出） =====

  describe('完整同步流程', () => {
    beforeEach(() => {
      mockIsTauri.mockReturnValue(true)
    })

    it('登录 → 触发同步 → 登出 完整链路', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      // 步骤 1: 登录
      mockLogin.mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()

      const loginResult = await store.login({ username: 'testuser', password: 'password' })
      expect(loginResult).toBe(true)
      expect(store.isAuthenticated).toBe(true)

      // 步骤 2: 触发云同步
      mockSafeInvoke.mockResolvedValueOnce({ success: true })
      const { cloudSyncService } = await import('@/services/cloudSync')
      const syncResult = await cloudSyncService.triggerSync()
      expect(syncResult).toBe(true)
      expect(store.syncStatus).toBe('success')
      expect(store.lastSyncAt).not.toBeNull()

      // 步骤 3: 登出
      mockLogout.mockResolvedValueOnce(undefined)
      await store.logout()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.syncStatus).toBe('idle')
      expect(store.lastSyncAt).toBeNull()
    })

    it('登录 → 同步失败 → 重试 → 成功 流程', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      // 登录
      mockLogin.mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      await store.login({ username: 'testuser', password: 'password' })

      // 第一次同步失败
      mockSafeInvoke.mockResolvedValueOnce({ success: false })
      const { cloudSyncService } = await import('@/services/cloudSync')
      const firstResult = await cloudSyncService.triggerSync()
      expect(firstResult).toBe(false)
      expect(store.syncStatus).toBe('error')

      // 重试同步成功
      mockSafeInvoke.mockResolvedValueOnce({ success: true })
      const secondResult = await cloudSyncService.triggerSync()
      expect(secondResult).toBe(true)
      expect(store.syncStatus).toBe('success')
    })

    it('Token 过期触发登出', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        createdAt: 1234567890,
        updatedAt: 1234567890
      }

      // 登录
      mockLogin.mockResolvedValueOnce({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600
      })

      const { useAuthStore } = await import('@/stores/auth')
      const store = useAuthStore()
      await store.login({ username: 'testuser', password: 'password' })
      expect(store.isAuthenticated).toBe(true)

      // Token 刷新失败
      mockRefreshToken.mockResolvedValueOnce(false)
      const refreshResult = await store.refreshToken()
      expect(refreshResult).toBe(false)
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })
  })
})
