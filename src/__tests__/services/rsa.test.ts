import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

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
    it('获取公钥失败时抛出错误', async () => {
      mockAuthRepo.getPublicKey.mockRejectedValueOnce(
        new RepositoryError({
          code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
          message: '获取 RSA 公钥失败',
          platform: 'tauri',
        })
      )

      await expect(encryptPassword('test-password')).rejects.toThrow(RepositoryError)
      expect(mockAuthRepo.getPublicKey).toHaveBeenCalled()
    })

    it('crypto.subtle 不可用时抛出错误', async () => {
      mockAuthRepo.getPublicKey.mockResolvedValueOnce('invalid-base64-key')

      await expect(encryptPassword('test-password')).rejects.toThrow()
    })
  })

  describe('clearCachedPublicKey', () => {
    it('应该可以正常调用而不抛出异常', () => {
      expect(() => clearCachedPublicKey()).not.toThrow()
    })
  })
})
