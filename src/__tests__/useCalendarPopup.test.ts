import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 模拟 Tauri 环境
beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    writable: true,
    configurable: true,
  })
})

// 模拟 WebviewWindow
const mockShow = vi.fn()
const mockHide = vi.fn()
const mockSetFocus = vi.fn()
const mockGetByLabel = vi.fn()
const mockIsVisible = vi.fn()

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: () => mockGetByLabel(),
  },
}))

// 模拟事件监听
const mockListen = vi.fn()
vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}))

// 模拟窗口 API
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isVisible: () => Promise.resolve(false),
    show: mockShow,
    hide: mockHide,
    setFocus: mockSetFocus,
  }),
  availableMonitors: () => Promise.resolve([
    {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    },
  ]),
  // 模拟 PhysicalPosition 类
  PhysicalPosition: class PhysicalPosition {
    x: number
    y: number
    constructor(x: number, y: number) {
      this.x = x
      this.y = y
    }
  },
  // 模拟 LogicalSize 类
  LogicalSize: class LogicalSize {
    width: number
    height: number
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
    }
  },
}))

/**
 * 创建模拟的弹出窗口对象
 * @param options 配置选项
 * @param options.visible 窗口初始可见状态（默认 false）
 * @param options.position 窗口初始位置（默认 { x: 0, y: 0 }）
 */
function createMockPopupWindow(options: { visible?: boolean; position?: { x: number; y: number } } = {}) {
  let visible = options.visible ?? false
  const position = options.position ?? { x: 0, y: 0 }
  mockIsVisible.mockImplementation(() => Promise.resolve(visible))
  mockShow.mockImplementation(async () => { visible = true })
  mockHide.mockImplementation(async () => { visible = false })
  // 更新 isVisible 以反映 show/hide 后的状态
  mockIsVisible.mockImplementation(() => Promise.resolve(visible))

  return {
    show: mockShow,
    hide: mockHide,
    setFocus: mockSetFocus,
    isVisible: mockIsVisible,
    setPosition: vi.fn(),
    setSize: vi.fn(),
    innerPosition: vi.fn().mockResolvedValue(position),
  }
}

describe('useCalendarPopup', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // 动态导入 resetPopupState 并重置弹出窗口状态
    const { resetPopupState } = await import('../composables/useCalendarPopup')
    resetPopupState()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('showCalendarPopup', () => {
    it('当窗口不存在时打印警告', async () => {
      mockGetByLabel.mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'warn')

      const { showCalendarPopup } = await import('../composables/useCalendarPopup')
      await showCalendarPopup()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useCalendarPopup] 弹出窗口不存在，请检查窗口配置'
      )
    })

    it('显示窗口并设置焦点', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup } = await import('../composables/useCalendarPopup')
      await showCalendarPopup('Primary', { left: 100, top: 200, right: 300, bottom: 250 })

      expect(mockShow).toHaveBeenCalled()
      expect(mockSetFocus).toHaveBeenCalled()
    })

    it('传递 monitorType 和 clockRect 参数', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')
      await showCalendarPopup('Primary', { left: 100, top: 200, right: 300, bottom: 250 })

      // 验证窗口已显示
      expect(await isPopupVisible()).toBe(true)
      expect(mockShow).toHaveBeenCalled()
    })
  })

  describe('hideCalendarPopup', () => {
    it('隐藏弹出窗口', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, hideCalendarPopup } = await import('../composables/useCalendarPopup')

      // 先显示窗口
      await showCalendarPopup()
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 再隐藏
      await hideCalendarPopup()

      expect(mockHide).toHaveBeenCalled()
    })
  })

  describe('toggleCalendarPopup', () => {
    it('窗口隐藏时显示窗口', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup } = await import('../composables/useCalendarPopup')
      toggleCalendarPopup('Primary', { left: 100, top: 200, right: 300, bottom: 250 })

      // 等待防抖延迟
      await vi.advanceTimersByTimeAsync(300)

      expect(mockShow).toHaveBeenCalled()
      expect(mockSetFocus).toHaveBeenCalled()
    })

    it('窗口显示时隐藏窗口', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, toggleCalendarPopup } = await import('../composables/useCalendarPopup')

      // 先显示窗口
      await showCalendarPopup()
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)
      vi.clearAllMocks()

      // 重置 mock 返回值（clearAllMocks 清除了 mockGetByLabel）
      mockGetByLabel.mockResolvedValue(mockWindow)

      // 再切换，应该隐藏
      toggleCalendarPopup()
      // 等待防抖延迟
      await vi.advanceTimersByTimeAsync(300)

      expect(mockHide).toHaveBeenCalled()
    })
  })

  describe('isPopupVisible', () => {
    it('初始状态为 false', async () => {
      const { isPopupVisible } = await import('../composables/useCalendarPopup')
      // 窗口不存在时返回 false
      mockGetByLabel.mockResolvedValue(null)
      expect(await isPopupVisible()).toBe(false)
    })

    it('显示后返回 true', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')
      await showCalendarPopup()
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      expect(await isPopupVisible()).toBe(true)
    })
  })
})

