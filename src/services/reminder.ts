import { sendNotification } from '@tauri-apps/plugin-notification'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { emit as tauriEmit } from '@tauri-apps/api/event'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { useSettingsStore } from '../stores/settings'
import type { CalendarEvent, Todo, AppSettings } from '../types'

// ────────────────────────────────────────────
// 窗口配置常量
// ────────────────────────────────────────────

/** 提醒弹出窗口标签名 */
const REMINDER_POPUP_LABEL = 'reminder-popup'

// ────────────────────────────────────────────
// 提醒队列类型定义
// ────────────────────────────────────────────

/**
 * 提醒队列项
 * 包含提醒的完整信息及入队时间
 */
export interface ReminderQueueItem {
  /** 提醒唯一标识 */
  id: string
  /** 类型：事件或待办 */
  type: 'event' | 'todo'
  /** 提醒标题 */
  title: string
  /** 提醒正文 */
  body: string
  /** 原始触发时间 */
  triggerTime: number
  /** 关联的事件/待办 ID */
  itemId: string
  /** 关联的事件/待办数据 */
  itemData: CalendarEvent | Todo
  /** 入队时间戳 */
  enqueuedAt: number
}

/**
 * 提醒队列结构
 */
export interface ReminderQueue {
  /** 队列项列表 */
  items: ReminderQueueItem[]
  /** 最大队列长度 */
  maxSize: number
  /** 超时时间（毫秒） */
  timeoutMs: number
}

/**
 * 队列存储键
 */
const QUEUE_STORAGE_KEY = 'reminder_queue'

/**
 * 默认队列配置
 */
const DEFAULT_QUEUE_CONFIG: ReminderQueue = {
  items: [],
  maxSize: 100,
  timeoutMs: 3600000 // 1小时
}

/**
 * 当前显示的提醒 ID（用于控制同时只显示一个）
 */
let currentDisplayedReminderId: string | null = null

// ────────────────────────────────────────────
// 队列持久化函数
// ────────────────────────────────────────────

/**
 * 从 localStorage 加载队列
 * @returns 队列数据
 */
function loadQueue(): ReminderQueue {
  try {
    const data = localStorage.getItem(QUEUE_STORAGE_KEY)
    if (data) {
      const queue = JSON.parse(data) as ReminderQueue
      // 确保队列结构完整
      return {
        items: queue.items || [],
        maxSize: queue.maxSize || DEFAULT_QUEUE_CONFIG.maxSize,
        timeoutMs: queue.timeoutMs || DEFAULT_QUEUE_CONFIG.timeoutMs
      }
    }
  } catch (error) {
    console.error('加载提醒队列失败:', error)
  }
  return { ...DEFAULT_QUEUE_CONFIG }
}

/**
 * 保存队列到 localStorage
 * @param queue 队列数据
 */
function saveQueue(queue: ReminderQueue): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch (error) {
    console.error('保存提醒队列失败:', error)
  }
}

// ────────────────────────────────────────────
// 队列操作函数
// ────────────────────────────────────────────

/**
 * 优先级排序比较函数
 * 事件优先于待办，触发时间早优先于晚
 */
function comparePriority(a: ReminderQueueItem, b: ReminderQueueItem): number {
  // 事件优先于待办
  if (a.type === 'event' && b.type === 'todo') return -1
  if (a.type === 'todo' && b.type === 'event') return 1

  // 同类型按触发时间排序（早优先）
  return a.triggerTime - b.triggerTime
}

/**
 * 添加提醒到队列
 * @param item 提醒项
 * @returns 是否成功入队
 */
export function enqueueReminder(item: Omit<ReminderQueueItem, 'enqueuedAt'>): boolean {
  const queue = loadQueue()

  // 清理超时项
  queue.items = queue.items.filter(
    i => Date.now() - i.enqueuedAt < queue.timeoutMs
  )

  // 检查是否已存在相同 ID
  if (queue.items.some(i => i.id === item.id)) {
    return false
  }

  // 检查队列长度限制
  if (queue.items.length >= queue.maxSize) {
    // 移除优先级最低的项
    queue.items.sort(comparePriority)
    queue.items.pop()
  }

  // 添加新项
  const newItem: ReminderQueueItem = {
    ...item,
    enqueuedAt: Date.now()
  }
  queue.items.push(newItem)

  // 按优先级排序
  queue.items.sort(comparePriority)

  // 保存队列
  saveQueue(queue)

  return true
}

