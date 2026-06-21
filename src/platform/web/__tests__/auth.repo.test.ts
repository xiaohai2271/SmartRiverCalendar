import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebAuthRepository } from '@/platform/web/auth.repo'
import { WebApiClient } from '@/platform/web/api-client'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'
import type { SsoEvent } from '@/platform/types/auth.repository'

// mock fetch
const mockFetch = vi.fn()
globalThis.fetch = mockFetch

// mock BroadcastChannel
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = []
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  listeners: Array<(event: MessageEvent) => void> = []

  constructor(name: string) {
    this.name = name
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(data: unknown): void {
    // 模拟广播到其他实例
    MockBroadcastChannel.instances.forEach(instance => {
      if (instance !== this && instance.name === this.name) {
        const event = new MessageEvent('message', { data })
        instance.listeners.forEach(listener => listener(event))
        if (instance.onmessage) {
          instance.onmessage(event)
        }
      }
    })
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.listeners.push(listener)
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  close(): void {
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter(i => i !== this)
  }
}

// 替换全局 BroadcastChannel
vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)

describe('WebAuthRepository SSO 方法', () => {
  let authRepo: WebAuthRepository
  let apiClient: WebApiClient

  beforeEach(() => {
    MockBroadcastChannel.instances = []
    apiClient = new WebApiClient()
    authRepo = new WebAuthRepository(apiClient)
    vi.clearAllMocks()
  })

  afterEach(() => {
    MockBroadcastChannel.instances = []
  })

  describe('detectSsoSession()', () => {
    it('200 响应应返回 loggedIn: true 和用户数据', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        display_name: '测试用户',
        avatar_url: null,
        provider: 'local',
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, data: mockUser }),
      })

      const result = await authRepo.detectSsoSession()
      expect(result.loggedIn).toBe(true)
      if (result.loggedIn && result.user) {
        expect(result.user.email).toBe('test@example.com')
      }

      // 验证请求携带 credentials: 'include'
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/user/profile'),
        expect.objectContaining({ credentials: 'include' })
      )
    })

    it('401 响应 + wasLoggedIn=false 应返回 loggedIn: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: 401 }),
      })

      const result = await authRepo.detectSsoSession()
      expect(result.loggedIn).toBe(false)
    })

    it('401 响应 + wasLoggedIn=true 应抛出 SSO_SESSION_EXPIRED', async () => {
      authRepo.setWasLoggedInGetter(() => true)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ code: 401 }),
      })

      try {
        await authRepo.detectSsoSession()
        expect.fail('应抛出 SSO_SESSION_EXPIRED 错误')
      } catch (error) {
        expect(error).toBeInstanceOf(RepositoryError)
        expect((error as RepositoryError).code).toBe(RepoErrorCodes.SSO_SESSION_EXPIRED)
      }
    })

    it('网络错误应返回 loggedIn: false，不抛错', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('NetworkError'))

      const result = await authRepo.detectSsoSession()
      expect(result.loggedIn).toBe(false)
    })

    it('非 200/401 响应应返回 loggedIn: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ code: 500 }),
      })

      const result = await authRepo.detectSsoSession()
      expect(result.loggedIn).toBe(false)
    })
  })

  describe('notifySsoEvent()', () => {
    it('应通过 BroadcastChannel.postMessage 发送事件', async () => {
      const event: SsoEvent = { type: 'logout' }
      await authRepo.notifySsoEvent(event)

      // 验证 BroadcastChannel 实例已创建并调用 postMessage
      const channel = MockBroadcastChannel.instances.find(c => c.name === 'smart-river-calendar-sso')
      expect(channel).toBeDefined()
    })

    it('应支持发送 login 事件', async () => {
      const event: SsoEvent = { type: 'login', userId: 123 }
      await authRepo.notifySsoEvent(event)

      const channel = MockBroadcastChannel.instances.find(c => c.name === 'smart-river-calendar-sso')
      expect(channel).toBeDefined()
    })
  })

  describe('subscribeSsoEvents()', () => {
    it('应返回取消订阅函数', () => {
      const callback = vi.fn()
      const unsubscribe = authRepo.subscribeSsoEvents(callback)

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })

    it('addEventListener 注册的回调应被触发', () => {
      const callback = vi.fn()
      authRepo.subscribeSsoEvents(callback)

      // 获取 BroadcastChannel 实例
      const channel = MockBroadcastChannel.instances.find(c => c.name === 'smart-river-calendar-sso')
      expect(channel).toBeDefined()

      // 直接触发 addEventListener 注册的监听器
      const event = new MessageEvent('message', { data: { type: 'logout' } })
      channel!.listeners.forEach(listener => listener(event))

      expect(callback).toHaveBeenCalledWith({ type: 'logout' })
    })

    it('取消订阅后应不再触发回调', () => {
      const callback = vi.fn()
      const unsubscribe = authRepo.subscribeSsoEvents(callback)

      // 获取 channel 取消订阅前的快照
      const channel = MockBroadcastChannel.instances.find(c => c.name === 'smart-river-calendar-sso')
      const listenerCountBefore = channel?.listeners.length ?? 0

      unsubscribe()

      // 取消订阅后 listeners 应减少
      const channelAfter = MockBroadcastChannel.instances.find(c => c.name === 'smart-river-calendar-sso')
      const listenerCountAfter = channelAfter?.listeners.length ?? 0
      expect(listenerCountAfter).toBeLessThan(listenerCountBefore)
    })
  })
})
