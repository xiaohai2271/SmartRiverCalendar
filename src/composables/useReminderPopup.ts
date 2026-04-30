// 提醒弹出窗口控制 composable
// 管理提醒弹出窗口的显示、隐藏和定位逻辑
// 支持与精简面板协调定位、多显示器环境、任务栏位置变化等边缘情况处理

import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { availableMonitors, PhysicalPosition, LogicalSize, type Monitor } from '@tauri-apps/api/window'
import { onSettingsChange } from '@/utils/broadcast'

/// 提醒弹出窗口标签名
const REMINDER_POPUP_LABEL = 'reminder-popup'

/// 提醒弹出窗口尺寸配置（与 tauri.conf.json 保持一致）
const REMINDER_WIDTH = 320
const REMINDER_HEIGHT = 160
const POPUP_MARGIN = 8 // 与屏幕边缘的间距

/// 精简面板上移偏移量（当精简面板显示时，提醒窗口上移的距离）
const POPUP_OFFSET = 100

/// 精简面板窗口标签名
const CALENDAR_POPUP_LABEL = 'calendar-popup'

/// 竞态保护状态标志
let isTransitioning = false

/// 动画持续时间（毫秒）- 用于跟踪动画状态
const ANIMATION_DURATION = 200

/// 快速连续触发防护：同一提醒的最小触发间隔（毫秒）
const RAPID_TRIGGER_COOLDOWN = 5000

/// 快速连续触发防护：最近触发记录（itemId → 上次触发时间戳）
const lastTriggerTimes: Map<string, number> = new Map()

/// 精简面板设置变更监听器清理函数
let calendarPopupSettingsCleanup: (() => void) | null = null

/**
 * 设置精简面板设置变更监听器
 * 当精简面板窗口大小设置变更时，同步更新提醒窗口位置和大小
 */
async function setupCalendarPopupSettingsListener(): Promise<void> {
  try {
    // 清理之前的监听器
    cleanupCalendarPopupSettingsListener()

    console.log('[useReminderPopup] 开始设置精简面板设置变更监听器...')

    // 监听设置变更广播（实时响应主窗口的设置修改）
    calendarPopupSettingsCleanup = onSettingsChange((key, value) => {
      console.log(`[useReminderPopup] 收到设置变更广播: ${key} =`, value)

      // 处理窗口尺寸变更
      if (key === 'popupWindowSize' && typeof value === 'string') {
        console.log('[useReminderPopup] 精简面板窗口大小设置变更，重新定位提醒窗口')
        repositionIfVisible()
      }
    })

    console.log('[useReminderPopup] 已设置精简面板设置变更监听器')
  } catch (error) {
    console.error('[useReminderPopup] 设置精简面板设置变更监听器失败:', error)
  }
}

/**
 * 如果提醒窗口可见，重新定位
 */
async function repositionIfVisible(): Promise<void> {
  if (await isReminderWindowVisible()) {
    console.log('[useReminderPopup] 提醒窗口已显示，重新定位')
    const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)
    if (reminderWindow) {
      await positionReminderWindow(reminderWindow)
    }
  } else {
    console.log('[useReminderPopup] 提醒窗口未显示，跳过重新定位')
  }
}

/**
 * 清理精简面板设置变更监听器
 */
function cleanupCalendarPopupSettingsListener(): void {
  if (calendarPopupSettingsCleanup) {
    calendarPopupSettingsCleanup()
    calendarPopupSettingsCleanup = null
    console.log('[useReminderPopup] 已清理精简面板设置变更监听器')
  }
}

/**
 * 任务栏位置类型
 */
export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right'

/**
 * 任务栏位置检测结果
 */
export interface TaskbarInfo {
  /** 任务栏位置 */
  position: TaskbarPosition
  /** 任务栏占用尺寸（像素） */
  size: number
}

/**
 * 实时查询提醒弹出窗口是否可见
 * 不依赖本地缓存，直接查询 Tauri 窗口状态
 */