/**
 * 获取下一个待显示的提醒
 * 如果当前有提醒显示，返回 null
 * @returns 下一个提醒项或 null
 */
export function dequeueReminder(): ReminderQueueItem | null {
  // 如果当前有提醒正在显示，不返回新的
  if (currentDisplayedReminderId !== null) {
    return null
  }

  const queue = loadQueue()

  // 清理超时项
  queue.items = queue.items.filter(
    i => Date.now() - i.enqueuedAt < queue.timeoutMs
  )

  if (queue.items.length === 0) {
    saveQueue(queue)
    return null
  }

  // 获取优先级最高的项
  queue.items.sort(comparePriority)
  const nextItem = queue.items.shift()

  if (nextItem) {
    // 标记当前显示的提醒
    currentDisplayedReminderId = nextItem.id
    saveQueue(queue)
    return nextItem
  }

  return null
}

/**
 * 标记当前提醒已处理（关闭/查看）
 * 允许显示下一个提醒
 */
export function markReminderProcessed(): void {
  currentDisplayedReminderId = null

  // 触发下一个提醒显示
  processNextReminder()
}

/**
 * 获取队列当前状态
 * @returns 队列项数量和首个提醒
 */
export function getQueueStatus(): { count: number; firstItem: ReminderQueueItem | null } {
  const queue = loadQueue()

  // 清理超时项
  queue.items = queue.items.filter(
    i => Date.now() - i.enqueuedAt < queue.timeoutMs
  )
  saveQueue(queue)

  return {
    count: queue.items.length,
    firstItem: queue.items.length > 0 ? queue.items[0] : null
  }
}

/**
 * 清空队列
 */
export function clearQueue(): void {
  saveQueue({ ...DEFAULT_QUEUE_CONFIG, items: [] })
  currentDisplayedReminderId = null
}

/**
 * 处理队列中的下一个提醒
 */
async function processNextReminder(): Promise<void> {
  const nextItem = dequeueReminder()
  if (nextItem) {
    // 在独立窗口中显示提醒
    await showReminderInWindow(nextItem)
  }
}

// ────────────────────────────────────────────
// 原有提醒服务代码
// ────────────────────────────────────────────

// 定时器句柄
let reminderInterval: ReturnType<typeof setInterval> | null = null

// 提醒检查间隔（10秒，减少延迟）
const CHECK_INTERVAL = 10 * 1000

// localStorage 中已发送提醒的前缀
const REMINDER_SENT_PREFIX = 'reminder_sent_'

// 稍后提醒的存储前缀
const SNOOZE_PREFIX = 'reminder_snooze_'

// 查看详情的存储前缀
const REMINDER_VIEWED_PREFIX = 'reminder_viewed_'

// 查看详情后的有效时间（1小时）
const VIEWED_VALID_DURATION = 60 * 60 * 1000

// 上次清理时间的存储键
const LAST_CLEANUP_KEY = 'reminder_last_cleanup_time'

// 清理间隔（24小时）
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000

/// 快速连续触发防护：同一 itemId 的最小触发间隔（5秒）
const RAPID_TRIGGER_COOLDOWN = 5000

/// 快速连续触发防护：最近触发记录（itemId → 上次触发时间戳）
const lastTriggerTimes: Map<string, number> = new Map()

// 提醒弹窗事件总线类型
type ReminderPopupCallback = (data: {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
}) => void

// 提醒弹窗事件总线
const reminderPopupCallbacks: ReminderPopupCallback[] = []

/**
 * 注册提醒弹窗回调
 * @param callback 回调函数
 */
export function onReminderPopup(callback: ReminderPopupCallback): void {
  reminderPopupCallbacks.push(callback)
}

