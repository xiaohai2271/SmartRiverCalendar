// 日历弹出窗口控制 composable
// 管理日历弹出窗口的显示、隐藏和定位逻辑
// 包含防抖和竞态保护机制

import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors, type Monitor, PhysicalPosition, LogicalSize } from '@tauri-apps/api/window'
import type { PopupWindowSize } from '@/types'
import { POPUP_WINDOW_SIZES } from '@/types'

/// 窗口边界检查结果
export interface BoundsCheckResult {
  needsAdjustment: boolean // 是否需要调整位置
  x: number // 调整后的 X 坐标
  y: number // 调整后的 Y 坐标
}

/// 弹出窗口定位矩形
export interface PopupRect {
  left: number
  top: number
  right: number
  bottom: number
}

/// 日历弹出窗口标签名
const CALENDAR_POPUP_LABEL = 'calendar-popup'

/// 防抖定时器
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 300

/// 竞态保护状态标志
let isTransitioning = false

/// 动画持续时间（毫秒）- 用于跟踪动画状态
const ANIMATION_DURATION = 200

/// 弹出窗口尺寸配置（与 tauri.conf.json 保持一致）
const POPUP_WIDTH = 340
const POPUP_HEIGHT = 480
const POPUP_MARGIN = 8 // 与任务栏/屏幕边缘的间距

/**
 * 实时查询弹出窗口是否可见
 * 不依赖本地缓存，直接查询 Tauri 窗口状态
 */
async function isPopupWindowVisible(): Promise<boolean> {
  try {
    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)
    if (!popupWindow) return false
    return await popupWindow.isVisible()
  } catch {
    return false
  }
}

/// 待处理的切换请求参数
interface PendingToggleParams {
  monitorType?: 'Primary' | 'Secondary'
  clockRect?: PopupRect
}
let pendingParams: PendingToggleParams = {}

/**
 * 计算弹出窗口的目标位置（相对于屏幕左上角）
 * 窗口紧贴任务栏上方显示
 * @param clockRect 时钟区域矩形
 * @param monitor 目标显示器信息
 * @returns 弹出窗口的左上角坐标
 */