describe('useWindowToggle 事件处理', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockListen.mockReset()
    // 重置弹出窗口状态
    const { resetPopupState } = await import('../composables/useCalendarPopup')
    resetPopupState()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ClockArea 事件触发弹出窗口切换', async () => {
    // 设置模拟返回值
    const mockWindow = createMockPopupWindow()
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 模拟事件回调
    let eventCallback: (event: { payload: unknown }) => Promise<void> = async () => {}
    mockListen.mockImplementation(async (_event: string, callback: (e: { payload: unknown }) => Promise<void>) => {
      eventCallback = callback
      return () => {}
    })

    // 初始化监听器
    const { initWindowToggleListener } = await import('../composables/useWindowToggle')
    await initWindowToggleListener()

    // 触发 ClockArea 事件
    await eventCallback({
      payload: {
        source: 'ClockArea',
        monitorType: 'Primary',
        clockRect: { left: 100, top: 200, right: 300, bottom: 250 },
      },
    })

    // 等待防抖延迟
    await vi.advanceTimersByTimeAsync(300)

    // 验证弹出窗口被显示
    expect(mockShow).toHaveBeenCalled()
  })

  it('TrayIcon 事件触发主窗口切换', async () => {
    const mockWindowVisible = vi.fn().mockResolvedValue(false)
    const mockMainWindowShow = vi.fn()
    const mockMainWindowHide = vi.fn()
    const mockMainWindowFocus = vi.fn()

    // 重新模拟窗口 API - 需要在导入模块之前设置
    vi.doMock('@tauri-apps/api/window', () => ({
      getCurrentWindow: () => ({
        isVisible: mockWindowVisible,
        show: mockMainWindowShow,
        hide: mockMainWindowHide,
        setFocus: mockMainWindowFocus,
      }),
    }))

    // 重置模块缓存以应用新的 mock
    vi.resetModules()

    // 模拟事件回调
    let eventCallback: (event: { payload: unknown }) => Promise<void> = async () => {}
    const localMockListen = vi.fn().mockImplementation(async (_event: string, callback: (e: { payload: unknown }) => Promise<void>) => {
      eventCallback = callback
      return () => {}
    })

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: localMockListen,
    }))

    // 初始化监听器
    const { initWindowToggleListener } = await import('../composables/useWindowToggle')
    await initWindowToggleListener()

    // 触发 TrayIcon 事件
    await eventCallback({
      payload: {
        source: 'TrayIcon',
      },
    })

    // 由于模拟了主窗口不可见，应该调用 show
    expect(mockMainWindowShow).toHaveBeenCalled()

    // 恢复模块
    vi.doUnmock('@tauri-apps/api/window')
    vi.doUnmock('@tauri-apps/api/event')
  })

  it('参数正确传递给弹出窗口控制逻辑', async () => {
    const mockWindow = createMockPopupWindow()

    // 由于上一个测试使用了 vi.resetModules()，需要重新设置全局 mock
    vi.doMock('@tauri-apps/api/webviewWindow', () => ({
      WebviewWindow: {
        getByLabel: () => mockGetByLabel(),
      },
    }))

    vi.doMock('@tauri-apps/api/event', () => ({
      listen: (...args: unknown[]) => mockListen(...args),
    }))

    vi.doMock('@tauri-apps/api/window', () => ({
      getCurrentWindow: () => ({
        isVisible: () => Promise.resolve(false),
        show: mockShow,
        hide: mockHide,
        setFocus: mockSetFocus,
      }),
      availableMonitors: () => Promise.resolve([
        {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
      ]),
      // 模拟 PhysicalPosition 类
      PhysicalPosition: class PhysicalPosition {
        x: number
        y: number
        constructor(x: number, y: number) {
          this.x = x
          this.y = y
        }
      },
      // 模拟 LogicalSize 类
      LogicalSize: class LogicalSize {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
      },
    }))

    vi.doMock('@tauri-apps/plugin-positioner', () => ({
      moveWindowConstrained: () => Promise.resolve(),
      Position: {
        TrayBottomRight: 'TrayBottomRight',
      },
    }))

    // 重置模块缓存以应用新的 mock
    vi.resetModules()

    // 设置 mock 返回值
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 重置弹出窗口状态
    const { resetPopupState, isPopupVisible } = await import('../composables/useCalendarPopup')
    resetPopupState()

    // 模拟事件回调
    let eventCallback: (event: { payload: unknown }) => Promise<void> = async () => {}
    mockListen.mockImplementation(async (_event: string, callback: (e: { payload: unknown }) => Promise<void>) => {
      eventCallback = callback
      return () => {}
    })

    // 初始化监听器
    const { initWindowToggleListener } = await import('../composables/useWindowToggle')
    await initWindowToggleListener()

    // 重置 mock 返回值（因为在 beforeEach 中被清除）
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 触发带参数的 ClockArea 事件
    await eventCallback({
      payload: {
        source: 'ClockArea',
        monitorType: 'Secondary',
        clockRect: { left: 1920, top: 0, right: 2120, bottom: 50 },
      },
    })

    // 等待防抖延迟
    await vi.advanceTimersByTimeAsync(300)

    // 验证参数传递
    expect(await isPopupVisible()).toBe(true)
    expect(mockShow).toHaveBeenCalled()
  })
})

