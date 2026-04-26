/**
 * 节假日 localStorage 持久化模块
 * 用于保存和管理用户自定义的节假日和补休日期
 */

import { HOLIDAYS, MAKEUP_DAYS } from './holidayData'

/**
 * 用户自定义节假日数据结构
 */
export interface CustomHolidayData {
  holidays: Record<string, string>    // 自定义节假日: 'YYYY-MM-DD': '节日名称'
  makeupDays: Record<string, string>  // 自定义补休: 'YYYY-MM-DD': '调休原因'
}

/**
 * 合并后的节假日数据结构
 */
export interface MergedHolidayInfo {
  name: string
  type: 'holiday' | 'makeup'
}

/**
 * localStorage 存储键名
 */
const STORAGE_KEY = 'user-holidays'

/**
 * 从 localStorage 读取用户自定义节假日
 * @returns 用户自定义节假日数据，如果不存在或解析失败则返回空对象
 */
export function loadCustomHolidays(): CustomHolidayData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load custom holidays:', e)
  }
  return { holidays: {}, makeupDays: {} }
}

/**
 * 保存用户自定义节假日到 localStorage
 * @param data 要保存的节假日数据
 */
export function saveCustomHolidays(data: CustomHolidayData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save custom holidays:', e)
  }
}

/**
 * 添加单条自定义节假日或补休日期
 * @param date 日期字符串 'YYYY-MM-DD'
 * @param name 节日名称或调休原因
 * @param type 类型 'holiday' | 'makeup'
 */
export function addCustomHoliday(date: string, name: string, type: 'holiday' | 'makeup'): void {
  const customData = loadCustomHolidays()

  if (type === 'holiday') {
    customData.holidays[date] = name
  } else {
    customData.makeupDays[date] = name
  }

  saveCustomHolidays(customData)
}

/**
 * 删除单条自定义节假日或补休日期
 * @param date 日期字符串 'YYYY-MM-DD'
 * @param type 类型 'holiday' | 'makeup'
 */
export function removeCustomHoliday(date: string, type: 'holiday' | 'makeup'): void {
  const customData = loadCustomHolidays()

  if (type === 'holiday') {
    delete customData.holidays[date]
  } else {
    delete customData.makeupDays[date]
  }

  saveCustomHolidays(customData)
}

/**
 * 获取合并后的节假日数据（静态数据 + 自定义数据）
 * 用户自定义数据优先级高于静态数据
 * @returns 合并后的节假日数据，格式: Record<string, {name: string, type: 'holiday'|'makeup'}>
 */
export function getAllMergedHolidays(): Record<string, MergedHolidayInfo> {
  const customData = loadCustomHolidays()
  const merged: Record<string, MergedHolidayInfo> = {}

  // 先添加静态节假日数据
  Object.entries(HOLIDAYS).forEach(([date, name]) => {
    merged[date] = { name, type: 'holiday' }
  })

  // 再添加静态补休数据
  Object.entries(MAKEUP_DAYS).forEach(([date, name]) => {
    merged[date] = { name, type: 'makeup' }
  })

  // 最后添加自定义节假日（覆盖静态数据）
  Object.entries(customData.holidays).forEach(([date, name]) => {
    merged[date] = { name, type: 'holiday' }
  })

  // 最后添加自定义补休（覆盖静态数据）
  Object.entries(customData.makeupDays).forEach(([date, name]) => {
    merged[date] = { name, type: 'makeup' }
  })

  return merged
}

/**
 * 按年份筛选节假日
 * @param year 年份，如 2024
 * @returns 该年份的节假日数据，格式: Record<string, {name: string, type: 'holiday'|'makeup'}>
 */
export function filterHolidaysByYear(year: number): Record<string, MergedHolidayInfo> {
  const allHolidays = getAllMergedHolidays()
  const filtered: Record<string, MergedHolidayInfo> = {}
  const yearPrefix = `${year}-`

  Object.entries(allHolidays).forEach(([date, info]) => {
    if (date.startsWith(yearPrefix)) {
      filtered[date] = info
    }
  })

  return filtered
}

/**
 * 获取有数据的年份列表
 * 从静态数据和自定义数据中提取年份列表，按降序排列
 * @returns 年份列表，如 [2026, 2025, 2024]
 */
export function getAvailableYears(): number[] {
  const years = new Set<number>()

  // 从静态节假日数据提取年份
  Object.keys(HOLIDAYS).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  // 从静态补休数据提取年份
  Object.keys(MAKEUP_DAYS).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  // 从自定义数据提取年份
  const customData = loadCustomHolidays()
  Object.keys(customData.holidays).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })
  Object.keys(customData.makeupDays).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  // 返回降序排列的年份列表
  return Array.from(years).sort((a, b) => b - a)
}

/**
 * 导出所有自定义节假日数据（用于备份或分享）
 * @returns 自定义节假日数据
 */
export function exportCustomHolidays(): CustomHolidayData {
  return loadCustomHolidays()
}

/**
 * 导入自定义节假日数据（用于恢复或导入）
 * @param data 要导入的节假日数据
 */
export function importCustomHolidays(data: CustomHolidayData): void {
  saveCustomHolidays(data)
}