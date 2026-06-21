import type { IReminderRepository, ReminderQueueItem } from '@/platform/types/reminder.repository'
import type { CalendarEvent, Todo, AppSettings } from '@/types'
import { useCalendarStore } from '@/stores/calendar'
import { useTodoStore } from '@/stores/todo'
import { useSettingsStore } from '@/stores/settings'

const REMINDER_SENT_PREFIX = 'reminder_sent_'
const CHECK_INTERVAL = 10 * 1000
const MAX_QUEUE_SIZE = 100
const QUEUE_TIMEOUT_MS = 3600000
const VIEWED_VALID_DURATION = 60 * 60 * 1000

export interface ReminderActions {
  showStrongReminder(item: ReminderQueueItem): Promise<void>
  showSystemNotification(title: string, body: string): Promise<void>
  startTitleBlink(title: string): void
  stopTitleBlink(): void
  updateDisplayedReminder(item: ReminderQueueItem): Promise<void>
}

export interface ReminderService {
  start(): void
  stop(): void
  isRunning(): boolean
  triggerCheck(): Promise<void>
  enqueue(item: Omit<ReminderQueueItem, 'enqueuedAt'>): boolean
  dequeue(): ReminderQueueItem | null
  markProcessed(): void
  getQueueStatus(): { count: number; firstItem: ReminderQueueItem | null }
  clearQueue(): void
  markAsViewed(id: string): void
  handleSnooze(itemId: string, snoozeTime: number): void
  handleDeleted(itemId: string, type: 'event' | 'todo'): Promise<void>
  resetRapidTriggerState(): void
}

export function comparePriority(a: ReminderQueueItem, b: ReminderQueueItem): number {
  if (a.type === 'event' && b.type === 'todo') return -1
  if (a.type === 'todo' && b.type === 'event') return 1
  return a.triggerTime - b.triggerTime
}

export function formatNotificationTitle(title: string, settings: AppSettings): string {
  if (settings.customReminderTitle) {
    return settings.customReminderTitle.replace('{title}', title)
  }
  return `小河日历 - ${title}`
}

