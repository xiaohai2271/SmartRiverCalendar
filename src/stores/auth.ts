import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, CloudSyncStatus, AuthState, LoginRequest, RegisterRequest } from '../types/auth'
import { usePlatform } from '@/platform/provider'
import { encryptPassword, clearCachedPublicKey } from '../services/rsa'

/**
 * 认证 Store
 * 管理用户认证状态和云同步状态
 */
export const useAuthStore = defineStore('auth', () => {
  // State
  const isAuthenticated = ref<boolean>(false)
  const user = ref<User | null>(null)
  const syncStatus = ref<CloudSyncStatus>('idle')
  const lastSyncAt = ref<number | null>(null)
  const isInitialized = ref<boolean>(false)

  // Computed
  const authState = computed<AuthState>(() => ({
    isAuthenticated: isAuthenticated.value,
    user: user.value,
    syncStatus: syncStatus.value,
    lastSyncAt: lastSyncAt.value,
    isInitialized: isInitialized.value
  }))

  /**
   * 初始化认证状态
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return
    }

    try {
      const { authRepo } = usePlatform()
      const isAuth = await authRepo.checkAuthStatus()
      if (isAuth) {
        const currentUser = await authRepo.getCurrentUser()
        if (currentUser) {
          user.value = currentUser
          isAuthenticated.value = true
        }
      }
    } catch (error) {
      console.error('初始化认证状态失败:', error)
      user.value = null
      isAuthenticated.value = false
    } finally {
      isInitialized.value = true
    }
  }

  /**
   * 用户登录
   */
  async function login(credentials: LoginRequest): Promise<boolean> {
    try {
      const { authRepo } = usePlatform()
      // 使用 RSA 加密密码
      const encryptedPassword = await encryptPassword(credentials.password)
      if (!encryptedPassword) {
        console.error('[AuthStore] 密码加密失败，无法登录')
        return false
      }

      const result = await authRepo.login(credentials.username, encryptedPassword)
      if (result) {
        const currentUser = await authRepo.getCurrentUser()
        if (currentUser) {
          user.value = currentUser
          isAuthenticated.value = true
          return true
        } else {
          console.error('[AuthStore] 登录成功但获取用户信息失败，回滚认证状态')
          user.value = null
          isAuthenticated.value = false
          return false
        }
      }
      return false
    } catch (error) {
      console.error('登录失败:', error)
      return false
    }
  }

  /**
   * 用户注册
   */
  async function register(data: RegisterRequest): Promise<boolean> {
    try {
      const { authRepo } = usePlatform()
      const encryptedPassword = await encryptPassword(data.password)
      if (!encryptedPassword) {
        console.error('[AuthStore] 密码加密失败，无法注册')
        return false
      }

      const result = await authRepo.register(data.email, encryptedPassword, data.username)
      if (result) {
        const currentUser = await authRepo.getCurrentUser()
        if (currentUser) {
          user.value = currentUser
          isAuthenticated.value = true
          return true
        } else {
          console.error('[AuthStore] 注册成功但获取用户信息失败，回滚认证状态')
          user.value = null
          isAuthenticated.value = false
          return false
        }
      }
      return false
    } catch (error) {
      console.error('注册失败:', error)
      return false
    }
  }

  /**
   * GitHub OAuth 登录
   */
  async function loginWithGithub(clientId: string, redirectUri: string): Promise<boolean> {
    try {
      const { authRepo, capabilities } = usePlatform()
      if (!capabilities.hasOAuthCallback) {
        console.warn('[AuthStore] GitHub OAuth 登录暂不支持当前平台')
        return false
      }

      // OAuth 通过 Tauri 平台的 safeInvoke 实现
      const { safeInvoke } = await import('@/utils/tauri')
      const response = await safeInvoke<{
        user_id: number
        access_token: string
        refresh_token: string
        expires_in: number
      }>('auth_oauth_github', { clientId, redirectUri })

      if (response?.access_token) {
        const currentUser = await authRepo.getCurrentUser()
        if (currentUser) {
          user.value = currentUser
          isAuthenticated.value = true
          return true
        }
      }
      return false
    } catch (error) {
      console.error('GitHub 登录失败:', error)
      return false
    }
  }

  /**
   * 用户登出
   */
  async function logout(): Promise<void> {
    try {
      const { authRepo } = usePlatform()
      await authRepo.logout()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      // 清除缓存的 RSA 公钥
      clearCachedPublicKey()
      // 无论后端登出是否成功，都清除本地状态
      user.value = null
      isAuthenticated.value = false
      syncStatus.value = 'idle'
      lastSyncAt.value = null
    }
  }

  /**
   * 刷新访问令牌
   */
  async function refreshToken(): Promise<boolean> {
    try {
      const { authRepo } = usePlatform()
      const success = await authRepo.refreshToken()
      if (!success) {
        user.value = null
        isAuthenticated.value = false
      }
      return success
    } catch (error) {
      console.error('刷新令牌失败:', error)
      user.value = null
      isAuthenticated.value = false
      return false
    }
  }

  /**
   * 检查认证状态
   */
  async function checkAuthStatus(): Promise<boolean> {
    try {
      const { authRepo } = usePlatform()
      const currentUser = await authRepo.getCurrentUser()
      if (currentUser) {
        user.value = currentUser
        isAuthenticated.value = true
        return true
      }
      return false
    } catch (error) {
      console.error('检查认证状态失败:', error)
      user.value = null
      isAuthenticated.value = false
      return false
    }
  }

  /**
   * 开始云同步
   */
  async function startSync(): Promise<void> {
    if (!isAuthenticated.value) {
      console.warn('未登录，无法开始同步')
      return
    }

    try {
      syncStatus.value = 'syncing'
      const { syncRepo } = usePlatform()
      await syncRepo.triggerCloudSync()
      syncStatus.value = 'success'
      lastSyncAt.value = Date.now()
    } catch (error) {
      console.error('同步失败:', error)
      syncStatus.value = 'error'
    }
  }

  /**
   * 停止云同步
   */
  function stopSync(): void {
    syncStatus.value = 'idle'
  }

  return {
    // State
    isAuthenticated,
    user,
    syncStatus,
    lastSyncAt,
    isInitialized,
    // Computed
    authState,
    // Actions
    initialize,
    login,
    register,
    loginWithGithub,
    logout,
    refreshToken,
    checkAuthStatus,
    startSync,
    stopSync
  }
})
