/**
 * 跨窗口广播通道工具
 * 用于在不同窗口间同步设置变更
 */

// 设置变更广播通道
const SETTINGS_CHANNEL_NAME = 'smartriver-settings-channel'
export const settingsChannel = new BroadcastChannel(SETTINGS_CHANNEL_NAME)

/**
 * 广播设置变更
 * @param key 设置键名
 * @param value 新值
 */
export function broadcastSettingsChange(key: string, value: unknown): void {
  try {
    settingsChannel.postMessage({
      type: 'settings-change',
      key,
      value,
      timestamp: Date.now()
    })
    console.log(`[Broadcast] 设置变更已广播: ${key} =`, value)
  } catch (error) {
    console.error('[Broadcast] 广播设置变更失败:', error)
  }
}

/**
 * 监听设置变更
 * @param callback 变更回调函数
 * @returns 取消监听函数
 */
export function onSettingsChange(
  callback: (key: string, value: unknown) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'settings-change') {
      callback(event.data.key, event.data.value)
    }
  }

  settingsChannel.addEventListener('message', handler)

  // 返回取消监听函数
  return () => {
    settingsChannel.removeEventListener('message', handler)
  }
}

/**
 * 广播窗口切换请求
 * @param request 切换请求载荷
 */
export function broadcastWindowToggleRequest(request: WindowToggleRequest): void {
  try {
    settingsChannel.postMessage({
      type: 'window-toggle-request',
      ...request,
      timestamp: Date.now()
    })
    console.log('[Broadcast] 窗口切换请求已广播:', request)
  } catch (error) {
    console.error('[Broadcast] 广播窗口切换请求失败:', error)
  }
}

/**
 * 监听窗口切换请求
 * @param callback 切换请求回调函数
 * @returns 取消监听函数
 */
export function onWindowToggleRequest(
  callback: (request: WindowToggleRequest) => void
): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'window-toggle-request') {
      callback(event.data as WindowToggleRequest)
    }
  }

  settingsChannel.addEventListener('message', handler)

  return () => {
    settingsChannel.removeEventListener('message', handler)
  }
}

// 导入类型定义
import type { WindowToggleRequest } from '../types'
