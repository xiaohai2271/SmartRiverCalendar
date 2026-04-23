import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟 Tauri 环境：safeInvoke 内部会检查 isTauri()
beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    writable: true,
    configurable: true,
  })
})

const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))

describe('clockHook API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockReset()
  })

  it('enableClockHook 返回检测方式名称', async () => {
    mockInvoke.mockResolvedValue('窗口句柄查找')
    const { enableClockHook } = await import('../utils/tauri')
    expect(await enableClockHook()).toBe('窗口句柄查找')
  })

  it('disableClockHook 调用正确命令', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const { disableClockHook } = await import('../utils/tauri')
    await disableClockHook()
    // safeInvoke 会传递 undefined 作为第二个参数
    expect(mockInvoke).toHaveBeenCalledWith('disable_clock_hook', undefined)
  })

  it('setClockHookBlockPopup 传递 block 参数', async () => {
    mockInvoke.mockResolvedValue(undefined)
    const { setClockHookBlockPopup } = await import('../utils/tauri')
    await setClockHookBlockPopup(true)
    expect(mockInvoke).toHaveBeenCalledWith('set_clock_hook_block_popup', { block: true })
  })

  it('getClockHookStatus 返回状态字符串', async () => {
    mockInvoke.mockResolvedValue('窗口句柄查找')
    const { getClockHookStatus } = await import('../utils/tauri')
    expect(await getClockHookStatus()).toBe('窗口句柄查找')
  })

  it('isClockHookAvailable 返回可用状态', async () => {
    mockInvoke.mockResolvedValue(true)
    const { isClockHookAvailable } = await import('../utils/tauri')
    expect(await isClockHookAvailable()).toBe(true)
  })

  it('非 Tauri 环境下返回默认值', async () => {
    // 完全删除 Tauri 环境标记属性（而不是设置为 undefined）
    delete (window as any).__TAURI_INTERNALS__
    
    // 重置模块缓存以确保重新导入
    vi.resetModules()
    
    const { enableClockHook } = await import('../utils/tauri')
    expect(await enableClockHook()).toBe('')
    // invoke 不应被调用
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
