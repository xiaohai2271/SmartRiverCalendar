// 云端同步服务
// 提供云同步触发、状态查询、自动同步等功能

import { safeInvoke, isTauri } from '../utils/tauri'
import { useAuthStore } from '../stores/auth'

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

// Tauri 事件监听器
let tauriEventUnlisteners: (() => void)[] = []

// 同步状态
export type CloudSyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

// 同步状态响应
export interface SyncStatusResponse {
  status: CloudSyncStatus
  lastSyncAt: number | null
  pendingChanges: number
}

/**
 * 云同步服务
 */
export const cloudSyncService = {
  /**
   * 触发手动同步
   */
  async triggerSync(): Promise<boolean> {
    if (!isTauri()) {
      console.warn('[cloudSync] 非 Tauri 环境，跳过同步')
      return false
    }

    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      console.warn('[cloudSync] 未登录，无法同步')
      return false
    }

    try {
      authStore.syncStatus = 'syncing'
      const result = await safeInvoke<{ success: boolean }>('cloud_sync_trigger')
      if (result?.success) {
        authStore.syncStatus = 'success'
        authStore.lastSyncAt = Date.now()
        return true
      }
      authStore.syncStatus = 'error'
      return false
    } catch (error) {
      console.error('[cloudSync] 同步失败:', error)
      authStore.syncStatus = 'error'
      return false
    }
  },

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatusResponse | null> {
    if (!isTauri()) return null

    try {
      return await safeInvoke<SyncStatusResponse>('cloud_sync_get_status')
    } catch (error) {
      console.error('[cloudSync] 获取同步状态失败:', error)
      return null
    }
  },

  /**
   * 启动自动同步
   * @param intervalMinutes 同步间隔（分钟），默认 5 分钟
   */
  startAutoSync(intervalMinutes: number = 5): void {
    this.stopAutoSync()

    if (!isTauri()) return

    const intervalMs = intervalMinutes * 60 * 1000
    autoSyncInterval = setInterval(async () => {
      const authStore = useAuthStore()
      if (authStore.isAuthenticated && authStore.syncStatus !== 'syncing') {
        await this.triggerSync()
      }
    }, intervalMs)

    console.log(`[cloudSync] 自动同步已启动，间隔 ${intervalMinutes} 分钟`)
  },

  /**
   * 停止自动同步
   */
  stopAutoSync(): void {
    if (autoSyncInterval) {
      clearInterval(autoSyncInterval)
      autoSyncInterval = null
      console.log('[cloudSync] 自动同步已停止')
    }
  },

  /**
   * 初始化 Tauri 事件监听
   */
  async initEventListeners(): Promise<void> {
    if (!isTauri()) return

    try {
      const { listen } = await import('@tauri-apps/api/event')

      // 监听同步完成事件
      const unlisten1 = await listen('sync-complete', () => {
        const authStore = useAuthStore()
        authStore.syncStatus = 'success'
        authStore.lastSyncAt = Date.now()
        console.log('[cloudSync] 同步完成')
      })

      // 监听同步错误事件
      const unlisten2 = await listen('sync-error', () => {
        const authStore = useAuthStore()
        authStore.syncStatus = 'error'
        console.warn('[cloudSync] 同步出错')
      })

      // 监听 Token 过期事件
      const unlisten3 = await listen('auth-token-expired', async () => {
        const authStore = useAuthStore()
        await authStore.logout()
        console.warn('[cloudSync] Token 已过期，已退出登录')
      })

      tauriEventUnlisteners.push(unlisten1, unlisten2, unlisten3)
      console.log('[cloudSync] 事件监听已初始化')
    } catch (error) {
      console.error('[cloudSync] 事件监听初始化失败:', error)
    }
  },

  /**
   * 清理事件监听
   */
  cleanupEventListeners(): void {
    tauriEventUnlisteners.forEach(unlisten => unlisten())
    tauriEventUnlisteners = []
  }
}