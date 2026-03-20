import { SolarDay, LunarDay, LegalHoliday, SolarTerm } from 'tyme4ts'

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
  const solarDay = SolarDay.fromYmd(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )

  // 获取农历信息
  const lunarDay = solarDay.getLunarDay()
  const lunarMonth = lunarDay.getLunarMonth()
  const lunarMonthName = lunarMonth.getName()
  const lunarDayName = lunarDay.getName()

  // 获取农历节日
  const lunarFestival = lunarDay.getFestival()
  const lunarFestivalName = lunarFestival ? lunarFestival.getName() : undefined

  // 获取节气
  const solarTerm = solarDay.getTerm()
  const solarTermName = solarTerm ? solarTerm.getName() : undefined

  // 获取法定节假日
  const legalHoliday = solarDay.getLegalHoliday()
  const holidayName = legalHoliday ? legalHoliday.getName() : undefined
  const isWorkDay = legalHoliday ? legalHoliday.isWork() : false

  const isWeekend = getWeekend(date)

  return {
    lunarDate: `${lunarMonthName}${lunarDayName}`,
    lunarMonth: lunarMonthName,
    lunarDay: lunarDayName,
    lunarFestival: lunarFestivalName,
    solarTerm: solarTermName,
    isWeekend,
    isHoliday: !!holidayName,
    holidayName,
    isWorkDay,
    workDayName: isWorkDay ? holidayName : undefined,
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

// 导出节假日管理函数（兼容旧接口）
export {
  addHoliday,
  addMakeupDay,
  removeHoliday,
  removeMakeupDay,
  getAllHolidays,
  getAllMakeupDays,
  exportHolidayData,
  importHolidayData
} from './holidayData'