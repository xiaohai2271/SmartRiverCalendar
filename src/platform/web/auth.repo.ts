import type { IAuthRepository, AuthResult } from '../types/auth.repository'
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
      const data = await this.apiClient.get<ApiResponse<{ id: number }>>('/auth/check-status')
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
}
