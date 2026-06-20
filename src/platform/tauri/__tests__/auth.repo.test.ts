import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TauriAuthRepository } from '@/platform/tauri/auth.repo'
import type { SsoEvent } from '@/platform/types/auth.repository'

// mock safeInvoke
vi.mock('@/utils/tauri', () => ({
  safeInvoke: vi.fn().mockResolvedValue(null),
}))

describe('TauriAuthRepository SSO no-op 方法', () => {
  let authRepo: TauriAuthRepository

  beforeEach(() => {
    vi.clearAllMocks()
    authRepo = new TauriAuthRepository()
  })

  describe('detectSsoSession()', () => {
    it('应返回 { loggedIn: false }', async () => {
      const result = await authRepo.detectSsoSession()
      expect(result).toEqual({ loggedIn: false })
    })
  })

  describe('notifySsoEvent()', () => {
    it('应直接 resolve，不执行任何操作', async () => {
      const event: SsoEvent = { type: 'logout' }
      await expect(authRepo.notifySsoEvent(event)).resolves.toBeUndefined()
    })

    it('应接受 login 事件但不执行任何操作', async () => {
      const event: SsoEvent = { type: 'login', userId: 123 }
      await expect(authRepo.notifySsoEvent(event)).resolves.toBeUndefined()
    })
  })

  describe('subscribeSsoEvents()', () => {
    it('应返回 no-op 取消订阅函数', () => {
      const callback = vi.fn()
      const unsubscribe = authRepo.subscribeSsoEvents(callback)

      expect(typeof unsubscribe).toBe('function')
      // 调用取消函数不应抛错
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})
