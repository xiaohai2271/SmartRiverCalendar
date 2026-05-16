import type { CalendarEvent, ExternalAccount } from '@/types'

export interface ConnectResult {
  success: boolean
  error?: string
  account?: ExternalAccount
  calendars?: Array<{
    id: string
    name: string
    color?: string
    url: string
    readOnly: boolean
  }>
}

export interface ExternalEventParams {
  accountId: string
  accountType: string
  serverUrl: string
  username: string
  encryptedPassword: string
  calendarUrl: string
}

export interface ExternalCalendarInfo {
  id: string
  name: string
  color?: string
  url: string
  readOnly: boolean
}

export interface ISyncRepository {
  /** 连接 Exchange 服务器 */
  connectExchange(serverUrl: string | null, username: string, password: string): Promise<ConnectResult>

  /** 连接 CalDAV 服务器 */
  connectCalDAV(serverUrl: string, username: string, password: string): Promise<ConnectResult>

  /** 获取所有外部账号 */
  getAllAccounts(): Promise<ExternalAccount[]>

  /** 删除外部账号 */
  deleteAccount(accountId: string): Promise<void>

  /** 获取外部日历列表 */
  getExternalCalendars(params: ExternalEventParams): Promise<ExternalCalendarInfo[]>

  /** 获取外部日历事件 */
  getExternalEvents(params: ExternalEventParams & {
    calendarId: string
    startTime: number
    endTime: number
  }): Promise<CalendarEvent[]>

  /** 创建外部日历事件 */
  createExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }>

  /** 更新外部日历事件 */
  updateExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }>

  /** 删除外部日历事件 */
  deleteExternalEvent(params: ExternalEventParams & {
    eventId: string
  }): Promise<{ success: boolean; error?: string }>

  /** 触发云同步 */
  triggerCloudSync(): Promise<boolean>

  /** 获取同步状态 */
  getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }>

  /** 启动自动同步 */
  startAutoSync(intervalMinutes: number): void

  /** 停止自动同步 */
  stopAutoSync(): void
}
