import type { IEventRepository } from '../types/event.repository'
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

  async create(params: {
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
  }): Promise<CalendarEvent> {
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

  async update(params: {
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
  }): Promise<CalendarEvent> {
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
}
