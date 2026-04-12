// 日历弹出窗口控制 composable
// 管理日历弹出窗口的显示、隐藏和定位逻辑
// 包含防抖和竞态保护机制

import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors, type Monitor, PhysicalPosition } from '@tauri-apps/api/window'
import { moveWindowConstrained, Position } from '@tauri-apps/plugin-positioner'

/// 弹出窗口定位矩形
export interface PopupRect {
  left: number
  top: number
  right: number
  bottom: number
}

/// 日历弹出窗口标签名
const CALENDAR_POPUP_LABEL = 'calendar-popup'

/// 弹出窗口状态缓存
let popupVisible = false

/// 防抖定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 300

/// 竞态保护状态标志
let isTransitioning = false

/// 动画持续时间（毫秒）- 用于跟踪动画状态
const ANIMATION_DURATION = 200

/// 弹出窗口尺寸配置
const POPUP_WIDTH = 360
const POPUP_HEIGHT = 500
const POPUP_MARGIN = 8 // 与任务栏/屏幕边缘的间距

/// 待处理的切换请求参数
interface PendingToggleParams {
  monitorType?: 'Primary' | 'Secondary'
  clockRect?: PopupRect
}
let pendingParams: PendingToggleParams = {}

/**
 * 计算弹出窗口的目标位置（相对于屏幕左上角）
 * @param clockRect 时钟区域矩形
 * @param monitor 目标显示器信息
 * @returns 弹出窗口的左上角坐标
 */
export function calculatePopupPosition(
  clockRect: PopupRect,
  monitor: Monitor
): { x: number; y: number } {
  const monitorRight = monitor.position.x + monitor.size.width
  const monitorBottom = monitor.position.y + monitor.size.height

  // 默认位置：时钟右下角，向上弹出
  let x = clockRect.right - POPUP_WIDTH
  let y = clockRect.top - POPUP_HEIGHT - POPUP_MARGIN

  // 水平边界检查：如果弹出窗口超出显示器左边界，向右调整
  if (x < monitor.position.x + POPUP_MARGIN) {
    x = monitor.position.x + POPUP_MARGIN
  }

  // 水平边界检查：如果弹出窗口超出显示器右边界，向左调整
  if (x + POPUP_WIDTH > monitorRight - POPUP_MARGIN) {
    x = monitorRight - POPUP_WIDTH - POPUP_MARGIN
  }

  // 垂直边界检查：如果弹出窗口超出显示器上边界，改为向下弹出
  if (y < monitor.position.y + POPUP_MARGIN) {
    y = clockRect.bottom + POPUP_MARGIN
  }

  // 垂直边界检查：如果弹出窗口超出显示器下边界，调整为可见区域
  if (y + POPUP_HEIGHT > monitorBottom - POPUP_MARGIN) {
    y = monitorBottom - POPUP_HEIGHT - POPUP_MARGIN
  }

  // 最终边界保护：确保窗口在显示器范围内
  x = Math.max(monitor.position.x + POPUP_MARGIN, Math.min(x, monitorRight - POPUP_WIDTH - POPUP_MARGIN))
  y = Math.max(monitor.position.y + POPUP_MARGIN, Math.min(y, monitorBottom - POPUP_HEIGHT - POPUP_MARGIN))

  return { x, y }
}

/**
 * 根据时钟区域判断点击发生在哪个显示器
 * @param clockRect 时钟区域矩形（屏幕坐标）
 * @param monitors 可用显示器列表
 * @returns 命中的显示器，如果未找到则返回 null
 */
export function findMonitorByClockRect(
  clockRect: PopupRect,
  monitors: Monitor[]
): Monitor | null {
  // 时钟中心点坐标
  const clockCenterX = (clockRect.left + clockRect.right) / 2
  const clockCenterY = (clockRect.top + clockRect.bottom) / 2

  // 查找包含时钟中心点的显示器
  for (const monitor of monitors) {
    const monitorLeft = monitor.position.x
    const monitorTop = monitor.position.y
    const monitorRight = monitor.position.x + monitor.size.width
    const monitorBottom = monitor.position.y + monitor.size.height

    if (
      clockCenterX >= monitorLeft &&
      clockCenterX <= monitorRight &&
      clockCenterY >= monitorTop &&
      clockCenterY <= monitorBottom
    ) {
      return monitor
    }
  }

  // 未找到匹配的显示器，返回 null（调用方会回退到主显示器）
  console.warn('[useCalendarPopup] 未找到匹配的显示器，将回退到主显示器')
  return null
}

