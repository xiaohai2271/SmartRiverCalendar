import type { CalendarEvent } from '@/types'

export interface EventCreateParams {
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
  timezone?: string
}

export interface EventUpdateParams {
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
  timezone?: string
}

export interface IEventRepository {
  /** 获取所有事件 */
  getAll(): Promise<CalendarEvent[]>

  /** 按日历 ID 获取事件 */
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>

  /** 按时间范围获取事件 */
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>

  /** 创建事件 */
  create(params: EventCreateParams): Promise<CalendarEvent>

  /** 更新事件 */
  update(params: EventUpdateParams): Promise<CalendarEvent>

  /** 删除事件 */
  delete(id: number): Promise<void>

  /** 带同步语义的创建事件 */
  createWithSync(params: EventCreateParams): Promise<CalendarEvent>

  /** 带同步语义的更新事件 */
  updateWithSync(params: EventUpdateParams): Promise<CalendarEvent>

  /** 带同步语义的删除事件 */
  deleteWithSync(id: number): Promise<void>

  /** 按日历 ID 和时间范围批量删除事件 */
  deleteByCalendarAndTimeRange(calendarId: string, startTime: number, endTime: number): Promise<void>

  /** 按时间范围和日历 ID 获取事件（性能优化核心方法） */
  getByTimeRangeAndCalendars(startTime: number, endTime: number, calendarIds: string[]): Promise<CalendarEvent[]>

  /** 获取事件总数 */
  getCount(): Promise<number>

  /** 获取即将到来的事件 */
  getUpcoming(limit: number, calendarIds: string[]): Promise<CalendarEvent[]>

  /** 搜索事件 */
  search(query: string, limit: number, calendarIds: string[]): Promise<CalendarEvent[]>
}
