/**
 * 节假日持久化模块
 * 用于保存和管理用户自定义的节假日和补休日期
 *
 * 数据流: Vue → Service → settingsRepo → 平台实现 → 数据源
 * 当数据库不可用时，降级到 localStorage
 */

import { HOLIDAYS, MAKEUP_DAYS } from './holidayData'
import * as settingsService from '@/services/settings'

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
 * 从数据库或 localStorage 读取用户自定义节假日
 * 优先使用数据库，当数据库不可用时降级到 localStorage
 * @returns 用户自定义节假日数据，如果不存在或解析失败则返回空对象
 */
export async function loadCustomHolidays(): Promise<CustomHolidayData> {
  const dbAvailable = settingsService.isDatabaseAvailable()
  
  if (dbAvailable) {
    try {
      const holidays = await settingsService.getUserHolidays()
      const result: CustomHolidayData = { holidays: {}, makeupDays: {} }
      
      for (const h of holidays) {
        if (h.category === 'holiday') {
          result.holidays[h.date] = h.name
        } else {
          result.makeupDays[h.date] = h.name
        }
      }
      
      return result
    } catch (e) {
      console.error('Failed to load holidays from database:', e)
      console.warn('[holidayStorage] 数据库加载失败，降级到 localStorage')
      // 降级到 localStorage
    }
  } else {
    console.warn('[holidayStorage] 数据库不可用，降级到 localStorage 加载节假日数据')
  }
  
  // 数据库不可用或出错，使用 localStorage
  try {
    const stored = settingsService.loadFromLocalStorage(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error('Failed to load custom holidays from localStorage:', e)
  }
  
  return { holidays: {}, makeupDays: {} }
}

/**
 * 保存用户自定义节假日到数据库或 localStorage
 * 优先使用数据库，当数据库不可用时降级到 localStorage
 * @param data 要保存的节假日数据
 */
export async function saveCustomHolidays(data: CustomHolidayData): Promise<void> {
  const dbAvailable = settingsService.isDatabaseAvailable()
  
  if (dbAvailable) {
    try {
      // 先清除所有现有数据
      const existing = await settingsService.getUserHolidays()
      for (const h of existing) {
        await settingsService.removeUserHoliday(h.date, h.category)
      }
      
      // 添加新数据
      for (const [date, name] of Object.entries(data.holidays)) {
        await settingsService.addUserHoliday(date, name, 'holiday', 'custom')
      }
      for (const [date, name] of Object.entries(data.makeupDays)) {
        await settingsService.addUserHoliday(date, name, 'makeup', 'custom')
      }
      return
    } catch (e) {
      console.error('Failed to save holidays to database:', e)
      console.warn('[holidayStorage] 数据库保存失败，降级到 localStorage')
      // 降级到 localStorage
    }
  } else {
    console.warn('[holidayStorage] 数据库不可用，降级到 localStorage 保存节假日数据')
  }
  
  // 数据库不可用或出错，使用 localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to save custom holidays to localStorage:', e)
  }
}

/**
 * 添加单条自定义节假日或补休日期
 * @param date 日期字符串 'YYYY-MM-DD'
 * @param name 节日名称或调休原因
 * @param type 类型 'holiday' | 'makeup'
 */
export async function addCustomHoliday(date: string, name: string, type: 'holiday' | 'makeup'): Promise<void> {
  const dbAvailable = settingsService.isDatabaseAvailable()
  
  if (dbAvailable) {
    try {
      await settingsService.addUserHoliday(date, name, type, 'custom')
      return
    } catch (e) {
      console.error('Failed to add holiday to database:', e)
      console.warn('[holidayStorage] 数据库添加失败，降级到 localStorage')
      // 降级到 localStorage
    }
  } else {
    console.warn('[holidayStorage] 数据库不可用，降级到 localStorage 添加节假日')
  }
  
  // 数据库不可用或出错，使用 localStorage
  const customData = await loadCustomHolidays()
  
  if (type === 'holiday') {
    customData.holidays[date] = name
  } else {
    customData.makeupDays[date] = name
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customData))
}

/**
 * 删除单条自定义节假日或补休日期
 * @param date 日期字符串 'YYYY-MM-DD'
 * @param type 类型 'holiday' | 'makeup'
 */
export async function removeCustomHoliday(date: string, type: 'holiday' | 'makeup'): Promise<void> {
  const dbAvailable = settingsService.isDatabaseAvailable()
  
  if (dbAvailable) {
    try {
      await settingsService.removeUserHoliday(date, type)
      return
    } catch (e) {
      console.error('Failed to remove holiday from database:', e)
      console.warn('[holidayStorage] 数据库删除失败，降级到 localStorage')
      // 降级到 localStorage
    }
  } else {
    console.warn('[holidayStorage] 数据库不可用，降级到 localStorage 删除节假日')
  }
  
  // 数据库不可用或出错，使用 localStorage
  const customData = await loadCustomHolidays()
  
  if (type === 'holiday') {
    delete customData.holidays[date]
  } else {
    delete customData.makeupDays[date]
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customData))
}

/**
 * 获取合并后的节假日数据（静态数据 + 自定义数据）
 * 用户自定义数据优先级高于静态数据
 * @returns 合并后的节假日数据，格式: Record<string, {name: string, type: 'holiday'|'makeup'}>
 */
export async function getAllMergedHolidays(): Promise<Record<string, MergedHolidayInfo>> {
  const customData = await loadCustomHolidays()
  const merged: Record<string, MergedHolidayInfo> = {}

  // 先添加静态节假日数据（系统预置，不入库）
  Object.entries(HOLIDAYS).forEach(([date, name]) => {
    merged[date] = { name, type: 'holiday' }
  })

  // 再添加静态补休数据（系统预置，不入库）
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
export async function filterHolidaysByYear(year: number): Promise<Record<string, MergedHolidayInfo>> {
  const allHolidays = await getAllMergedHolidays()
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
export async function getAvailableYears(): Promise<number[]> {
  const years = new Set<number>()

  // 从静态节假日数据提取年份（系统预置）
  Object.keys(HOLIDAYS).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  // 从静态补休数据提取年份（系统预置）
  Object.keys(MAKEUP_DAYS).forEach(date => {
    const year = parseInt(date.split('-')[0], 10)
    if (!isNaN(year)) {
      years.add(year)
    }
  })

  // 从自定义数据提取年份
  const customData = await loadCustomHolidays()
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
export async function exportCustomHolidays(): Promise<CustomHolidayData> {
  return await loadCustomHolidays()
}

/**
 * 导入自定义节假日数据（用于恢复或导入）
 * @param data 要导入的节假日数据
 */
export async function importCustomHolidays(data: CustomHolidayData): Promise<void> {
  await saveCustomHolidays(data)
}