async function isReminderWindowVisible(): Promise<boolean> {
  try {
    const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)
    if (!reminderWindow) return false
    return await reminderWindow.isVisible()
  } catch {
    return false
  }
}

/**
 * 获取主显示器
 * 通过对比显示器尺寸与工作区域来推断主显示器，
 * 优先选择位置在 (0, 0) 的显示器（Windows 主显示器默认位置）
 * @param monitors 可用显示器列表
 * @returns 主显示器，如果未找到则返回第一个显示器
 */
export function getPrimaryMonitor(monitors: Monitor[]): Monitor | null {
  if (monitors.length === 0) return null

  // 策略1：位置在 (0, 0) 的显示器通常是主显示器
  const primaryLike = monitors.find(
    (m) => m.position.x === 0 && m.position.y === 0
  )
  if (primaryLike) {
    return primaryLike
  }

  // 策略2：选择工作区域最大的显示器（主显示器通常分辨率较高）
  const sortedByWorkArea = [...monitors].sort(
    (a, b) => (b.workArea.size.width * b.workArea.size.height) - (a.workArea.size.width * a.workArea.size.height)
  )

  return sortedByWorkArea[0]
}

/**
 * 检测任务栏位置和大小
 * 通过对比显示器总尺寸与工作区域来推断任务栏位置
 * @param monitor 显示器信息
 * @returns 任务栏位置信息
 */
export function detectTaskbarPosition(monitor: Monitor): TaskbarInfo {
  const { position: monPos, size: monSize, workArea } = monitor
  const { position: workPos, size: workSize } = workArea

  // 计算各方向上的差值
  const leftDiff = workPos.x - monPos.x
  const topDiff = workPos.y - monPos.y
  const rightDiff = (monPos.x + monSize.width) - (workPos.x + workSize.width)
  const bottomDiff = (monPos.y + monSize.height) - (workPos.y + workSize.height)

  // 找出最大的差值方向（任务栏通常只在一个方向有较大差值）
  const diffs: Array<{ position: TaskbarPosition; size: number }> = [
    { position: 'bottom', size: bottomDiff },
    { position: 'top', size: topDiff },
    { position: 'left', size: leftDiff },
    { position: 'right', size: rightDiff },
  ]

  // 按差值降序排列，最大的就是任务栏所在方向
  diffs.sort((a, b) => b.size - a.size)

  const taskbar = diffs[0]

  // 如果所有方向差值都很小（≤4像素），视为没有任务栏（全屏模式等）
  if (taskbar.size <= 4) {
    return { position: 'bottom', size: 0 }
  }

  return taskbar
}

/**
 * 获取精简面板当前位置和尺寸
 * @returns 精简面板位置和尺寸，如果未显示则返回 null
 */
async function getCalendarPopupInfo(): Promise<{ x: number; y: number; width: number; height: number } | null> {
  try {
    const calendarWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)
    if (!calendarWindow) return null
    const isVisible = await calendarWindow.isVisible()
    if (!isVisible) return null
    const position = await calendarWindow.innerPosition()
    const size = await calendarWindow.innerSize()
    return { x: position.x, y: position.y, width: size.width, height: size.height }
  } catch {
    return null
  }
}

/**
 * 计算提醒窗口的基础位置
 * 使用工作区域（排除任务栏）精确定位，支持任务栏在任意方向
 * @param primaryMonitor 主显示器信息
 * @returns 提醒窗口的左上角坐标
 */
