import type { ReminderActions } from './reminder-core'
import type { ReminderQueueItem } from '@/platform/types/reminder.repository'
import type { CalendarEvent, Todo } from '@/types'
import { useCapabilities } from '@/platform/provider'

const RAPID_TRIGGER_COOLDOWN = 5000
const lastTriggerTimes: Map<string, number> = new Map()

const REMINDER_POPUP_LABEL = 'reminder-popup'

type ReminderPopupCallback = (data: {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
}) => void

const reminderPopupCallbacks: ReminderPopupCallback[] = []

export function onReminderPopup(callback: ReminderPopupCallback): void {
  reminderPopupCallbacks.push(callback)
}

export function offReminderPopup(callback: ReminderPopupCallback): void {
  const index = reminderPopupCallbacks.indexOf(callback)
  if (index !== -1) {
    reminderPopupCallbacks.splice(index, 1)
  }
}

export function resetRapidTriggerState(): void {
  lastTriggerTimes.clear()
}

function checkRapidTrigger(itemId: string): boolean {
  const now = Date.now()
  const lastTime = lastTriggerTimes.get(itemId)
  if (lastTime !== undefined && now - lastTime < RAPID_TRIGGER_COOLDOWN) {
    return true
  }
  lastTriggerTimes.set(itemId, now)
  for (const [key, time] of lastTriggerTimes) {
    if (now - time >= RAPID_TRIGGER_COOLDOWN) {
      lastTriggerTimes.delete(key)
    }
  }
  return false
}

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
      console.error('[reminder-ui] 提醒弹窗回调执行失败:', error)
    }
  })
}

let blinkInterval: ReturnType<typeof setInterval> | null = null
let originalTitle = ''

function startBlinkTitle(reminderTitle: string): void {
  if (blinkInterval) return

  originalTitle = document.title
  let isOriginal = true

  blinkInterval = setInterval(() => {
    document.title = isOriginal ? `【提醒】${reminderTitle}` : originalTitle
    isOriginal = !isOriginal
  }, 1000)

  setTimeout(() => {
    stopBlinkTitle()
  }, 30000)
}

function stopBlinkTitle(): void {
  if (blinkInterval) {
    clearInterval(blinkInterval)
    blinkInterval = null
    document.title = originalTitle
  }
}

function sendBrowserNotification(title: string, body: string): void {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body })
        }
      })
    }
  }
}

export function createReminderActions(): ReminderActions {
  const capabilities = useCapabilities()

  return {
    async showStrongReminder(item: ReminderQueueItem): Promise<void> {
      try {
        const { useSettingsStore } = await import('@/stores/settings')
        const settingsStore = useSettingsStore()
        if (settingsStore.settings.theme === 'dark') {
          console.log('[reminder-ui] 夜间模式不显示提醒窗口')
          return
        }

        if (capabilities.hasReminderPopup) {
          const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
          const { emit: tauriEmit } = await import('@tauri-apps/api/event')

          const reminderWindow = await WebviewWindow.getByLabel(REMINDER_POPUP_LABEL)

          if (reminderWindow) {
            const isVisible = await reminderWindow.isVisible()
            const { positionReminderWindow } = await import('@/composables/useReminderPopup')

            if (!isVisible) {
              await positionReminderWindow(reminderWindow)
              await reminderWindow.show()
              await reminderWindow.setFocus()
              await new Promise(resolve => setTimeout(resolve, 200))
            } else {
              await positionReminderWindow(reminderWindow)
              await reminderWindow.setFocus()
            }

            await tauriEmit('show-reminder', {
              id: item.id,
              type: item.type,
              title: item.title,
              body: item.body,
              triggerTime: item.triggerTime,
              itemId: item.itemId,
              itemData: item.itemData,
              createdAt: item.enqueuedAt
            })
          } else {
            triggerLocalPopup(item)
          }
        } else {
          triggerLocalPopup(item)
        }
      } catch (error) {
        console.error('[reminder-ui] 显示提醒窗口失败:', error)
        triggerLocalPopup(item)
      }
    },

    async showSystemNotification(title: string, body: string): Promise<void> {
      if (!capabilities.hasSystemNotification) return

      if (capabilities.hasReminderPopup) {
        try {
          const { sendNotification } = await import('@tauri-apps/plugin-notification')
          await sendNotification({ title, body })
        } catch (e) {
          console.warn('[reminder-ui] Tauri 通知发送失败，降级为浏览器通知:', e)
          sendBrowserNotification(title, body)
        }
      } else {
        sendBrowserNotification(title, body)
      }
    },

    startTitleBlink(title: string): void {
      startBlinkTitle(title)
    },

    stopTitleBlink(): void {
      stopBlinkTitle()
    },

    async updateDisplayedReminder(item: ReminderQueueItem): Promise<void> {
      if (!capabilities.hasReminderPopup) return

      try {
        const { emit: tauriEmit } = await import('@tauri-apps/api/event')
        await tauriEmit('show-reminder', {
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          triggerTime: item.triggerTime,
          itemId: item.itemId,
          itemData: item.itemData,
          createdAt: item.enqueuedAt
        })
      } catch (e) {
        console.warn('[reminder-ui] 发送删除更新事件失败:', e)
      }
    }
  }
}
