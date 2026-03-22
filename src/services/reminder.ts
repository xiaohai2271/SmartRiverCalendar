import { sendNotification } from '@tauri-apps/plugin-notification'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { useSettingsStore } from '../stores/settings'
import type { CalendarEvent, Todo, AppSettings } from '../types'

// 定时器句柄
let reminderInterval: ReturnType<typeof setInterval> | null = null

// 提醒检查间隔（1分钟）
const CHECK_INTERVAL = 60 * 1000

// localStorage 中已发送提醒的前缀
const REMINDER_SENT_PREFIX = 'reminder_sent_'

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
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key))
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
 */
async function sendReminderNotification(
  title: string,
  body: string,
  mode: AppSettings['reminderMode']
): Promise<void> {
  try {
    // 发送系统通知
    await sendNotification({ title, body })

    // 根据提醒强度处理
    if (mode === 'strong') {
      // 强提醒：闪烁任务栏标题
      startBlinkTitle(title)
    }
    // silent 模式暂不支持静默通知，Tauri 统一发送
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
        // 生成提醒 key（使用事件开始时间作为标识）
        const reminderKey = generateReminderKey(event.id, event.startTime)

        if (!isReminderSent(reminderKey)) {
          const title = formatNotificationTitle(event.title, settings)
          const body = formatNotificationBody(event, 'event', settings)

          await sendReminderNotification(title, body, settings.reminderMode)
          markReminderSent(reminderKey)

          console.log('事件提醒已发送:', event.title)
        }
      }
    }

    // 检查待办提醒
    for (const todo of todoStore.pendingTodos) {
      if (shouldRemindTodo(todo, now, settings)) {
        // 生成提醒 key（使用截止时间作为标识）
        const reminderKey = generateReminderKey(todo.id, todo.dueDate!)

        if (!isReminderSent(reminderKey)) {
          const title = formatNotificationTitle(todo.title, settings)
          const body = formatNotificationBody(todo, 'todo', settings)

          await sendReminderNotification(title, body, settings.reminderMode)
          markReminderSent(reminderKey)

          console.log('待办提醒已发送:', todo.title)
        }
      }
    }

    // 定期清理过期的提醒记录
    if (Math.random() < 0.01) { // 1% 的概率触发清理
      cleanupOldReminders()
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
    console.log('提醒服务已在运行')
    return
  }

  console.log('启动提醒服务')

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
    console.log('提醒服务已停止')
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