describe('setPopupWindowSize', () => {
  it('设置窗口为小尺寸', async () => {
    const mockWindow = createMockPopupWindow()
    mockGetByLabel.mockResolvedValue(mockWindow)
    const setSizeMock = mockWindow.setSize as ReturnType<typeof vi.fn>
    const setPositionMock = mockWindow.setPosition as ReturnType<typeof vi.fn>
    const consoleSpy = vi.spyOn(console, 'log')

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    await setPopupWindowSize('small')

    // 检查 setSize 被调用
    expect(setSizeMock).toHaveBeenCalled()
    // 检查是否传入了正确的 LogicalSize
    const logicalSizeArg = setSizeMock.mock.calls[0][0]
    expect(logicalSizeArg).toBeInstanceOf(Object)
    expect(logicalSizeArg.width).toBe(280)
    expect(logicalSizeArg.height).toBe(400)
    // 检查 setPosition 被调用（窗口重新定位到右下角）
    expect(setPositionMock).toHaveBeenCalled()
    // 检查日志输出
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('窗口已调整到右下角位置')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('280x400')
    )
  })

  it('设置窗口为中等尺寸', async () => {
    const mockWindow = createMockPopupWindow()
    mockGetByLabel.mockResolvedValue(mockWindow)
    const setSizeMock = mockWindow.setSize as ReturnType<typeof vi.fn>
    const setPositionMock = mockWindow.setPosition as ReturnType<typeof vi.fn>
    const consoleSpy = vi.spyOn(console, 'log')

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    await setPopupWindowSize('medium')

    expect(setSizeMock).toHaveBeenCalled()
    const logicalSizeArg = setSizeMock.mock.calls[0][0]
    expect(logicalSizeArg.width).toBe(340)
    expect(logicalSizeArg.height).toBe(480)
    // 检查 setPosition 被调用
    expect(setPositionMock).toHaveBeenCalled()
    // 检查日志输出
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('窗口已调整到右下角位置')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('340x480')
    )
  })

  it('设置窗口为大尺寸', async () => {
    const mockWindow = createMockPopupWindow()
    mockGetByLabel.mockResolvedValue(mockWindow)
    const setSizeMock = mockWindow.setSize as ReturnType<typeof vi.fn>
    const setPositionMock = mockWindow.setPosition as ReturnType<typeof vi.fn>
    const consoleSpy = vi.spyOn(console, 'log')

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    await setPopupWindowSize('large')

    expect(setSizeMock).toHaveBeenCalled()
    const logicalSizeArg = setSizeMock.mock.calls[0][0]
    expect(logicalSizeArg.width).toBe(400)
    expect(logicalSizeArg.height).toBe(560)
    // 检查 setPosition 被调用
    expect(setPositionMock).toHaveBeenCalled()
    // 检查日志输出
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('窗口已调整到右下角位置')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('400x560')
    )
  })

  it('窗口不存在时打印警告', async () => {
    mockGetByLabel.mockResolvedValue(null)
    const consoleSpy = vi.spyOn(console, 'warn')

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    await setPopupWindowSize('medium')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[useCalendarPopup] 弹出窗口不存在，无法设置大小'
    )
  })

  it('设置窗口大小时发生错误', async () => {
    const mockWindow = createMockPopupWindow()
    mockWindow.setSize = vi.fn().mockRejectedValue(new Error('设置失败'))
    mockGetByLabel.mockResolvedValue(mockWindow)
    const consoleSpy = vi.spyOn(console, 'error')

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    await expect(setPopupWindowSize('medium')).rejects.toThrow('设置失败')
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useCalendarPopup] 设置窗口大小失败:',
      expect.any(Error)
    )
  })
})

