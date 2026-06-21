import type { CalendarEvent } from '@/types'

export interface IEventRepository {
  /** 获取所有事件 */
  getAll(): Promise<CalendarEvent[]>

  /** 按日历 ID 获取事件 */
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>

  /** 按时间范围获取事件 */
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>

  /** 创建事件 */
  create(params: {
    title: string
    description?: string
    startTime: number
    endTime: number
    allDay: boolean
    calendarId: number
    color?: string
    reminder?: number
    repeatRule?: string
    location?: string
    externalId?: string
  }): Promise<CalendarEvent>

  /** 更新事件 */
  update(params: {
    id: number
    title: string
    description?: string
    startTime: number
    endTime: number
    allDay: boolean
    calendarId: number
    color?: string
    reminder?: number
    repeatRule?: string
    location?: string
    externalId?: string
  }): Promise<CalendarEvent>

  /** 删除事件 */
  delete(id: number): Promise<void>
}
