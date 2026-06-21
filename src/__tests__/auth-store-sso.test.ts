import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { createPinia, setActivePinia } from 'pinia'
import type { IAuthRepository } from '@/platform/types/auth.repository'
import type { PlatformCapabilities } from '@/platform/capabilities'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// mock platform provider
const mockDetectSsoSession = vi.fn()
const mockNotifySsoEvent = vi.fn()
const mockSubscribeSsoEvents = vi.fn().mockReturnValue(() => {})
const mockCheckAuthStatus = vi.fn().mockResolvedValue(false)
const mockGetCurrentUser = vi.fn().mockRejectedValue(
  new RepositoryError({
    code: RepoErrorCodes.NOT_FOUND,
    message: '未找到当前用户',
    platform: 'web',
  })
)
const mockSetWasLoggedInGetter = vi.fn()

let mockCapabilities: PlatformCapabilities

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    authRepo: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuthStatus: mockCheckAuthStatus,
      getCurrentUser: mockGetCurrentUser,
      refreshToken: vi.fn(),
      getPublicKey: vi.fn(),
      oauthLogin: vi.fn(),
      cancelOAuthLogin: vi.fn(),
      detectSsoSession: mockDetectSsoSession,
      notifySsoEvent: mockNotifySsoEvent,
      subscribeSsoEvents: mockSubscribeSsoEvents,
      setWasLoggedInGetter: mockSetWasLoggedInGetter,
    },
    capabilities: mockCapabilities,
    syncRepo: { triggerCloudSync: vi.fn() },
  }),
  useCapabilities: () => mockCapabilities,
  initPlatform: vi.fn(),
}))

// mock RSA
vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted'),
  clearCachedPublicKey: vi.fn(),
}))

// mock calendar store
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: vi.fn().mockReturnValue({
    loginTransition: vi.fn().mockResolvedValue(undefined),
    logoutTransition: vi.fn().mockResolvedValue(undefined),
    reloadFromDatabase: vi.fn().mockResolvedValue(undefined),
  }),
}))

// mock sso-coordinator
vi.mock('@/platform/web/sso-coordinator', () => ({
  SsoCoordinator: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}))

describe('AuthStore SSO 集成', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    mockCapabilities = {
      hasLocalDatabase: false,
      hasOfflineMode: false,
      dataPriority: 'remote-first',
      hasReminderPopup: false,
      hasSystemNotification: true,
      hasSnoozeReminder: false,
      hasExchangeSupport: true,
      hasCalDavSupport: true,
      hasExternalSync: true,
      hasSystemTray: false,
      hasAutoStart: false,
      hasClockHook: false,
      hasMultiWindow: false,
      hasAutoUpdate: false,
      hasAlwaysOnTop: false,
      hasMinimizeToTray: false,
      hasProxySettings: false,
      hasOAuthLogin: false,
      hasSsoLogin: true,
      hasBackgroundSync: false,
      hasIncrementalSync: false,
      hasClientConflictResolution: false,
    }
    mockCheckAuthStatus.mockResolvedValue(false)
    mockGetCurrentUser.mockRejectedValue(
      new RepositoryError({
        code: RepoErrorCodes.NOT_FOUND,
        message: '未找到当前用户',
        platform: 'web',
      })
    )
    mockDetectSsoSession.mockResolvedValue({ loggedIn: false })
  })

  describe('initialize() SSO 检测路径', () => {
    it('detectSsoSession 返回 loggedIn: true 时应进入已登录态', async () => {
      const mockUser = { id: '1', email: 'test@example.com', displayName: '测试' }
      mockDetectSsoSession.mockResolvedValue({ loggedIn: true, user: mockUser })

      const store = useAuthStore()
      await store.initialize()

      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(store.wasLoggedIn).toBe(true)
    })

    it('detectSsoSession 返回 loggedIn: false 时应保持未登录态', async () => {
      mockDetectSsoSession.mockResolvedValue({ loggedIn: false })

      const store = useAuthStore()
      await store.initialize()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
    })

    it('hasSsoLogin=false 时不应调用 detectSsoSession', async () => {
      mockCapabilities.hasSsoLogin = false

      const store = useAuthStore()
      await store.initialize()

      expect(mockDetectSsoSession).not.toHaveBeenCalled()
    })
  })

  describe('logout() SSO 广播', () => {
    it('Web 端登出后应调用 notifySsoEvent', async () => {
      const store = useAuthStore()
      await store.initialize()
      // 手动设置为已登录
      store.$patch({ isAuthenticated: true, user: { id: '1', email: 'test' } })

      await store.logout()

      expect(mockNotifySsoEvent).toHaveBeenCalledWith({ type: 'logout' })
    })

    it('桌面端登出不应调用 notifySsoEvent', async () => {
      mockCapabilities.hasSsoLogin = false

      const store = useAuthStore()
      await store.initialize()

      await store.logout()

      expect(mockNotifySsoEvent).not.toHaveBeenCalled()
    })
  })

  describe('wasLoggedIn 状态', () => {
    it('localStorage 恢复 wasLoggedIn', async () => {
      localStorage.setItem('lastKnownLoggedIn', 'true')

      const store = useAuthStore()
      await store.initialize()

      expect(store.wasLoggedIn).toBe(true)
    })

    it('登录后应设置 wasLoggedIn=true 并持久化', async () => {
      mockCheckAuthStatus.mockResolvedValue(true)
      mockGetCurrentUser.mockResolvedValue({ id: '1', email: 'test@example.com', displayName: '测试' })

      const store = useAuthStore()
      await store.initialize()

      expect(store.wasLoggedIn).toBe(true)
      expect(localStorage.getItem('lastKnownLoggedIn')).toBe('true')
    })

    it('登出后应设置 wasLoggedIn=false', async () => {
      const store = useAuthStore()
      await store.initialize()
      store.$patch({ isAuthenticated: true })
      localStorage.setItem('lastKnownLoggedIn', 'true')

      await store.logout()

      expect(store.wasLoggedIn).toBe(false)
      expect(localStorage.getItem('lastKnownLoggedIn')).toBe('false')
    })
  })

  describe('SSO_SESSION_EXPIRED 处理', () => {
    it('SSO 会话过期应清空本地态', async () => {
      localStorage.setItem('lastKnownLoggedIn', 'true')
      mockDetectSsoSession.mockRejectedValue(
        new RepositoryError({
          code: RepoErrorCodes.SSO_SESSION_EXPIRED,
          message: 'SSO 会话已过期',
          platform: 'web',
        })
      )

      const store = useAuthStore()
      await store.initialize()

      expect(store.isAuthenticated).toBe(false)
      expect(store.wasLoggedIn).toBe(false)
      expect(localStorage.getItem('lastKnownLoggedIn')).toBe('false')
    })
  })

  describe('cleanup()', () => {
    it('应停止 SsoCoordinator', async () => {
      const store = useAuthStore()
      await store.initialize()

      // cleanup 不应抛错
      expect(() => store.cleanup()).not.toThrow()
    })
  })
})