export function calculatePopupPosition(
  clockRect: PopupRect,
  monitor: Monitor
): { x: number; y: number } {
  const monitorRight = monitor.position.x + monitor.size.width
  const monitorTop = monitor.position.y

  // 水平位置：弹出窗口右边缘与时钟区域右边缘对齐
  let x = clockRect.right - POPUP_WIDTH

  // 垂直位置：弹出窗口紧贴时钟区域上方（即紧贴任务栏上方）
  // clockRect.top 是任务栏内时钟区域的顶部坐标
  // 弹出窗口底部对齐到 clockRect.top，实现紧贴任务栏
  let y = clockRect.top - POPUP_HEIGHT

  // 水平边界检查
  if (x < monitor.position.x + POPUP_MARGIN) {
    x = monitor.position.x + POPUP_MARGIN
  }
  if (x + POPUP_WIDTH > monitorRight - POPUP_MARGIN) {
    x = monitorRight - POPUP_WIDTH - POPUP_MARGIN
  }

  // 垂直边界检查：如果弹出窗口超出显示器上边界，改为向下弹出
  if (y < monitorTop + POPUP_MARGIN) {
    y = clockRect.bottom + POPUP_MARGIN
  }

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
 * 统一使用手动定位，确保操作正确的窗口实例
 * @param popupWindow 弹出窗口实例
 * @param clockRect 时钟区域矩形
 */
async function positionPopupWindow(
  popupWindow: WebviewWindow,
  clockRect?: PopupRect
): Promise<void> {
  // 获取所有可用显示器
  const monitors = await availableMonitors()
  console.log(`[useCalendarPopup] 检测到 ${monitors.length} 个显示器`)

  if (monitors.length === 0) {
    console.warn('[useCalendarPopup] 未检测到显示器，无法定位')
    return
  }

  if (clockRect) {
    // 有精确时钟区域坐标时，基于坐标定位
    let targetMonitor = findMonitorByClockRect(clockRect, monitors)

    if (!targetMonitor) {
      targetMonitor = getPrimaryMonitor(monitors)
      console.log('[useCalendarPopup] 目标显示器不可用，回退到主显示器')
    }

    if (targetMonitor) {
      const position = calculatePopupPosition(clockRect, targetMonitor)
      await positionWindowManually(popupWindow, position.x, position.y)
    } else {
      console.warn('[useCalendarPopup] 无法确定目标显示器')
    }
  } else {
    // 没有时钟区域坐标时，定位到主显示器右下角（任务栏时间大致区域上方）
    // 使用屏幕底部减去弹出窗口高度，紧贴任务栏上方
    const primaryMonitor = getPrimaryMonitor(monitors)
    if (primaryMonitor) {
      const x = primaryMonitor.position.x + primaryMonitor.size.width - POPUP_WIDTH - POPUP_MARGIN
      // 估算任务栏高度（Windows 通常约 40-48 逻辑像素），弹出窗口紧贴其上
      const estimatedTaskbarHeight = 48
      const y = primaryMonitor.position.y + primaryMonitor.size.height - estimatedTaskbarHeight - POPUP_HEIGHT
      await positionWindowManually(popupWindow, x, y)
    }
  }
}

/**
 * 显示日历弹出窗口
 * @param _monitorType 显示器类型（保留参数用于日志，暂未使用）
 * @param clockRect 时钟区域矩形，用于定位弹出窗口
 */
export async function showCalendarPopup(
  _monitorType?: 'Primary' | 'Secondary',
  clockRect?: PopupRect
): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useCalendarPopup] 正在过渡中，忽略显示请求')
    return
  }

  // 立即标记过渡状态，防止竞态
  isTransitioning = true

  try {
    // 实时查询：如果已经显示，直接返回
    if (await isPopupWindowVisible()) {
      console.log('[useCalendarPopup] 弹出窗口已显示，忽略重复请求')
      isTransitioning = false
      return
    }

    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)

    if (!popupWindow) {
      console.warn('[useCalendarPopup] 弹出窗口不存在，请检查窗口配置')
      return
    }

    // 定位弹出窗口（使用 positioner 插件或手动定位）
    await positionPopupWindow(popupWindow, clockRect)

    // 显示窗口并聚焦
    await popupWindow.show()
    await popupWindow.setFocus()

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

  // 立即标记过渡状态，防止竞态
  isTransitioning = true

  try {
    // 实时查询：如果已经隐藏，直接返回
    if (!(await isPopupWindowVisible())) {
      console.log('[useCalendarPopup] 弹出窗口已隐藏，忽略重复请求')
      isTransitioning = false
      return
    }

    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)

    if (!popupWindow) {
      console.warn('[useCalendarPopup] 弹出窗口不存在')
      return
    }

    await popupWindow.hide()

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

    // 实时查询窗口可见性来决定切换方向
    if (await isPopupWindowVisible()) {
      await hideCalendarPopup()
    } else {
      await showCalendarPopup(pendingParams.monitorType, pendingParams.clockRect)
    }
  }, DEBOUNCE_DELAY)
}

/**
 * 获取弹出窗口当前可见状态
 * 异步版本：实时查询 Tauri 窗口
 */
