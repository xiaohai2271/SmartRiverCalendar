import type { ISettingsRepository } from '../types/settings.repository'
import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'
import { safeInvoke } from '@/utils/tauri'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Tauri 设置 Repository 实现 */
export class TauriSettingsRepository implements ISettingsRepository {
  private readonly platform = 'tauri' as const

  /** 数据库可用性缓存 */
  private dbAvailableCache: boolean | null = null

  async loadAppSettings(): Promise<AppSettings> {
    return this.loadSettings<AppSettings>('app.', this.getDefaultAppSettings())
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    await this.saveSettings('app.', settings as unknown as Record<string, unknown>)
  }

  async loadPopupSettings(): Promise<PopupSettings> {
    return this.loadSettings<PopupSettings>('popup.', this.getDefaultPopupSettings())
  }

  async savePopupSettings(settings: PopupSettings): Promise<void> {
    await this.saveSettings('popup.', settings as unknown as Record<string, unknown>)
  }

  async getUserHolidays(): Promise<UserHolidayEntry[]> {
    const result = await safeInvoke<UserHolidayEntry[]>('get_all_user_holidays')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取用户节假日',
        platform: this.platform,
      })
    }
    return result
  }

  async addUserHoliday(
    date: string,
    name: string,
    category: 'holiday' | 'makeup',
    source?: 'custom' | 'api'
  ): Promise<void> {
    const result = await safeInvoke<void>('add_user_holiday', {
      date,
      name,
      category,
      source: source ?? 'custom',
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法添加节假日',
        platform: this.platform,
      })
    }
  }

  async removeUserHoliday(date: string, category: 'holiday' | 'makeup'): Promise<boolean> {
    const result = await safeInvoke<boolean>('remove_user_holiday', { date, category })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法移除节假日',
        platform: this.platform,
      })
    }
    return result
  }

  async migrateFromLocalStorage(): Promise<void> {
    const dbAvailable = await this.isDatabaseAvailable()
    if (!dbAvailable) return

    // 检查是否已有数据（幂等）
    const existing = await safeInvoke<[string, string][]>('get_all_settings', { prefix: 'app.' })
    if (existing && existing.length > 0) return

    // 迁移 app-settings
    const appSettings = this.loadFromLocalStorage('app-settings')
    if (appSettings) {
      try {
        const data = JSON.parse(appSettings) as Record<string, unknown>
        for (const [key, value] of Object.entries(data)) {
          await this.setSetting(`app.${key}`, JSON.stringify(value))
        }
        console.info('[migration] 迁移 app-settings 完成')
      } catch (e) {
        console.error('[migration] 迁移 app-settings 失败:', e)
      }
    }

    // 迁移 popup-settings
    const popupSettings = this.loadFromLocalStorage('popup-settings')
    if (popupSettings) {
      try {
        const data = JSON.parse(popupSettings) as Record<string, unknown>
        for (const [key, value] of Object.entries(data)) {
          await this.setSetting(`popup.${key}`, JSON.stringify(value))
        }
        console.info('[migration] 迁移 popup-settings 完成')
      } catch (e) {
        console.error('[migration] 迁移 popup-settings 失败:', e)
      }
    }

    // 迁移 user-holidays
    const userHolidays = this.loadFromLocalStorage('user-holidays')
    if (userHolidays) {
      try {
        const data = JSON.parse(userHolidays) as {
          holidays?: Record<string, string>
          makeupDays?: Record<string, string>
        }
        if (data.holidays) {
          for (const [date, name] of Object.entries(data.holidays)) {
            await this.addUserHoliday(date, name, 'holiday', 'custom')
          }
        }
        if (data.makeupDays) {
          for (const [date, name] of Object.entries(data.makeupDays)) {
            await this.addUserHoliday(date, name, 'makeup', 'custom')
          }
        }
        console.info('[migration] 迁移 user-holidays 完成')
      } catch (e) {
        console.error('[migration] 迁移 user-holidays 失败:', e)
      }
    }
  }

  // ─── 私有方法 ───

  /** 检测数据库是否可用 */
  private async isDatabaseAvailable(): Promise<boolean> {
    if (this.dbAvailableCache !== null) return this.dbAvailableCache
    try {
      await this.getSetting('__db_test__')
      this.dbAvailableCache = true
      return true
    } catch {
      this.dbAvailableCache = false
      console.warn('[TauriSettingsRepository] 数据库不可用')
      return false
    }
  }

  /** 获取单个设置项 */
  private async getSetting(key: string): Promise<string | null> {
    return await safeInvoke<string | null>('get_setting', { key })
  }

  /** 设置单个设置项 */
  private async setSetting(key: string, value: string, description?: string): Promise<void> {
    await safeInvoke('set_setting', { key, value, description })
  }

  /** 加载指定前缀的所有设置并合并为对象 */
  private async loadSettings<T>(prefix: string, defaults: T): Promise<T> {
    const dbAvailable = await this.isDatabaseAvailable()
    if (!dbAvailable) {
      return defaults
    }

    const result = await safeInvoke<[string, string][]>('get_all_settings', { prefix })
    if (!result || result.length === 0) {
      return defaults
    }

    const settings: Record<string, unknown> = {}
    for (const [key, value] of result) {
      const settingKey = key.replace(prefix, '')
      try {
        settings[settingKey] = JSON.parse(value)
      } catch {
        settings[settingKey] = value
      }
    }

    return { ...defaults, ...settings } as T
  }

  /** 保存设置对象到数据库 */
  private async saveSettings(prefix: string, settings: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.setSetting(`${prefix}${key}`, JSON.stringify(value))
    }
  }

  /** 从 localStorage 读取数据 */
  private loadFromLocalStorage(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }

  /** 获取默认应用设置 */
  private getDefaultAppSettings(): AppSettings {
    return {
      theme: 'auto',
      defaultView: 'month',
      firstDayOfWeek: 1,
      defaultReminder: 15,
      startMinimized: false,
      autoStart: false,
      autoUpdate: true,
      showLunar: true,
      showLunarFestival: true,
      showSolarTerm: true,
      showHoliday: true,
      showMakeupDay: true,
      showWeekend: true,
      monthEventDisplayStyle: 'dot',
      allDayReminderTime: 'morning',
      allDayReminderHour: 9,
      reminderMode: 'standard',
      customReminderTitle: '',
      customReminderBody: '',
      clockHookEnabled: false,
      clockHookBlockPopup: false,
      proxyMode: 'none',
      proxyHost: '',
      proxyPort: 0,
      proxyUsername: '',
      proxyPassword: '',
    }
  }

  /** 获取默认弹出面板设置 */
  private getDefaultPopupSettings(): PopupSettings {
    return {
      popupShowLunar: true,
      popupShowLunarFestival: true,
      popupShowSolarTerm: true,
      popupShowHoliday: true,
      popupShowEvents: true,
      popupCalendarShowLunar: true,
      popupWindowSize: 'medium',
    }
  }
}
