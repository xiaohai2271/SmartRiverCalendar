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
 * Format relative time (e.g., "3天前", "2小时后")
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