/**
 * 取消注册提醒弹窗回调
 * @param callback 回调函数
 */
export function offReminderPopup(callback: ReminderPopupCallback): void {
  const index = reminderPopupCallbacks.indexOf(callback)
  if (index !== -1) {
    reminderPopupCallbacks.splice(index, 1)
  }
}

/**
 * 在独立窗口中显示提醒
 * @param data 提醒数据
 */
async function showReminderInWindow(data: ReminderQueueItem): Promise<void> {
  try {
    // 获取设置存储
    const settingsStore = useSettingsStore()
    const settings = settingsStore.settings

    // 检查是否为夜间模式
    if (settings.theme === 'dark') {
      console.log('[reminder] 夜间模式不显示提醒窗口')
      // 夜间模式不显示窗口，但确保已发送系统通知（由 sendReminderNotification 处理）
      return
    }

    // 获取提醒窗口实例
    const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)

    if (reminderWindow) {
      // 检查窗口是否可见
      const isVisible = await reminderWindow.isVisible()

      if (!isVisible) {
        // 窗口存在但不可见，显示窗口
        await reminderWindow.show()
        await reminderWindow.setFocus()
        console.log('[reminder] 提醒窗口已显示')
      }

      // 发送提醒事件到窗口
      await tauriEmit('show-reminder', {
        id: data.id,
        type: data.type,
        title: data.title,
        body: data.body,
        triggerTime: data.triggerTime,
        itemId: data.itemId,
        itemData: data.itemData,
        createdAt: data.enqueuedAt
      })

      console.log('[reminder] 提醒事件已发送:', data.title)
    } else {
      console.warn('[reminder] 提醒窗口不存在，请检查窗口配置')
      // 降级处理：触发本地回调
      triggerLocalPopup(data)
    }
  } catch (error) {
    console.error('[reminder] 显示提醒窗口失败:', error)
    // 降级处理：触发本地回调
    triggerLocalPopup(data)
  }
}

/**
 * 触发本地弹窗回调（降级处理）
 * @param data 弹窗数据
 */
function triggerLocalPopup(data: ReminderQueueItem): void {
  reminderPopupCallbacks.forEach(callback => {
    try {
      callback({
        id: data.id,
        type: data.type,
        title: data.title,
        body: data.body,
        triggerTime: data.triggerTime,
        itemId: data.itemId,
        itemData: data.itemData
      })
    } catch (error) {
      console.error('提醒弹窗回调执行失败:', error)
    }
  })
}

/**
 * 生成提醒的唯一标识
 * @param id 事件或待办的 ID
 * @param timestamp 提醒时间戳
 * @returns 唯一标识
 */
function generateReminderKey(id: string, timestamp: number): string {
  return `${REMINDER_SENT_PREFIX}${id}_${timestamp}`
}

/**
 * 生成稍后提醒的唯一标识
 * @param id 事件或待办的 ID
 * @returns 唯一标识
 */
function generateSnoozeKey(id: string): string {
  return `${SNOOZE_PREFIX}${id}`
}

/**
 * 检查提醒是否已发送
 * @param key 提醒标识
 * @returns 是否已发送
 */
function isReminderSent(key: string): boolean {
  return localStorage.getItem(key) !== null
}

/**
 * 标记提醒已发送
 * @param key 提醒标识
 */
function markReminderSent(key: string): void {
  localStorage.setItem(key, '1')
}

/**
 * 检查是否有稍后提醒
 * @param id 事件或待办的 ID
 * @returns 稍后提醒的时间戳，如果没有则返回 null
 */
function getSnoozeTime(id: string): number | null {
  const key = generateSnoozeKey(id)
  const value = localStorage.getItem(key)
  if (value) {
    const timestamp = parseInt(value, 10)
    if (!isNaN(timestamp)) {
      return timestamp
    }
  }
  return null
}

/**
 * 设置稍后提醒
 * @param id 事件或待办的 ID
 * @param timestamp 稍后提醒的时间戳
 */
