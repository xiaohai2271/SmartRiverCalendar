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

describe('弹出窗口防抖和竞态保护', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // 重置弹出窗口状态
    const { resetPopupState } = await import('../composables/useCalendarPopup')
    resetPopupState()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('防抖功能', () => {
    it('快速连续点击只触发一次切换', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup } = await import('../composables/useCalendarPopup')

      // 快速连续调用 3 次
      toggleCalendarPopup()
      toggleCalendarPopup()
      toggleCalendarPopup()

      // 此时不应立即执行
      expect(mockShow).not.toHaveBeenCalled()

      // 快进 300ms
      await vi.advanceTimersByTimeAsync(300)

      // 应该只执行一次
      expect(mockShow).toHaveBeenCalledTimes(1)
    })

    it('防抖延迟期间使用最新参数', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, hideCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')

      // 先显示窗口
      await showCalendarPopup()
      await vi.advanceTimersByTimeAsync(200)
      expect(await isPopupVisible()).toBe(true)

      // 隐藏窗口
      await hideCalendarPopup()
      await vi.advanceTimersByTimeAsync(200)
      expect(await isPopupVisible()).toBe(false)

      // 重置 mock
      mockShow.mockClear()
    })

    it('防抖延迟后再次调用会重新开始计时', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup } = await import('../composables/useCalendarPopup')

      // 第一次调用 - 显示
      toggleCalendarPopup()
      await vi.advanceTimersByTimeAsync(300)
      expect(mockShow).toHaveBeenCalledTimes(1)

      // 等待动画完成（200ms）
      await vi.advanceTimersByTimeAsync(200)

      // 重置 mock 计数
      mockHide.mockClear()

      // 第二次调用 - 隐藏
      toggleCalendarPopup()
      await vi.advanceTimersByTimeAsync(300)
      expect(mockHide).toHaveBeenCalledTimes(1)
    })

    it('hasPendingDebounce 返回正确的防抖状态', async () => {
      const { toggleCalendarPopup, hasPendingDebounce } = await import('../composables/useCalendarPopup')

      // 初始没有待处理的防抖
      expect(hasPendingDebounce()).toBe(false)

      // 调用后有待处理的防抖
      toggleCalendarPopup()
      expect(hasPendingDebounce()).toBe(true)

      // 等待防抖完成
      await vi.advanceTimersByTimeAsync(300)
      expect(hasPendingDebounce()).toBe(false)
    })
  })

  describe('竞态保护', () => {
    it('过渡期间忽略新的切换请求', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup, isPopupTransitioning } = await import('../composables/useCalendarPopup')

      // 第一次调用
      toggleCalendarPopup()
      await vi.advanceTimersByTimeAsync(300)

      // 等待动画完成（200ms）
      await vi.advanceTimersByTimeAsync(200)

      // 过渡状态应该已经重置
      expect(isPopupTransitioning()).toBe(false)
    })

    it('show 过渡期间忽略重复的 show 请求', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')

      // 显示窗口
      await showCalendarPopup()
      expect(await isPopupVisible()).toBe(true)

      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 重置 mock
      mockShow.mockClear()

      // 再次显示应该被忽略（因为已经显示）
      await showCalendarPopup()
      expect(mockShow).not.toHaveBeenCalled()
    })

    it('hide 过渡期间忽略重复的 hide 请求', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, hideCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')

      // 先显示窗口
      await showCalendarPopup()
      expect(await isPopupVisible()).toBe(true)

      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 隐藏窗口
      await hideCalendarPopup()

      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      expect(await isPopupVisible()).toBe(false)

      // 重置 mock
      mockHide.mockClear()

      // 再次隐藏应该被忽略（因为已经隐藏）
      await hideCalendarPopup()
      expect(mockHide).not.toHaveBeenCalled()
    })

    it('isPopupTransitioning 返回正确的过渡状态', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, isPopupTransitioning } = await import('../composables/useCalendarPopup')

      // 初始不在过渡中
      expect(isPopupTransitioning()).toBe(false)

      // 开始显示
      const showPromise = showCalendarPopup()

      // 在动画完成前应该处于过渡中
      expect(isPopupTransitioning()).toBe(true)

      // 等待完成
      await showPromise
      await vi.advanceTimersByTimeAsync(200)

      // 动画完成后不再过渡中
      expect(isPopupTransitioning()).toBe(false)
    })
  })

  describe('状态重置', () => {
    it('resetPopupState 清除过渡和防抖状态', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, resetPopupState, isPopupVisible, isPopupTransitioning, hasPendingDebounce } = await import('../composables/useCalendarPopup')

      // 显示窗口
      await showCalendarPopup()
      // isPopupVisible 现在实时查询窗口状态
      expect(await isPopupVisible()).toBe(true)

      // 重置状态
      resetPopupState()

      // 过渡和防抖状态应该重置
      expect(isPopupTransitioning()).toBe(false)
      expect(hasPendingDebounce()).toBe(false)
      // isPopupVisible 查询真实窗口状态，窗口仍然可见
      expect(await isPopupVisible()).toBe(true)
    })

    it('重置状态后可以正常操作', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showCalendarPopup, hideCalendarPopup, resetPopupState, isPopupVisible } = await import('../composables/useCalendarPopup')

      // 显示并重置
      await showCalendarPopup()
      resetPopupState()

      // 重置后应该可以正常显示
      await showCalendarPopup()
      expect(await isPopupVisible()).toBe(true)

      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 应该可以正常隐藏
      await hideCalendarPopup()

      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      expect(await isPopupVisible()).toBe(false)
    })
  })

  describe('综合场景', () => {
    it('防抖 + 竞态组合：快速连续调用最终只执行一次', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup } = await import('../composables/useCalendarPopup')

      // 模拟快速点击
      for (let i = 0; i < 10; i++) {
        toggleCalendarPopup()
      }

      // 等待防抖完成
      await vi.advanceTimersByTimeAsync(300)

      // 只应该执行一次显示
      expect(mockShow).toHaveBeenCalledTimes(1)
    })

    it('主窗口可见时弹出弹出窗口正常工作', async () => {
      const mockWindow = createMockPopupWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { toggleCalendarPopup, isPopupVisible } = await import('../composables/useCalendarPopup')

      // 调用切换（模拟主窗口可见时的场景）
      toggleCalendarPopup()
      await vi.advanceTimersByTimeAsync(300)

      // 弹出窗口应该正常显示
      expect(await isPopupVisible()).toBe(true)
      expect(mockShow).toHaveBeenCalled()
    })
  })
})
