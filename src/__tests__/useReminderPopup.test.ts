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
const mockInnerPosition = vi.fn()

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: (label: string) => mockGetByLabel(label),
  },
}))

// 模拟窗口 API
vi.mock('@tauri-apps/api/window', () => ({
  availableMonitors: () => Promise.resolve([
    {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1032 },
      },
      scaleFactor: 1,
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
  PhysicalSize: class PhysicalSize {
    width: number
    height: number
    constructor(width: number, height: number) {
      this.width = width
      this.height = height
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

// 模拟事件 API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

/**
 * 创建模拟的提醒窗口对象
 * @param options 配置选项
 * @param options.visible 窗口初始可见状态（默认 false）
 * @param options.position 窗口初始位置（默认 { x: 0, y: 0 }）
 * @param options.size 窗口初始尺寸（默认 { width: 320, height: 160 }）
 */
function createMockReminderWindow(options: { visible?: boolean; position?: { x: number; y: number }; size?: { width: number; height: number } } = {}) {
  let visible = options.visible ?? false
  const position = options.position ?? { x: 0, y: 0 }
  const size = options.size ?? { width: 320, height: 160 }
  mockIsVisible.mockImplementation(() => Promise.resolve(visible))
  mockShow.mockImplementation(async () => { visible = true })
  mockHide.mockImplementation(async () => { visible = false })
  mockInnerPosition.mockResolvedValue(position)

  return {
    show: mockShow,
    hide: mockHide,
    setFocus: mockSetFocus,
    isVisible: mockIsVisible,
    setPosition: vi.fn(),
    setSize: vi.fn(),
    innerPosition: mockInnerPosition,
    innerSize: vi.fn().mockResolvedValue(size),
  }
}

describe('useReminderPopup', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // 动态导入 resetReminderState 并重置提醒窗口状态
    const { resetReminderState } = await import('../composables/useReminderPopup')
    resetReminderState()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('showReminderPopup', () => {
    it('当窗口不存在时打印警告', async () => {
      mockGetByLabel.mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'warn')

      const { showReminderPopup } = await import('../composables/useReminderPopup')
      await showReminderPopup()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useReminderPopup] 提醒窗口不存在，请检查窗口配置'
      )
    })

    it('显示窗口并设置焦点', async () => {
      const mockWindow = createMockReminderWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showReminderPopup } = await import('../composables/useReminderPopup')
      await showReminderPopup('reminder-123')

      expect(mockShow).toHaveBeenCalled()
      expect(mockSetFocus).toHaveBeenCalled()
    })

    it('窗口已显示时忽略重复请求', async () => {
      const mockWindow = createMockReminderWindow({ visible: true })
      mockGetByLabel.mockResolvedValue(mockWindow)
      const consoleSpy = vi.spyOn(console, 'log')

      const { showReminderPopup } = await import('../composables/useReminderPopup')
      await showReminderPopup()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useReminderPopup] 提醒窗口已显示，忽略重复请求'
      )
      expect(mockShow).not.toHaveBeenCalled()
    })

    it('定位到右下角', async () => {
      const mockWindow = createMockReminderWindow()
      const setPositionMock = mockWindow.setPosition as ReturnType<typeof vi.fn>
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showReminderPopup } = await import('../composables/useReminderPopup')
      await showReminderPopup()

      // 验证 setPosition 被调用
      expect(setPositionMock).toHaveBeenCalled()
      // 检查传入的位置参数
      const positionArg = setPositionMock.mock.calls[0][0]
      expect(positionArg.x).toBeDefined()
      expect(positionArg.y).toBeDefined()
    })
  })

  describe('hideReminderPopup', () => {
    it('隐藏提醒窗口', async () => {
      const mockWindow = createMockReminderWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showReminderPopup, hideReminderPopup } = await import('../composables/useReminderPopup')

      // 先显示窗口
      await showReminderPopup()
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 重置 mocks
      vi.clearAllMocks()
      mockGetByLabel.mockResolvedValue(mockWindow)
      // 模拟窗口可见
      mockIsVisible.mockResolvedValue(true)

      // 再隐藏
      await hideReminderPopup()

      expect(mockHide).toHaveBeenCalled()
    })

    it('窗口已隐藏时忽略重复请求', async () => {
      mockGetByLabel.mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'log')

      const { hideReminderPopup } = await import('../composables/useReminderPopup')
      await hideReminderPopup()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[useReminderPopup] 提醒窗口已隐藏，忽略重复请求'
      )
    })
  })

  describe('isReminderVisible', () => {
    it('初始状态为 false', async () => {
      mockGetByLabel.mockResolvedValue(null)
      const { isReminderVisible } = await import('../composables/useReminderPopup')
      expect(await isReminderVisible()).toBe(false)
    })

    it('显示后返回 true', async () => {
      const mockWindow = createMockReminderWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showReminderPopup, isReminderVisible } = await import('../composables/useReminderPopup')
      await showReminderPopup()
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)

      // 重置 mock
      mockGetByLabel.mockResolvedValue(mockWindow)
      mockIsVisible.mockResolvedValue(true)

      expect(await isReminderVisible()).toBe(true)
    })
  })

  describe('calculateBaseReminderPosition', () => {
    it('计算右下角基础位置（任务栏在底部）', async () => {
      const { calculateBaseReminderPosition } = await import('../composables/useReminderPopup')

      const primaryMonitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1032 }, // 1080 - 48 任务栏
        },
        scaleFactor: 1,
      }

      const position = calculateBaseReminderPosition(primaryMonitor as any)

      // 右边缘对齐：0 + 1920 - 320 - 8 = 1592
      expect(position.x).toBe(1592)
      // 底部对齐（工作区域）：0 + 1032 - 160 - 8 = 864
      expect(position.y).toBe(864)
    })

    it('处理多显示器坐标系统', async () => {
      const { calculateBaseReminderPosition } = await import('../composables/useReminderPopup')

      // 副显示器（位置在 1920, 0）
      const secondaryMonitor = {
        position: { x: 1920, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 1920, y: 0 },
          size: { width: 1920, height: 1032 },
        },
        scaleFactor: 1,
      }

      const position = calculateBaseReminderPosition(secondaryMonitor as any)

      // 右边缘对齐：1920 + 1920 - 320 - 8 = 3512
      expect(position.x).toBe(3512)
      // 底部对齐：0 + 1032 - 160 - 8 = 864
      expect(position.y).toBe(864)
    })

    it('任务栏在顶部时定位到右上角', async () => {
      const { calculateBaseReminderPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 40 }, // 任务栏在顶部
          size: { width: 1920, height: 1040 },
        },
        scaleFactor: 1,
      }

      const position = calculateBaseReminderPosition(monitor as any)

      // 右边缘对齐
      expect(position.x).toBe(1592)
      // 紧贴任务栏下方：40 + 8 = 48
      expect(position.y).toBe(48)
    })

    it('任务栏在左侧时定位到右下角', async () => {
      const { calculateBaseReminderPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 60, y: 0 }, // 任务栏在左侧
          size: { width: 1860, height: 1080 },
        },
        scaleFactor: 1,
      }

      const position = calculateBaseReminderPosition(monitor as any)

      // 右边缘对齐（基于工作区域）：60 + 1860 - 320 - 8 = 1592
      expect(position.x).toBe(1592)
      // 底部对齐（工作区域）：0 + 1080 - 160 - 8 = 912
      expect(position.y).toBe(912)
    })
  })

  describe('adjustPositionForPopup', () => {
    it('精简面板未显示时返回基础位置和默认宽度', async () => {
      const { adjustPositionForPopup } = await import('../composables/useReminderPopup')

      const basePosition = { x: 1592, y: 824 }
      const adjusted = adjustPositionForPopup(basePosition, null)

      // 精简面板未显示，位置不变，使用默认宽度
      expect(adjusted.x).toBe(1592)
      expect(adjusted.y).toBe(824)
      expect(adjusted.width).toBe(320) // 默认宽度
    })

    it('精简面板显示时紧贴其上方（任务栏在底部）', async () => {
      const { adjustPositionForPopup } = await import('../composables/useReminderPopup')

      const basePosition = { x: 1592, y: 824 }
      const calendarPopupInfo = { x: 1572, y: 500, width: 340, height: 480 }
      const adjusted = adjustPositionForPopup(basePosition, calendarPopupInfo, 'bottom')

      // 精简面板显示，提醒窗口紧贴其上方
      expect(adjusted.x).toBe(1572) // X 与精简面板对齐
      expect(adjusted.y).toBe(500 - 160 - 8) // 精简面板顶部 - 提醒窗口高度 - 间距
      expect(adjusted.width).toBe(340) // 宽度与精简面板一致
    })

    it('任务栏在顶部时精简面板显示下移', async () => {
      const { adjustPositionForPopup } = await import('../composables/useReminderPopup')

      const basePosition = { x: 1592, y: 48 }
      const calendarPopupInfo = { x: 1572, y: 100, width: 340, height: 480 }
      const adjusted = adjustPositionForPopup(basePosition, calendarPopupInfo, 'top')

      // 任务栏在顶部，提醒窗口显示在精简面板下方
      expect(adjusted.x).toBe(1572) // X 与精简面板对齐
      expect(adjusted.y).toBe(100 + 480 + 8) // 精简面板底部 + 间距
      expect(adjusted.width).toBe(340) // 宽度与精简面板一致
    })
  })

  describe('checkAndAdjustBounds', () => {
    const primaryMonitor = {
      position: { x: 0, y: 0 },
      size: { width: 1920, height: 1080 },
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1032 },
      },
      scaleFactor: 1,
    }

    it('位置在安全范围内不需要调整', async () => {
      const { checkAndAdjustBounds } = await import('../composables/useReminderPopup')

      const position = { x: 1592, y: 500 }
      const adjusted = checkAndAdjustBounds(position, primaryMonitor as any)

      expect(adjusted.x).toBe(1592)
      expect(adjusted.y).toBe(500)
    })

    it('位置超出左边界需要调整', async () => {
      const { checkAndAdjustBounds } = await import('../composables/useReminderPopup')

      const position = { x: 0, y: 500 }
      const adjusted = checkAndAdjustBounds(position, primaryMonitor as any)

      expect(adjusted.x).toBe(8) // POPUP_MARGIN
      expect(adjusted.y).toBe(500)
    })

    it('位置超出上边界需要调整（防止上移后超出顶部）', async () => {
      const { checkAndAdjustBounds } = await import('../composables/useReminderPopup')

      const position = { x: 1592, y: 0 }
      const adjusted = checkAndAdjustBounds(position, primaryMonitor as any)

      expect(adjusted.x).toBe(1592)
      expect(adjusted.y).toBe(8) // POPUP_MARGIN
    })

    it('位置超出右边界需要调整', async () => {
      const { checkAndAdjustBounds, getReminderWindowSize } = await import('../composables/useReminderPopup')

      const size = getReminderWindowSize()
      const position = { x: 1700, y: 500 } // 1700 + 320 = 2020 > 1920
      const adjusted = checkAndAdjustBounds(position, primaryMonitor as any)

      // 右边界调整：0 + 1920 - 320 - 8 = 1592（使用工作区域）
      expect(adjusted.x).toBe(primaryMonitor.workArea.position.x + primaryMonitor.workArea.size.width - size.width - 8)
      expect(adjusted.y).toBe(500)
    })

    it('位置超出下边界需要调整', async () => {
      const { checkAndAdjustBounds, getReminderWindowSize } = await import('../composables/useReminderPopup')

      const size = getReminderWindowSize()
      const position = { x: 1592, y: 900 } // 900 + 200 = 1100 > 1032
      const adjusted = checkAndAdjustBounds(position, primaryMonitor as any)

      expect(adjusted.x).toBe(1592)
      // 下边界调整：0 + 1032 - 200 - 8 = 824（使用工作区域）
      expect(adjusted.y).toBe(primaryMonitor.workArea.position.y + primaryMonitor.workArea.size.height - size.height - 8)
    })
  })

  describe('getPrimaryMonitor', () => {
    it('返回位置在 (0, 0) 的显示器作为主显示器', async () => {
      const { getPrimaryMonitor } = await import('../composables/useReminderPopup')

      const monitors = [
        { position: { x: 1920, y: 0 }, size: { width: 1920, height: 1080 }, workArea: { position: { x: 1920, y: 0 }, size: { width: 1920, height: 1032 } }, scaleFactor: 1 },
        { position: { x: 0, y: 0 }, size: { width: 1920, height: 1080 }, workArea: { position: { x: 0, y: 0 }, size: { width: 1920, height: 1032 } }, scaleFactor: 1 },
      ]

      const primary = getPrimaryMonitor(monitors as any)
      expect(primary).not.toBeNull()
      expect(primary!.position.x).toBe(0)
      expect(primary!.position.y).toBe(0)
    })

    it('无显示器在 (0, 0) 时选择工作区域最大的显示器', async () => {
      const { getPrimaryMonitor } = await import('../composables/useReminderPopup')

      const monitors = [
        { position: { x: 1920, y: 0 }, size: { width: 1280, height: 720 }, workArea: { position: { x: 1920, y: 0 }, size: { width: 1280, height: 680 } }, scaleFactor: 1 },
        { position: { x: -1920, y: 0 }, size: { width: 2560, height: 1440 }, workArea: { position: { x: -1920, y: 0 }, size: { width: 2560, height: 1400 } }, scaleFactor: 1 },
      ]

      const primary = getPrimaryMonitor(monitors as any)
      expect(primary).not.toBeNull()
      // 工作区域最大的显示器（2560x1400）
      expect(primary!.size.width).toBe(2560)
    })

    it('显示器列表为空时返回 null', async () => {
      const { getPrimaryMonitor } = await import('../composables/useReminderPopup')

      const primary = getPrimaryMonitor([])
      expect(primary).toBeNull()
    })
  })

  describe('getReminderWindowSize', () => {
    it('返回正确的窗口尺寸', async () => {
      const { getReminderWindowSize } = await import('../composables/useReminderPopup')

      const size = getReminderWindowSize()
      expect(size.width).toBe(320)
      expect(size.height).toBe(160)
    })
  })

  describe('getPopupOffset', () => {
    it('返回正确的上移偏移量', async () => {
      const { getPopupOffset } = await import('../composables/useReminderPopup')

      const offset = getPopupOffset()
      expect(offset).toBe(100)
    })
  })

  describe('isReminderTransitioning', () => {
    it('初始状态为 false', async () => {
      const { isReminderTransitioning } = await import('../composables/useReminderPopup')
      expect(isReminderTransitioning()).toBe(false)
    })

    it('显示过程中返回 true', async () => {
      const mockWindow = createMockReminderWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)

      const { showReminderPopup, isReminderTransitioning } = await import('../composables/useReminderPopup')
      
      // 开始显示，但动画未完成
      await showReminderPopup()
      
      // 在动画期间，应该返回 true
      expect(isReminderTransitioning()).toBe(true)
      
      // 等待动画完成
      await vi.advanceTimersByTimeAsync(200)
      expect(isReminderTransitioning()).toBe(false)
    })
  })

  describe('detectTaskbarPosition', () => {
    it('检测任务栏在底部', async () => {
      const { detectTaskbarPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1032 }, // 底部差 48
        },
      }

      const taskbar = detectTaskbarPosition(monitor as any)
      expect(taskbar.position).toBe('bottom')
      expect(taskbar.size).toBe(48)
    })

    it('检测任务栏在顶部', async () => {
      const { detectTaskbarPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 40 }, // 顶部差 40
          size: { width: 1920, height: 1040 },
        },
      }

      const taskbar = detectTaskbarPosition(monitor as any)
      expect(taskbar.position).toBe('top')
      expect(taskbar.size).toBe(40)
    })

    it('检测任务栏在左侧', async () => {
      const { detectTaskbarPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 60, y: 0 }, // 左侧差 60
          size: { width: 1860, height: 1080 },
        },
      }

      const taskbar = detectTaskbarPosition(monitor as any)
      expect(taskbar.position).toBe('left')
      expect(taskbar.size).toBe(60)
    })

    it('检测任务栏在右侧', async () => {
      const { detectTaskbarPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1860, height: 1080 }, // 右侧差 60
        },
      }

      const taskbar = detectTaskbarPosition(monitor as any)
      expect(taskbar.position).toBe('right')
      expect(taskbar.size).toBe(60)
    })

    it('无任务栏时返回底部且尺寸为0', async () => {
      const { detectTaskbarPosition } = await import('../composables/useReminderPopup')

      const monitor = {
        position: { x: 0, y: 0 },
        size: { width: 1920, height: 1080 },
        workArea: {
          position: { x: 0, y: 0 },
          size: { width: 1920, height: 1080 }, // 完全相同
        },
      }

      const taskbar = detectTaskbarPosition(monitor as any)
      expect(taskbar.position).toBe('bottom')
      expect(taskbar.size).toBe(0)
    })
  })

  describe('isRapidTrigger', () => {
    it('首次触发返回 false', async () => {
      const { isRapidTrigger } = await import('../composables/useReminderPopup')

      expect(isRapidTrigger('item-1')).toBe(false)
    })

    it('5秒内重复触发返回 true', async () => {
      const { isRapidTrigger } = await import('../composables/useReminderPopup')

      // 首次触发
      isRapidTrigger('item-2')
      // 立即再次触发
      expect(isRapidTrigger('item-2')).toBe(true)
    })

    it('不同 itemId 互不影响', async () => {
      const { isRapidTrigger } = await import('../composables/useReminderPopup')

      isRapidTrigger('item-a')
      expect(isRapidTrigger('item-b')).toBe(false)
    })
  })

  describe('resetReminderState', () => {
    it('重置过渡状态', async () => {
      const { resetReminderState, isReminderTransitioning } = await import('../composables/useReminderPopup')
      
      // 手动触发显示（这会设置 isTransitioning = true）
      const mockWindow = createMockReminderWindow()
      mockGetByLabel.mockResolvedValue(mockWindow)
      
      const { showReminderPopup } = await import('../composables/useReminderPopup')
      await showReminderPopup()
      
      // 状态为过渡中
      expect(isReminderTransitioning()).toBe(true)
      
      // 重置状态
      resetReminderState()
      expect(isReminderTransitioning()).toBe(false)
    })
  })
})

