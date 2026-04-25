// Calendar Event Types
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: number // Unix timestamp (milliseconds)
  endTime: number
  allDay: boolean
  calendarId: string
  externalId?: string
  color?: string
  reminder?: number // minutes before
  repeatRule?: RepeatRule
  location?: string
  createdAt: number
  updatedAt: number
}

export interface RepeatRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  interval: number // every N days/weeks/months/years
  endDate?: number // when to stop repeating
  count?: number // how many times to repeat
  daysOfWeek?: number[] // for weekly: 0=Sunday, 1=Monday, etc.
  dayOfMonth?: number // for monthly
}

// Calendar
export interface Calendar {
  id: string
  name: string
  color: string
  type: 'local' | 'exchange' | 'caldav'
  accountId?: string
  // 外部日历的账号信息
  accountType?: string
  serverUrl?: string
  username?: string
  encryptedPassword?: string
  // 日历的 URL（用于 CalDAV 创建事件）
  calendarUrl?: string
  // 是否为只读日历（如共享/订阅日历，不允许写入）
  readOnly?: boolean
  visible: boolean
  syncEnabled: boolean
  syncStatus?: 'idle' | 'syncing' | 'error' | 'success'
  lastSync?: number
}

// Todo
export interface Todo {
  id: string
  title: string
  description?: string
  dueDate?: number
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  calendarId: string
  createdAt: number
  updatedAt: number
}

// Time Block
export interface TimeBlock {
  id: string
  title: string
  startTime: number
  endTime: number
  type: 'work' | 'break' | 'meeting' | 'focus' | 'personal'
  color?: string
  calendarId: string
  pomodoroCount?: number
}

// App Settings
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto'
  defaultView: 'day' | 'week' | 'month' | 'year'
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sunday
  defaultReminder: number // minutes
  startMinimized: boolean
  autoStart: boolean
  autoUpdate: boolean // 自动更新
  // 日历显示设置
  showLunar: boolean // 显示农历
  showLunarFestival: boolean // 显示农历节日
  showSolarTerm: boolean // 显示节气
  showHoliday: boolean // 显示法定节假日
  showMakeupDay: boolean // 显示补休/调休
  showWeekend: boolean // 周末标识
  // 提醒设置
  allDayReminderTime: 'evening_before' | 'morning' // 全天事件提醒时间
  allDayReminderHour: number // 全天事件提醒小时（默认9）
  reminderMode: 'standard' | 'strong' | 'silent' // 提醒强度
  customReminderTitle: string // 自定义通知标题模板
  customReminderBody: string // 自定义通知正文模板
  // 系统集成设置
  clockHookEnabled: boolean // 是否启用系统时钟点击唤醒
  clockHookBlockPopup: boolean // 是否阻止系统日历弹窗
}

// View types
export type CalendarView = 'day' | 'week' | 'month' | 'year'

// Date navigation
export interface DateRange {
  start: Date
  end: Date
}

// 外部日历账户
export interface ExternalAccount {
  id: string
  type: 'exchange' | 'caldav'
  serverUrl: string
  username: string
  encryptedPassword?: string
  displayName?: string
  enabled: boolean
  lastSyncAt?: number
  createdAt: number
  updatedAt: number
}

// 同步状态
export interface SyncState {
  accountId: string
  calendarId: string
  syncToken?: string
  lastSyncAt?: number
  syncWindowStart?: number
  syncWindowEnd?: number
}

// 外部日历信息
export interface ExternalCalendarInfo {
  externalId: string
  name: string
  color?: string
  accountId: string
}

// 同步状态类型
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

// CalDAV 日历信息（用于连接结果）
export interface CalDavCalendarInfo {
  id: string
  name: string
  color?: string
  url: string
}

// 账号信息（用于连接结果）
export interface AccountInfo {
  id: string
  account_type: 'exchange' | 'caldav'
  server_url: string
  username: string
  encrypted_password: string
  display_name: string
  enabled: boolean
  last_sync?: number
}

// 连接结果类型（用于外部日历连接）
export interface ConnectResult {
  success: boolean
  error?: string
  account?: AccountInfo
  calendars?: CalDavCalendarInfo[]
}

// 弹出面板窗口尺寸
export type PopupWindowSize = 'small' | 'medium' | 'large'

// 弹出面板窗口尺寸常量
export const POPUP_WINDOW_SIZES = {
  small: { width: 280, height: 400 },
  medium: { width: 340, height: 480 },
  large: { width: 400, height: 560 }
} as const

// 弹出面板设置
export interface PopupSettings {
  popupShowLunar: boolean // 显示农历
  popupShowLunarFestival: boolean // 显示农历节日
  popupShowSolarTerm: boolean // 显示节气
  popupShowHoliday: boolean // 显示法定节假日
  popupShowEvents: boolean // 显示事件
  popupCalendarShowLunar: boolean // 日历网格显示农历
  popupCalendarHolidayColor: 'default' | 'soft' | 'high-contrast' // 节假日颜色模式
  popupWindowSize?: PopupWindowSize // 弹出窗口尺寸
}

// 弹出面板右键菜单动作类型
export type PopupContextMenuAction =
  | 'createEvent' // 创建事件
  | 'viewEvents' // 查看事件列表
  | 'viewEventDetail' // 查看事件详情
  | 'createTodo' // 创建待办
  | 'viewTodos' // 查看待办列表
  | 'openMain' // 在主界面打开

// 弹出面板导航载荷
export interface PopupNavigationPayload {
  action: PopupContextMenuAction
  date: string // ISO 日期字符串
  eventId?: string // 事件 ID（用于查看详情）
}

// 窗口切换请求
export interface WindowToggleRequest {
  source: string // 请求来源窗口标识
  monitorType?: string // 显示器类型
  clockRect?: {
    // 时钟区域坐标
    left: number
    top: number
    right: number
    bottom: number
  }
}

// 更新信息
export interface UpdateInfo {
  /** 新版本号 */
  version: string
  /** 更新说明 */
  body?: string
  /** 发布日期 */
  date?: string
}