import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock safeInvoke 和 isTauri
const mockSafeInvoke = vi.fn()

vi.mock('@/utils/tauri', () => ({
  safeInvoke: mockSafeInvoke,
  isTauri: vi.fn(() => true) // 默认模拟 Tauri 环境
}))

// Mock webApi
vi.mock('@/services/webApi', () => ({
  webApi: {
    getPublicKey: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
    refreshToken: vi.fn(),
    checkStatus: vi.fn(),
    storeTokens: vi.fn(),
    clearTokens: vi.fn(),
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null)
  }
}))

describe('RSA 加密服务', () => {
  let encryptPassword: typeof import('@/services/rsa').encryptPassword
  let clearCachedPublicKey: typeof import('@/services/rsa').clearCachedPublicKey

  beforeEach(async () => {
    vi.clearAllMocks()
    // 每次测试前重新导入模块，重置缓存状态
    const rsaModule = await import('@/services/rsa')
    encryptPassword = rsaModule.encryptPassword
    clearCachedPublicKey = rsaModule.clearCachedPublicKey
  })

  describe('encryptPassword', () => {
    it('获取公钥失败时返回 null', async () => {
      // safeInvoke 返回 null（非 Tauri 环境或后端不可用）
      mockSafeInvoke.mockResolvedValueOnce(null)

      const result = await encryptPassword('test-password')

      expect(result).toBeNull()
      expect(mockSafeInvoke).toHaveBeenCalledWith('auth_get_public_key')
    })

    it('公钥数据为空时返回 null', async () => {
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        data: null
      })

      const result = await encryptPassword('test-password')

      expect(result).toBeNull()
    })

    it('crypto.subtle 不可用时返回 null', async () => {
      // 在非浏览器环境中 crypto.subtle 可能不可用
      // 此测试验证错误处理逻辑
      mockSafeInvoke.mockResolvedValueOnce({
        code: 0,
        data: { publicKey: 'invalid-base64-key' }
      })

      // 无效的公钥会导致 crypto.subtle.importKey 抛出异常
      const result = await encryptPassword('test-password')

      // 加密失败应返回 null 而非抛出异常
      expect(result).toBeNull()
    })
  })

  describe('clearCachedPublicKey', () => {
    it('应该可以正常调用而不抛出异常', () => {
      expect(() => clearCachedPublicKey()).not.toThrow()
    })
  })
})
