// Tauri API 工具函数
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'
import type { ConnectResult, Calendar, CalendarEvent, Todo } from '../types'

// 检测是否在 Tauri 环境中
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// 安全地调用 Tauri invoke
export async function safeInvoke<T>(command: string, args?: Record<string, any>): Promise<T | null> {
  if (!isTauri()) {
    console.log(`Tauri not available, skipping invoke: ${command}`)
    return null
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<T>(command, args)
  } catch (error) {
    console.error(`Failed to invoke ${command}:`, error)
    return null
  }
}

// ============================================================
// 数据转换工具函数
// 用于后端 snake_case 与前端 camelCase 的转换
// ============================================================

/** 后端返回的日历原始数据 */
interface RawCalendar {
  id: number
  name: string
  color: string
  type: string
  account_id: number | null
  visible: boolean
  sync_enabled: boolean
  created_at: number
  updated_at: number
}

/** 后端返回的事件原始数据 */
interface RawEvent {
  id: number
  title: string
  description: string | null
  start_time: number
  end_time: number
  all_day: boolean
  calendar_id: number
  color: string | null
  reminder: number | null
  repeat_rule: string | null
  location: string | null
  external_id: string | null
  created_at: number
  updated_at: number
}

/** 后端返回的待办原始数据 */
interface RawTodo {
  id: number
  title: string
  description: string | null
  due_date: number | null
  completed: boolean
  priority: string
  calendar_id: number
  created_at: number
  updated_at: number
}

/** 后端返回的账号原始数据 */
interface RawAccount {
  id: number
  type: string
  server_url: string
  username: string
  encrypted_password: string
  display_name: string | null
  enabled: boolean
  created_at: number
  updated_at: number
}

/**
 * 将后端日历数据转换为前端格式
 */
export function transformCalendar(raw: RawCalendar): Calendar {
  return {
    id: String(raw.id),
    name: raw.name,
    color: raw.color,
    type: raw.type as 'local' | 'exchange' | 'caldav',
    accountId: raw.account_id != null ? String(raw.account_id) : undefined,
    visible: raw.visible,
    syncEnabled: raw.sync_enabled,
  }
}

/**
 * 将后端事件数据转换为前端格式
 */
