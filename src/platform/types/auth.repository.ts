import type { User } from '@/types/auth'

export interface AuthResult {
  userId: number
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface IAuthRepository {
  /** 登录 */
  login(email: string, encryptedPassword: string): Promise<AuthResult | null>

  /** 注册 */
  register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult | null>

  /** 登出 */
  logout(): Promise<void>

  /** 获取当前用户资料 */
  getCurrentUser(): Promise<User | null>

  /** 检查认证状态 */
  checkAuthStatus(): Promise<boolean>

  /** 刷新访问令牌 */
  refreshToken(): Promise<boolean>

  /** 获取 RSA 公钥 */
  getPublicKey(): Promise<string | null>
}
