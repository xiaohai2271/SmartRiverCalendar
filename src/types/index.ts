// Calendar Event Types
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: number // Unix timestamp (milliseconds)
  endTime: number
  allDay: boolean
  calendarId: string
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
  type: 'local' | 'google' | 'outlook'
  accountId?: string
  visible: boolean
  syncEnabled: boolean
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
  language: 'zh-CN' | 'en-US'
  defaultView: 'day' | 'week' | 'month' | 'year'
  firstDayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0=Sunday
  defaultReminder: number // minutes
  startMinimized: boolean
  autoStart: boolean
  minimizeToTray: boolean
  // 日历显示设置
  showLunar: boolean // 显示农历
  showLunarFestival: boolean // 显示农历节日
  showSolarTerm: boolean // 显示节气
  showHoliday: boolean // 显示法定节假日
  showMakeupDay: boolean // 显示补休/调休
  showWeekend: boolean // 周末标识
}

// View types
export type CalendarView = 'day' | 'week' | 'month' | 'year'

// Date navigation
export interface DateRange {
  start: Date
  end: Date
}