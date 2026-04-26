import { sendNotification } from '@tauri-apps/plugin-notification'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { useSettingsStore } from '../stores/settings'
import type { CalendarEvent, Todo, AppSettings } from '../types'

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
 * 触发提醒弹窗
 * @param data 弹窗数据
 */
function triggerReminderPopup(data: {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
}): void {
  reminderPopupCallbacks.forEach(callback => {
    try {
      callback(data)
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
    // 根据提醒强度决定是否发送系统通知
    // standard 和 strong 模式发送系统通知，silent 模式不发送
    if (mode !== 'silent') {
      await sendNotification({ title, body })
    }

    // 触发应用内弹窗（所有模式都弹窗）
    const popupId = `popup_${itemId}_${triggerTime}`
    triggerReminderPopup({
      id: popupId,
      type,
      title,
      body,
      triggerTime,
      itemId,
      itemData
    })

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
