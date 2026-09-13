/**
 * 前端同步服务
 *
 * 通过 Repository 接口完成同步操作，不再直接调用 Tauri API。
 * 注意：实际项目中主要使用 cloudSyncService，此类保留作为备选。
 */

import { usePlatform, useCapabilities } from '@/platform/provider'
import type { SyncStatus } from '../types'

/**
 * 同步结果接口
 */
export interface SyncResult {
  accountId: string
  success: boolean
  eventsAdded: number
  eventsUpdated: number
  eventsDeleted: number
  error?: string
  timestamp: number
}

/**
 * 同步事件回调类型
 */
type SyncStartCallback = () => void
type SyncCompleteCallback = (result: SyncResult) => void
type SyncErrorCallback = (error: string) => void

/**
 * 事件回调列表
 */
const syncStartCallbacks: SyncStartCallback[] = []
const syncCompleteCallbacks: SyncCompleteCallback[] = []
const syncErrorCallbacks: SyncErrorCallback[] = []

/**
 * Tauri 事件监听器
 */
let tauriEventListener: (() => void) | null = null

/**
 * 触发同步开始回调
 */
function triggerSyncStart(): void {
  syncStartCallbacks.forEach(callback => {
    try {
      callback()
    } catch (error) {
      console.error('同步开始回调执行失败:', error)
    }
  })
}

/**
 * 触发同步完成回调
 */
function triggerSyncComplete(result: SyncResult): void {
  syncCompleteCallbacks.forEach(callback => {
    try {
      callback(result)
    } catch (error) {
      console.error('同步完成回调执行失败:', error)
    }
  })
}

/**
 * 触发同步错误回调
 */
function triggerSyncError(error: string): void {
  syncErrorCallbacks.forEach(callback => {
    try {
      callback(error)
    } catch (err) {
      console.error('同步错误回调执行失败:', err)
    }
  })
}

/**
 * 初始化事件监听
 * 通过能力判断是否在支持后台同步的平台
 */
async function initTauriEventListener(): Promise<void> {
  const capabilities = useCapabilities()
  if (!capabilities.hasBackgroundSync || tauriEventListener) return

  try {
    const { listen } = await import('@tauri-apps/api/event')

    const unlisten = await listen<SyncResult>('sync-status-changed', (event) => {
      const result = event.payload
      if (result.success) {
        triggerSyncComplete(result)
      } else {
        triggerSyncError(result.error || '同步失败')
      }
    })

    tauriEventListener = unlisten
    console.log('同步事件监听已初始化')
  } catch (error) {
    console.error('初始化同步事件监听失败:', error)
  }
}

/**
 * 同步服务类
 */
export class SyncService {
  /**
   * 启动自动同步
   */
  startAutoSync(intervalMinutes: number): void {
    // 初始化事件监听
    initTauriEventListener()

    const { syncRepo } = usePlatform()
    syncRepo.startAutoSync(intervalMinutes)
    console.log(`启动自动同步，间隔: ${intervalMinutes} 分钟`)

    // 立即执行一次同步
    this.syncNow()
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    const { syncRepo } = usePlatform()
    syncRepo.stopAutoSync()

    // 清理事件监听
    if (tauriEventListener) {
      tauriEventListener()
      tauriEventListener = null
    }
  }

  /**
   * 立即同步
   */
  async syncNow(): Promise<void> {
    triggerSyncStart()

    try {
      const { syncRepo } = usePlatform()
      const result = await syncRepo.triggerCloudSync()
      if (result) {
        triggerSyncComplete({
          accountId: '',
          success: true,
          eventsAdded: 0,
          eventsUpdated: 0,
          eventsDeleted: 0,
          timestamp: Date.now(),
        })
      } else {
        triggerSyncError('同步失败：无法获取结果')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('同步失败:', errorMessage)
      triggerSyncError(errorMessage)
    }
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatus> {
    try {
      const { syncRepo } = usePlatform()
      const status = await syncRepo.getSyncStatus()
      return (status.status as SyncStatus) ?? 'idle'
    } catch (error) {
      console.error('获取同步状态失败:', error)
      return 'error'
    }
  }

  onSyncStart(callback: SyncStartCallback): void { syncStartCallbacks.push(callback) }
  onSyncComplete(callback: SyncCompleteCallback): void { syncCompleteCallbacks.push(callback) }
  onSyncError(callback: SyncErrorCallback): void { syncErrorCallbacks.push(callback) }

  offSyncStart(callback: SyncStartCallback): void {
    const index = syncStartCallbacks.indexOf(callback)
    if (index !== -1) syncStartCallbacks.splice(index, 1)
  }

  offSyncComplete(callback: SyncCompleteCallback): void {
    const index = syncCompleteCallbacks.indexOf(callback)
    if (index !== -1) syncCompleteCallbacks.splice(index, 1)
  }

  offSyncError(callback: SyncErrorCallback): void {
    const index = syncErrorCallbacks.indexOf(callback)
    if (index !== -1) syncErrorCallbacks.splice(index, 1)
  }

  isAutoSyncRunning(): boolean {
    return useCapabilities().hasBackgroundSync
  }
}

export const syncService = new SyncService()
