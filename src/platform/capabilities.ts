/** 平台能力定义 */
export interface PlatformCapabilities {
  // ─── 数据存储 ───
  /** 是否有本地数据库（离线可用） */
  hasLocalDatabase: boolean
  /** 是否支持离线模式 */
  hasOfflineMode: boolean
  /** 数据优先级 */
  dataPriority: 'local-first' | 'remote-first'

  // ─── 提醒系统 ───
  /** 是否支持应用内提醒弹窗 */
  hasReminderPopup: boolean
  /** 是否支持系统/浏览器原生通知 */
  hasSystemNotification: boolean
  /** 是否支持稍后提醒（snooze） */
  hasSnoozeReminder: boolean

  // ─── 外部日历 ───
  /** 是否支持 Exchange EWS 连接 */
  hasExchangeSupport: boolean
  /** 是否支持 CalDAV 连接 */
  hasCalDavSupport: boolean
  /** 是否支持外部日历实时同步 */
  hasExternalSync: boolean

  // ─── 系统集成 ───
  /** 是否支持系统托盘 */
  hasSystemTray: boolean
  /** 是否支持开机自启 */
  hasAutoStart: boolean
  /** 是否支持时钟点击检测 */
  hasClockHook: boolean
  /** 是否支持多窗口 */
  hasMultiWindow: boolean
  /** 是否支持自动更新 */
  hasAutoUpdate: boolean
  /** 是否支持始终置顶 */
  hasAlwaysOnTop: boolean
  /** 是否支持最小化到托盘 */
  hasMinimizeToTray: boolean
  /** 是否支持代理设置 */
  hasProxySettings: boolean

  // ─── 认证 ───
  /** 是否支持 OAuth 本地回调（需要本地 HTTP 服务器） */
  hasOAuthCallback: boolean
  /** 是否支持 SSO 登录（Web 端 cookie 会话检测） */
  hasSsoLogin: boolean

  // ─── 同步策略能力 ───

  /**
   * 是否支持后台同步
   * - 桌面端：true（应用可在后台持续运行同步）
   * - 移动端：false（OS 限制后台活动，如 Doze 模式，同步仅在活跃期执行）
   * - Web端：false（标签页不可靠）
   */
  hasBackgroundSync: boolean

  /**
   * 是否需要增量同步
   * - 桌面端：false（首期全量同步，网络稳定可接受）
   * - 移动端：true（减少流量消耗，缩短同步窗口）
   * - Web端：false（数据天然在线，不适用）
   */
  hasIncrementalSync: boolean

  /**
   * 是否需要客户端冲突解决
   * - 桌面端/移动端：true（本地数据可能与服务端冲突）
   * - Web端：false（服务端处理冲突）
   */
  hasClientConflictResolution: boolean
}
