import type { ISettingsRepository } from '../types/settings.repository'
import type { ISyncRepository, ConnectResult, ExternalEventParams, ExternalCalendarInfo } from '../types/sync.repository'
import type { CalendarEvent, ExternalAccount } from '@/types'
import { safeInvoke, safeInvokeWithResult } from '@/utils/tauri'
import { transformAccount, transformEvent, type RawAccount, type RawEvent } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

/** Tauri 同步 Repository 实现 */
export class TauriSyncRepository implements ISyncRepository {
  private readonly platform = 'tauri' as const

  async connectExchange(serverUrl: string | null, username: string, password: string): Promise<ConnectResult> {
    const result = await safeInvokeWithResult('connect_exchange', {
      server_url: serverUrl,
      username,
      password,
    })

    if (result.account) {
      return {
        ...result,
        account: transformAccount(result.account as unknown as RawAccount),
      }
    }

    return result
  }

  async connectCalDAV(serverUrl: string, username: string, password: string): Promise<ConnectResult> {
    const result = await safeInvokeWithResult('connect_caldav', {
      serverUrl,
      username,
      password,
    })

    if (result.account) {
      return {
        ...result,
        account: transformAccount(result.account as unknown as RawAccount),
      }
    }

    return result
  }

  async getAllAccounts(): Promise<ExternalAccount[]> {
    const result = await safeInvoke<RawAccount[]>('get_all_db_accounts')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取账号列表',
        platform: this.platform,
      })
    }
    return result.map(transformAccount)
  }

  async deleteAccount(accountId: string): Promise<void> {
    await safeInvoke('delete_account', { accountId })
  }

  async getExternalCalendars(params: ExternalEventParams): Promise<ExternalCalendarInfo[]> {
    const result = await safeInvoke<Array<{ id: string; name: string; color?: string; url: string; read_only?: boolean; readOnly?: boolean }>>(
      'get_external_calendars',
      {
        accountId: params.accountId,
        accountType: params.accountType,
        serverUrl: params.serverUrl,
        username: params.username,
        encryptedPassword: params.encryptedPassword,
      }
    )
    if (result === null) {
      return []
    }
    return result.map(cal => ({
      id: cal.id,
      name: cal.name,
      color: cal.color,
      url: cal.url,
      readOnly: cal.read_only ?? cal.readOnly ?? false,
    }))
  }

  async getExternalEvents(params: ExternalEventParams & {
    calendarId: string
    startTime: number
    endTime: number
  }): Promise<CalendarEvent[]> {
    const result = await safeInvoke<RawEvent[]>('get_external_events', {
      accountId: params.accountId,
      accountType: params.accountType,
      serverUrl: params.serverUrl,
      username: params.username,
      encryptedPassword: params.encryptedPassword,
      calendarUrl: params.calendarUrl,
      calendarId: params.calendarId,
      startTime: params.startTime,
      endTime: params.endTime,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取外部事件',
        platform: this.platform,
      })
    }
    return result.map(transformEvent)
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
    const result = await safeInvoke<{ success: boolean; external_id?: string; error?: string }>(
      'create_external_event',
      {
        accountId: params.accountId,
        accountType: params.accountType,
        serverUrl: params.serverUrl,
        username: params.username,
        encryptedPassword: params.encryptedPassword,
        calendarUrl: params.calendarUrl,
        event: params.event,
      }
    )
    if (result === null) {
      return { success: false, error: 'Tauri 环境不可用' }
    }
    return {
      success: result.success,
      externalId: result.external_id,
      error: result.error,
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
    const result = await safeInvoke<{ success: boolean; external_id?: string; error?: string }>(
      'update_external_event',
      {
        accountId: params.accountId,
        accountType: params.accountType,
        serverUrl: params.serverUrl,
        username: params.username,
        encryptedPassword: params.encryptedPassword,
        calendarUrl: params.calendarUrl,
        event: params.event,
      }
    )
    if (result === null) {
      return { success: false, error: 'Tauri 环境不可用' }
    }
    return {
      success: result.success,
      externalId: result.external_id,
      error: result.error,
    }
  }

  async deleteExternalEvent(params: ExternalEventParams & {
    eventId: string
  }): Promise<{ success: boolean; error?: string }> {
    const result = await safeInvoke<{ success: boolean; error?: string }>(
      'delete_external_event',
      {
        accountId: params.accountId,
        accountType: params.accountType,
        serverUrl: params.serverUrl,
        username: params.username,
        encryptedPassword: params.encryptedPassword,
        calendarUrl: params.calendarUrl,
        eventId: params.eventId,
      }
    )
    if (result === null) {
      return { success: false, error: 'Tauri 环境不可用' }
    }
    return result
  }

  async triggerCloudSync(): Promise<boolean> {
    const result = await safeInvoke<{ success: boolean }>('cloud_sync_trigger')
    return result?.success ?? false
  }

  async syncCalendarsFromServer(): Promise<boolean> {
    try {
      const result = await safeInvoke<{ success: boolean }>('sync_calendars_from_server')
      return result?.success ?? false
    } catch (error) {
      console.error('[TauriSyncRepository] 从服务端同步日历失败:', error)
      throw error
    }
  }

  async getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }> {
    const result = await safeInvoke<{
      status: string
      last_sync_at: number | null
      pending_changes: number
    }>('cloud_sync_get_status')
    if (result === null) {
      return { status: 'idle', lastSyncAt: null, pendingChanges: 0 }
    }
    return {
      status: result.status,
      lastSyncAt: result.last_sync_at,
      pendingChanges: result.pending_changes,
    }
  }

  startAutoSync(intervalMinutes: number): void {
    this.stopAutoSync()
    const intervalMs = intervalMinutes * 60 * 1000
    autoSyncInterval = setInterval(async () => {
      await this.triggerCloudSync()
    }, intervalMs)
    console.info(`[TauriSyncRepository] 自动同步已启动，间隔 ${intervalMinutes} 分钟`)
  }

  stopAutoSync(): void {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval)
      autoSyncInterval = null
      console.info('[TauriSyncRepository] 自动同步已停止')
    }
  }
}
