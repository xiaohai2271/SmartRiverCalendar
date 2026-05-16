import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock authRepo
const mockAuthRepo = {
  getPublicKey: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  checkAuthStatus: vi.fn(),
  refreshToken: vi.fn(),
}

// Mock capabilities
const mockCapabilities = {
  hasLocalDatabase: true,
  hasOfflineMode: true,
  dataPriority: 'local-first' as const,
  hasReminderPopup: true,
  hasSystemNotification: true,
  hasSnoozeReminder: true,
  hasSystemTray: true,
  hasAutoStart: true,
  hasClockHook: true,
  hasMultiWindow: true,
  hasAutoUpdate: true,
  hasMinimizeToTray: true,
  hasProxySettings: true,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    authRepo: mockAuthRepo,
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    settingsRepo: {},
    syncRepo: {},
  }),
  useCapabilities: () => mockCapabilities,
}))

describe('RSA 加密服务', () => {
  let encryptPassword: typeof import('@/services/rsa').encryptPassword
  let clearCachedPublicKey: typeof import('@/services/rsa').clearCachedPublicKey

  beforeEach(async () => {
    vi.clearAllMocks()
    const rsaModule = await import('@/services/rsa')
    encryptPassword = rsaModule.encryptPassword
    clearCachedPublicKey = rsaModule.clearCachedPublicKey
  })

  describe('encryptPassword', () => {
    it('获取公钥失败时返回 null', async () => {
      // authRepo.getPublicKey 返回 null
      mockAuthRepo.getPublicKey.mockResolvedValueOnce(null)

      const result = await encryptPassword('test-password')

      expect(result).toBeNull()
      expect(mockAuthRepo.getPublicKey).toHaveBeenCalled()
    })

    it('公钥数据为空时返回 null', async () => {
      mockAuthRepo.getPublicKey.mockResolvedValueOnce(null)

      const result = await encryptPassword('test-password')

      expect(result).toBeNull()
    })

    it('crypto.subtle 不可用时返回 null', async () => {
      // 返回无效的公钥（会导致 crypto.subtle.importKey 失败）
      mockAuthRepo.getPublicKey.mockResolvedValueOnce('invalid-base64-key')

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
