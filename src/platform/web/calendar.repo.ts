import type { ICalendarRepository } from '../types/calendar.repository'
import type { Calendar } from '@/types'
import { WebApiClient } from './api-client'
import { transformWebCalendar, type ApiResponse, type WebCalendar } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Web 日历 Repository 实现 */
export class WebCalendarRepository implements ICalendarRepository {
  private readonly platform = 'web' as const

  constructor(private readonly apiClient: WebApiClient) {}

  async getAll(): Promise<Calendar[]> {
    const response = await this.apiClient.get<ApiResponse<WebCalendar[]>>('/calendars')
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取日历列表',
        platform: this.platform,
      })
    }
    return response.data.map(transformWebCalendar)
  }

  async create(params: {
    name: string
    color: string
    type: string
    accountId?: number
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const response = await this.apiClient.post<ApiResponse<WebCalendar>>('/calendars', {
      name: params.name,
      color: params.color,
      type: params.type,
      account_id: params.accountId ?? null,
      visible: params.visible ?? true,
      sync_enabled: params.syncEnabled ?? false,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法创建日历',
        platform: this.platform,
      })
    }
    return transformWebCalendar(response.data)
  }

  async update(params: {
    id: number
    name?: string
    color?: string
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const response = await this.apiClient.put<ApiResponse<WebCalendar>>(`/calendars/${params.id}`, {
      name: params.name,
      color: params.color,
      visible: params.visible,
      sync_enabled: params.syncEnabled,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法更新日历',
        platform: this.platform,
      })
    }
    return transformWebCalendar(response.data)
  }

  async delete(id: number): Promise<void> {
    const response = await this.apiClient.delete<ApiResponse<null>>(`/calendars/${id}`)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法删除日历',
        platform: this.platform,
      })
    }
  }

  async updateType(params: {
    id: number
    type: 'local' | 'online'
    syncEnabled: boolean
  }): Promise<Calendar> {
    const response = await this.apiClient.put<ApiResponse<WebCalendar>>(`/calendars/${params.id}`, {
      type: params.type,
      sync_enabled: params.syncEnabled,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法更新日历类型',
        platform: this.platform,
      })
    }
    return transformWebCalendar(response.data)
  }
}
