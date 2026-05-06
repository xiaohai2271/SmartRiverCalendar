import { safeInvoke } from '../utils/tauri'
import type {
  User,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  GithubOAuthRequest,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ApiResponse
} from '../types/auth'

// 本地存储键名
const ACCESS_TOKEN_KEY = 'auth_access_token'
const REFRESH_TOKEN_KEY = 'auth_refresh_token'

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
      username,
      password
    })

    if (response?.data) {
      const authResponse = response.data
      // 保存令牌到 localStorage
      this.saveTokens(authResponse.accessToken, authResponse.refreshToken)
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
      username,
      email,
      password
    })

    if (response?.data) {
      const authResponse = response.data
      // 保存令牌到 localStorage
      this.saveTokens(authResponse.accessToken, authResponse.refreshToken)
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

    // 清除本地令牌
    this.clearTokens()

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
    const response = await safeInvoke<ApiResponse<AuthResponse>>('auth_github_login', {
      clientId,
      redirectUri
    })

    if (response?.data) {
      const authResponse = response.data
      // 保存令牌到 localStorage
      this.saveTokens(authResponse.accessToken, authResponse.refreshToken)
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
    const refreshTokenValue = this.getRefreshToken()
    if (!refreshTokenValue) {
      return false
    }

    const response = await safeInvoke<ApiResponse<RefreshTokenResponse>>('auth_refresh_token', {
      refreshToken: refreshTokenValue
    })

    if (response?.data) {
      const tokenResponse = response.data
      // 保存新令牌
      this.saveTokens(tokenResponse.accessToken, tokenResponse.refreshToken)
      return true
    }

    // 刷新失败，清除令牌
    this.clearTokens()
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
    const response = await safeInvoke<ApiResponse<User>>('auth_get_current_user')
    return response?.data ?? null
  }

  /**
   * 获取访问令牌
   * @returns 访问令牌或 null
   */
  getAccessToken(): string | null {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY)
    } catch {
      return null
    }
  }

  /**
   * 获取刷新令牌
   * @returns 刷新令牌或 null
   */
  private getRefreshToken(): string | null {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY)
    } catch {
      return null
    }
  }

  /**
   * 保存令牌到 localStorage
   * @param accessToken 访问令牌
   * @param refreshToken 刷新令牌
   */
  private saveTokens(accessToken: string, refreshToken: string): void {
    try {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    } catch (error) {
      console.error('保存令牌到 localStorage 失败:', error)
    }
  }

  /**
   * 清除 localStorage 中的令牌
   */
  private clearTokens(): void {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    } catch (error) {
      console.error('清除 localStorage 令牌失败:', error)
    }
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