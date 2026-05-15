import { safeInvoke } from '../utils/tauri'
import type {
  User,
  AuthResponse,
  RefreshTokenResponse,
  ApiResponse
} from '../types/auth'

// 注意: Token 仅在 Rust 层通过 keyring 安全存储，前端不存储 Token

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
   * @param username 用户名
   * @param password 密码
   * @returns 认证响应或 null
   */
  async login(username: string, password: string): Promise<AuthResponse | null> {
    const response = await safeInvoke<ApiResponse<AuthResponse>>('auth_login', {
      email: username,
      password
    })

    if (response?.data) {
      const authResponse = response.data
      // 触发认证状态变化回调
      this.triggerAuthChange(true, authResponse.user)
      return authResponse
    }

    return null
  }

  /**
   * 用户注册
   * @param username 用户名
   * @param email 邮箱
   * @param password 密码
   * @returns 认证响应或 null
   */
  async register(username: string, email: string, password: string): Promise<AuthResponse | null> {
    const response = await safeInvoke<ApiResponse<AuthResponse>>('auth_register', {
      email,
      password,
      display_name: username
    })

    if (response?.data) {
      const authResponse = response.data
      // 触发认证状态变化回调
      this.triggerAuthChange(true, authResponse.user)
      return authResponse
    }

    return null
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    // 调用后端登出接口
    await safeInvoke('auth_logout')

    // 触发认证状态变化回调
    this.triggerAuthChange(false, null)
  }

  /**
   * GitHub OAuth 登录
   * @param clientId GitHub 客户端 ID
   * @param redirectUri 重定向 URI
   * @returns 认证响应或 null
   */
  async githubLogin(clientId: string, redirectUri: string): Promise<AuthResponse | null> {
    const response = await safeInvoke<ApiResponse<AuthResponse>>('auth_oauth_github', {
      clientId,
      redirectUri
    })

    if (response?.data) {
      const authResponse = response.data
      // 触发认证状态变化回调
      this.triggerAuthChange(true, authResponse.user)
      return authResponse
    }

    return null
  }

  /**
   * 刷新访问令牌
   * @returns 是否刷新成功
   */
  async refreshToken(): Promise<boolean> {
    const response = await safeInvoke<ApiResponse<RefreshTokenResponse>>('auth_refresh_token')

    if (response?.data) {
      return true
    }

    // 刷新失败，触发登出
    this.triggerAuthChange(false, null)
    return false
  }

  /**
   * 检查认证状态
   * @returns 用户信息或 null
   */
  async checkAuthStatus(): Promise<User | null> {
    const response = await safeInvoke<ApiResponse<User>>('auth_check_status')
    return response?.data ?? null
  }

  /**
   * 获取当前用户信息
   * @returns 用户信息或 null
   */
  async getCurrentUser(): Promise<User | null> {
    const response = await safeInvoke<ApiResponse<User>>('auth_get_profile')
    return response?.data ?? null
  }

  /**
   * 获取访问令牌
   * @returns 访问令牌或 null
   * @deprecated Token 仅在 Rust 层存储，前端不应访问
   */
  getAccessToken(): string | null {
    console.warn('[AuthService] getAccessToken 已废弃：Token 仅在 Rust 层通过 keyring 安全存储')
    return null
  }

  // 移除以下方法：getRefreshToken、saveTokens、clearTokens
  // Token 现在由 Rust 层通过 keyring 安全存储，前端不再需要管理

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