import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, CloudSyncStatus, AuthState, LoginRequest, RegisterRequest } from '../types/auth'
import { usePlatform, useCapabilities } from '@/platform/provider'
import { encryptPassword, clearCachedPublicKey } from '../services/rsa'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

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
  const wasLoggedIn = ref<boolean>(false)

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
   *
   * 区分三种情况：
   * 1. 认证有效 → isAuthenticated = true
   * 2. 未认证（无 token / token 无效）→ isAuthenticated = false，显示登录页
   * 3. 系统错误（keyring 故障 / 网络问题）→ 不清除认证状态，避免误判为未登录
   */
  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return
    }

    // localStorage 恢复 wasLoggedIn
    const storedWasLoggedIn = localStorage.getItem('lastKnownLoggedIn')
    if (storedWasLoggedIn === 'true') {
      wasLoggedIn.value = true
    }

    try {
      const { authRepo } = usePlatform()
      const capabilities = useCapabilities()
      const isAuth = await authRepo.checkAuthStatus()
      if (isAuth) {
        const currentUser = await authRepo.getCurrentUser()
        if (currentUser) {
          user.value = currentUser
          isAuthenticated.value = true
          wasLoggedIn.value = true
          localStorage.setItem('lastKnownLoggedIn', 'true')
        }
      } else if (capabilities.hasSsoLogin) {
        // SSO 检测路径：checkAuthStatus 返回 false，但可能 SSO cookie 仍有效
        try {
          const ssoResult = await authRepo.detectSsoSession()
          if (ssoResult.loggedIn && ssoResult.user) {
            user.value = ssoResult.user
            isAuthenticated.value = true
            wasLoggedIn.value = true
            localStorage.setItem('lastKnownLoggedIn', 'true')
          }
        } catch (ssoError) {
          if (ssoError instanceof RepositoryError && ssoError.code === RepoErrorCodes.SSO_SESSION_EXPIRED) {
            isAuthenticated.value = false
            user.value = null
            wasLoggedIn.value = false
            localStorage.setItem('lastKnownLoggedIn', 'false')
          }
        }
      }
      // isAuth === false 且无 SSO: 合法的"未认证"，不做额外处理
    } catch (error) {
      if (error instanceof RepositoryError) {
        console.error('[AuthStore] 认证状态检查系统错误:', error.code, error.message)
      } else {
        console.error('初始化认证状态失败:', error)
        user.value = null
        isAuthenticated.value = false
      }
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
          wasLoggedIn.value = true
          localStorage.setItem('lastKnownLoggedIn', 'true')

          // 登录成功后，日历身份切换（local → online）
          // 替代原有的 syncCalendarsFromServer()
          const { useCalendarStore } = await import('./calendar')
          const calendarStore = useCalendarStore()
          await calendarStore.loginTransition()

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
          wasLoggedIn.value = true
          localStorage.setItem('lastKnownLoggedIn', 'true')

          // 注册成功后，日历身份切换（local → online）
          // 替代原有的 syncCalendarsFromServer()
          const { useCalendarStore } = await import('./calendar')
          const calendarStore = useCalendarStore()
          await calendarStore.loginTransition()

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
    // 退出前日历身份切换（online → local）
    try {
      const { useCalendarStore } = await import('./calendar')
      const calendarStore = useCalendarStore()
      await calendarStore.logoutTransition()
    } catch (error) {
      console.warn('[AuthStore] 退出前日历切换失败:', error)
    }

    // Web 端 SSO 广播登出事件
    const capabilities = useCapabilities()
    if (capabilities.hasSsoLogin) {
      try {
        const { authRepo } = usePlatform()
        await authRepo.notifySsoEvent({ type: 'logout' })
      } catch (error) {
        console.warn('[AuthStore] SSO 登出广播失败:', error)
      }
    }

    try {
      const { authRepo } = usePlatform()
      await authRepo.logout()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      clearCachedPublicKey()
      user.value = null
      isAuthenticated.value = false
      syncStatus.value = 'idle'
      lastSyncAt.value = null
      wasLoggedIn.value = false
      localStorage.setItem('lastKnownLoggedIn', 'false')
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
   * 同步完成后重新加载各 Store 的数据，确保前端显示最新
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

      // 同步成功后，重新从数据库加载数据到各 Store
      // Rust 后端已将远端变更写入 SQLite，前端需要刷新响应式状态
      try {
        const { useCalendarStore } = await import('./calendar')
        const { useTodoStore } = await import('./todo')
        const calendarStore = useCalendarStore()
        const todoStore = useTodoStore()
        await Promise.all([
          calendarStore.reloadFromDatabase(),
          todoStore.reloadFromDatabase(),
        ])
        console.log('[AuthStore] 同步后数据已刷新')
      } catch (reloadError) {
        // 数据刷新失败不影响同步状态
        console.error('[AuthStore] 同步后数据刷新失败:', reloadError)
      }
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

  /**
   * 从服务端同步日历到本地
   */
  async function syncCalendarsFromServer(): Promise<void> {
    try {
      const { syncRepo } = usePlatform()
      const success = await syncRepo.syncCalendarsFromServer()

      if (success) {
        const { useCalendarStore } = await import('./calendar')
        const calendarStore = useCalendarStore()
        await calendarStore.reloadFromDatabase()

        console.log('[AuthStore] 日历同步完成')
      } else {
        console.warn('[AuthStore] 日历同步返回失败')
      }
    } catch (error) {
      console.error('[AuthStore] 日历同步失败:', error)
    }
  }

  /** 清理资源（停止 SsoCoordinator 等） */
  function cleanup(): void {
    // 后续集成 SsoCoordinator 实例管理时在此停止
  }

  return {
    // State
    isAuthenticated,
    user,
    syncStatus,
    lastSyncAt,
    isInitialized,
    wasLoggedIn,
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
    stopSync,
    syncCalendarsFromServer,
    cleanup,
  }
})
