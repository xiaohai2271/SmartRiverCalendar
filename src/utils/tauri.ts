// Tauri API 工具函数
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'

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
  return safeInvoke<any>('connect_exchange', { server_url: serverUrl, username, password })
}

export async function invokeConnectCalDAV(serverUrl: string, username: string, password: string) {
  return safeInvoke<any>('connect_caldav', { serverUrl, username, password })
}

// 外部日历同步
export async function invokeSyncCalendar(accountId: string) {
  return safeInvoke<any>('sync_now', { accountId })
}

export async function invokeSyncAllCalendars() {
  return safeInvoke<any>('sync_all')
}

// 获取外部日历列表
export async function invokeGetExternalCalendars(accountId: string) {
  return safeInvoke<any[]>('get_external_calendars', { accountId })
}

// 获取所有外部账号
export async function invokeGetAllAccounts() {
  return safeInvoke<any[]>('get_all_accounts')
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