export function calculateBaseReminderPosition(primaryMonitor: Monitor): { x: number; y: number } {
  const taskbar = detectTaskbarPosition(primaryMonitor)
  const { workArea } = primaryMonitor

  let x: number
  let y: number

  // 根据任务栏位置决定提醒窗口的对齐方向
  switch (taskbar.position) {
    case 'bottom':
      // 任务栏在底部：窗口放在右下角（工作区域内）
      x = workArea.position.x + workArea.size.width - REMINDER_WIDTH - POPUP_MARGIN
      y = workArea.position.y + workArea.size.height - REMINDER_HEIGHT - POPUP_MARGIN
      break
    case 'top':
      // 任务栏在顶部：窗口放在右上角（工作区域内）
      x = workArea.position.x + workArea.size.width - REMINDER_WIDTH - POPUP_MARGIN
      y = workArea.position.y + POPUP_MARGIN
      break
    case 'left':
      // 任务栏在左侧：窗口放在右下角（工作区域内）
      x = workArea.position.x + workArea.size.width - REMINDER_WIDTH - POPUP_MARGIN
      y = workArea.position.y + workArea.size.height - REMINDER_HEIGHT - POPUP_MARGIN
      break
    case 'right':
      // 任务栏在右侧：窗口放在右下角（紧贴任务栏左侧）
      x = workArea.position.x + workArea.size.width - REMINDER_WIDTH - POPUP_MARGIN
      y = workArea.position.y + workArea.size.height - REMINDER_HEIGHT - POPUP_MARGIN
      break
    default:
      // 降级：使用工作区域右下角
      x = workArea.position.x + workArea.size.width - REMINDER_WIDTH - POPUP_MARGIN
      y = workArea.position.y + workArea.size.height - REMINDER_HEIGHT - POPUP_MARGIN
  }

  return { x, y }
}

/**
 * 根据精简面板位置调整提醒窗口位置
 * 如果精简面板显示，提醒窗口紧贴其上方展示
 * @param basePosition 基础位置（右下角）
 * @param calendarPopupInfo 精简面板信息（位置和尺寸），如果未显示则为 null
 * @param taskbarPosition 任务栏位置，用于决定避让方向
 * @returns 调整后的位置和宽度
 */
export function adjustPositionForPopup(
  basePosition: { x: number; y: number },
  calendarPopupInfo: { x: number; y: number; width: number; height: number } | null,
  taskbarPosition: TaskbarPosition = 'bottom'
): { x: number; y: number; width: number } {
  if (!calendarPopupInfo) {
    // 精简面板未显示，使用基础位置和默认宽度
    return { x: basePosition.x, y: basePosition.y, width: REMINDER_WIDTH }
  }

  // 精简面板显示时，提醒窗口紧贴其上方
  // X 坐标与精简面板对齐
  // Y 坐标为精简面板顶部减去提醒窗口高度和间距
  const reminderWidth = calendarPopupInfo.width // 宽度与精简面板一致

  if (taskbarPosition === 'top') {
    // 任务栏在顶部，提醒窗口显示在精简面板下方
    return {
      x: calendarPopupInfo.x,
      y: calendarPopupInfo.y + calendarPopupInfo.height + POPUP_MARGIN,
      width: reminderWidth
    }
  }

  // 默认：提醒窗口显示在精简面板上方
  return {
    x: calendarPopupInfo.x,
    y: calendarPopupInfo.y - REMINDER_HEIGHT - POPUP_MARGIN,
    width: reminderWidth
  }
}

/**
 * 检查位置是否超出显示器工作区域边界并调整
 * 使用工作区域（排除任务栏）作为边界参考
 * @param position 待检查的位置
 * @param primaryMonitor 主显示器信息
 * @param width 提醒窗口宽度（可选，默认使用 REMINDER_WIDTH）
 * @returns 调整后的位置
 */
export function checkAndAdjustBounds(
  position: { x: number; y: number },
  primaryMonitor: Monitor,
  width: number = REMINDER_WIDTH
): { x: number; y: number } {
  let { x, y } = position

  // 使用工作区域作为边界（已排除任务栏）
  const { workArea } = primaryMonitor
  const workRight = workArea.position.x + workArea.size.width
  const workBottom = workArea.position.y + workArea.size.height

  // 左边界检查
  if (x < workArea.position.x + POPUP_MARGIN) {
    x = workArea.position.x + POPUP_MARGIN
  }

  // 右边界检查
  if (x + width > workRight - POPUP_MARGIN) {
    x = workRight - width - POPUP_MARGIN
  }

  // 上边界检查
  if (y < workArea.position.y + POPUP_MARGIN) {
    y = workArea.position.y + POPUP_MARGIN
  }

  // 下边界检查
  if (y + REMINDER_HEIGHT > workBottom - POPUP_MARGIN) {
    y = workBottom - REMINDER_HEIGHT - POPUP_MARGIN
  }

  return { x, y }
}

