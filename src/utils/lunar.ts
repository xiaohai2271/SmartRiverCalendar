import lunarCalendar from 'lunar-calendar'
import {
  HOLIDAYS,
  MAKEUP_DAYS,
  LUNAR_FESTIVALS,
  addHoliday,
  addMakeupDay,
  removeHoliday,
  removeMakeupDay,
  getAllHolidays,
  getAllMakeupDays,
  exportHolidayData,
  importHolidayData
} from './holidayData'

export interface LunarInfo {
  lunarDate: string // 农历日期
  lunarMonth: string // 农历月
  lunarDay: string // 农历日
  lunarFestival?: string // 农历节日
  solarTerm?: string // 节气
  isWeekend: boolean // 是否周末
  isHoliday: boolean // 是否法定节假日
  holidayName?: string // 节假日名称
  isWorkDay: boolean // 是否工作日（补休）
  workDayName?: string // 补休名称
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function getLunarInfo(date: Date): LunarInfo {
  const dateStr = formatDate(date)
  const lunar = lunarCalendar.solarToLunar(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )

  const lunarMonthDay = `${lunar.lunarMonthName || ''}${lunar.lunarDayName || ''}`
  const lunarFestival = LUNAR_FESTIVALS[lunarMonthDay]

  const isWeekend = getWeekend(date)
  const holidayName = HOLIDAYS[dateStr]
  const workDayName = MAKEUP_DAYS[dateStr]

  const isHoliday = !!holidayName
  const isWorkDay = !!workDayName

  return {
    lunarDate: `${lunar.lunarMonthName || ''}${lunar.lunarDayName || ''}`,
    lunarMonth: lunar.lunarMonthName || '',
    lunarDay: lunar.lunarDayName || '',
    lunarFestival,
    solarTerm: lunar.solarTerm || undefined,
    isWeekend,
    isHoliday,
    holidayName,
    isWorkDay,
    workDayName,
  }
}

// 获取月份的所有日期的农历信息
export function getMonthLunarInfo(year: number, month: number): Map<string, LunarInfo> {
  const result = new Map<string, LunarInfo>()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = formatDate(date)
    result.set(dateStr, getLunarInfo(date))
  }

  return result
}

// 判断是否为工作日
export function isWorkDay(date: Date): boolean {
  const lunarInfo = getLunarInfo(date)
  if (lunarInfo.isHoliday) return false
  if (lunarInfo.isWorkDay) return true
  return !lunarInfo.isWeekend
}

// 导出节假日管理函数
export {
  addHoliday,
  addMakeupDay,
  removeHoliday,
  removeMakeupDay,
  getAllHolidays,
  getAllMakeupDays,
  exportHolidayData,
  importHolidayData
}