export async function isPopupVisible(): Promise<boolean> {
  return isPopupWindowVisible()
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
 * 重置弹出窗口状态（用于异常恢复）
 */
export function resetPopupState(): void {
  isTransitioning = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

/**
 * 根据窗口位置查找窗口所在的显示器
 * @param windowPosition 窗口当前位置
 * @param monitors 可用显示器列表
 * @returns 窗口所在的显示器，如果未找到则返回主显示器
 */
export function findWindowMonitor(
  windowPosition: { x: number; y: number },
  monitors: Monitor[]
): Monitor | null {
  // 查找包含窗口位置的显示器
  for (const monitor of monitors) {
    const monitorLeft = monitor.position.x
    const monitorTop = monitor.position.y
    const monitorRight = monitor.position.x + monitor.size.width
    const monitorBottom = monitor.position.y + monitor.size.height

    // 检查窗口中心点是否在显示器范围内
    if (
      windowPosition.x >= monitorLeft &&
      windowPosition.x <= monitorRight &&
      windowPosition.y >= monitorTop &&
      windowPosition.y <= monitorBottom
    ) {
      return monitor
    }
  }

  // 未找到匹配的显示器，返回主显示器
  return getPrimaryMonitor(monitors)
}

/**
 * 检查窗口边界并计算调整后的位置
 * 确保窗口在调整大小后仍然完全可见
 * @param windowPosition 窗口当前位置
 * @param windowSize 窗口当前大小
 * @param monitor 目标显示器
 * @returns 边界检查结果，包含是否需要调整和调整后的位置
 */
export function checkWindowBounds(
  windowPosition: { x: number; y: number },
  windowSize: { width: number; height: number },
  monitor: Monitor
): BoundsCheckResult {
  let { x, y } = windowPosition
  let needsAdjustment = false

  // 计算显示器边界
  const monitorLeft = monitor.position.x
  const monitorTop = monitor.position.y
  const monitorRight = monitor.position.x + monitor.size.width
  const monitorBottom = monitor.position.y + monitor.size.height

  // 左边界检查
  if (x < monitorLeft + POPUP_MARGIN) {
    x = monitorLeft + POPUP_MARGIN
    needsAdjustment = true
  }

  // 右边界检查
  if (x + windowSize.width > monitorRight - POPUP_MARGIN) {
    x = monitorRight - windowSize.width - POPUP_MARGIN
    needsAdjustment = true
  }

  // 上边界检查
  if (y < monitorTop + POPUP_MARGIN) {
    y = monitorTop + POPUP_MARGIN
    needsAdjustment = true
  }

  // 下边界检查
  if (y + windowSize.height > monitorBottom - POPUP_MARGIN) {
    y = monitorBottom - windowSize.height - POPUP_MARGIN
    needsAdjustment = true
  }

  return { needsAdjustment, x, y }
}

/**
 * 设置弹出窗口大小
 * 设置窗口大小后自动检查边界，确保窗口完全可见
 * @param size 窗口尺寸类型（'small' | 'medium' | 'large'）
 */
export async function setPopupWindowSize(size: PopupWindowSize): Promise<void> {
  try {
    const popupWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)

    if (!popupWindow) {
      console.warn('[useCalendarPopup] 弹出窗口不存在，无法设置大小')
      return
    }

    // 从类型定义文件中获取尺寸配置
    const dimensions = POPUP_WINDOW_SIZES[size]

    if (!dimensions) {
      console.error(`[useCalendarPopup] 不支持的窗口尺寸: ${size}`)
      return
    }

    // 获取窗口当前位置
    const currentPosition = await popupWindow.innerPosition()

    // 获取所有可用显示器
    const monitors = await availableMonitors()

    if (monitors.length === 0) {
      console.warn('[useCalendarPopup] 未检测到显示器，仅设置窗口大小')
      await popupWindow.setSize(new LogicalSize(dimensions.width, dimensions.height))
      return
    }

    // 查找窗口所在的显示器
    const targetMonitor = findWindowMonitor(
      { x: currentPosition.x, y: currentPosition.y },
      monitors
    )

    if (!targetMonitor) {
      console.warn('[useCalendarPopup] 无法确定目标显示器，仅设置窗口大小')
      await popupWindow.setSize(new LogicalSize(dimensions.width, dimensions.height))
      return
    }

    // 在设置大小后，重新定位窗口到右下角
    // 获取窗口所在的显示器
    const monitorRight = targetMonitor.position.x + targetMonitor.size.width
    const monitorBottom = targetMonitor.position.y + targetMonitor.size.height

    // 估算任务栏高度（Windows 通常约 40-48 逻辑像素）
    const estimatedTaskbarHeight = 48

    // 新位置：窗口右边缘距离显示器右边缘 POPUP_MARGIN，底部紧贴任务栏上方
    const newX = monitorRight - dimensions.width - POPUP_MARGIN
    const newY = monitorBottom - estimatedTaskbarHeight - dimensions.height

    // 设置窗口大小
    await popupWindow.setSize(new LogicalSize(dimensions.width, dimensions.height))

    // 设置窗口位置
    await popupWindow.setPosition(new PhysicalPosition(newX, newY))
    console.log(`[useCalendarPopup] 窗口已调整到右下角位置: (${newX}, ${newY}), 大小: ${dimensions.width}x${dimensions.height}`)
  } catch (error) {
    console.error('[useCalendarPopup] 设置窗口大小失败:', error)
    throw error
  }
}
