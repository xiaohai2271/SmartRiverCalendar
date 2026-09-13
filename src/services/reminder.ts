import type { ReminderQueueItem } from '@/platform/types/reminder.repository'
import type { CalendarEvent, Todo } from '@/types'
import { usePlatform } from '@/platform/provider'
import { createReminderService } from './reminder-core'
import type { ReminderService } from './reminder-core'
import { createReminderActions, onReminderPopup, offReminderPopup, resetRapidTriggerState as resetUiRapidTriggerState } from './reminder-ui'

export type { ReminderQueueItem } from '@/platform/types/reminder.repository'

type ReminderPopupCallback = (data: {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
}) => void

let _service: ReminderService | null = null

function getService(): ReminderService {
  if (!_service) {
    const { reminderRepo } = usePlatform()
    const actions = createReminderActions()
    _service = createReminderService(reminderRepo, actions)
  }
  return _service
}

export function startReminderService(): void {
  getService().start()
}

export function stopReminderService(): void {
  getService().stop()
}

export function isReminderServiceRunning(): boolean {
  return getService().isRunning()
}

export async function triggerReminderCheck(): Promise<void> {
  await getService().triggerCheck()
}

export function enqueueReminder(item: Omit<ReminderQueueItem, 'enqueuedAt'>): boolean {
  return getService().enqueue(item)
}

export function dequeueReminder(): ReminderQueueItem | null {
  return getService().dequeue()
}

export function markReminderProcessed(): void {
  getService().markProcessed()
}

export function getQueueStatus(): { count: number; firstItem: ReminderQueueItem | null } {
  return getService().getQueueStatus()
}

export function clearQueue(): void {
  getService().clearQueue()
}

export function markReminderAsViewed(id: string): void {
  getService().markAsViewed(id)
}

export function handleSnoozeReminder(itemId: string, snoozeTime: number): void {
  getService().handleSnooze(itemId, snoozeTime)
}

export async function handleReminderDeleted(itemId: string, type: 'event' | 'todo'): Promise<void> {
  await getService().handleDeleted(itemId, type)
}

export function resetRapidTriggerState(): void {
  resetUiRapidTriggerState()
  getService().resetRapidTriggerState()
}

export { onReminderPopup, offReminderPopup }

export type { ReminderPopupCallback }
