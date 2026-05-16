import { safeInvoke, isTauri } from '../utils/tauri'
import { encryptPassword, clearCachedPublicKey } from './rsa'
import { webApi } from './webApi'
import type {
  User,
  AuthResponse,
  RefreshTokenResponse,
  ApiResponse
} from '../types/auth'

// 注意: Tauri 模式下 Token 仅在 Rust 层通过 keyring 安全存储
// Web 模式下 Token 存储在 localStorage（由 webApi 管理）

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
   * @returns 认证响应或 null
   */
  /**
   * 用户登录
   * @param username 用户名（邮箱）
   * @param password 密码
   * @returns 认证响应和用户信息，或 null
   */
  async login(username: string, password: string): Promise<{ authResponse: AuthResponse; user: User | null } | null> {
    // 使用 RSA 加密密码
    const encryptedPassword = await encryptPassword(password)
    if (!encryptedPassword) {
      console.error('[AuthService] 密码加密失败，无法登录')
      return null
    }

    if (isTauri()) {
      // Tauri 模式：通过 IPC 调用 Rust 命令
      // Rust auth_login 内部已调用 get_profile 并保存用户信息到本地数据库
      const response = await safeInvoke<{
        user_id: number
        access_token: string
        refresh_token: string
        expires_in: number
      }>('auth_login', {
        email: username,
        password: encryptedPassword
      })

      if (response?.access_token) {
        const authResponse: AuthResponse = {
          userId: response.user_id,
          accessToken: response.access_token,
          refreshToken: response.refresh_token,
          expiresIn: response.expires_in
        }
        // 获取用户信息（仅调用一次，避免重复请求）
        const user = await this.getCurrentUser()
        this.triggerAuthChange(true, user)
        return { authResponse, user }
      }

      return null
    } else {
      // Web 模式：直接调用 API
      const data = await webApi.login(username, encryptedPassword)
      if (data.code === 0 && data.data) {
        const authResponse: AuthResponse = {
          userId: data.data.user_id,
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          expiresIn: data.data.expires_in
        }
        // 获取用户信息（仅调用一次，避免重复请求）
        const user = await this.getCurrentUser()
        this.triggerAuthChange(true, user)
        return { authResponse, user }
      }
      return null
    }
  }

  /**
   * 用户注册
   * @param username 用户名
   * @param email 邮箱
   * @param password 密码
   * @returns 认证响应和用户信息，或 null
   */
  async register(username: string, email: string, password: string): Promise<{ authResponse: AuthResponse; user: User | null } | null> {
    // 使用 RSA 加密密码
    const encryptedPassword = await encryptPassword(password)
    if (!encryptedPassword) {
      console.error('[AuthService] 密码加密失败，无法注册')
      return null
    }

    if (isTauri()) {
      // Tauri 模式：通过 IPC 调用 Rust 命令
      const response = await safeInvoke<{
        user_id: number
        access_token: string
        refresh_token: string
        expires_in: number
      }>('auth_register', {
        email,
        password: encryptedPassword,
        display_name: username
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
    } else {
      // Web 模式：直接调用 API
      const data = await webApi.register(email, encryptedPassword, username)
      if (data.code === 0 && data.data) {
        const authResponse: AuthResponse = {
          userId: data.data.user_id,
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token,
          expiresIn: data.data.expires_in
        }
        const user = await this.getCurrentUser()
        this.triggerAuthChange(true, user)
        return { authResponse, user }
      }
      return null
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    if (isTauri()) {
      // Tauri 模式：通过 IPC 调用 Rust 命令
      await safeInvoke('auth_logout')
    } else {
      // Web 模式：直接调用 API
      await webApi.logout()
    }

    // 清除缓存的 RSA 公钥
    clearCachedPublicKey()

    // 触发认证状态变化回调
    this.triggerAuthChange(false, null)
  }

  /**
   * GitHub OAuth 登录
   * @param clientId GitHub 客户端 ID
   * @param redirectUri 重定向 URI
   * @returns 认证响应和用户信息，或 null
   */
  async githubLogin(clientId: string, redirectUri: string): Promise<{ authResponse: AuthResponse; user: User | null } | null> {
    // OAuth 登录目前仅支持 Tauri 模式（需要本地 HTTP 服务器接收回调）
    if (!isTauri()) {
      console.warn('[AuthService] GitHub OAuth 登录暂不支持 Web 模式')
      return null
    }

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
    if (isTauri()) {
      // Tauri 模式：Rust auth_refresh_token 返回 bool
      const result = await safeInvoke<boolean>('auth_refresh_token')
      if (result === true) {
        return true
      }
      // 刷新失败，触发登出
      this.triggerAuthChange(false, null)
      return false
    } else {
      // Web 模式：直接调用 API
      try {
        const data = await webApi.refreshToken()
        if (data.code === 0 && data.data) {
          localStorage.setItem('access_token', data.data.access_token)
          return true
        }
        // 刷新失败，触发登出
        this.triggerAuthChange(false, null)
        return false
      } catch {
        this.triggerAuthChange(false, null)
        return false
      }
    }
  }

  /**
   * 检查认证状态
   * @returns 用户信息或 null
   */
  async checkAuthStatus(): Promise<User | null> {
    if (isTauri()) {
      // Tauri 模式：Rust auth_check_status 返回 bool（是否已认证）
      const isAuthenticated = await safeInvoke<boolean>('auth_check_status')
      if (isAuthenticated) {
        // 已认证，获取用户资料
        return this.getCurrentUser()
      }
      return null
    } else {
      try {
        const data = await webApi.checkStatus()
        if (data.code === 0 && data.data) {
          return {
            id: String(data.data.id),
            email: data.data.email,
            displayName: data.data.display_name,
            provider: 'local'
          }
        }
        return null
      } catch {
        return null
      }
    }
  }

  /**
   * 获取当前用户信息
   * @returns 用户信息或 null
   */
  async getCurrentUser(): Promise<User | null> {
    if (isTauri()) {
      // Tauri 模式：Rust auth_get_profile 返回 UserProfile 直接 JSON
      const response = await safeInvoke<{
        id: number
        email: string
        display_name: string
        avatar_url: string | null
        provider: string
      }>('auth_get_profile')
      if (response) {
        return {
          id: String(response.id),
          email: response.email,
          displayName: response.display_name,
          avatarUrl: response.avatar_url ?? undefined,
          provider: (response.provider as User['provider']) || 'local'
        }
      }
      return null
    } else {
      try {
        const data = await webApi.getProfile()
        if (data.code === 0 && data.data) {
          return {
            id: String(data.data.id),
            email: data.data.email,
            displayName: data.data.display_name,
            avatarUrl: data.data.avatar_url ?? undefined,
            provider: (data.data.provider as User['provider']) || 'local'
          }
        }
        return null
      } catch {
        return null
      }
    }
  }

  /**
   * 获取 RSA 公钥
   * @returns 公钥字符串或 null
   */
  async getPublicKey(): Promise<string | null> {
    if (isTauri()) {
      const response = await safeInvoke<ApiResponse<{ public_key: string }>>('auth_get_public_key')
      return response?.data?.public_key ?? null
    } else {
      try {
        const data = await webApi.getPublicKey()
        return data?.data?.public_key ?? null
      } catch {
        return null
      }
    }
  }

  /**
   * 获取访问令牌
   * @returns 访问令牌或 null
   * @deprecated Tauri 模式下 Token 仅在 Rust 层存储；Web 模式下由 webApi 管理
   */
  getAccessToken(): string | null {
    if (isTauri()) {
      console.warn('[AuthService] getAccessToken 已废弃：Token 仅在 Rust 层通过 keyring 安全存储')
      return null
    }
    return webApi.getAccessToken()
  }

  // 移除以下方法：saveTokens、clearTokens
  // Tauri 模式下 Token 由 Rust 层通过 keyring 安全存储
  // Web 模式下 Token 由 webApi 管理

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
