import type { IAuthRepository, AuthResult } from '../types/auth.repository'
import type { User } from '@/types/auth'
import { safeInvoke } from '@/utils/tauri'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Tauri 认证 Repository 实现 */
export class TauriAuthRepository implements IAuthRepository {
  private readonly platform = 'tauri' as const

  async login(email: string, encryptedPassword: string): Promise<AuthResult | null> {
    const response = await safeInvoke<{
      user_id: number
      access_token: string
      refresh_token: string
      expires_in: number
    }>('auth_login', {
      email,
      password: encryptedPassword,
    })

    if (response?.access_token) {
      return {
        userId: response.user_id,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in,
      }
    }

    return null
  }

  async register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult | null> {
    const response = await safeInvoke<{
      user_id: number
      access_token: string
      refresh_token: string
      expires_in: number
    }>('auth_register', {
      email,
      password: encryptedPassword,
      display_name: displayName,
    })

    if (response?.access_token) {
      return {
        userId: response.user_id,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresIn: response.expires_in,
      }
    }

    return null
  }

  async logout(): Promise<void> {
    await safeInvoke('auth_logout')
  }

  async getCurrentUser(): Promise<User | null> {
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
        provider: (response.provider as User['provider']) || 'local',
      }
    }

    return null
  }

  async checkAuthStatus(): Promise<boolean> {
    const result = await safeInvoke<boolean>('auth_check_status')
    return result === true
  }

  async refreshToken(): Promise<boolean> {
    const result = await safeInvoke<boolean>('auth_refresh_token')
    return result === true
  }

  async getPublicKey(): Promise<string | null> {
    const response = await safeInvoke<{ data: { public_key: string } }>('auth_get_public_key')
    return response?.data?.public_key ?? null
  }
}