/**
 * 获取主显示器
 * @param monitors 可用显示器列表
 * @returns 主显示器，如果未找到则返回第一个显示器
 */
export function getPrimaryMonitor(monitors: Monitor[]): Monitor | null {
  // Tauri API 不直接提供主显示器标识，通常主显示器在 (0, 0) 位置
  // 先尝试找位置在 (0, 0) 的显示器
  const primaryLike = monitors.find(
    (m) => m.position.x === 0 && m.position.y === 0
  )
  if (primaryLike) {
    return primaryLike
  }
  // 否则返回第一个显示器
  return monitors.length > 0 ? monitors[0] : null
}

/**
 * 使用 positioner 插件定位窗口（适用于托盘图标点击）
 * 注意：moveWindowConstrained 自动作用于当前窗口
 */
async function positionWindowWithPlugin(): Promise<boolean> {
  try {
    // 使用 moveWindowConstrained 会自动进行边界约束
    await moveWindowConstrained(Position.TrayBottomRight)
    console.log('[useCalendarPopup] 使用 positioner 插件定位成功')
    return true
  } catch (error) {
    console.warn('[useCalendarPopup] positioner 插件定位失败:', error)
    return false
  }
}

/**
 * 手动定位窗口到指定坐标
 * @param popupWindow 弹出窗口实例
 * @param x 目标 X 坐标（物理像素）
 * @param y 目标 Y 坐标（物理像素）
 */
async function positionWindowManually(
  popupWindow: WebviewWindow,
  x: number,
  y: number
): Promise<void> {
  try {
    await popupWindow.setPosition(new PhysicalPosition(x, y))
    console.log(`[useCalendarPopup] 手动定位窗口到 (${x}, ${y})`)
  } catch (error) {
    console.error('[useCalendarPopup] 手动定位窗口失败:', error)
    throw error
  }
}

/**
 * 定位弹出窗口
 * @param popupWindow 弹出窗口实例
 * @param monitorType 显示器类型
 * @param clockRect 时钟区域矩形
 */
async function positionPopupWindow(
  popupWindow: WebviewWindow,
  monitorType?: 'Primary' | 'Secondary',
  clockRect?: PopupRect
): Promise<void> {
  // 获取所有可用显示器
  const monitors = await availableMonitors()
  console.log(`[useCalendarPopup] 检测到 ${monitors.length} 个显示器`)

  if (monitors.length === 0) {
    console.warn('[useCalendarPopup] 未检测到显示器，无法定位')
    return
  }

  // 判断是否需要手动定位
  // 主屏时钟点击且无 clockRect 时，使用 positioner 插件
  // 副屏时钟点击或有 clockRect 时，使用手动定位
  const useManualPosition = clockRect || monitorType === 'Secondary'

  if (!useManualPosition) {
    // 使用 positioner 插件定位（适用于托盘图标点击或主屏时钟点击）
    const positioned = await positionWindowWithPlugin()
    if (!positioned) {
      // positioner 失败，回退到手动定位
      const primaryMonitor = getPrimaryMonitor(monitors)
      if (primaryMonitor) {
        // 回退到主显示器右下角
        const x = primaryMonitor.position.x + primaryMonitor.size.width - POPUP_WIDTH - POPUP_MARGIN
        const y = primaryMonitor.position.y + primaryMonitor.size.height - POPUP_HEIGHT - POPUP_MARGIN
        await positionWindowManually(popupWindow, x, y)
      }
    }
  } else if (clockRect) {
    // 手动定位逻辑：用于副屏时钟点击或有精确坐标的情况
    // 1. 找到时钟所在的显示器
    let targetMonitor = findMonitorByClockRect(clockRect, monitors)

    // 2. 如果目标显示器不可用（可能已断开），回退到主显示器
    if (!targetMonitor) {
      targetMonitor = getPrimaryMonitor(monitors)
      console.log('[useCalendarPopup] 目标显示器不可用，回退到主显示器')
    }

    if (targetMonitor) {
      // 3. 计算弹出窗口位置
      const position = calculatePopupPosition(clockRect, targetMonitor)

      // 4. 定位窗口
      await positionWindowManually(popupWindow, position.x, position.y)
    } else {
      // 完全无法定位
      console.warn('[useCalendarPopup] 无法确定目标显示器')
    }
  }
}

