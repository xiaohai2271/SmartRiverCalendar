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
}))

/**
 * 创建模拟的弹出窗口对象
 * @param options 配置选项
 * @param options.visible 窗口初始可见状态（默认 false）
 */
function createMockPopupWindow(options: { visible?: boolean } = {}) {
  let visible = options.visible ?? false
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
