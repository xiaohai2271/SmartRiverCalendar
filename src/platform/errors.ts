/** Repository 统一错误类型 */
export class RepositoryError extends Error {
  /** 错误码 */
  readonly code: string
  /** 来源平台 */
  readonly platform: 'tauri' | 'web'
  /** 原始错误 */
  readonly cause?: unknown

  constructor(params: {
    code: string
    message: string
    platform: 'tauri' | 'web'
    cause?: unknown
  }) {
    super(params.message)
    this.name = 'RepositoryError'
    this.code = params.code
    this.platform = params.platform
    this.cause = params.cause
  }
}

/** 常用错误码 */
export const RepoErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PLATFORM_UNAVAILABLE: 'PLATFORM_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const