/**
 * 定位提醒弹出窗口
 * @param reminderWindow 提醒窗口实例
 */
export async function positionReminderWindow(reminderWindow: WebviewWindow): Promise<void> {
  // 获取所有可用显示器
  const monitors = await availableMonitors()
  console.log(`[useReminderPopup] 检测到 ${monitors.length} 个显示器`)

  if (monitors.length === 0) {
    console.warn('[useReminderPopup] 未检测到显示器，无法定位')
    return
  }

  // 获取主显示器（限制在主显示器）
  const primaryMonitor = getPrimaryMonitor(monitors)

  if (!primaryMonitor) {
    console.warn('[useReminderPopup] 无法获取主显示器')
    return
  }
  // 设置精简面板设置变更监听器，实时同步提醒窗口位置
  await setupCalendarPopupSettingsListener()

  // 检测任务栏位置
  const taskbar = detectTaskbarPosition(primaryMonitor)
  console.log(`[useReminderPopup] 任务栏位置: ${taskbar.position}, 尺寸: ${taskbar.size}px`)

  // 计算基础位置（根据任务栏位置精确定位）
  const basePosition = calculateBaseReminderPosition(primaryMonitor)

  // 检查精简面板位置和尺寸
  const calendarPopupInfo = await getCalendarPopupInfo()

  // 根据精简面板和任务栏位置调整（返回位置和宽度）
  const adjusted = adjustPositionForPopup(basePosition, calendarPopupInfo, taskbar.position)

  // 如果精简面板显示，调整提醒窗口宽度与精简面板一致
  if (calendarPopupInfo) {
    await reminderWindow.setSize(new LogicalSize(adjusted.width, REMINDER_HEIGHT))
    console.log(`[useReminderPopup] 提醒窗口宽度调整为 ${adjusted.width}px（与精简面板一致）`)
  }

  // 边界检查（使用工作区域，传入实际宽度）
  const finalPosition = checkAndAdjustBounds({ x: adjusted.x, y: adjusted.y }, primaryMonitor, adjusted.width)

  // 设置窗口位置
  await reminderWindow.setPosition(new PhysicalPosition(finalPosition.x, finalPosition.y))
  console.log(`[useReminderPopup] 窗口定位到 (${finalPosition.x}, ${finalPosition.y})`)

  if (calendarPopupInfo) {
    console.log(`[useReminderPopup] 精简面板显示在 (${calendarPopupInfo.x}, ${calendarPopupInfo.y})，尺寸: ${calendarPopupInfo.width}x${calendarPopupInfo.height}`)
  }
}

/**
 * 检查是否为快速连续触发（5秒内同一提醒不重复触发）
 * @param itemId 提醒关联的事件/待办 ID
 * @returns true 表示是快速连续触发，应跳过；false 表示可以触发
 */
export function isRapidTrigger(itemId: string): boolean {
  const now = Date.now()
  const lastTime = lastTriggerTimes.get(itemId)

  if (lastTime !== undefined && now - lastTime < RAPID_TRIGGER_COOLDOWN) {
    console.log(`[useReminderPopup] 快速连续触发防护: ${itemId} 在 ${RAPID_TRIGGER_COOLDOWN}ms 内已触发过，跳过`)
    return true
  }

  // 记录本次触发时间
  lastTriggerTimes.set(itemId, now)

  // 清理过期的触发记录（超过冷却时间的）
  for (const [key, time] of lastTriggerTimes) {
    if (now - time >= RAPID_TRIGGER_COOLDOWN) {
      lastTriggerTimes.delete(key)
    }
  }

  return false
}

/**
 * 显示提醒弹出窗口
 * @param reminderId 提醒 ID（可选，用于标识具体提醒）
 */
