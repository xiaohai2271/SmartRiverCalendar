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
