import type { IEventRepository } from '../types/event.repository'
import type { CalendarEvent } from '@/types'
import { WebApiClient } from './api-client'
import { transformWebEvent, type ApiResponse, type PageResponse, type WebEvent } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Web 事件 Repository 实现 */
export class WebEventRepository implements IEventRepository {
  private readonly platform = 'web' as const

  constructor(private readonly apiClient: WebApiClient) {}

  async getAll(): Promise<CalendarEvent[]> {
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>('/events')
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取事件列表',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
  }

  async getByCalendarId(calendarId: number): Promise<CalendarEvent[]> {
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>(`/events?calendar_id=${calendarId}`)
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取日历事件',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
  }

  async getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]> {
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>(`/events?start_time=${startTime}&end_time=${endTime}`)
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取时间范围内的事件',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
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
    timezone?: string
  }): Promise<CalendarEvent> {
    const response = await this.apiClient.post<ApiResponse<WebEvent>>('/events', {
      title: params.title,
      description: params.description ?? null,
      start_time: params.startTime,
      end_time: params.endTime,
      all_day: params.allDay,
      calendar_id: params.calendarId,
      timezone: params.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeat_rule: params.repeatRule ?? null,
      location: params.location ?? null,
      external_id: params.externalId ?? null,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法创建事件',
        platform: this.platform,
      })
    }
    return transformWebEvent(response.data)
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
    timezone?: string
  }): Promise<CalendarEvent> {
    const response = await this.apiClient.put<ApiResponse<WebEvent>>(`/events/${params.id}`, {
      title: params.title,
      description: params.description ?? null,
      start_time: params.startTime,
      end_time: params.endTime,
      all_day: params.allDay,
      timezone: params.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      color: params.color ?? null,
      reminder: params.reminder ?? null,
      repeat_rule: params.repeatRule ?? null,
      location: params.location ?? null,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法更新事件',
        platform: this.platform,
      })
    }
    return transformWebEvent(response.data)
  }

  async delete(id: number): Promise<void> {
    const response = await this.apiClient.delete<ApiResponse<null>>(`/events/${id}`)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法删除事件',
        platform: this.platform,
      })
    }
  }
}
