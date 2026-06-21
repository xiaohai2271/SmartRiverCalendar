import type { IReminderRepository, ReminderQueueItem } from '../types/reminder.repository'

const QUEUE_STORAGE_KEY = 'reminder_queue'
const REMINDER_SENT_PREFIX = 'reminder_sent_'
const SNOOZE_PREFIX = 'reminder_snooze_'
const REMINDER_VIEWED_PREFIX = 'reminder_viewed_'
const VIEWED_VALID_DURATION = 60 * 60 * 1000
const LAST_CLEANUP_KEY = 'reminder_last_cleanup_time'

export class WebReminderRepository implements IReminderRepository {
  private readonly platform = 'web' as const

  async loadQueue(): Promise<ReminderQueueItem[]> {
    try {
      const data = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (data) {
        const queue = JSON.parse(data) as { items?: ReminderQueueItem[] }
        return queue.items || []
      }
    } catch (error) {
      console.error('[WebReminderRepository] 加载提醒队列失败:', error)
    }
    return []
  }

  async saveQueue(items: ReminderQueueItem[]): Promise<void> {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items }))
    } catch (error) {
      console.error('[WebReminderRepository] 保存提醒队列失败:', error)
    }
  }

  async isReminderSent(key: string): Promise<boolean> {
    return localStorage.getItem(key) !== null
  }

  async markReminderSent(key: string): Promise<void> {
    localStorage.setItem(key, '1')
  }

  async getSnoozeTime(id: string): Promise<number | null> {
    const key = `${SNOOZE_PREFIX}${id}`
    const value = localStorage.getItem(key)
    if (value) {
      const timestamp = parseInt(value, 10)
      if (!isNaN(timestamp)) {
        return timestamp
      }
    }
    return null
  }

  async setSnoozeTime(id: string, timestamp: number): Promise<void> {
    const key = `${SNOOZE_PREFIX}${id}`
    localStorage.setItem(key, timestamp.toString())
  }

  async clearSnoozeTime(id: string): Promise<void> {
    const key = `${SNOOZE_PREFIX}${id}`
    localStorage.removeItem(key)
  }

  async isReminderViewed(id: string, validDurationMs: number): Promise<boolean> {
    const key = `${REMINDER_VIEWED_PREFIX}${id}`
    const value = localStorage.getItem(key)
    if (value) {
      const viewedTime = parseInt(value, 10)
      if (!isNaN(viewedTime)) {
        return Date.now() - viewedTime < validDurationMs
      }
    }
    return false
  }

  async markReminderAsViewed(id: string): Promise<void> {
    const key = `${REMINDER_VIEWED_PREFIX}${id}`
    localStorage.setItem(key, Date.now().toString())
  }

  async cleanupExpiredRecords(now: number): Promise<void> {
    const lastCleanup = localStorage.getItem(LAST_CLEANUP_KEY)
    if (lastCleanup) {
      const lastCleanupTime = parseInt(lastCleanup, 10)
      if (now - lastCleanupTime < 24 * 60 * 60 * 1000) {
        return
      }
    }

    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(REMINDER_SENT_PREFIX)) {
        const parts = key.split('_')
        const timestamp = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(timestamp) && timestamp < sevenDaysAgo) {
          keysToRemove.push(key)
        }
      } else if (key && key.startsWith(REMINDER_VIEWED_PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          const viewedTime = parseInt(value, 10)
          if (!isNaN(viewedTime) && now - viewedTime >= VIEWED_VALID_DURATION) {
            keysToRemove.push(key)
          }
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    localStorage.setItem(LAST_CLEANUP_KEY, now.toString())
  }
}
