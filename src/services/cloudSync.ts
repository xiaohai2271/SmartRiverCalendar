// 云端同步服务
// 提供云同步触发、状态查询、自动同步等功能
// 所有数据操作通过 syncRepo 完成，不再直接调用 Tauri API
// 事件监听通过 syncRepo 封装，不在 platform 层外导入 @tauri-apps/*

import { useAuthStore } from '../stores/auth'
import { useCapabilities } from '@/platform/provider'
import { usePlatform } from '@/platform/provider'

// 自动同步定时器
let autoSyncInterval: ReturnType<typeof setInterval> | null = null

// syncRepo 事件取消监听函数
let syncRepoUnlisteners: (() => void)[] = []

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
    const { syncRepo } = usePlatform()
    const authStore = useAuthStore()

    if (!authStore.isAuthenticated) {
      console.warn('[cloudSync] 未登录，无法同步')
      return false
    }

    try {
      authStore.syncStatus = 'syncing'
      const result = await syncRepo.triggerCloudSync()
      if (result) {
        authStore.syncStatus = 'success'
        authStore.lastSyncAt = Date.now()

        // 同步成功后，重新从数据库加载数据到各 Store
        try {
          const { useCalendarStore } = await import('../stores/calendar')
          const { useTodoStore } = await import('../stores/todo')
          const calendarStore = useCalendarStore()
          const todoStore = useTodoStore()
          await Promise.all([
            calendarStore.reloadFromDatabase(),
            todoStore.reloadFromDatabase(),
          ])
          console.log('[cloudSync] 同步后数据已刷新')
        } catch (reloadError) {
          console.error('[cloudSync] 同步后数据刷新失败:', reloadError)
        }

        return true
      }
      authStore.syncStatus = 'error'
      return false
    } catch (error) {
      console.error('[cloudSync] 同步失败:', error)
      authStore.syncStatus = 'offline'
      return false
    }
  },

  /**
   * 获取同步状态
   */
  async getSyncStatus(): Promise<SyncStatusResponse | null> {
    try {
      const { syncRepo } = usePlatform()
      const result = await syncRepo.getSyncStatus()
      return {
        status: result.status as CloudSyncStatus,
        lastSyncAt: result.lastSyncAt,
        pendingChanges: result.pendingChanges,
      }
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

    const { syncRepo } = usePlatform()
    syncRepo.startAutoSync(intervalMinutes)

    // 同时启动本地定时器检查认证状态后触发同步
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
    }
    try {
      const { syncRepo } = usePlatform()
      syncRepo.stopAutoSync()
    } catch {
      // Provider 未初始化时忽略
    }
    console.log('[cloudSync] 自动同步已停止')
  },

  /**
   * 初始化 syncRepo 事件监听（替代直接使用 @tauri-apps/api/event）
   */
  async initEventListeners(): Promise<void> {
    const capabilities = useCapabilities()
    if (!capabilities.hasBackgroundSync) return

    try {
      const { syncRepo } = usePlatform()

      // 监听同步完成事件
      const unlisten1 = await syncRepo.onSyncComplete(() => {
        const authStore = useAuthStore()
        authStore.syncStatus = 'success'
        authStore.lastSyncAt = Date.now()
        console.log('[cloudSync] 同步完成')
      })

      // 监听同步错误事件
      const unlisten2 = await syncRepo.onSyncError(() => {
        const authStore = useAuthStore()
        authStore.syncStatus = 'error'
        console.warn('[cloudSync] 同步出错')
      })

      // 监听 Token 过期事件
      const unlisten3 = await syncRepo.onAuthTokenExpired(async () => {
        const authStore = useAuthStore()
        await authStore.logout()
        console.warn('[cloudSync] Token 已过期，已退出登录')
      })

      syncRepoUnlisteners.push(unlisten1, unlisten2, unlisten3)
      console.log('[cloudSync] 事件监听已初始化')
    } catch (error) {
      console.error('[cloudSync] 事件监听初始化失败:', error)
    }
  },

  /**
   * 清理事件监听
   */
  cleanupEventListeners(): void {
    syncRepoUnlisteners.forEach(unlisten => unlisten())
    syncRepoUnlisteners = []
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