/**
 * 显示日历弹出窗口
 * @param monitorType 显示器类型 ('Primary' | 'Secondary')
 * @param clockRect 时钟区域矩形，用于定位弹出窗口
 */
export async function showCalendarPopup(
  monitorType?: 'Primary' | 'Secondary',
  clockRect?: PopupRect
): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useCalendarPopup] 正在过渡中，忽略显示请求')
    return
  }

  // 如果已经显示，直接返回
  if (popupVisible) {
    console.log('[useCalendarPopup] 弹出窗口已显示，忽略重复请求')
    return
  }

  try {
    isTransitioning = true
    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)
    
    if (!popupWindow) {
      console.warn('[useCalendarPopup] 弹出窗口不存在，请检查窗口配置')
      return
    }

    // 定位弹出窗口（使用 positioner 插件或手动定位）
    await positionPopupWindow(popupWindow, monitorType, clockRect)

    // 显示窗口并聚焦
    await popupWindow.show()
    await popupWindow.setFocus()
    popupVisible = true

    // 调用 Rust 命令更新区域跟踪
    // TODO (Task 7): 调用 start_tracking_popup_region 命令
    console.log('[useCalendarPopup] 弹出窗口已显示')
  } catch (error) {
    console.error('[useCalendarPopup] 显示弹出窗口失败:', error)
  } finally {
    // 延迟重置过渡状态，确保动画完成
    setTimeout(() => {
      isTransitioning = false
    }, ANIMATION_DURATION)
  }
}

/**
 * 隐藏日历弹出窗口
 */
export async function hideCalendarPopup(): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useCalendarPopup] 正在过渡中，忽略隐藏请求')
    return
  }

  // 如果已经隐藏，直接返回
  if (!popupVisible) {
    console.log('[useCalendarPopup] 弹出窗口已隐藏，忽略重复请求')
    return
  }

  try {
    isTransitioning = true
    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)
    
    if (!popupWindow) {
      console.warn('[useCalendarPopup] 弹出窗口不存在')
      return
    }

    await popupWindow.hide()
    popupVisible = false

    // 调用 Rust 命令停止区域跟踪
    // TODO (Task 7): 调用 stop_tracking_popup_region 命令
    console.log('[useCalendarPopup] 弹出窗口已隐藏')
  } catch (error) {
    console.error('[useCalendarPopup] 隐藏弹出窗口失败:', error)
  } finally {
    // 延迟重置过渡状态，确保动画完成
    setTimeout(() => {
      isTransitioning = false
    }, ANIMATION_DURATION)
  }
}

/**
 * 切换日历弹出窗口显隐（带防抖和竞态保护）
 * @param monitorType 显示器类型 ('Primary' | 'Secondary')
 * @param clockRect 时钟区域矩形，用于定位弹出窗口
 */
export async function toggleCalendarPopup(
  monitorType?: 'Primary' | 'Secondary',
  clockRect?: PopupRect
): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useCalendarPopup] 正在过渡中，忽略切换请求')
    return
  }

  // 保存最新参数
  pendingParams = { monitorType, clockRect }

  // 清除之前的定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  // 设置新的防抖定时器
  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    
    // 再次检查竞态状态
    if (isTransitioning) {
      console.log('[useCalendarPopup] 防抖后仍在过渡中，放弃切换')
      return
    }

    // 执行切换
    if (popupVisible) {
      await hideCalendarPopup()
    } else {
      await showCalendarPopup(pendingParams.monitorType, pendingParams.clockRect)
    }
  }, DEBOUNCE_DELAY)
}

/**
 * 获取弹出窗口当前可见状态
 */
export function isPopupVisible(): boolean {
  return popupVisible
}

/**
 * 获取当前是否正在过渡（用于测试）
 */
export function isPopupTransitioning(): boolean {
  return isTransitioning
}

/**
 * 获取当前是否有待处理的防抖定时器（用于测试）
 */
export function hasPendingDebounce(): boolean {
  return debounceTimer !== null
}

/**
 * 重置弹出窗口状态（用于窗口关闭时同步状态）
 */
export function resetPopupState(): void {
  popupVisible = false
  isTransitioning = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}
