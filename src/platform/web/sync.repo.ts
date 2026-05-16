import type { ISyncRepository, ConnectResult, ExternalEventParams, ExternalCalendarInfo } from '../types/sync.repository'
import type { CalendarEvent, ExternalAccount } from '@/types'
import { WebApiClient } from './api-client'
import { transformWebAccount, transformWebEvent, type ApiResponse, type WebAccount, type WebEvent } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

/** Web 同步 Repository 实现 — 外部日历操作通过远端 API 代理 */
export class WebSyncRepository implements ISyncRepository {
  private readonly platform = 'web' as const

  constructor(private readonly apiClient: WebApiClient) {}

  async connectExchange(serverUrl: string | null, username: string, password: string): Promise<ConnectResult> {
    const response = await this.apiClient.post<ApiResponse<ConnectResult>>('/sync/connect-exchange', {
      server_url: serverUrl,
      username,
      password,
    })
    if (response.code !== 0) {
      return { success: false, error: response.message || '连接 Exchange 失败' }
    }
    return response.data ?? { success: false, error: '无返回数据' }
  }

  async connectCalDAV(serverUrl: string, username: string, password: string): Promise<ConnectResult> {
    const response = await this.apiClient.post<ApiResponse<ConnectResult>>('/sync/connect-caldav', {
      server_url: serverUrl,
      username,
      password,
    })
    if (response.code !== 0) {
      return { success: false, error: response.message || '连接 CalDAV 失败' }
    }
    return response.data ?? { success: false, error: '无返回数据' }
  }

  async getAllAccounts(): Promise<ExternalAccount[]> {
    const response = await this.apiClient.get<ApiResponse<WebAccount[]>>('/sync/accounts')
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取账号列表',
        platform: this.platform,
      })
    }
    return response.data.map(transformWebAccount)
  }

  async deleteAccount(accountId: string): Promise<void> {
    const response = await this.apiClient.delete<ApiResponse<null>>(`/sync/accounts/${accountId}`)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法删除账号',
        platform: this.platform,
      })
    }
  }

  async getExternalCalendars(params: ExternalEventParams): Promise<ExternalCalendarInfo[]> {
    const response = await this.apiClient.post<
      ApiResponse<Array<{ id: string; name: string; color?: string; url: string; read_only?: boolean }>>
    >('/sync/external-calendars', {
      account_id: params.accountId,
    })
    if (response.code !== 0 || !response.data) {
      return []
    }
    return response.data.map(cal => ({
      id: cal.id,
      name: cal.name,
      color: cal.color,
      url: cal.url,
      readOnly: cal.read_only ?? false,
    }))
  }

  async getExternalEvents(params: ExternalEventParams & {
    calendarId: string
    startTime: number
    endTime: number
  }): Promise<CalendarEvent[]> {
    const response = await this.apiClient.post<ApiResponse<WebEvent[]>>('/sync/external-events', {
      account_id: params.accountId,
      calendar_id: params.calendarId,
      start_time: params.startTime,
      end_time: params.endTime,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取外部事件',
        platform: this.platform,
      })
    }
    return response.data.map(transformWebEvent)
  }

  async createExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const response = await this.apiClient.post<
      ApiResponse<{ success: boolean; external_id?: string; error?: string }>
    >('/sync/external-events', {
      account_id: params.accountId,
      calendar_url: params.calendarUrl,
      event: params.event,
    })
    if (response.code !== 0 || !response.data) {
      return { success: false, error: response.message || '创建外部事件失败' }
    }
    return {
      success: response.data.success,
      externalId: response.data.external_id,
      error: response.data.error,
    }
  }

  async updateExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }> {
    const response = await this.apiClient.put<
      ApiResponse<{ success: boolean; external_id?: string; error?: string }>
    >(`/sync/external-events/${params.event.id}`, {
      account_id: params.accountId,
      calendar_url: params.calendarUrl,
      event: params.event,
    })
    if (response.code !== 0 || !response.data) {
      return { success: false, error: response.message || '更新外部事件失败' }
    }
    return {
      success: response.data.success,
      externalId: response.data.external_id,
      error: response.data.error,
    }
  }

  async deleteExternalEvent(params: ExternalEventParams & {
    eventId: string
  }): Promise<{ success: boolean; error?: string }> {
    const response = await this.apiClient.delete<
      ApiResponse<{ success: boolean; error?: string }>
    >(`/sync/external-events/${params.eventId}`)
    if (response.code !== 0 || !response.data) {
      return { success: false, error: response.message || '删除外部事件失败' }
    }
    return response.data
  }

  async triggerCloudSync(): Promise<boolean> {
    const response = await this.apiClient.post<ApiResponse<{ success: boolean }>>('/sync/trigger')
    return response?.data?.success ?? false
  }

  async getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }> {
    try {
      const response = await this.apiClient.get<
        ApiResponse<{ status: string; last_sync_at: number | null; pending_changes: number }>
      >('/sync/status')
      if (response.code === 0 && response.data) {
        return {
          status: response.data.status,
          lastSyncAt: response.data.last_sync_at,
          pendingChanges: response.data.pending_changes,
        }
      }
      return { status: 'idle', lastSyncAt: null, pendingChanges: 0 }
    } catch {
      return { status: 'idle', lastSyncAt: null, pendingChanges: 0 }
    }
  }

  startAutoSync(intervalMinutes: number): void {
    this.stopAutoSync()
    const intervalMs = intervalMinutes * 60 * 1000
    autoSyncInterval = setInterval(async () => {
      await this.triggerCloudSync()
    }, intervalMs)
    console.info(`[WebSyncRepository] 自动同步已启动，间隔 ${intervalMinutes} 分钟`)
  }

  stopAutoSync(): void {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval)
      autoSyncInterval = null
      console.info('[WebSyncRepository] 自动同步已停止')
    }
  }
}
