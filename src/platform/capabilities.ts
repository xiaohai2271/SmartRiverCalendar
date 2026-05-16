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
}
