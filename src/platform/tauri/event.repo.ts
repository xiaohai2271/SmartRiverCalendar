import type { IEventRepository, EventCreateParams, EventUpdateParams } from '../types/event.repository'
import type { CalendarEvent } from '@/types'
import { safeInvoke } from '@/utils/tauri'
import { transformEvent, type RawEvent } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Tauri 事件 Repository 实现 */
export class TauriEventRepository implements IEventRepository {
  private readonly platform = 'tauri' as const

  async getAll(): Promise<CalendarEvent[]> {
    const result = await safeInvoke<RawEvent[]>('get_events')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取事件列表：Tauri 环境不可用',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }

  async getByCalendarId(calendarId: number): Promise<CalendarEvent[]> {
    const result = await safeInvoke<RawEvent[]>('get_events_by_calendar', { calendarId })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取日历事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }

  async getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]> {
    const result = await safeInvoke<RawEvent[]>('get_events_by_time_range', { startTime, endTime })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取时间范围内的事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }

  async create(params: EventCreateParams): Promise<CalendarEvent> {
    const result = await safeInvoke<RawEvent>('create_event', {
      title: params.title,
      description: params.description ?? null,
      startTime: params.startTime,
      endTime: params.endTime,
      allDay: params.allDay,
      calendarId: params.calendarId,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeatRule: params.repeatRule ?? null,
      location: params.location ?? null,
      externalId: params.externalId ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法创建事件',
        platform: this.platform,
      })
    }
    return transformEvent(result)
  }

  async update(params: EventUpdateParams): Promise<CalendarEvent> {
    const result = await safeInvoke<RawEvent>('update_event', {
      id: params.id,
      title: params.title,
      description: params.description ?? null,
      startTime: params.startTime,
      endTime: params.endTime,
      allDay: params.allDay,
      calendarId: params.calendarId,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeatRule: params.repeatRule ?? null,
      location: params.location ?? null,
      externalId: params.externalId ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法更新事件',
        platform: this.platform,
      })
    }
    return transformEvent(result)
  }

  async delete(id: number): Promise<void> {
    const result = await safeInvoke<boolean>('delete_event', { id })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法删除事件',
        platform: this.platform,
      })
    }
  }

  async createWithSync(params: EventCreateParams): Promise<CalendarEvent> {
    const result = await safeInvoke<RawEvent>('create_event_with_sync', {
      title: params.title,
      description: params.description ?? null,
      startTime: params.startTime,
      endTime: params.endTime,
      allDay: params.allDay,
      calendarId: params.calendarId,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeatRule: params.repeatRule ?? null,
      location: params.location ?? null,
      externalId: params.externalId ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法创建事件',
        platform: this.platform,
      })
    }
    return transformEvent(result)
  }

  async updateWithSync(params: EventUpdateParams): Promise<CalendarEvent> {
    const result = await safeInvoke<RawEvent>('update_event_with_sync', {
      id: params.id,
      title: params.title,
      description: params.description ?? null,
      startTime: params.startTime,
      endTime: params.endTime,
      allDay: params.allDay,
      calendarId: params.calendarId,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeatRule: params.repeatRule ?? null,
      location: params.location ?? null,
      externalId: params.externalId ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法更新事件',
        platform: this.platform,
      })
    }
    return transformEvent(result)
  }

  async deleteWithSync(id: number): Promise<void> {
    const result = await safeInvoke<null>('delete_event_with_sync', { id })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法删除事件',
        platform: this.platform,
      })
    }
  }

  async deleteByCalendarAndTimeRange(calendarId: string, startTime: number, endTime: number): Promise<void> {
    const calId = parseInt(calendarId)
    if (isNaN(calId)) return
    await safeInvoke('delete_events_by_calendar_and_time_range', {
      calendarId: calId,
      startTime,
      endTime,
    })
  }

  async getByTimeRangeAndCalendars(startTime: number, endTime: number, calendarIds: string[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const numericCalendarIds = calendarIds.map(id => Number(id))
    const result = await safeInvoke<RawEvent[]>('get_events_by_time_range_and_calendars', { startTime, endTime, calendarIds: numericCalendarIds })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取时间范围和日历内的事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }

  async getCount(): Promise<number> {
    const result = await safeInvoke<number>('get_event_count')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取事件数量',
        platform: this.platform,
      })
    }
    return result
  }

  async getUpcoming(limit: number, calendarIds: string[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const numericCalendarIds = calendarIds.map(id => Number(id))
    const result = await safeInvoke<RawEvent[]>('get_upcoming_events', { limit, calendarIds: numericCalendarIds })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取即将到来的事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }

  async search(query: string, limit: number, calendarIds: string[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const numericCalendarIds = calendarIds.map(id => Number(id))
    const result = await safeInvoke<RawEvent[]>('search_events', { query, limit, calendarIds: numericCalendarIds })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法搜索事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
  }
}
