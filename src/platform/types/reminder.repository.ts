import type { CalendarEvent, Todo } from '@/types'

export interface ReminderQueueItem {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
  enqueuedAt: number
}

export interface IReminderRepository {
  loadQueue(): Promise<ReminderQueueItem[]>
  saveQueue(items: ReminderQueueItem[]): Promise<void>
  isReminderSent(key: string): Promise<boolean>
  markReminderSent(key: string): Promise<void>
  getSnoozeTime(id: string): Promise<number | null>
  setSnoozeTime(id: string, timestamp: number): Promise<void>
  clearSnoozeTime(id: string): Promise<void>
  isReminderViewed(id: string, validDurationMs: number): Promise<boolean>
  markReminderAsViewed(id: string): Promise<void>
  cleanupExpiredRecords(now: number): Promise<void>
}
