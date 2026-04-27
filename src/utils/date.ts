// Date utility functions

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date to locale string
 */
export function formatDateLocale(date: Date, locale: string = 'zh-CN'): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Format time to HH:MM string
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Format datetime to YYYY-MM-DD HH:MM string
 */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Get start of week (Monday by default)
 */
export function startOfWeek(date: Date, firstDay: number = 1): Date {
  const result = new Date(date)
  const day = result.getDay()
  const diff = (day < firstDay ? 7 : 0) + day - firstDay
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of week
 */
export function endOfWeek(date: Date, firstDay: number = 1): Date {
  const start = startOfWeek(date, firstDay)
  return new Date(start.getTime() + 7 * 86400000 - 1)
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

/**
 * Get start of year
 */
export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1)
}

/**
 * Get days in month
 */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Get week number of year
 */
export function weekOfYear(date: Date): number {
  const start = startOfYear(date)
  const diff = date.getTime() - start.getTime()
  const oneWeek = 604800000
  return Math.ceil(diff / oneWeek)
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date())
}

/**
 * Check if date is in past
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now()
}

/**
 * Check if date is in future
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

/**
 * Get all days in a month (with padding for weeks)
 */
export function getMonthDays(date: Date, firstDay: number = 1): Date[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  const days: Date[] = []

  // Add days from previous month to fill the first week
  const startDay = firstDayOfMonth.getDay()
  const prevMonthDays = startDay < firstDay ? 7 - firstDay + startDay : startDay - firstDay
  for (let i = prevMonthDays; i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }

  // Add days of current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  // Add days from next month to complete the last week
  const remaining = 42 - days.length // 6 weeks * 7 days
  for (let i = 1; i <= remaining; i++) {
    days.push(new Date(year, month + 1, i))
  }

  return days
}

/**
 * Get week days array
 */
export function getWeekDays(firstDay: number = 1): string[] {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const result: string[] = []
  for (let i = 0; i < 7; i++) {
    result.push(days[(firstDay + i) % 7])
  }
  return result
}

/**
 * 格式化相对时间（如 "3天前"、"2小时后"）
 */
export function formatRelativeTime(timestamp: number, _locale: string = 'zh-CN'): string {
  const now = Date.now()
  const diff = timestamp - now
  const absDiff = Math.abs(diff)

  const units = [
    { unit: 31536000000, name: '年' },
    { unit: 2592000000, name: '月' },
    { unit: 86400000, name: '天' },
    { unit: 3600000, name: '小时' },
    { unit: 60000, name: '分钟' }
  ]

  for (const { unit, name } of units) {
    const value = Math.floor(absDiff / unit)
    if (value >= 1) {
      const prefix = diff > 0 ? '' : ''
      return `${prefix}${value}${name}${diff > 0 ? '后' : '前'}`
    }
  }

  return '刚刚'
}

// ===== 跨天事件工具函数 =====

/** 跨天事件参数类型 */
interface CrossDayEvent {
  startTime: number
  endTime: number
}

/** 事件跨度信息 */
export interface EventSpanInfo {
  /** 是否为事件开始天 */
  isStart: boolean
  /** 是否为事件结束天 */
  isEnd: boolean
  /** 是否为事件中间天 */
  isMiddle: boolean
  /** 事件跨越的总天数 */
  spanDays: number
}

/**
 * 获取事件的有效结束日期（处理全天事件 endTime 为次日 00:00 的情况）
 * 全天事件如 1月15日 00:00 → 1月16日 00:00，实际只占1天
 */
function getEffectiveEndDate(endTime: number, startDate: Date): Date {
  const endDate = new Date(endTime)
  // 如果结束时间在开始日期次日的 00:00:00 附近（亚秒级容差），视为全天事件，回退到开始日期
  // 容差处理：部分日历系统 endTime 存在毫秒级偏差（如 00:00:00.001），精确匹配会误判为跨天
  const nextDayStart = new Date(startDate)
  nextDayStart.setDate(nextDayStart.getDate() + 1)
  nextDayStart.setHours(0, 0, 0, 0)
  const TOLERANCE_MS = 1000 // 毫秒级容差，覆盖日历系统亚秒级偏差
  if (Math.abs(endDate.getTime() - nextDayStart.getTime()) < TOLERANCE_MS) {
    return new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  }
  return endDate
}

/**
 * 判断事件是否为跨天事件
 * startTime 和 endTime 为毫秒级 Unix 时间戳
 * 全天事件（结束时间为次日 00:00）不算跨天
 */
export function isMultiDayEvent(event: CrossDayEvent): boolean {
  const startDate = new Date(event.startTime)
  const effectiveEndDate = getEffectiveEndDate(event.endTime, startDate)
  return !isSameDay(startDate, effectiveEndDate)
}

/**
 * 判断事件是否覆盖某天
 * 包括开始天、中间天和结束天
 * 全天事件（结束时间为次日 00:00）不覆盖次日
 */
export function isEventOnDay(event: CrossDayEvent, day: Date): boolean {
  const startDate = new Date(event.startTime)
  const effectiveEndDate = getEffectiveEndDate(event.endTime, startDate)

  const dayStart = startOfDay(day)
  const eventStartDate = startOfDay(startDate)
  const eventEndDate = startOfDay(effectiveEndDate)

  return dayStart.getTime() >= eventStartDate.getTime() && dayStart.getTime() <= eventEndDate.getTime()
}

/**
 * 获取事件在某天的跨度渲染信息
 * - isStart: 是否为事件开始天
 * - isEnd: 是否为事件结束天
 * - isMiddle: 是否为事件中间天（非开始非结束）
 * - spanDays: 事件跨越的总天数
 */
export function getEventSpanInfo(event: CrossDayEvent, day: Date): EventSpanInfo {
  const startDate = new Date(event.startTime)
  const effectiveEndDate = getEffectiveEndDate(event.endTime, startDate)

  const eventStartDate = startOfDay(startDate)
  const eventEndDate = startOfDay(effectiveEndDate)

  // 计算跨越天数，使用 Math.floor 避免毫秒偏差导致向上取整
  const diffMs = eventEndDate.getTime() - eventStartDate.getTime()
  const spanDays = Math.floor(diffMs / 86400000) + 1

  // 判断 day 是否在事件范围内
  const dayStart = startOfDay(day)
  const onDay = dayStart.getTime() >= eventStartDate.getTime() && dayStart.getTime() <= eventEndDate.getTime()

  if (!onDay) {
    return { isStart: false, isEnd: false, isMiddle: false, spanDays }
  }

  const isStart = isSameDay(day, startDate)
  const isEnd = isSameDay(day, effectiveEndDate)

  // 单日事件：既是开始也是结束
  // 跨天事件：isStart/isEnd 互斥，其他情况为中间天
  const isMiddle = !isStart && !isEnd

  return { isStart, isEnd, isMiddle, spanDays }
}