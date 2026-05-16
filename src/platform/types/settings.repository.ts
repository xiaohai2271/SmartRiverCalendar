import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'

export interface ISettingsRepository {
  /** 加载应用设置 */
  loadAppSettings(): Promise<AppSettings>

  /** 保存应用设置 */
  saveAppSettings(settings: AppSettings): Promise<void>

  /** 加载弹出面板设置 */
  loadPopupSettings(): Promise<PopupSettings>

  /** 保存弹出面板设置 */
  savePopupSettings(settings: PopupSettings): Promise<void>

  /** 获取用户自定义节假日 */
  getUserHolidays(): Promise<UserHolidayEntry[]>

  /** 添加用户自定义节假日 */
  addUserHoliday(date: string, name: string, category: 'holiday' | 'makeup', source?: 'custom' | 'api'): Promise<void>

  /** 移除用户自定义节假日 */
  removeUserHoliday(date: string, category: 'holiday' | 'makeup'): Promise<boolean>

  /** 执行 localStorage → 数据库迁移（仅桌面端有意义） */
  migrateFromLocalStorage?(): Promise<void>
}
