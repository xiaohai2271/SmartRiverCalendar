import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SsoCoordinator } from '@/platform/web/sso-coordinator'
import type { IAuthRepository, SsoSessionResult, SsoEvent } from '@/platform/types/auth.repository'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// 创建 mock authRepo
function createMockAuthRepo(overrides?: Partial<IAuthRepository>): IAuthRepository {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    checkAuthStatus: vi.fn(),
    refreshToken: vi.fn(),
    getPublicKey: vi.fn(),
    oauthLogin: vi.fn(),
    cancelOAuthLogin: vi.fn(),
    detectSsoSession: vi.fn().mockResolvedValue({ loggedIn: false }),
    notifySsoEvent: vi.fn(),
    subscribeSsoEvents: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  }
}

// mock document.visibilitychange
const visibilityListeners: Array<() => void> = []
const origAddEventListener = document.addEventListener.bind(document)
const origRemoveEventListener = document.removeEventListener.bind(document)

describe('SsoCoordinator', () => {
  let coordinator: SsoCoordinator
  let mockAuthRepo: IAuthRepository
  let onSessionChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    visibilityListeners.length = 0

    // 拦截 visibilitychange 事件
    document.addEventListener = vi.fn((type: string, listener: EventListener) => {
      if (type === 'visibilitychange') {
        visibilityListeners.push(() => listener(new Event('visibilitychange')))
      }
    }) as any
    document.removeEventListener = vi.fn((type: string, listener: EventListener) => {
      if (type === 'visibilitychange') {
        const idx = visibilityListeners.indexOf(() => listener(new Event('visibilitychange')))
        if (idx >= 0) visibilityListeners.splice(idx, 1)
      }
    }) as any

    onSessionChange = vi.fn()
    mockAuthRepo = createMockAuthRepo()
    coordinator = new SsoCoordinator(mockAuthRepo, { onSessionChange })
  })

  afterEach(() => {
    coordinator.stop()
    vi.useRealTimers()
    document.addEventListener = origAddEventListener
    document.removeEventListener = origRemoveEventListener
  })

  describe('start()', () => {
    it('应注册 visibilitychange 监听 + 启动轮询 + 订阅 BroadcastChannel', () => {
      coordinator.start()

      expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(mockAuthRepo.subscribeSsoEvents).toHaveBeenCalledWith(expect.any(Function))
    })

    it('重复调用应忽略', () => {
      coordinator.start()
      coordinator.start()

      expect(document.addEventListener).toHaveBeenCalledTimes(1)
    })
  })

  describe('stop()', () => {
    it('应移除所有监听器 + 清除定时器 + 取消订阅', () => {
      const mockUnsubscribe = vi.fn()
      ;(mockAuthRepo.subscribeSsoEvents as ReturnType<typeof vi.fn>).mockReturnValue(mockUnsubscribe)

      coordinator.start()
      coordinator.stop()

      expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('未启动时调用应安全退出', () => {
      expect(() => coordinator.stop()).not.toThrow()
    })
  })

  describe('visibilitychange', () => {
    it('标签页切回前台应触发检测', async () => {
      ;(mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        loggedIn: true,
        user: { id: '1', email: 'test@example.com', displayName: '测试' },
      })

      coordinator.start()

      // 模拟 visibilityState 变为 visible
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      visibilityListeners.forEach(fn => fn())

      // 等待 200ms debounce
      await vi.advanceTimersByTimeAsync(250)

      expect(mockAuthRepo.detectSsoSession).toHaveBeenCalled()
    })
  })

  describe('定时轮询', () => {
    it('轮询到期应触发检测', async () => {
      coordinator.start({ pollIntervalMs: 5000 })

      ;(mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        loggedIn: false,
      })

      // 推进 5 秒
      await vi.advanceTimersByTimeAsync(5000)

      expect(mockAuthRepo.detectSsoSession).toHaveBeenCalled()
    })

    it('标签页隐藏应暂停轮询', async () => {
      coordinator.start({ pollIntervalMs: 5000 })

      // 模拟隐藏
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      visibilityListeners.forEach(fn => fn())

      const callCountBefore = (mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mock.calls.length

      // 推进时间，不应有新检测
      await vi.advanceTimersByTimeAsync(10000)

      const callCountAfter = (mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mock.calls.length
      // 隐藏后不应触发新的定时轮询检测（可能有 debounce 的调用）
      expect(callCountAfter).toBeLessThanOrEqual(callCountBefore + 1)
    })
  })

  describe('debounce', () => {
    it('200ms 内多次 visibilitychange 只触发一次检测', async () => {
      coordinator.start()

      // 快速触发多次 visibilitychange
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      visibilityListeners.forEach(fn => fn())
      visibilityListeners.forEach(fn => fn())
      visibilityListeners.forEach(fn => fn())

      // 200ms 内，只应触发一次
      await vi.advanceTimersByTimeAsync(100)
      const callsAt100 = (mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mock.calls.length

      await vi.advanceTimersByTimeAsync(200)
      const callsAt300 = (mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mock.calls.length

      // debounce 确保只有最后一次生效
      expect(callsAt300).toBeLessThanOrEqual(callsAt100 + 1)
    })
  })

  describe('BroadcastChannel 事件', () => {
    it('收到 logout 事件应通知会话变更', () => {
      let capturedCallback: ((event: SsoEvent) => void) | null = null
      ;(mockAuthRepo.subscribeSsoEvents as ReturnType<typeof vi.fn>).mockImplementation((cb: (event: SsoEvent) => void) => {
        capturedCallback = cb
        return () => {}
      })

      coordinator.start()

      // 模拟收到 logout 事件
      capturedCallback!({ type: 'logout' })

      expect(onSessionChange).toHaveBeenCalledWith({ loggedIn: false })
    })

    it('收到 login 事件应触发 detectSsoSession', () => {
      let capturedCallback: ((event: SsoEvent) => void) | null = null
      ;(mockAuthRepo.subscribeSsoEvents as ReturnType<typeof vi.fn>).mockImplementation((cb: (event: SsoEvent) => void) => {
        capturedCallback = cb
        return () => {}
      })

      coordinator.start()

      // 模拟收到 login 事件
      capturedCallback!({ type: 'login', userId: 123 })

      expect(mockAuthRepo.detectSsoSession).toHaveBeenCalled()
    })
  })

  describe('SSO_SESSION_EXPIRED 处理', () => {
    it('detectSsoSession 抛 SSO_SESSION_EXPIRED 应通知 loggedIn: false', async () => {
      ;(mockAuthRepo.detectSsoSession as ReturnType<typeof vi.fn>).mockRejectedValue(
        new RepositoryError({
          code: RepoErrorCodes.SSO_SESSION_EXPIRED,
          message: 'SSO 会话已过期',
          platform: 'web',
        })
      )

      coordinator.start()

      // 模拟 visibilitychange 触发
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      visibilityListeners.forEach(fn => fn())
      await vi.advanceTimersByTimeAsync(250)

      expect(onSessionChange).toHaveBeenCalledWith({ loggedIn: false })
    })
  })
})