describe('checkWindowBounds', () => {
  // 定义测试用显示器
  const testMonitor = {
    position: { x: 0, y: 0 },
    size: { width: 1920, height: 1080 },
  }

  it('窗口在安全范围内不需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 100, y: 100 },
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(false)
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  it('窗口超出左边界需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 0, y: 100 }, // 窗口左边缘在显示器左边缘
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(8) // POPUP_MARGIN = 8
    expect(result.y).toBe(100)
  })

  it('窗口超出右边界需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 1600, y: 100 }, // 窗口右边缘 1600 + 340 = 1940 > 1920 - 8
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(1920 - 340 - 8) // 1572
    expect(result.y).toBe(100)
  })

  it('窗口超出上边界需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 100, y: 0 }, // 窗口上边缘在显示器上边缘
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(100)
    expect(result.y).toBe(8) // POPUP_MARGIN = 8
  })

  it('窗口超出下边界需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 100, y: 620 }, // 窗口下边缘 620 + 480 = 1100 > 1080 - 8
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(100)
    expect(result.y).toBe(1080 - 480 - 8) // 592
  })

  it('大尺寸窗口超出多边界需要调整', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: 0, y: 0 }, // 同时超出左边界和上边界
      { width: 400, height: 560 }, // large 尺寸
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(8)
    expect(result.y).toBe(8)
  })

  it('处理负坐标位置', async () => {
    const { checkWindowBounds } = await import('../composables/useCalendarPopup')

    const result = checkWindowBounds(
      { x: -100, y: -50 },
      { width: 340, height: 480 },
      testMonitor as any
    )

    expect(result.needsAdjustment).toBe(true)
    expect(result.x).toBe(8)
    expect(result.y).toBe(8)
  })
})

describe('findWindowMonitor', () => {
  // 定义多显示器配置
  const multiMonitors = [
    {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
    },
    {
      position: { x: 1920, y: 0 },
      size: { width: 1920, height: 1080 },
    },
  ]

  it('窗口在主显示器上', async () => {
    const { findWindowMonitor } = await import('../composables/useCalendarPopup')

    const monitor = findWindowMonitor(
      { x: 500, y: 300 },
      multiMonitors as any
    )

    expect(monitor).not.toBeNull()
    expect(monitor!.position.x).toBe(0)
    expect(monitor!.position.y).toBe(0)
  })

  it('窗口在副显示器上', async () => {
    const { findWindowMonitor } = await import('../composables/useCalendarPopup')

    const monitor = findWindowMonitor(
      { x: 2200, y: 300 }, // 副显示器中心区域
      multiMonitors as any
    )

    expect(monitor).not.toBeNull()
    expect(monitor!.position.x).toBe(1920)
    expect(monitor!.position.y).toBe(0)
  })

  it('窗口位置不在任何显示器上，返回主显示器', async () => {
    const { findWindowMonitor, getPrimaryMonitor } = await import('../composables/useCalendarPopup')

    // 窗口位置在显示器范围外
    const monitor = findWindowMonitor(
      { x: -100, y: -100 },
      multiMonitors as any
    )

    // 应返回主显示器
    const primary = getPrimaryMonitor(multiMonitors as any)
    expect(monitor).toEqual(primary)
  })
})