function setSnoozeTime(id: string, timestamp: number): void {
  const key = generateSnoozeKey(id)
  localStorage.setItem(key, timestamp.toString())
}

/**
 * 清除稍后提醒
 * @param id 事件或待办的 ID
 */
function clearSnoozeTime(id: string): void {
  const key = generateSnoozeKey(id)
  localStorage.removeItem(key)
}

/**
 * 生成查看详情的唯一标识
 * @param id 事件或待办的 ID
 * @returns 唯一标识
 */
function generateViewedKey(id: string): string {
  return `${REMINDER_VIEWED_PREFIX}${id}`
}

/**
 * 标记事件或待办已查看详情（防止在有效期内重复提醒）
 * @param id 事件或待办的 ID
 */
export function markReminderAsViewed(id: string): void {
  const key = generateViewedKey(id)
  const viewedTime = Date.now()
  localStorage.setItem(key, viewedTime.toString())
}

/**
 * 检查事件或待办是否已查看详情
 * @param id 事件或待办的 ID
 * @returns 是否已查看详情（在有效期内）
 */
function isReminderViewed(id: string): boolean {
  const key = generateViewedKey(id)
  const value = localStorage.getItem(key)
  if (value) {
    const viewedTime = parseInt(value, 10)
    if (!isNaN(viewedTime)) {
      // 检查是否在有效期内
      return Date.now() - viewedTime < VIEWED_VALID_DURATION
    }
  }
  return false
}

/**
 * 检查是否需要执行清理
 * @returns 是否需要清理
 */
function shouldCleanupReminders(): boolean {
  const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY)
  if (!lastCleanup) {
    return true
  }
  const lastCleanupTime = parseInt(lastCleanup, 10)
  return Date.now() - lastCleanupTime >= CLEANUP_INTERVAL
}

/**
 * 清理过期的提醒记录（保留最近 7 天）
 */
function cleanupOldReminders(): void {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const keysToRemove: string[] = []

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(REMINDER_SENT_PREFIX)) {
      // 从 key 中提取时间戳
      const parts = key.split('_')
      const timestamp = parseInt(parts[parts.length - 1], 10)
      if (!isNaN(timestamp) && timestamp < sevenDaysAgo) {
        keysToRemove.push(key)
      }
    } else if (key && key.startsWith(REMINDER_VIEWED_PREFIX)) {
      // 清理过期的查看记录
      const value = localStorage.getItem(key)
      if (value) {
        const viewedTime = parseInt(value, 10)
        if (!isNaN(viewedTime) && Date.now() - viewedTime >= VIEWED_VALID_DURATION) {
          keysToRemove.push(key)
        }
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))

  // 记录清理时间
  localStorage.setItem(LAST_CLEANUP_KEY, Date.now().toString())
}

/**
 * 格式化通知标题
 * @param title 原始标题
 * @param settings 应用设置
 * @returns 格式化后的标题
 */
function formatNotificationTitle(title: string, settings: AppSettings): string {
  if (settings.customReminderTitle) {
    return settings.customReminderTitle.replace('{title}', title)
  }
  return `小河日历 - ${title}`
}

/**
 * 格式化通知正文
 * @param item 事件或待办
 * @param type 类型：'event' | 'todo'
 * @param settings 应用设置
 * @returns 格式化后的正文
 */
