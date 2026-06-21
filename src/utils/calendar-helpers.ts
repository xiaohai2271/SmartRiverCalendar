import type { Calendar } from '@/types'

/**
 * 获取有效的日历 ID
 * 优先返回传入的 calendarId，其次返回本地日历，最后返回第一个可用日历
 */
export function getValidCalendarId(calendarId: string | undefined, calendars: Calendar[]): number {
  if (calendarId) {
    const parsed = parseInt(calendarId)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  // 从日历列表获取第一个本地日历
  const localCalendar = calendars.find(c => c.type === 'local')
  if (localCalendar) {
    const parsed = parseInt(localCalendar.id)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  // 兜底：返回第一个日历（不限类型）
  const firstCalendar = calendars[0]
  if (firstCalendar) {
    const parsed = parseInt(firstCalendar.id)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  // 最终兜底（不应发生）
  console.warn('[getValidCalendarId] 无法获取有效的日历 ID，使用默认值 1')
  return 1
}