export function formatNotificationBody(
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

export async function shouldRemindEvent(
  event: CalendarEvent,
  now: number,
  settings: AppSettings,
  repo: IReminderRepository
): Promise<boolean> {
  if (await repo.isReminderViewed(event.id, VIEWED_VALID_DURATION)) {
    return false
  }

  const snoozeTime = await repo.getSnoozeTime(event.id)
  if (snoozeTime !== null) {
    if (now >= snoozeTime) {
      return true
    }
    return false
  }

  const reminderMinutes = event.reminder ?? settings.defaultReminder
  const reminderTime = reminderMinutes * 60 * 1000

  if (event.allDay) {
    const eventDate = new Date(event.startTime)

    if (settings.allDayReminderTime === 'evening_before') {
      const eveningBefore = new Date(eventDate)
      eveningBefore.setDate(eveningBefore.getDate() - 1)
      eveningBefore.setHours(settings.allDayReminderHour, 0, 0, 0)

      const eveningBeforeEnd = new Date(eveningBefore)
      eveningBeforeEnd.setMinutes(eveningBeforeEnd.getMinutes() + 1)

      return now >= eveningBefore.getTime() && now < eveningBeforeEnd.getTime()
    } else {
      const morningOf = new Date(eventDate)
      morningOf.setHours(settings.allDayReminderHour, 0, 0, 0)

      const morningOfEnd = new Date(morningOf)
      morningOfEnd.setMinutes(morningOfEnd.getMinutes() + 1)

      return now >= morningOf.getTime() && now < morningOfEnd.getTime()
    }
  } else {
    const reminderStart = event.startTime - reminderTime
    return now >= reminderStart && now < event.startTime
  }
}

export async function shouldRemindTodo(
  todo: Todo,
  now: number,
  settings: AppSettings,
  repo: IReminderRepository
): Promise<boolean> {
  if (!todo.dueDate || todo.completed) return false

  if (await repo.isReminderViewed(todo.id, VIEWED_VALID_DURATION)) {
    return false
  }

  const snoozeTime = await repo.getSnoozeTime(todo.id)
  if (snoozeTime !== null) {
    if (now >= snoozeTime) {
      return true
    }
    return false
  }

  const reminderTime = settings.defaultReminder * 60 * 1000
  const reminderStart = todo.dueDate - reminderTime

  return now >= reminderStart && now < todo.dueDate
}

function generateReminderKey(id: string, timestamp: number): string {
  return `${REMINDER_SENT_PREFIX}${id}_${timestamp}`
}

function filterExpiredItems(items: ReminderQueueItem[]): ReminderQueueItem[] {
  return items.filter(i => Date.now() - i.enqueuedAt < QUEUE_TIMEOUT_MS)
}

class ReminderServiceImpl implements ReminderService {
  private currentDisplayedId: string | null = null
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly repo: IReminderRepository,
    private readonly actions: ReminderActions
  ) {}

  start(): void {
    if (this.interval) return

    this.interval = setInterval(() => {
      this.checkAndSendReminders()
    }, CHECK_INTERVAL)

    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      await this.repo.cleanupExpiredRecords(Date.now())
      await this.checkAndSendReminders()
    } catch (error) {
      console.error('[reminder] 初始化失败:', error)
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.actions.stopTitleBlink()
  }

  isRunning(): boolean {
    return this.interval !== null
  }

  async triggerCheck(): Promise<void> {
    await this.checkAndSendReminders()
  }

  enqueue(item: Omit<ReminderQueueItem, 'enqueuedAt'>): boolean {
    let items: ReminderQueueItem[] = []
    try {
      const loaded = this.syncLoadQueue()
      if (loaded) items = loaded
    } catch {}

    items = filterExpiredItems(items)

    if (items.some(i => i.id === item.id)) {
      return false
    }

    if (items.length >= MAX_QUEUE_SIZE) {
      items.sort(comparePriority)
      items.pop()
    }

    const newItem: ReminderQueueItem = {
      ...item,
      enqueuedAt: Date.now()
    }
    items.push(newItem)
    items.sort(comparePriority)

    this.syncSaveQueue(items)

    return true
  }

  dequeue(): ReminderQueueItem | null {
    if (this.currentDisplayedId !== null) {
      return null
    }

    let items: ReminderQueueItem[] = []
    try {
      const loaded = this.syncLoadQueue()
      if (loaded) items = loaded
    } catch {}

    items = filterExpiredItems(items)

    if (items.length === 0) {
      this.syncSaveQueue(items)
      return null
    }

    items.sort(comparePriority)
    const nextItem = items.shift()

    if (nextItem) {
      this.currentDisplayedId = nextItem.id
      this.syncSaveQueue(items)
      return nextItem
    }

    return null
  }

  markProcessed(): void {
    this.currentDisplayedId = null
    this.processNext()
  }

  getQueueStatus(): { count: number; firstItem: ReminderQueueItem | null } {
    let items: ReminderQueueItem[] = []
    try {
      const loaded = this.syncLoadQueue()
      if (loaded) items = loaded
    } catch {}

    items = filterExpiredItems(items)
    this.syncSaveQueue(items)

    return {
      count: items.length,
      firstItem: items.length > 0 ? items[0] : null
    }
  }

  clearQueue(): void {
    this.currentDisplayedId = null
    this.syncSaveQueue([])
  }

  markAsViewed(id: string): void {
    this.repo.markReminderAsViewed(id).catch(e =>
      console.error('[reminder] 标记已查看失败:', e)
    )
  }

  handleSnooze(itemId: string, snoozeTime: number): void {
    this.repo.setSnoozeTime(itemId, snoozeTime).catch(e =>
      console.error('[reminder] 设置稍后提醒失败:', e)
    )
  }

  async handleDeleted(itemId: string, type: 'event' | 'todo'): Promise<void> {
    try {
      let items: ReminderQueueItem[] = []
      try {
        const loaded = await this.repo.loadQueue()
        if (loaded) items = loaded
      } catch {}

      const matchingItem = items.find(item => item.itemId === itemId)

      if (matchingItem) {
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

        await this.repo.saveQueue(items)

        if (this.currentDisplayedId === matchingItem.id) {
          await this.actions.updateDisplayedReminder(matchingItem)
        }
      }
    } catch (error) {
      console.error('[reminder] 处理删除提醒失败:', error)
    }
  }

  resetRapidTriggerState(): void {
    // 防抖状态由 reminder-ui.ts 管理，此处为兼容接口
  }

  private syncLoadQueue(): ReminderQueueItem[] | null {
    try {
      const data = localStorage.getItem('reminder_queue')
      if (data) {
        const queue = JSON.parse(data) as { items?: ReminderQueueItem[] }
        return queue.items || []
      }
    } catch {}
    return []
  }

  private syncSaveQueue(items: ReminderQueueItem[]): void {
    try {
      localStorage.setItem('reminder_queue', JSON.stringify({ items }))
    } catch (e) {
      console.error('[reminder] 保存队列失败:', e)
    }
  }

  private async processNext(): Promise<void> {
    const nextItem = this.dequeue()
    if (nextItem) {
      await this.actions.showStrongReminder(nextItem)
    }
  }

  private async checkAndSendReminders(): Promise<void> {
    try {
      const calendarStore = useCalendarStore()
      const todoStore = useTodoStore()
      const settingsStore = useSettingsStore()

      if (!calendarStore.isInitialized || !todoStore.isInitialized) {
        return
      }

      const settings = settingsStore.settings
      const now = Date.now()

      // 独立查询近未来事件，不依赖 Store 的 loadedRange
      let eventsToCheck: CalendarEvent[] = []
      try {
        const { eventRepo } = await import('@/platform/provider').then(m => m.usePlatform())
        const visibleCalendarIds = calendarStore.visibleCalendars.map(c => c.id)
        if (visibleCalendarIds.length > 0) {
          // 查询过去1小时到未来48小时的事件
          eventsToCheck = await eventRepo.getByTimeRangeAndCalendars(
            now - 3600000, now + 172800000, visibleCalendarIds
          )
        }
      } catch {
        // 查询失败时降级到 Store 数据
        eventsToCheck = calendarStore.visibleEvents
      }

      for (const event of eventsToCheck) {
        if (await shouldRemindEvent(event, now, settings, this.repo)) {
          const snoozeTime = await this.repo.getSnoozeTime(event.id)
          const reminderKey = snoozeTime !== null
            ? generateReminderKey(event.id, snoozeTime)
            : generateReminderKey(event.id, event.startTime)

          if (!(await this.repo.isReminderSent(reminderKey))) {
            const title = formatNotificationTitle(event.title, settings)
            const body = formatNotificationBody(event, 'event', settings)

            await this.sendReminder(title, body, settings.reminderMode, event.id, 'event', event, now)
            await this.repo.markReminderSent(reminderKey)

            if (snoozeTime !== null) {
              await this.repo.clearSnoozeTime(event.id)
            }
          }
        }
      }

      for (const todo of todoStore.pendingTodos) {
        if (await shouldRemindTodo(todo, now, settings, this.repo)) {
          const snoozeTime = await this.repo.getSnoozeTime(todo.id)
          const reminderKey = snoozeTime !== null
            ? generateReminderKey(todo.id, snoozeTime)
            : generateReminderKey(todo.id, todo.dueDate!)

          if (!(await this.repo.isReminderSent(reminderKey))) {
            const title = formatNotificationTitle(todo.title, settings)
            const body = formatNotificationBody(todo, 'todo', settings)

            await this.sendReminder(title, body, settings.reminderMode, todo.id, 'todo', todo, now)
            await this.repo.markReminderSent(reminderKey)

            if (snoozeTime !== null) {
              await this.repo.clearSnoozeTime(todo.id)
            }
          }
        }
      }
    } catch (error) {
      console.error('[reminder] 检查提醒失败:', error)
    }
  }

  private async sendReminder(
    title: string,
    body: string,
    mode: AppSettings['reminderMode'],
    itemId: string,
    type: 'event' | 'todo',
    itemData: CalendarEvent | Todo,
    triggerTime: number
  ): Promise<void> {
    try {
      if (mode === 'strong') {
        const popupId = `popup_${itemId}_${triggerTime}`
        this.enqueue({
          id: popupId,
          type,
          title,
          body,
          triggerTime,
          itemId,
          itemData
        })

        this.processNext()
        this.actions.startTitleBlink(title)
      } else if (mode === 'standard') {
        await this.actions.showSystemNotification(title, body)
      }
    } catch (error) {
      console.error('[reminder] 发送提醒失败:', error)
    }
  }
}

export function createReminderService(
  repo: IReminderRepository,
  actions: ReminderActions
): ReminderService {
  return new ReminderServiceImpl(repo, actions)
}
