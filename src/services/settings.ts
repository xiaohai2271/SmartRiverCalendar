/**
 * 设置服务 - 前端 Service 层封装
 * 
 * 提供设置和用户自定义节假日的数据库操作接口。
 * 数据流: Vue → Service → Tauri invoke() → Rust → SQLite
 */

import { invoke } from '@tauri-apps/api/core'

/**
 * 应用设置条目（含描述字段）
 * 对应 Rust SettingEntry 结构体
 */
export interface SettingEntry {
  /** 设置键名 */
  key: string
  /** 设置值 */
  value: string
  /** 设置描述 */
  description: string
  /** 更新时间（Unix 时间戳，秒） */
  updated_at: number
}

/**
 * 用户自定义节假日类型
 */
export interface UserHoliday {
  date: string
  name: string
  category: 'holiday' | 'makeup'
  source: 'custom' | 'api'
  created_at: number
}

/**
 * 检测是否在 Tauri 环境中
 */
function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * 获取单个设置项
 * @param key 设置键名
 * @returns 设置值，不存在时返回 null
 */
export async function getSetting(key: string): Promise<string | null> {
  if (!isTauriAvailable()) return null
  return await invoke<string | null>('get_setting', { key })
}

/**
 * 设置单个设置项
 * @param key 设置键名
 * @param value 设置值
 * @param description 设置描述（可选）
 */
export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  if (!isTauriAvailable()) return
  await invoke('set_setting', { key, value, description })
}

/**
 * 获取完整设置条目（含描述）
 * @param key 设置键名
 * @returns 完整设置条目，不存在时返回 null
 */
export async function getSettingEntry(key: string): Promise<SettingEntry | null> {
  if (!isTauriAvailable()) return null
  return await invoke<SettingEntry | null>('get_setting_entry', { key })
}

/**
 * 获取所有设置条目（含描述，按前缀过滤）
 * @param prefix 设置键名前缀
 * @returns 完整设置条目数组
 */
export async function getAllSettingEntries(prefix: string): Promise<SettingEntry[]> {
  if (!isTauriAvailable()) return []
  return await invoke<SettingEntry[]>('get_all_setting_entries', { prefix })
}

/**
 * 获取指定前缀的所有设置项
 * @param prefix 设置键名前缀
 * @returns 键值对数组
 */
export async function getAllSettings(prefix: string): Promise<[string, string][]> {
  if (!isTauriAvailable()) return []
  return await invoke<[string, string][]>('get_all_settings', { prefix })
}

/**
 * 添加用户自定义节假日
 * @param date 日期字符串 (YYYY-MM-DD)
 * @param name 节假日名称
 * @param category 类型: holiday (节假日) 或 makeup (补休)
 * @param source 来源: custom (自定义) 或 api (API导入)，默认 undefined
 */
export async function addUserHoliday(
  date: string,
  name: string,
  category: 'holiday' | 'makeup',
  source?: 'custom' | 'api'
): Promise<void> {
  if (!isTauriAvailable()) return
  await invoke('add_user_holiday', { date, name, category, source })
}

/**
 * 移除用户自定义节假日
 * @param date 日期字符串 (YYYY-MM-DD)
 * @param category 类型: holiday 或 makeup
 * @returns 是否成功删除
 */
export async function removeUserHoliday(
  date: string,
  category: 'holiday' | 'makeup'
): Promise<boolean> {
  if (!isTauriAvailable()) return false
  return await invoke<boolean>('remove_user_holiday', { date, category })
}

/**
 * 获取所有用户自定义节假日
 * @returns 节假日数组
 */
export async function getAllUserHolidays(): Promise<UserHoliday[]> {
  if (!isTauriAvailable()) return []
  return await invoke<UserHoliday[]>('get_all_user_holidays')
}

/**
 * 数据库可用性缓存
 */
let dbAvailableCache: boolean | null = null

/**
 * 检测数据库是否可用
 * 首次调用会尝试执行一次数据库操作来验证可用性，结果会被缓存
 * @returns 数据库是否可用
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (dbAvailableCache !== null) return dbAvailableCache
  try {
    await getSetting('__db_test__')
    dbAvailableCache = true
    return true
  } catch {
    dbAvailableCache = false
    console.warn('[settings] 数据库不可用，降级到 localStorage')
    return false
  }
}

/**
 * 重置数据库可用性缓存（用于测试）
 */
export function _resetDbCache(): void {
  dbAvailableCache = null
}

/**
 * 从 localStorage 读取数据（用于旧数据迁移）
 * @param key localStorage 键名
 * @returns 数据值，不存在或出错时返回 null
 */
export function loadFromLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * 从 localStorage 迁移数据到数据库
 * - 首次启动时执行
 * - 幂等：已有数据时跳过
 * - 迁移成功后不清除 localStorage（保留作为降级方案）
 */
export async function migrateLocalStorageToDb(): Promise<void> {
  // 1. 检查数据库是否可用
  const dbAvailable = await isDatabaseAvailable()
  if (!dbAvailable) return

  // 2. 检查是否已有数据（幂等）
  const existing = await getAllSettings('app.')
  if (existing.length > 0) return // 已有数据，跳过迁移

  // 3. 从 localStorage 读取数据
  const appSettings = loadFromLocalStorage('app-settings')
  const popupSettings = loadFromLocalStorage('popup-settings')
  const userHolidays = loadFromLocalStorage('user-holidays')

  // 4. 迁移 app-settings
  if (appSettings) {
    try {
      const data = JSON.parse(appSettings) as Record<string, unknown>
      for (const [key, value] of Object.entries(data)) {
        await setSetting(`app.${key}`, JSON.stringify(value))
      }
      console.info('[migration] 迁移 app-settings 完成')
    } catch (e) {
      console.error('[migration] 迁移 app-settings 失败:', e)
    }
  }

  // 5. 迁移 popup-settings
  if (popupSettings) {
    try {
      const data = JSON.parse(popupSettings) as Record<string, unknown>
      for (const [key, value] of Object.entries(data)) {
        await setSetting(`popup.${key}`, JSON.stringify(value))
      }
      console.info('[migration] 迁移 popup-settings 完成')
    } catch (e) {
      console.error('[migration] 迁移 popup-settings 失败:', e)
    }
  }

  // 6. 迁移 user-holidays
  if (userHolidays) {
    try {
      const data = JSON.parse(userHolidays) as {
        holidays?: Record<string, string>
        makeupDays?: Record<string, string>
      }
      // 格式: { holidays: {...}, makeupDays: {...} }
      if (data.holidays) {
        for (const [date, name] of Object.entries(data.holidays)) {
          await addUserHoliday(date, name, 'holiday', 'custom')
        }
      }
      if (data.makeupDays) {
        for (const [date, name] of Object.entries(data.makeupDays)) {
          await addUserHoliday(date, name, 'makeup', 'custom')
        }
      }
      console.info('[migration] 迁移 user-holidays 完成')
    } catch (e) {
      console.error('[migration] 迁移 user-holidays 失败:', e)
    }
  }

  // 7. 不清除 localStorage（保留作为降级方案）
}