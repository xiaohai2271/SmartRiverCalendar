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
    expect(mockInvoke).toHaveBeenCalledWith('disable_clock_hook')
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
    // 移除 Tauri 环境标记
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const { enableClockHook } = await import('../utils/tauri')
    expect(await enableClockHook()).toBe('')
    // invoke 不应被调用
    expect(mockInvoke).not.toHaveBeenCalled()
  })
})
