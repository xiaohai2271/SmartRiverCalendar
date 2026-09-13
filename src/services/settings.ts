/**
 * 设置服务 - 前端 Service 层封装
 *
 * 通过 Repository 接口访问设置数据，不再直接调用 Tauri API。
 * 数据流: Vue → Service → settingsRepo → 平台实现 → 数据源
 */

import { usePlatform, useCapabilities } from '@/platform/provider'
import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'

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
 * 加载应用设置
 */
export async function loadAppSettings(): Promise<AppSettings> {
  const { settingsRepo } = usePlatform()
  return settingsRepo.loadAppSettings()
}

/**
 * 保存应用设置
 */
export async function saveAppSettings(settings: AppSettings): Promise<void> {
  const { settingsRepo } = usePlatform()
  return settingsRepo.saveAppSettings(settings)
}

/**
 * 加载弹出面板设置
 */
export async function loadPopupSettings(): Promise<PopupSettings> {
  const { settingsRepo } = usePlatform()
  return settingsRepo.loadPopupSettings()
}

/**
 * 保存弹出面板设置
 */
export async function savePopupSettings(settings: PopupSettings): Promise<void> {
  const { settingsRepo } = usePlatform()
  return settingsRepo.savePopupSettings(settings)
}

/**
 * 获取用户自定义节假日
 */
export async function getUserHolidays(): Promise<UserHolidayEntry[]> {
  const { settingsRepo } = usePlatform()
  return settingsRepo.getUserHolidays()
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
  const { settingsRepo } = usePlatform()
  return settingsRepo.addUserHoliday(date, name, category, source)
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
  const { settingsRepo } = usePlatform()
  return settingsRepo.removeUserHoliday(date, category)
}

/**
 * 检测数据库是否可用
 * 通过平台能力判断，而非尝试执行数据库操作
 */
export function isDatabaseAvailable(): boolean {
  return useCapabilities().hasLocalDatabase
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
 * 委托给 settingsRepo.migrateFromLocalStorage（仅桌面端有实现）
 */
export async function migrateLocalStorageToDb(): Promise<void> {
  const { settingsRepo } = usePlatform()
  if (settingsRepo.migrateFromLocalStorage) {
    return settingsRepo.migrateFromLocalStorage()
  }
}
