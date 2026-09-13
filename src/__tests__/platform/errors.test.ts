import { describe, it, expect } from 'vitest'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

describe('RepositoryError', () => {
  it('应正确构造错误对象', () => {
    const error = new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: '网络连接失败',
      platform: 'web',
    })
    expect(error.name).toBe('RepositoryError')
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toBe('网络连接失败')
    expect(error.platform).toBe('web')
    expect(error.cause).toBeUndefined()
  })

  it('应支持传入原始错误', () => {
    const cause = new Error('原始错误')
    const error = new RepositoryError({
      code: RepoErrorCodes.UNKNOWN,
      message: '未知错误',
      platform: 'tauri',
      cause,
    })
    expect(error.cause).toBe(cause)
  })

  it('RepoErrorCodes 应包含所有常用错误码', () => {
    expect(RepoErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(RepoErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
    expect(RepoErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(RepoErrorCodes.AUTH_EXPIRED).toBe('AUTH_EXPIRED')
    expect(RepoErrorCodes.PLATFORM_UNAVAILABLE).toBe('PLATFORM_UNAVAILABLE')
    expect(RepoErrorCodes.UNKNOWN).toBe('UNKNOWN')
  })
})