export function transformEvent(raw: RawEvent): CalendarEvent {
  let repeatRule = undefined
  if (raw.repeat_rule) {
    try {
      repeatRule = JSON.parse(raw.repeat_rule)
    } catch {
      console.warn('Failed to parse repeat_rule:', raw.repeat_rule)
    }
  }
  
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    startTime: raw.start_time,
    endTime: raw.end_time,
    allDay: raw.all_day,
    calendarId: String(raw.calendar_id),
    color: raw.color ?? undefined,
    reminder: raw.reminder ?? undefined,
    repeatRule,
    location: raw.location ?? undefined,
    externalId: raw.external_id ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

/**
 * 将后端待办数据转换为前端格式
 */
export function transformTodo(raw: RawTodo): Todo {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    dueDate: raw.due_date ?? undefined,
    completed: raw.completed,
    priority: raw.priority as 'low' | 'medium' | 'high',
    calendarId: String(raw.calendar_id),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

/**
 * 将后端账号数据转换为前端格式
 */
export function transformAccount(raw: RawAccount) {
  return {
    id: String(raw.id),
    type: raw.type as 'exchange' | 'caldav',
    serverUrl: raw.server_url,
    username: raw.username,
    encryptedPassword: raw.encrypted_password,
    displayName: raw.display_name ?? undefined,
    enabled: raw.enabled,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

// ============================================================
// 本地数据操作工具函数
// ============================================================

/**
 * 获取所有本地日历
 */
export async function invokeGetCalendars(): Promise<Calendar[]> {
  const result = await safeInvoke<RawCalendar[]>('get_calendars')
  return result?.map(transformCalendar) ?? []
}

/**
 * 创建本地日历
 */
export async function invokeCreateCalendar(params: {
  name: string
  color: string
  type: string
  accountId?: number
  visible?: boolean
  syncEnabled?: boolean
}): Promise<Calendar | null> {
  const result = await safeInvoke<RawCalendar>('create_calendar', {
    name: params.name,
    color: params.color,
    calendarType: params.type, // 注意：Rust 命令参数名为 calendar_type
    accountId: params.accountId ?? null,
    visible: params.visible ?? true,
    syncEnabled: params.syncEnabled ?? false,
  })
  return result ? transformCalendar(result) : null
}

/**
 * 更新本地日历
 */
export async function invokeUpdateCalendar(params: {
  id: number
  name?: string
  color?: string
  visible?: boolean
  syncEnabled?: boolean
}): Promise<Calendar | null> {
  const result = await safeInvoke<RawCalendar>('update_calendar', {
    id: params.id,
    name: params.name ?? null,
    color: params.color ?? null,
    visible: params.visible ?? null,
    syncEnabled: params.syncEnabled ?? null,
  })
  return result ? transformCalendar(result) : null
}

/**
 * 删除本地日历
 */
export async function invokeDeleteCalendar(id: number): Promise<boolean> {
  const result = await safeInvoke<void>('delete_calendar', { id })
  return result !== null
}

/**
 * 获取所有本地事件
 */
export async function invokeGetEvents(): Promise<CalendarEvent[]> {
  const result = await safeInvoke<RawEvent[]>('get_events')
  return result?.map(transformEvent) ?? []
}

/**
 * 根据日历 ID 获取事件
 */
export async function invokeGetEventsByCalendar(calendarId: number): Promise<CalendarEvent[]> {
  const result = await safeInvoke<RawEvent[]>('get_events_by_calendar', { calendarId })
  return result?.map(transformEvent) ?? []
}

/**
 * 创建本地事件
 */
export async function invokeCreateEvent(params: {
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
}): Promise<CalendarEvent | null> {
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
  return result ? transformEvent(result) : null
}

/**
 * 更新本地事件
 */
export async function invokeUpdateEvent(params: {
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
}): Promise<CalendarEvent | null> {
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
  return result ? transformEvent(result) : null
}

/**
 * 删除本地事件
 */
export async function invokeDeleteEvent(id: number): Promise<boolean> {
  const result = await safeInvoke<boolean>('delete_event', { id })
  return result ?? false
}

/**
 * 获取所有待办事项
 */
export async function invokeGetTodos(): Promise<Todo[]> {
  const result = await safeInvoke<RawTodo[]>('get_todos')
  return result?.map(transformTodo) ?? []
}

/**
 * 创建待办事项
 */
export async function invokeCreateTodo(params: {
  title: string
  description?: string
  dueDate?: number
  completed?: boolean
  priority?: string
  calendarId: number
}): Promise<Todo | null> {
  const result = await safeInvoke<RawTodo>('create_todo', {
    title: params.title,
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,
    completed: params.completed ?? null,
    priority: params.priority ?? null,
    calendarId: params.calendarId,
  })
  return result ? transformTodo(result) : null
}

/**
 * 更新待办事项
 */
export async function invokeUpdateTodo(params: {
  id: number
  title?: string
  description?: string
  dueDate?: number
  completed?: boolean
  priority?: string
  calendarId?: number
}): Promise<Todo | null> {
  const result = await safeInvoke<RawTodo>('update_todo', {
    id: params.id,
    title: params.title ?? null,
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,
    completed: params.completed ?? null,
    priority: params.priority ?? null,
    calendarId: params.calendarId ?? null,
  })
  return result ? transformTodo(result) : null
}

/**
 * 删除待办事项
 */
export async function invokeDeleteTodo(id: number): Promise<boolean> {
  const result = await safeInvoke<boolean>('delete_todo', { id })
  return result ?? false
}

/**
 * 获取所有账号（数据库版本）
 */
export async function invokeGetAllDbAccounts(): Promise<ReturnType<typeof transformAccount>[]> {
  const result = await safeInvoke<RawAccount[]>('get_all_db_accounts')
  return result?.map(transformAccount) ?? []
}

/**
 * 根据服务器地址和用户名查找账号
 */
export async function invokeGetAccountByServerUrl(serverUrl: string, username: string): Promise<ReturnType<typeof transformAccount> | null> {
  const accounts = await invokeGetAllDbAccounts()
  return accounts.find(a => a.serverUrl === serverUrl && a.username === username) ?? null
}

/**
 * 保存外部账号（创建或更新）
 */
export async function invokeSaveAccount(account: {
  id?: string
  type: string
  serverUrl: string
  username: string
  encryptedPassword: string
  displayName?: string
  enabled: boolean
}): Promise<ReturnType<typeof transformAccount> | null> {
  // 如果有 id 且能转换为数字，说明是更新已有账号
  const existingId = account.id ? parseInt(account.id, 10) : NaN
  
  if (!isNaN(existingId) && existingId > 0) {
    // 更新已有账号
    const result = await safeInvoke<RawAccount>('update_account', {
      id: existingId,
      accountType: account.type,
      serverUrl: account.serverUrl,
      username: account.username,
      encryptedPassword: account.encryptedPassword,
      displayName: account.displayName ?? null,
      enabled: account.enabled,
    })
    return result ? transformAccount(result) : null
  } else {
    // 创建新账号
    const result = await safeInvoke<RawAccount>('create_account', {
      accountType: account.type,
      serverUrl: account.serverUrl,
      username: account.username,
      encryptedPassword: account.encryptedPassword,
      displayName: account.displayName ?? null,
      enabled: account.enabled,
    })
    return result ? transformAccount(result) : null
  }
}

// 带错误信息的 Tauri invoke（用于连接命令）
export async function safeInvokeWithResult(command: string, args?: Record<string, any>): Promise<ConnectResult> {
  if (!isTauri()) {
    console.log(`Tauri not available, skipping invoke: ${command}`)
    return { success: false, error: 'Tauri 环境不可用' }
  }
  
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const result = await invoke<ConnectResult>(command, args)
    return result
  } catch (error) {
    console.error(`Failed to invoke ${command}:`, error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMessage }
  }
}

// 自启动相关 - 使用 @tauri-apps/plugin-autostart
export async function setAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauri()) {
    console.log('Tauri not available, skipping autostart setting')
    return false
  }
  
  try {
    if (enabled) {
      await enable()
    } else {
      await disable()
    }
    return true
  } catch (error) {
    console.error('Failed to set autostart:', error)
    return false
  }
}

export async function getAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) {
    console.log('Tauri not available, skipping autostart check')
    return false
  }
  
  try {
    return await isEnabled()
  } catch (error) {
    console.error('Failed to get autostart status:', error)
    return false
  }
}

