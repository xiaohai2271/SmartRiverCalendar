import type { IAuthRepository, AuthResult, SsoSessionResult, SsoEvent } from '../types/auth.repository'
import type { User } from '@/types/auth'
import { WebApiClient } from './api-client'
import { transformWebUser, type ApiResponse, type WebUserProfile } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Web 认证 Repository 实现 */
export class WebAuthRepository implements IAuthRepository {
  private readonly platform = 'web' as const

  constructor(private readonly apiClient: WebApiClient) {}

  async login(email: string, encryptedPassword: string): Promise<AuthResult | null> {
    const data = await this.apiClient.post<
      ApiResponse<{ user_id: number; access_token: string; refresh_token: string; expires_in: number }>
    >('/auth/login', { email, password: encryptedPassword })

    if (data.code === 0 && data.data) {
      this.apiClient.setTokens(data.data.access_token, data.data.refresh_token)
      return {
        userId: data.data.user_id,
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        expiresIn: data.data.expires_in,
      }
    }

    return null
  }

  async register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult | null> {
    const data = await this.apiClient.post<
      ApiResponse<{ user_id: number; access_token: string; refresh_token: string; expires_in: number }>
    >('/auth/register', { email, password: encryptedPassword, display_name: displayName })

    if (data.code === 0 && data.data) {
      this.apiClient.setTokens(data.data.access_token, data.data.refresh_token)
      return {
        userId: data.data.user_id,
        accessToken: data.data.access_token,
        refreshToken: data.data.refresh_token,
        expiresIn: data.data.expires_in,
      }
    }

    return null
  }

  async logout(): Promise<void> {
    try {
      await this.apiClient.post('/auth/logout')
    } finally {
      this.apiClient.clearTokens()
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const data = await this.apiClient.get<ApiResponse<WebUserProfile>>('/user/profile')
      if (data.code === 0 && data.data) {
        return transformWebUser(data.data)
      }
      return null
    } catch {
      return null
    }
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      // 使用 /user/profile 判断认证状态，/auth/check-status 端点不存在
      const data = await this.apiClient.get<ApiResponse<WebUserProfile>>('/user/profile')
      return data.code === 0 && data.data !== null
    } catch {
      return false
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const data = await this.apiClient.post<
        ApiResponse<{ access_token: string; refresh_token: string; expires_in: number }>
      >('/auth/refresh', { refresh_token: this.apiClient.getRefreshToken() })

      if (data.code === 0 && data.data) {
        this.apiClient.setTokens(data.data.access_token, data.data.refresh_token)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async getPublicKey(): Promise<string | null> {
    try {
      const data = await this.apiClient.get<ApiResponse<{ public_key: string }>>('/auth/public-key')
      return data?.data?.public_key ?? null
    } catch {
      return null
    }
  }

  // ─── SSO 方法 ───

  private wasLoggedInGetter: (() => boolean) | null = null
  private ssoChannel: BroadcastChannel | null = null

  /** 注入 wasLoggedIn getter，用于 detectSsoSession 中判断是否应抛 SSO_SESSION_EXPIRED */
  setWasLoggedInGetter(getter: () => boolean): void {
    this.wasLoggedInGetter = getter
  }

  async detectSsoSession(): Promise<SsoSessionResult> {
    // SSO 检测使用 cookie（credentials: 'include'），不走 apiClient（避免 Authorization header 和 token 刷新逻辑）
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1188/v1'
    try {
      const resp = await fetch(`${baseUrl}/user/profile`, {
        credentials: 'include',
      })
      const data = await resp.json()

      if (resp.ok && data.code === 0 && data.data) {
        return {
          loggedIn: true,
          user: transformWebUser(data.data),
        }
      }

      if (resp.status === 401) {
        const wasLoggedIn = this.wasLoggedInGetter?.() ?? false
        if (wasLoggedIn) {
          throw new RepositoryError({
            code: RepoErrorCodes.SSO_SESSION_EXPIRED,
            message: 'SSO 会话已过期',
            platform: this.platform,
          })
        }
        return { loggedIn: false }
      }

      return { loggedIn: false }
    } catch (error) {
      if (error instanceof RepositoryError) {
        throw error
      }
      // 网络错误，静默返回 false
      return { loggedIn: false }
    }
  }

  async notifySsoEvent(event: SsoEvent): Promise<void> {
    if (!this.ssoChannel) {
      this.ssoChannel = new BroadcastChannel('smart-river-calendar-sso')
    }
    this.ssoChannel.postMessage(event)
  }

  subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void {
    if (!this.ssoChannel) {
      this.ssoChannel = new BroadcastChannel('smart-river-calendar-sso')
    }

    const handler = (e: MessageEvent) => {
      callback(e.data as SsoEvent)
    }
    this.ssoChannel.addEventListener('message', handler)

    return () => {
      this.ssoChannel?.removeEventListener('message', handler)
    }
  }
}