describe('setPopupWindowSize 边界检查集成', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const { resetPopupState } = await import('../composables/useCalendarPopup')
    resetPopupState()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('窗口大小变更后重新定位到右下角', async () => {
    // 创建模拟窗口，位置靠近右边界
    const mockWindow = {
      ...createMockPopupWindow(),
      innerPosition: vi.fn().mockResolvedValue({ x: 1600, y: 100 }),
      setPosition: vi.fn(),
    }
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 模拟 availableMonitors 返回显示器信息
    vi.doMock('@tauri-apps/api/window', () => ({
      getCurrentWindow: () => ({
        isVisible: () => Promise.resolve(false),
        show: mockShow,
        hide: mockHide,
        setFocus: mockSetFocus,
      }),
      availableMonitors: () => Promise.resolve([
        {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
      ]),
      PhysicalPosition: class PhysicalPosition {
        x: number
        y: number
        constructor(x: number, y: number) {
          this.x = x
          this.y = y
        }
      },
      LogicalSize: class LogicalSize {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
      },
    }))

    vi.resetModules()

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    const consoleSpy = vi.spyOn(console, 'log')

    await setPopupWindowSize('medium')

    // 检查 setSize 被调用
    expect(mockWindow.setSize).toHaveBeenCalled()

    // 检查 setPosition 被调用（窗口重新定位到右下角）
    expect(mockWindow.setPosition).toHaveBeenCalled()

    // 检查日志输出（窗口已调整到右下角位置）
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('窗口已调整到右下角位置')
    )
  })

  it('窗口大小变更后重新定位到右下角（原位置在安全范围内）', async () => {
    // 创建模拟窗口，位置在安全范围内
    const mockWindow = {
      ...createMockPopupWindow(),
      innerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
      setPosition: vi.fn(),
    }
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 模拟 availableMonitors 返回显示器信息（必须在 vi.resetModules 后重新设置）
    vi.doMock('@tauri-apps/api/window', () => ({
      getCurrentWindow: () => ({
        isVisible: () => Promise.resolve(false),
        show: mockShow,
        hide: mockHide,
        setFocus: mockSetFocus,
      }),
      availableMonitors: () => Promise.resolve([
        {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 },
        },
      ]),
      PhysicalPosition: class PhysicalPosition {
        x: number
        y: number
        constructor(x: number, y: number) {
          this.x = x
          this.y = y
        }
      },
      LogicalSize: class LogicalSize {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
      },
    }))

    vi.resetModules()

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    const consoleSpy = vi.spyOn(console, 'log')

    await setPopupWindowSize('medium')

    // 检查 setSize 被调用
    expect(mockWindow.setSize).toHaveBeenCalled()

    // 检查 setPosition 被调用（窗口重新定位到右下角，无论原位置如何）
    expect(mockWindow.setPosition).toHaveBeenCalled()

    // 检查日志输出（窗口已调整到右下角位置）
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('窗口已调整到右下角位置')
    )
    // 不应包含位置调整的日志
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('窗口位置已调整')
    )
  })

  it('未检测到显示器时仅设置窗口大小', async () => {
    const mockWindow = {
      ...createMockPopupWindow(),
      innerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
      setPosition: vi.fn(),
    }
    mockGetByLabel.mockResolvedValue(mockWindow)

    // 模拟无显示器情况
    vi.doMock('@tauri-apps/api/window', () => ({
      getCurrentWindow: () => ({
        isVisible: () => Promise.resolve(false),
        show: mockShow,
        hide: mockHide,
        setFocus: mockSetFocus,
      }),
      availableMonitors: () => Promise.resolve([]),
      PhysicalPosition: class PhysicalPosition {
        x: number
        y: number
        constructor(x: number, y: number) {
          this.x = x
          this.y = y
        }
      },
      LogicalSize: class LogicalSize {
        width: number
        height: number
        constructor(width: number, height: number) {
          this.width = width
          this.height = height
        }
      },
    }))

    vi.resetModules()

    const { setPopupWindowSize } = await import('../composables/useCalendarPopup')
    const consoleWarnSpy = vi.spyOn(console, 'warn')

    await setPopupWindowSize('medium')

    // 检查警告日志
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[useCalendarPopup] 未检测到显示器，仅设置窗口大小'
    )
    // setPosition 不应被调用
    expect(mockWindow.setPosition).not.toHaveBeenCalled()
  })
})
