/**
 * SSO 会话协调器
 *
 * 负责协调 Web 端 SSO 会话的三大检测机制：
 * 1. visibilitychange 事件：标签页切回前台时立即重新校验登录态
 * 2. 定时轮询：跨子域场景下 BroadcastChannel 不可用时的兜底机制
 * 3. BroadcastChannel 订阅：同源标签页间实时同步登录态变更事件
 *
 * 跨子域 BroadcastChannel 降级策略：
 * - 同源标签页（如多个 app.menghuan.life 标签）：BroadcastChannel 实时同步
 * - 跨子域标签页（如 app.menghuan.life 与 web.menghuan.life）：
 *   BroadcastChannel 不可用，依赖 visibilitychange + 定时轮询检测
 * - 轮询间隔默认 30 秒，可通过 VITE_SSO_POLL_INTERVAL_MS 环境变量覆盖
 */

import type { IAuthRepository, SsoSessionResult, SsoEvent } from '../types/auth.repository'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** SsoCoordinator 配置 */
export interface SsoCoordinatorOptions {
  /** 会话状态变更回调 */
  onSessionChange: (result: SsoSessionResult) => void
  /** 轮询间隔（毫秒），默认 30000 */
  pollIntervalMs?: number
}

/** SSO 会话协调器 */
export class SsoCoordinator {
  private authRepo: IAuthRepository
  private options: SsoCoordinatorOptions
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private abortController: AbortController | null = null
  private unsubscribeSso: (() => void) | null = null
  private isRunning = false

  constructor(authRepo: IAuthRepository, options: SsoCoordinatorOptions) {
    this.authRepo = authRepo
    this.options = options
  }

  /**
   * 启动 SSO 会话协调器
   *
   * 注册 visibilitychange 监听 + 启动定时轮询 + 订阅 BroadcastChannel
   */
  start(options?: Partial<SsoCoordinatorOptions>): void {
    if (this.isRunning) {
      console.warn('[SsoCoordinator] 已在运行中，忽略重复启动')
      return
    }

    // 合并选项
    if (options) {
      this.options = { ...this.options, ...options }
    }

    this.isRunning = true

    // 1. 注册 visibilitychange 监听
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    // 2. 启动定时轮询
    this.startPolling()

    // 3. 订阅 BroadcastChannel 事件
    this.unsubscribeSso = this.authRepo.subscribeSsoEvents(this.handleSsoEvent)

    console.info('[SsoCoordinator] 已启动')
  }

  /**
   * 停止 SSO 会话协调器
   *
   * 清理所有监听器 + 清除定时器 + 取消订阅
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    // 1. 移除 visibilitychange 监听
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)

    // 2. 清除定时器
    this.stopPolling()

    // 3. 清除 debounce 定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    // 4. 取消进行中的请求
    this.abortController?.abort()
    this.abortController = null

    // 5. 取消 BroadcastChannel 订阅
    this.unsubscribeSso?.()
    this.unsubscribeSso = null

    console.info('[SsoCoordinator] 已停止')
  }

  /** 获取轮询间隔，优先使用环境变量 */
  private getPollIntervalMs(): number {
    const envValue = import.meta.env.VITE_SSO_POLL_INTERVAL_MS
    if (envValue) {
      const parsed = Number(envValue)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    return this.options.pollIntervalMs ?? 30000
  }

  /** 启动定时轮询 */
  private startPolling(): void {
    this.stopPolling()
    const interval = this.getPollIntervalMs()
    this.pollTimer = setInterval(() => {
      this.detectSession()
    }, interval)
  }

  /** 停止定时轮询 */
  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /** visibilitychange 事件处理 */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      // 标签页切回前台：恢复轮询 + 200ms debounce 检测
      this.startPolling()
      this.debouncedDetect()
    } else {
      // 标签页切到后台：暂停轮询节省流量
      this.stopPolling()
    }
  }

  /** 200ms debounce 检测，避免频繁切换标签页触发多次请求 */
  private debouncedDetect(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // 取消上一次未完成的请求
    this.abortController?.abort()
    this.abortController = new AbortController()

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.detectSession()
    }, 200)
  }

  /** 检测 SSO 会话状态 */
  private async detectSession(): Promise<void> {
    try {
      const result = await this.authRepo.detectSsoSession()
      this.options.onSessionChange(result)
    } catch (error) {
      if (error instanceof RepositoryError && error.code === RepoErrorCodes.SSO_SESSION_EXPIRED) {
        // SSO 会话过期，通知上层处理
        this.options.onSessionChange({ loggedIn: false })
        return
      }
      // 其他错误不阻塞，静默处理
      console.warn('[SsoCoordinator] detectSession 错误:', error)
    }
  }

  /** BroadcastChannel SSO 事件回调 */
  private handleSsoEvent = (event: SsoEvent): void => {
    if (event.type === 'logout') {
      // 同源标签页登出：清空本地态，不调后端避免重复
      this.options.onSessionChange({ loggedIn: false })
    } else if (event.type === 'login') {
      // 同源标签页登录：触发检测同步用户
      this.detectSession()
    }
  }
}
