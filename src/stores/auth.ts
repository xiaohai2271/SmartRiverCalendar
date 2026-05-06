import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, CloudSyncStatus, AuthState, LoginRequest, RegisterRequest } from '../types/auth'
import { authService } from '../services/auth'

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
   * 从 localStorage 恢复用户信息和令牌
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return
    }

    try {
      // 尝试从 authService 恢复认证状态
      const currentUser = await authService.getCurrentUser()
      if (currentUser) {
        user.value = currentUser
        isAuthenticated.value = true
      }
    } catch (error) {
      console.error('初始化认证状态失败:', error)
      // 初始化失败时清除状态
      user.value = null
      isAuthenticated.value = false
    } finally {
      isInitialized.value = true
    }
  }

  /**
   * 用户登录
   * @param credentials 登录凭据
   * @returns 是否登录成功
   */
  async function login(credentials: LoginRequest): Promise<boolean> {
    try {
      const response = await authService.login(credentials.username, credentials.password)
      if (response) {
        user.value = response.user
        isAuthenticated.value = true
        return true
      }
      return false
    } catch (error) {
      console.error('登录失败:', error)
      return false
    }
  }

  /**
   * 用户注册
   * @param data 注册数据
   * @returns 是否注册成功
   */
  async function register(data: RegisterRequest): Promise<boolean> {
    try {
      const response = await authService.register(data.username, data.email, data.password)
      if (response) {
        user.value = response.user
        isAuthenticated.value = true
        return true
      }
      return false
    } catch (error) {
      console.error('注册失败:', error)
      return false
    }
  }

  /**
   * GitHub OAuth 登录
   * @param clientId GitHub 客户端 ID
   * @param redirectUri 重定向 URI
   * @returns 是否登录成功
   */
  async function loginWithGithub(clientId: string, redirectUri: string): Promise<boolean> {
    try {
      const response = await authService.githubLogin(clientId, redirectUri)
      if (response) {
        user.value = response.user
        isAuthenticated.value = true
        return true
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
      await authService.logout()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      // 无论后端登出是否成功，都清除本地状态
      user.value = null
      isAuthenticated.value = false
      syncStatus.value = 'idle'
      lastSyncAt.value = null
    }
  }

  /**
   * 刷新访问令牌
   * @returns 是否刷新成功
   */
  async function refreshToken(): Promise<boolean> {
    try {
      const success = await authService.refreshToken()
      if (!success) {
        // 刷新失败，清除认证状态
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
   * @returns 当前是否已认证
   */
  async function checkAuthStatus(): Promise<boolean> {
    try {
      const currentUser = await authService.getCurrentUser()
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
      // 调用 authService 的同步方法（待实现）
      // await authService.sync()
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