export async function showReminderPopup(reminderId?: string): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useReminderPopup] 正在过渡中，忽略显示请求')
    return
  }

  // 快速连续触发防护
  if (reminderId && isRapidTrigger(reminderId)) {
    return
  }

  // 立即标记过渡状态，防止竞态
  isTransitioning = true

  try {
    // 实时查询：如果已经显示，直接返回
    if (await isReminderWindowVisible()) {
      console.log('[useReminderPopup] 提醒窗口已显示，忽略重复请求')
      isTransitioning = false
      return
    }

    const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)

    if (!reminderWindow) {
      console.warn('[useReminderPopup] 提醒窗口不存在，请检查窗口配置')
      return
    }

    // 定位提醒窗口
    await positionReminderWindow(reminderWindow)

    // 显示窗口
    await reminderWindow.show()

    // 设置焦点：提醒窗口优先级高于 calendar-popup
    try {
      // 先让 calendar-popup 失去焦点（如果存在）
      const calendarWindow = await WebviewWindow.getByLabel(CALENDAR_POPUP_LABEL)
      if (calendarWindow) {
        const isCalVisible = await calendarWindow.isVisible()
        if (isCalVisible) {
          // 提醒窗口优先获取焦点
          console.log('[useReminderPopup] calendar-popup 可见，提醒窗口优先获取焦点')
        }
      }
    } catch {
      // 忽略焦点管理错误，不影响主要功能
    }

    // 设置提醒窗口焦点
    await reminderWindow.setFocus()

    console.log(`[useReminderPopup] 提醒窗口已显示${reminderId ? `, ID: ${reminderId}` : ''}`)
  } catch (error) {
    console.error('[useReminderPopup] 显示提醒窗口失败:', error)
  } finally {
    // 延迟重置过渡状态，确保动画完成
    setTimeout(() => {
      isTransitioning = false
    }, ANIMATION_DURATION)
  }
}

/**
 * 隐藏提醒弹出窗口
 */
export async function hideReminderPopup(): Promise<void> {
  // 竞态保护：如果正在过渡中，直接返回
  if (isTransitioning) {
    console.log('[useReminderPopup] 正在过渡中，忽略隐藏请求')
    return
  }
  
  // 立即标记过渡状态，防止竞态
  isTransitioning = true
  
  try {
    // 实时查询：如果已经隐藏，直接返回
    if (!(await isReminderWindowVisible())) {
      console.log('[useReminderPopup] 提醒窗口已隐藏，忽略重复请求')
      isTransitioning = false
      return
    }
    
    const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)
    
    if (!reminderWindow) {
      console.warn('[useReminderPopup] 提醒窗口不存在')
      return
    }
    
    await reminderWindow.hide()

    // 清理精简面板设置变更监听器
    cleanupCalendarPopupSettingsListener()

    console.log('[useReminderPopup] 提醒窗口已隐藏')
  } catch (error) {
    console.error('[useReminderPopup] 隐藏提醒窗口失败:', error)
  } finally {
    // 延迟重置过渡状态，确保动画完成
    setTimeout(() => {
      isTransitioning = false
    }, ANIMATION_DURATION)
  }
}

/**
 * 获取提醒窗口当前可见状态
 * 异步版本：实时查询 Tauri 窗口
 */
export async function isReminderVisible(): Promise<boolean> {
  return isReminderWindowVisible()
}

/**
 * 获取当前是否正在过渡（用于测试）
 */
export function isReminderTransitioning(): boolean {
  return isTransitioning
}

/**
 * 重置提醒窗口状态（用于异常恢复）
 */
export function resetReminderState(): void {
  isTransitioning = false
  cleanupCalendarPopupSettingsListener()
}

/**
 * 获取提醒窗口尺寸配置
 */
export function getReminderWindowSize(): { width: number; height: number } {
  return { width: REMINDER_WIDTH, height: REMINDER_HEIGHT }
}

/**
 * 获取上移偏移量配置
 */
export function getPopupOffset(): number {
  return POPUP_OFFSET
}