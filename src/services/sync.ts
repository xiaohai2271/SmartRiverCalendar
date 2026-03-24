// 前端同步服务
import { safeInvoke, isTauri } from '../utils/tauri'
import type { SyncStatus } from '../types'

// 同步结果接口
export interface SyncResult {
  accountId: string
  success: boolean
  eventsAdded: number
  eventsUpdated: number
  eventsDeleted: number
  error?: string
  timestamp: number
}

// 同步事件回调类型
type SyncStartCallback = () => void
type SyncCompleteCallback = (result: SyncResult) => void
type SyncErrorCallback = (error: string) => void

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

// 事件回调列表
const syncStartCallbacks: SyncStartCallback[] = []
const syncCompleteCallbacks: SyncCompleteCallback[] = []
const syncErrorCallbacks: SyncErrorCallback[] = []

// Tauri 事件监听器
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
 * @param result 同步结果
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
 * @param error 错误信息
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
 * 初始化 Tauri 事件监听
 */
async function initTauriEventListener(): Promise<void> {
  if (!isTauri() || tauriEventListener) return

  try {
    const { listen } = await import('@tauri-apps/api/event')

    // 监听同步状态变化事件
    const unlisten = await listen<SyncResult>('sync-status-changed', (event) => {
      const result = event.payload
      if (result.success) {
        triggerSyncComplete(result)
      } else {
        triggerSyncError(result.error || '同步失败')
      }
    })

    tauriEventListener = unlisten
    console.log('Tauri 同步事件监听已初始化')
  } catch (error) {
    console.error('初始化 Tauri 事件监听失败:', error)
  }
}

/**
 * 同步服务类
 */
export class SyncService {
  /**
   * 启动自动同步
   * @param intervalMinutes 同步间隔（分钟）
   */
  startAutoSync(intervalMinutes: number): void {
    if (autoSyncInterval) {
      console.log('自动同步已在运行')
      return
    }

    // 初始化 Tauri 事件监听
    initTauriEventListener()

    const intervalMs = intervalMinutes * 60 * 1000
    console.log(`启动自动同步，间隔: ${intervalMinutes} 分钟`)

    // 立即执行一次同步
    this.syncNow()

    // 设置定时同步
    autoSyncInterval = setInterval(() => {
      this.syncNow()
    }, intervalMs)
  }

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval)
      autoSyncInterval = null
      console.log('自动同步已停止')
    }

    // 清理 Tauri 事件监听
    if (tauriEventListener) {
      tauriEventListener()
      tauriEventListener = null
    }
  }

  /**
   * 立即同步
   * @param accountId 可选，指定账号 ID；不指定则同步所有账号
   */
  async syncNow(accountId?: string): Promise<void> {
    triggerSyncStart()

    try {
      if (accountId) {
        // 同步指定账号
        const result = await safeInvoke<SyncResult>('sync_now', { accountId })
        if (result) {
          triggerSyncComplete(result)
        } else {
          triggerSyncError('同步失败：无法获取结果')
        }
      } else {
        // 同步所有账号
        const result = await safeInvoke<SyncResult>('sync_all')
        if (result) {
          triggerSyncComplete(result)
        } else {
          triggerSyncError('同步失败：无法获取结果')
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('同步失败:', errorMessage)
      triggerSyncError(errorMessage)
    }
  }

  /**
   * 获取同步状态
   * @param accountId 账号 ID
   * @returns 同步状态
   */
  async getSyncStatus(accountId: string): Promise<SyncStatus> {
    try {
      const status = await safeInvoke<SyncStatus>('get_sync_status', { accountId })
      return status ?? 'idle'
    } catch (error) {
      console.error('获取同步状态失败:', error)
      return 'error'
    }
  }

  /**
   * 注册同步开始回调
   * @param callback 回调函数
   */
  onSyncStart(callback: SyncStartCallback): void {
    syncStartCallbacks.push(callback)
  }

  /**
   * 注册同步完成回调
   * @param callback 回调函数
   */
  onSyncComplete(callback: SyncCompleteCallback): void {
    syncCompleteCallbacks.push(callback)
  }

  /**
   * 注册同步错误回调
   * @param callback 回调函数
   */
  onSyncError(callback: SyncErrorCallback): void {
    syncErrorCallbacks.push(callback)
  }

  /**
   * 取消注册同步开始回调
   * @param callback 回调函数
   */
  offSyncStart(callback: SyncStartCallback): void {
    const index = syncStartCallbacks.indexOf(callback)
    if (index !== -1) {
      syncStartCallbacks.splice(index, 1)
    }
  }

  /**
   * 取消注册同步完成回调
   * @param callback 回调函数
   */
  offSyncComplete(callback: SyncCompleteCallback): void {
    const index = syncCompleteCallbacks.indexOf(callback)
    if (index !== -1) {
      syncCompleteCallbacks.splice(index, 1)
    }
  }

  /**
   * 取消注册同步错误回调
   * @param callback 回调函数
   */
  offSyncError(callback: SyncErrorCallback): void {
    const index = syncErrorCallbacks.indexOf(callback)
    if (index !== -1) {
      syncErrorCallbacks.splice(index, 1)
    }
  }

  /**
   * 检查自动同步是否正在运行
   * @returns 是否正在运行
   */
  isAutoSyncRunning(): boolean {
    return autoSyncInterval !== null
  }
}

// 导出单例实例
export const syncService = new SyncService()