function formatNotificationBody(
  item: CalendarEvent | Todo,
  type: 'event' | 'todo',
  settings: AppSettings
): string {
  if (settings.customReminderBody) {
    let body = settings.customReminderBody
    body = body.replace('{title}', item.title)
    body = body.replace('{description}', item.description || '')
    if (type === 'event') {
      const event = item as CalendarEvent
      body = body.replace('{startTime}', new Date(event.startTime).toLocaleString())
      body = body.replace('{endTime}', new Date(event.endTime).toLocaleString())
    } else {
      const todo = item as Todo
      body = body.replace('{dueDate}', todo.dueDate ? new Date(todo.dueDate).toLocaleString() : '')
    }
    return body
  }

  // 默认格式
  if (type === 'event') {
    const event = item as CalendarEvent
    const timeStr = event.allDay
      ? '全天事件'
      : `${new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    return `${timeStr}${event.description ? `\n${event.description}` : ''}`
  } else {
    const todo = item as Todo
    return todo.dueDate
      ? `截止时间: ${new Date(todo.dueDate).toLocaleString()}`
      : '待办事项提醒'
  }
}

/**
 * 发送提醒通知
 * @param title 通知标题
 * @param body 通知正文
 * @param mode 提醒强度
 * @param itemId 事件或待办的 ID
 * @param type 类型：'event' | 'todo'
 * @param itemData 事件或待办数据
 * @param triggerTime 提醒触发时间
 */
async function sendReminderNotification(
  title: string,
  body: string,
  mode: AppSettings['reminderMode'],
  itemId: string,
  type: 'event' | 'todo',
  itemData: CalendarEvent | Todo,
  triggerTime: number
): Promise<void> {
  try {
    // 快速连续触发防护：同一 itemId 在冷却时间内不重复触发
    const now = Date.now()
    const lastTriggerTime = lastTriggerTimes.get(itemId)
    if (lastTriggerTime !== undefined && now - lastTriggerTime < RAPID_TRIGGER_COOLDOWN) {
      console.log(`[reminder] 快速连续触发防护: ${itemId} 在 ${RAPID_TRIGGER_COOLDOWN}ms 内已触发过，跳过`)
      return
    }
    lastTriggerTimes.set(itemId, now)

    // 清理过期的触发记录
    for (const [key, time] of lastTriggerTimes) {
      if (now - time >= RAPID_TRIGGER_COOLDOWN) {
        lastTriggerTimes.delete(key)
      }
    }

    // 根据提醒强度决定是否发送系统通知
    // standard 和 strong 模式发送系统通知，silent 模式不发送
    if (mode !== 'silent') {
      await sendNotification({ title, body })
    }

    // 入队而不是直接显示（实现排队逻辑）
    const popupId = `popup_${itemId}_${triggerTime}`
    enqueueReminder({
      id: popupId,
      type,
      title,
      body,
      triggerTime,
      itemId,
      itemData
    })

    // 尝试显示下一个提醒（如果当前没有显示的）
    processNextReminder()

    // strong 模式额外闪烁任务栏标题
    if (mode === 'strong') {
      startBlinkTitle(title)
    }
  } catch (error) {
    console.error('发送提醒通知失败:', error)
  }
}

// 闪烁任务栏标题相关变量
let blinkInterval: ReturnType<typeof setInterval> | null = null
let originalTitle = ''

/**
 * 开始闪烁任务栏标题
 * @param reminderTitle 提醒标题
 */
function startBlinkTitle(reminderTitle: string): void {
  if (blinkInterval) return

  originalTitle = document.title
  let isOriginal = true

  blinkInterval = setInterval(() => {
    document.title = isOriginal ? `【提醒】${reminderTitle}` : originalTitle
    isOriginal = !isOriginal
  }, 1000)

  // 30秒后停止闪烁
  setTimeout(() => {
    stopTitleBlink()
  }, 30000)
}

/**
 * 停止闪烁任务栏标题
 */
function stopTitleBlink(): void {
  if (blinkInterval) {
    clearInterval(blinkInterval)
    blinkInterval = null
    document.title = originalTitle
  }
}

/**
 * 检查事件是否需要提醒
 * @param event 日历事件
 * @param now 当前时间戳
 * @param settings 应用设置
 * @returns 是否需要提醒
 */
function shouldRemindEvent(event: CalendarEvent, now: number, settings: AppSettings): boolean {
  // 检查是否已查看详情（在有效期内不重复提醒）
  if (isReminderViewed(event.id)) {
    return false
  }

  // 检查是否有稍后提醒
  const snoozeTime = getSnoozeTime(event.id)
  if (snoozeTime !== null) {
    if (now >= snoozeTime) {
      // 稍后提醒时间已到，返回 true（稍后提醒将在 checkAndSendReminders 中清除）
      return true
    }
    // 稍后提醒时间未到，不触发提醒
    return false
  }

  // 获取提醒提前时间（分钟）
  const reminderMinutes = event.reminder ?? settings.defaultReminder
  const reminderTime = reminderMinutes * 60 * 1000

  if (event.allDay) {
    // 全天事件
    const eventDate = new Date(event.startTime)
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)

    if (settings.allDayReminderTime === 'evening_before') {
      // 前一天晚上提醒
      const eveningBefore = new Date(eventDate)
      eveningBefore.setDate(eveningBefore.getDate() - 1)
      eveningBefore.setHours(settings.allDayReminderHour, 0, 0, 0)

      const eveningBeforeEnd = new Date(eveningBefore)
      eveningBeforeEnd.setMinutes(eveningBeforeEnd.getMinutes() + 1)

      return now >= eveningBefore.getTime() && now < eveningBeforeEnd.getTime()
    } else {
      // 当天指定时间提醒
      const morningOf = new Date(eventDate)
      morningOf.setHours(settings.allDayReminderHour, 0, 0, 0)

      const morningOfEnd = new Date(morningOf)
      morningOfEnd.setMinutes(morningOfEnd.getMinutes() + 1)

      return now >= morningOf.getTime() && now < morningOfEnd.getTime()
    }
  } else {
    // 普通事件：startTime - reminder <= now < startTime
    const reminderStart = event.startTime - reminderTime
    return now >= reminderStart && now < event.startTime
  }
}

/**
 * 检查待办是否需要提醒
 * @param todo 待办事项
 * @param now 当前时间戳
 * @param settings 应用设置
 * @returns 是否需要提醒
 */
function shouldRemindTodo(todo: Todo, now: number, settings: AppSettings): boolean {
  if (!todo.dueDate || todo.completed) return false

  // 检查是否已查看详情（在有效期内不重复提醒）
  if (isReminderViewed(todo.id)) {
    return false
  }

  // 检查是否有稍后提醒
  const snoozeTime = getSnoozeTime(todo.id)
  if (snoozeTime !== null) {
    if (now >= snoozeTime) {
      // 稍后提醒时间已到，返回 true（稍后提醒将在 checkAndSendReminders 中清除）
      return true
    }
    // 稍后提醒时间未到，不触发提醒
    return false
  }

  // dueDate - defaultReminder <= now < dueDate
  const reminderTime = settings.defaultReminder * 60 * 1000
  const reminderStart = todo.dueDate - reminderTime

  return now >= reminderStart && now < todo.dueDate
}

/**
 * 检查并发送提醒
 */
async function checkAndSendReminders(): Promise<void> {
  try {
    const calendarStore = useCalendarStore()
    const todoStore = useTodoStore()
    const settingsStore = useSettingsStore()

    // 确保 store 已初始化
    if (!calendarStore.isInitialized || !todoStore.isInitialized) {
      return
    }

    const settings = settingsStore.settings
    const now = Date.now()

    // 检查事件提醒
    for (const event of calendarStore.visibleEvents) {
      if (shouldRemindEvent(event, now, settings)) {
        // 检查是否有稍后提醒，如果有则使用稍后提醒时间作为 key
        const snoozeTime = getSnoozeTime(event.id)
        const reminderKey = snoozeTime !== null
          ? generateReminderKey(event.id, snoozeTime)
          : generateReminderKey(event.id, event.startTime)

        if (!isReminderSent(reminderKey)) {
          const title = formatNotificationTitle(event.title, settings)
          const body = formatNotificationBody(event, 'event', settings)

          await sendReminderNotification(title, body, settings.reminderMode, event.id, 'event', event, now)
          markReminderSent(reminderKey)

          // 如果是稍后提醒，清除稍后提醒时间
          if (snoozeTime !== null) {
            clearSnoozeTime(event.id)
          }
        }
      }
    }

    // 检查待办提醒
    for (const todo of todoStore.pendingTodos) {
      if (shouldRemindTodo(todo, now, settings)) {
        // 检查是否有稍后提醒，如果有则使用稍后提醒时间作为 key
        const snoozeTime = getSnoozeTime(todo.id)
        const reminderKey = snoozeTime !== null
          ? generateReminderKey(todo.id, snoozeTime)
          : generateReminderKey(todo.id, todo.dueDate!)

        if (!isReminderSent(reminderKey)) {
          const title = formatNotificationTitle(todo.title, settings)
          const body = formatNotificationBody(todo, 'todo', settings)

          await sendReminderNotification(title, body, settings.reminderMode, todo.id, 'todo', todo, now)
          markReminderSent(reminderKey)

          // 如果是稍后提醒，清除稍后提醒时间
          if (snoozeTime !== null) {
            clearSnoozeTime(todo.id)
          }
        }
      }
    }
  } catch (error) {
    console.error('检查提醒失败:', error)
  }
}

/**
 * 启动提醒服务
 */
export function startReminderService(): void {
  if (reminderInterval) {
    return
  }

  // 启动时检查是否需要清理过期提醒记录
  if (shouldCleanupReminders()) {
    cleanupOldReminders()
  }

  // 立即执行一次检查
  checkAndSendReminders()

  // 设置定时检查
  reminderInterval = setInterval(() => {
    checkAndSendReminders()
  }, CHECK_INTERVAL)
}

/**
 * 停止提醒服务
 */
export function stopReminderService(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval)
    reminderInterval = null
  }

  // 停止标题闪烁
  stopTitleBlink()
}

/**
 * 获取提醒服务状态
 * @returns 是否正在运行
 */
export function isReminderServiceRunning(): boolean {
  return reminderInterval !== null
}

/**
 * 手动触发一次提醒检查（用于测试）
 */
export async function triggerReminderCheck(): Promise<void> {
  await checkAndSendReminders()
}

/**
 * 重置快速连续触发防护状态（用于测试）
 */
export function resetRapidTriggerState(): void {
  lastTriggerTimes.clear()
}

/**
 * 处理稍后提醒
 * @param itemId 事件或待办的 ID
 * @param snoozeTime 稍后提醒的时间戳
 */
export function handleSnoozeReminder(
  itemId: string,
  snoozeTime: number
): void {
  setSnoozeTime(itemId, snoozeTime)
}

/**
 * 处理事件/待办被删除的情况
 * 当原项目被删除时，更新提醒内容为"项目已删除"
 * @param itemId 事件或待办的 ID
 * @param type 类型：'event' | 'todo'
 */
export async function handleReminderDeleted(
  itemId: string,
  type: 'event' | 'todo'
): Promise<void> {
  try {
    // 检查队列中是否有该项目的提醒
    const queue = loadQueue()
    const matchingItem = queue.items.find(item => item.itemId === itemId)

    if (matchingItem) {
      // 更新提醒内容
      matchingItem.title = '项目已删除'
      matchingItem.body = type === 'event'
        ? '该日历事件已被删除'
        : '该待办事项已被删除'
      matchingItem.itemData = {
        id: itemId,
        title: matchingItem.title,
        ...(type === 'event' ? {
          startTime: Date.now(),
          endTime: Date.now() + 3600000,
          allDay: false,
          calendarId: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        } : {
          completed: false,
          priority: 'medium',
          calendarId: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      }

      // 保存更新后的队列
      saveQueue(queue)

      // 如果当前正在显示这个提醒，发送更新事件
      if (currentDisplayedReminderId === matchingItem.id) {
        await tauriEmit('show-reminder', {
          id: matchingItem.id,
          type: matchingItem.type,
          title: matchingItem.title,
          body: matchingItem.body,
          triggerTime: matchingItem.triggerTime,
          itemId: matchingItem.itemId,
          itemData: matchingItem.itemData,
          createdAt: matchingItem.enqueuedAt
        })
      }

      console.log(`[reminder] 项目已删除提醒已更新: ${itemId}`)
    }
  } catch (error) {
    console.error('[reminder] 处理删除提醒失败:', error)
  }
}
