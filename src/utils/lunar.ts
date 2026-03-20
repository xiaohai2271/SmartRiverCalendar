import { SolarDay, SolarTerm } from 'tyme4ts'

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

// 节气缓存，避免重复计算
const solarTermCache = new Map<string, Map<string, string>>()

// 获取指定年月的节气信息
function getMonthSolarTerms(year: number, month: number): Map<string, string> {
  const cacheKey = `${year}-${month}`
  if (solarTermCache.has(cacheKey)) {
    return solarTermCache.get(cacheKey)!
  }

  const termMap = new Map<string, string>()

  // 获取该月的两个节气（节和气）
  // 节气索引：小寒=0, 大寒=1, 立春=2, 雨水=3, 惊蛰=4, 春分=5, 清明=6, 谷雨=7,
  //          立夏=8, 小满=9, 芒种=10, 夏至=11, 小暑=12, 大暑=13, 立秋=14, 处暑=15,
  //          白露=16, 秋分=17, 寒露=18, 霜降=19, 立冬=20, 小雪=21, 大雪=22, 冬至=23

  // 每月第一个节气的索引 = (month - 1) * 2
  const termIndex1 = (month - 1) * 2
  const termIndex2 = termIndex1 + 1

  try {
    // 获取第一个节气（节）
    let term = SolarTerm.fromIndex(year, termIndex1)
    const termDay1 = term.getSolarDay()
    const termDate1 = `${termDay1.getYear()}-${String(termDay1.getMonth()).padStart(2, '0')}-${String(termDay1.getDay()).padStart(2, '0')}`

    // 只有当节气日期在当月时才添加
    if (termDay1.getYear() === year && termDay1.getMonth() === month) {
      termMap.set(termDate1, term.getName())
    }

    // 获取第二个节气（气）
    term = SolarTerm.fromIndex(year, termIndex2)
    const termDay2 = term.getSolarDay()
    const termDate2 = `${termDay2.getYear()}-${String(termDay2.getMonth()).padStart(2, '0')}-${String(termDay2.getDay()).padStart(2, '0')}`

    // 只有当节气日期在当月时才添加
    if (termDay2.getYear() === year && termDay2.getMonth() === month) {
      termMap.set(termDate2, term.getName())
    }
  } catch (e) {
    // 如果获取节气失败，忽略错误
    console.warn('Failed to get solar terms:', e)
  }

  solarTermCache.set(cacheKey, termMap)
  return termMap
}

export function getLunarInfo(date: Date): LunarInfo {
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

  // 简化农历日期显示：
  // - 初一：只显示月份，如"正月"
  // - 其他日期：只显示日期，如"初八"
  const simplifiedLunarDate = lunarDayName === '初一' ? lunarMonthName : lunarDayName

  // 获取农历节日
  const lunarFestival = lunarDay.getFestival()
  const lunarFestivalName = lunarFestival ? lunarFestival.getName() : undefined

  // 获取节气（使用精确的节气计算）
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const dateStr = formatDate(date)
  const monthTerms = getMonthSolarTerms(year, month)
  const solarTermName = monthTerms.get(dateStr)

  // 获取法定节假日
  const legalHoliday = solarDay.getLegalHoliday()
  const holidayName = legalHoliday ? legalHoliday.getName() : undefined
  const isWorkDay = legalHoliday ? legalHoliday.isWork() : false

  const isWeekend = getWeekend(date)

  return {
    lunarDate: simplifiedLunarDate,
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
    result.set(formatDate(date), getLunarInfo(date))
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