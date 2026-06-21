import type { User } from '@/types/auth'

export interface AuthResult {
  userId: number
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SsoSessionResult {
  loggedIn: boolean
  user?: User
}

export type SsoEvent =
  | { type: 'logout' }
  | { type: 'login'; userId: number }

export interface IAuthRepository {
  /** 登录，失败抛出 RepositoryError */
  login(email: string, encryptedPassword: string): Promise<AuthResult>

  /** 注册，失败抛出 RepositoryError */
  register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult>

  /** 登出 */
  logout(): Promise<void>

  /** 获取当前用户资料，未登录抛出 NOT_FOUND */
  getCurrentUser(): Promise<User>

  /** 检查认证状态 */
  checkAuthStatus(): Promise<boolean>

  /** 刷新访问令牌 */
  refreshToken(): Promise<boolean>

  /** 获取 RSA 公钥，失败抛出 RepositoryError */
  getPublicKey(): Promise<string>

  /** 检测 SSO 会话状态（Web 端使用 cookie 检测，桌面端返回 loggedIn: false） */
  detectSsoSession(): Promise<SsoSessionResult>

  /** 通知 SSO 事件（Web 端通过 BroadcastChannel 广播，桌面端 no-op） */
  notifySsoEvent(event: SsoEvent): Promise<void>

  /** 订阅 SSO 事件（Web 端通过 BroadcastChannel 监听，桌面端 no-op） */
  subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void
}
