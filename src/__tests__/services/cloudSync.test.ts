import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri 依赖
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {})
}))

vi.mock('../../utils/tauri', () => ({
  safeInvoke: vi.fn().mockResolvedValue({}),
  isTauri: vi.fn().mockReturnValue(false)
}))

describe('cloudSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('在非 Tauri 环境下 triggerSync 返回 false', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.triggerSync()
    expect(result).toBe(false)
  })

  it('在非 Tauri 环境下 getSyncStatus 返回 null', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    const result = await cloudSyncService.getSyncStatus()
    expect(result).toBeNull()
  })

  it('在非 Tauri 环境下 startAutoSync 不抛出错误', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.startAutoSync(5)).not.toThrow()
  })

  it('stopAutoSync 正常执行', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.stopAutoSync()).not.toThrow()
  })

  it('cleanupEventListeners 正常执行', async () => {
    const { cloudSyncService } = await import('../../services/cloudSync')
    expect(() => cloudSyncService.cleanupEventListeners()).not.toThrow()
  })
})