describe('精简面板协调定位', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const { resetReminderState } = await import('../composables/useReminderPopup')
    resetReminderState()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('精简面板显示时提醒窗口紧贴其上方', async () => {
    // 创建精简面板窗口模拟（可见）
    const mockCalendarWindow = {
      isVisible: vi.fn().mockResolvedValue(true),
      innerPosition: vi.fn().mockResolvedValue({ x: 1572, y: 500 }),
      innerSize: vi.fn().mockResolvedValue({ width: 340, height: 480 }),
    }

    // 创建提醒窗口模拟
    const mockReminderWindow = createMockReminderWindow()
    const setPositionMock = mockReminderWindow.setPosition as ReturnType<typeof vi.fn>
    const setSizeMock = mockReminderWindow.setSize as ReturnType<typeof vi.fn>

    // 设置 getByLabel 根据标签返回不同窗口
    mockGetByLabel.mockImplementation(async (label: string) => {
      if (label === 'reminder-popup') {
        return mockReminderWindow
      }
      if (label === 'calendar-popup') {
        return mockCalendarWindow
      }
      return null
    })

    const consoleSpy = vi.spyOn(console, 'log')

    const { showReminderPopup } = await import('../composables/useReminderPopup')
    await showReminderPopup()

    // 验证 setPosition 被调用
    expect(setPositionMock).toHaveBeenCalled()

    // 验证 setSize 被调用（宽度与精简面板一致）
    expect(setSizeMock).toHaveBeenCalled()

    // 验证日志包含精简面板信息
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('精简面板显示在')
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('提醒窗口宽度调整为')
    )
  })

  it('精简面板隐藏时提醒窗口使用基础位置', async () => {
    // 创建精简面板窗口模拟（不可见）
    const mockCalendarWindow = {
      isVisible: vi.fn().mockResolvedValue(false),
    }

    // 创建提醒窗口模拟
    const mockReminderWindow = createMockReminderWindow()
    const setPositionMock = mockReminderWindow.setPosition as ReturnType<typeof vi.fn>

    // 设置 getByLabel
    mockGetByLabel.mockImplementation(async (label: string) => {
      if (label === 'reminder-popup') {
        return mockReminderWindow
      }
      if (label === 'calendar-popup') {
        return mockCalendarWindow
      }
      return null
    })

    const consoleSpy = vi.spyOn(console, 'log')

    const { showReminderPopup } = await import('../composables/useReminderPopup')
    await showReminderPopup()

    // 验证 setPosition 被调用
    expect(setPositionMock).toHaveBeenCalled()

    // 验证日志不包含精简面板信息（因为未显示）
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('精简面板显示在')
    )
  })
})