// 窗口控制
export async function minimizeToTray(): Promise<void> {
  await safeInvoke('minimize_to_tray')
}

export async function showMainWindow(): Promise<void> {
  await safeInvoke('show_main_window')
}

export async function hideMainWindow(): Promise<void> {
  await safeInvoke('hide_main_window')
}

export async function isWindowVisible(): Promise<boolean> {
  const result = await safeInvoke<boolean>('is_window_visible')
  return result ?? false
}

// 总在最前
export async function toggleAlwaysOnTop(): Promise<boolean> {
  const result = await safeInvoke<boolean>('toggle_always_on_top')
  return result ?? false
}

export async function getAlwaysOnTop(): Promise<boolean> {
  const result = await safeInvoke<boolean>('get_always_on_top')
  return result ?? false
}

// 自动隐藏
export async function toggleAutoHide(): Promise<boolean> {
  const result = await safeInvoke<boolean>('toggle_auto_hide')
  return result ?? false
}

export async function getAutoHide(): Promise<boolean> {
  const result = await safeInvoke<boolean>('get_auto_hide')
  return result ?? false
}

// ==================== 外部日历相关 ====================

// 同步相关常量
export const SYNC_DEFAULT_INTERVAL_MINUTES = 15
export const SYNC_WINDOW_PAST_DAYS = 30
export const SYNC_WINDOW_FUTURE_DAYS = 90

// 外部日历连接
// 对于 Exchange，serverUrl 可以为空（将自动使用 Autodiscover 发现）
export async function invokeConnectExchange(serverUrl: string | null, username: string, password: string) {
  return safeInvokeWithResult('connect_exchange', { server_url: serverUrl, username, password })
}

export async function invokeConnectCalDAV(serverUrl: string, username: string, password: string) {
  return safeInvokeWithResult('connect_caldav', { serverUrl, username, password })
}

// 外部日历同步
export async function invokeSyncCalendar(accountId: string) {
  return safeInvoke<any>('sync_now', { accountId })
}

export async function invokeSyncAllCalendars() {
  return safeInvoke<any>('sync_all')
}

// 获取外部日历列表
export async function invokeGetExternalCalendars(account: any) {
  console.log('[invokeGetExternalCalendars] account:', account)
  const result = await safeInvoke<any[]>('get_external_calendars', {
    accountId: account.id || '',
    accountType: account.type || '',
    serverUrl: account.serverUrl || '',
    username: account.username || '',
    encryptedPassword: account.encryptedPassword || ''
  })
  // Rust serde 默认输出 snake_case，这里手动映射 read_only -> readOnly
  return result?.map(cal => ({
    ...cal,
    readOnly: cal.read_only ?? false,
  })) ?? null
}

// 获取所有外部账号（使用 Rust 后端）
export async function invokeGetAllAccounts() {
  return invokeGetAllDbAccounts()
}

// 删除外部账号
export async function invokeDeleteAccount(accountId: string) {
  return safeInvoke<void>('delete_account', { accountId })
}

// 获取同步状态
export async function invokeGetSyncStatus(accountId: string) {
  return safeInvoke<any>('get_sync_status', { accountId })
}

// 设置同步间隔
export async function invokeSetSyncInterval(minutes: number) {
  return safeInvoke<void>('set_sync_interval', { minutes })
}
