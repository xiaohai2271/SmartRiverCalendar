import type { IAuthRepository, AuthResult, SsoSessionResult, SsoEvent } from '../types/auth.repository'
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
    // 认证状态检查必须区分"未认证"和"系统错误"
    // 使用 invoke() 直接调用，让 Rust 端的 Err 能正确传播为异常
    // safeInvoke 会吞掉所有错误返回 null，导致系统故障也被误判为"未认证"
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<boolean>('auth_check_status')
      return result === true
    } catch (error) {
      // Rust 端返回 Err 时，invoke() 会抛出异常
      // 解析错误前缀区分错误类型
      const message = error instanceof Error ? error.message : String(error)

      if (message.startsWith('TOKEN_LOAD_ERROR:')) {
        // Token 存储系统故障（数据库/解密），不是"未认证"，需要抛出让前端做差异化处理
        throw new RepositoryError({
          code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
          message: `凭据存储访问失败: ${message.replace('TOKEN_LOAD_ERROR:', '')}`,
          platform: this.platform,
          cause: error,
        })
      }

      // 其他错误（网络、服务器等），同样需要区分
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: `认证状态检查失败: ${message}`,
        platform: this.platform,
        cause: error,
      })
    }
  }

  async refreshToken(): Promise<boolean> {
    const result = await safeInvoke<boolean>('auth_refresh_token')
    return result === true
  }

  async getPublicKey(): Promise<string | null> {
    const response = await safeInvoke<{ data: { public_key: string } }>('auth_get_public_key')
    return response?.data?.public_key ?? null
  }

  // ─── SSO no-op 方法（桌面端不需要 SSO） ───

  async detectSsoSession(): Promise<SsoSessionResult> {
    return { loggedIn: false }
  }

  async notifySsoEvent(_event: SsoEvent): Promise<void> {
    // 桌面端不需要 SSO 广播
  }

  subscribeSsoEvents(_callback: (event: SsoEvent) => void): () => void {
    return () => {}
  }
}
