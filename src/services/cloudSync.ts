// 云端同步服务
// 提供云同步触发、状态查询、自动同步等功能

import { safeInvoke } from '../utils/tauri'
import { useAuthStore } from '../stores/auth'
import { useCapabilities } from '@/platform/provider'
import { usePlatform } from '@/platform/provider'

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

// Tauri 事件监听器
let tauriEventUnlisteners: (() => void)[] = []

// 网络状态监听器清理函数
let networkListenerCleanup: (() => void) | null = null

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
 * 桌面端通过 Tauri invoke 调用 Rust 后端同步
 * Web 端通过 syncRepo 调用远端 API
 */
export const cloudSyncService = {
  /**
   * 触发手动同步
   */
  async triggerSync(): Promise<boolean> {
    const capabilities = useCapabilities()

    if (!capabilities.hasOfflineMode) {
      // Web 端：通过 syncRepo 同步
      try {
        const { syncRepo } = usePlatform()
        const result = await syncRepo.triggerCloudSync()
        return result
      } catch (error) {
        console.error('[cloudSync] Web 端同步失败:', error)
        return false
      }
    }

    // 桌面端：通过 Tauri invoke 同步
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
      // 同步失败时标记为离线状态
      authStore.syncStatus = 'offline'
      return false
    }
  },

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatusResponse | null> {
    const capabilities = useCapabilities()

    if (!capabilities.hasOfflineMode) {
      // Web 端暂不支持获取详细同步状态
      return null
    }

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

    const capabilities = useCapabilities()
    if (!capabilities.hasOfflineMode) return

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
   * 初始化 Tauri 事件监听（仅桌面端）
   */
  async initEventListeners(): Promise<void> {
    const capabilities = useCapabilities()
    if (!capabilities.hasOfflineMode) return

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
  },

  /**
   * 监听网络状态变化
   * 网络恢复时自动触发同步，网络断开时标记离线状态
   */
  initNetworkListener(): void {
    if (typeof window === 'undefined') return

    // 先清理已有的监听器
    this.cleanupNetworkListener()

    const onlineHandler = () => {
      const authStore = useAuthStore()
      if (authStore.isAuthenticated && authStore.syncStatus === 'offline') {
        console.log('[cloudSync] 网络恢复，触发自动同步')
        this.triggerSync()
      }
    }

    const offlineHandler = () => {
      const authStore = useAuthStore()
      console.log('[cloudSync] 网络断开，标记为离线状态')
      authStore.syncStatus = 'offline'
    }

    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)

    // 保存清理函数
    networkListenerCleanup = () => {
      window.removeEventListener('online', onlineHandler)
      window.removeEventListener('offline', offlineHandler)
      networkListenerCleanup = null
    }

    console.log('[cloudSync] 网络状态监听已初始化')
  },

  /**
   * 清理网络状态监听
   */
  cleanupNetworkListener(): void {
    if (networkListenerCleanup) {
      networkListenerCleanup()
      console.log('[cloudSync] 网络状态监听已清理')
    }
  }
}
