import { encryptPassword, clearCachedPublicKey } from './rsa'
import { usePlatform } from '@/platform/provider'
import { useCapabilities } from '@/platform/provider'
import type { User, AuthResponse } from '../types/auth'

// 注意: Tauri 模式下 Token 仅在 Rust 层通过 keyring 安全存储
// Web 模式下 Token 存储在 localStorage（由 apiClient 管理）

// 认证状态变化回调类型
type AuthChangeCallback = (isAuthenticated: boolean, user: User | null) => void

// 令牌过期回调类型
type TokenExpiredCallback = () => void

// 认证服务类
export class AuthService {
  // 事件回调列表
  private authChangeCallbacks: AuthChangeCallback[] = []
  private tokenExpiredCallbacks: TokenExpiredCallback[] = []

  /**
   * 用户登录
   * @param username 用户名（邮箱）
   * @param password 密码
   * @returns 认证响应和用户信息，失败抛出 RepositoryError
   */
  async login(username: string, password: string): Promise<{ authResponse: AuthResponse; user: User | null }> {
    const encryptedPassword = await encryptPassword(password)

    const { authRepo } = usePlatform()
    const result = await authRepo.login(username, encryptedPassword)

    const authResponse: AuthResponse = {
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    }
    const user = await this.getCurrentUser()
    this.triggerAuthChange(true, user)
    return { authResponse, user }
  }

  /**
   * 用户注册
   * @param username 用户名
   * @param email 邮箱
   * @param password 密码
   * @returns 认证响应和用户信息，失败抛出 RepositoryError
   */
  async register(username: string, email: string, password: string): Promise<{ authResponse: AuthResponse; user: User | null }> {
    const encryptedPassword = await encryptPassword(password)

    const { authRepo } = usePlatform()
    const result = await authRepo.register(email, encryptedPassword, username)

    const authResponse: AuthResponse = {
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    }
    const user = await this.getCurrentUser()
    this.triggerAuthChange(true, user)
    return { authResponse, user }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    const { authRepo } = usePlatform()
    await authRepo.logout()

    // 清除缓存的 RSA 公钥
    clearCachedPublicKey()

    // 触发认证状态变化回调
    this.triggerAuthChange(false, null)
  }

  /**
   * GitHub OAuth 登录
   * OAuth 登录目前仅支持 Tauri 桌面端（需要本地 HTTP 服务器接收回调）
   * @param clientId GitHub 客户端 ID
   * @param redirectUri 重定向 URI
   * @returns 认证响应和用户信息，或 null
   */
  async githubLogin(clientId: string, redirectUri: string): Promise<{ authResponse: AuthResponse; user: User | null } | null> {
    const capabilities = useCapabilities()

    // OAuth 登录目前仅支持桌面端（需要本地 HTTP 服务器接收回调）
    if (!capabilities.hasLocalDatabase) {
      console.warn('[AuthService] GitHub OAuth 登录暂不支持 Web 模式')
      return null
    }

    // OAuth 仍需通过 Tauri invoke（Rust 端启动本地 HTTP 服务器接收回调）
    const { safeInvoke } = await import('@/utils/tauri')
    const response = await safeInvoke<{
      user_id: number
      access_token: string
      refresh_token: string
      expires_in: number
    }>('auth_oauth_github', {
      clientId,
      redirectUri
    })

    if (response?.access_token) {
      const authResponse: AuthResponse = {
        userId: response.user_id,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in
      }
      const user = await this.getCurrentUser()
      this.triggerAuthChange(true, user)
      return { authResponse, user }
    }

    return null
  }

  /**
   * 刷新访问令牌
   * @returns 是否刷新成功
   */
  async refreshToken(): Promise<boolean> {
    const { authRepo } = usePlatform()
    const result = await authRepo.refreshToken()

    if (!result) {
      // 刷新失败，触发登出
      this.triggerAuthChange(false, null)
    }

    return result
  }

  /**
   * 检查认证状态
   * @returns 用户信息或 null
   */
  async checkAuthStatus(): Promise<User | null> {
    const { authRepo } = usePlatform()
    const isAuthenticated = await authRepo.checkAuthStatus()
    if (isAuthenticated) {
      return this.getCurrentUser()
    }
    return null
  }

  /**
   * 获取当前用户信息
   * @returns 用户信息，未登录抛出 RepositoryError
   */
  async getCurrentUser(): Promise<User> {
    const { authRepo } = usePlatform()
    return authRepo.getCurrentUser()
  }

  /**
   * 获取 RSA 公钥
   * @returns 公钥字符串，失败抛出 RepositoryError
   */
  async getPublicKey(): Promise<string> {
    const { authRepo } = usePlatform()
    return authRepo.getPublicKey()
  }

  /**
   * 获取访问令牌
   * @returns 访问令牌或 null
   * @deprecated Tauri 模式下 Token 仅在 Rust 层存储；Web 模式下由 apiClient 管理
   */
  getAccessToken(): string | null {
    // Tauri 模式下 Token 由 Rust 层通过 keyring 安全存储，无法从前端获取
    // Web 模式下 Token 由 apiClient 管理
    console.warn('[AuthService] getAccessToken 已废弃：Token 由平台层安全存储')
    return null
  }

  /**
   * 注册认证状态变化回调
   * @param callback 回调函数
   */
  onAuthChange(callback: AuthChangeCallback): void {
    this.authChangeCallbacks.push(callback)
  }

  /**
   * 取消注册认证状态变化回调
   * @param callback 回调函数
   */
  offAuthChange(callback: AuthChangeCallback): void {
    const index = this.authChangeCallbacks.indexOf(callback)
    if (index !== -1) {
      this.authChangeCallbacks.splice(index, 1)
    }
  }

  /**
   * 注册令牌过期回调
   * @param callback 回调函数
   */
  onTokenExpired(callback: TokenExpiredCallback): void {
    this.tokenExpiredCallbacks.push(callback)
  }

  /**
   * 取消注册令牌过期回调
   * @param callback 回调函数
   */
  offTokenExpired(callback: TokenExpiredCallback): void {
    const index = this.tokenExpiredCallbacks.indexOf(callback)
    if (index !== -1) {
      this.tokenExpiredCallbacks.splice(index, 1)
    }
  }

  /**
   * 触发认证状态变化回调
   * @param isAuthenticated 是否已认证
   * @param user 用户信息
   */
  private triggerAuthChange(isAuthenticated: boolean, user: User | null): void {
    this.authChangeCallbacks.forEach(callback => {
      try {
        callback(isAuthenticated, user)
      } catch (error) {
        console.error('认证状态变化回调执行失败:', error)
      }
    })
  }

  /**
   * 触发令牌过期回调
   */
  triggerTokenExpired(): void {
    this.tokenExpiredCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('令牌过期回调执行失败:', error)
      }
    })
  }
}

// 导出单例实例
export const authService = new AuthService()
