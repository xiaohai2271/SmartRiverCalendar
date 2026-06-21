import type { IEventRepository, EventCreateParams, EventUpdateParams } from '../types/event.repository'
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

  async create(params: EventCreateParams): Promise<CalendarEvent> {
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

  async update(params: EventUpdateParams): Promise<CalendarEvent> {
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

  async createWithSync(params: EventCreateParams): Promise<CalendarEvent> {
    if (!navigator.onLine) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法创建事件',
        platform: this.platform,
      })
    }
    return this.create(params)
  }

  async updateWithSync(params: EventUpdateParams): Promise<CalendarEvent> {
    if (!navigator.onLine) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法更新事件',
        platform: this.platform,
      })
    }
    return this.update(params)
  }

  async deleteWithSync(id: number): Promise<void> {
    if (!navigator.onLine) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法删除事件',
        platform: this.platform,
      })
    }
    return this.delete(id)
  }

  async deleteByCalendarAndTimeRange(calendarId: string, startTime: number, endTime: number): Promise<void> {
    const calId = parseInt(calendarId)
    if (isNaN(calId)) return
    const response = await this.apiClient.delete<ApiResponse<null>>(
      `/events?calendar_id=${calId}&start_time=${startTime}&end_time=${endTime}`
    )
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法按范围删除事件',
        platform: this.platform,
      })
    }
  }

  async getByTimeRangeAndCalendars(startTime: number, endTime: number, calendarIds: number[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const idsParam = calendarIds.join(',')
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>(
      `/events?start_time=${startTime}&end_time=${endTime}&calendar_ids=${idsParam}`
    )
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取时间范围和日历内的事件',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
  }

  async getCount(): Promise<number> {
    const response = await this.apiClient.get<ApiResponse<{ count: number }>>('/events/count')
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取事件数量',
        platform: this.platform,
      })
    }
    return response.data.count
  }

  async getUpcoming(limit: number, calendarIds: number[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const idsParam = calendarIds.join(',')
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>(
      `/events/upcoming?limit=${limit}&calendar_ids=${idsParam}`
    )
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取即将到来的事件',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
  }

  async search(query: string, limit: number, calendarIds: number[]): Promise<CalendarEvent[]> {
    if (calendarIds.length === 0) return []
    const idsParam = calendarIds.join(',')
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebEvent>>>(
      `/events/search?q=${encodeURIComponent(query)}&limit=${limit}&calendar_ids=${idsParam}`
    )
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法搜索事件',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebEvent)
  }
}
