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

  /** 从服务端获取日历列表并同步到本地数据库 */
  syncCalendarsFromServer(): Promise<boolean>

  /** 获取同步状态 */
  getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }>

  /** 启动自动同步 */
  startAutoSync(intervalMinutes: number): void

  /** 停止自动同步 */
  stopAutoSync(): void

  /**
   * 记录待同步的本地变更
   *
   * 当日历 type='online' 但网络不可用时，事件仍写入本地 SQLite，
   * 同时通过此方法记录到 sync_log 表，待网络恢复后推送。
   *
   * 仅 local-first 平台需要实现（桌面端 + 移动端）。
   * Web 端无需实现（无本地数据库）。
   */
  recordPendingChange(params: {
    action: 'create' | 'update' | 'delete'
    entityType: 'event' | 'todo' | 'calendar'
    entityId: string
    payload: string
  }): Promise<void>

  /**
   * 推送所有待同步的本地变更到远端
   *
   * 读取 sync_log 表中 synced=0 的记录，逐条推送到远端 API。
   * 推送成功后标记 synced=1，并回填 externalId。
   *
   * 触发时机：
   * - 网络恢复时（cloudSyncService 监听 online 事件）
   * - 应用回到前台时（移动端 resume）
   * - 自动同步定时器触发时
   */
  pushPendingChanges(): Promise<{ pushed: number; failed: number }>
}
