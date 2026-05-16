import type { ISettingsRepository } from '../types/settings.repository'
import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'
import { WebApiClient } from './api-client'
import { type ApiResponse } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Web 设置 Repository 实现 — 设置存远端 API，无本地缓存 */
export class WebSettingsRepository implements ISettingsRepository {
  private readonly platform = 'web' as const

  constructor(private readonly apiClient: WebApiClient) {}

  async loadAppSettings(): Promise<AppSettings> {
    // API: GET /settings?prefix=app.
    const response = await this.apiClient.get<ApiResponse<Array<{ key: string; value: string; description?: string }>>>('/settings?prefix=app.')
    if (response.code !== 0 || !response.data) {
      return this.getDefaultAppSettings()
    }
    // 将 key-value 列表转换为 AppSettings 对象
    const settingsMap: Record<string, unknown> = {}
    for (const item of response.data) {
      // 去除 "app." 前缀作为属性名
      const key = item.key.replace(/^app\./, '')
      try {
        settingsMap[key] = JSON.parse(item.value)
      } catch {
        settingsMap[key] = item.value
      }
    }
    return { ...this.getDefaultAppSettings(), ...settingsMap } as AppSettings
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    // API: PUT /settings/{key} 逐个保存设置项
    const entries = Object.entries(settings)
    for (const [key, value] of entries) {
      const apiKey = `app.${key}`
      const response = await this.apiClient.put<ApiResponse<null>>(`/settings/${encodeURIComponent(apiKey)}`, {
        value: JSON.stringify(value),
      })
      if (response.code !== 0) {
        throw new RepositoryError({
          code: RepoErrorCodes.NETWORK_ERROR,
          message: response.message || `无法保存设置项 ${key}`,
          platform: this.platform,
        })
      }
    }
  }

  async loadPopupSettings(): Promise<PopupSettings> {
    // API: GET /settings?prefix=popup.
    const response = await this.apiClient.get<ApiResponse<Array<{ key: string; value: string; description?: string }>>>('/settings?prefix=popup.')
    if (response.code !== 0 || !response.data) {
      return this.getDefaultPopupSettings()
    }
    // 将 key-value 列表转换为 PopupSettings 对象
    const settingsMap: Record<string, unknown> = {}
    for (const item of response.data) {
      const key = item.key.replace(/^popup\./, '')
      try {
        settingsMap[key] = JSON.parse(item.value)
      } catch {
        settingsMap[key] = item.value
      }
    }
    return { ...this.getDefaultPopupSettings(), ...settingsMap } as PopupSettings
  }

  async savePopupSettings(settings: PopupSettings): Promise<void> {
    // API: PUT /settings/{key} 逐个保存设置项
    const entries = Object.entries(settings)
    for (const [key, value] of entries) {
      const apiKey = `popup.${key}`
      const response = await this.apiClient.put<ApiResponse<null>>(`/settings/${encodeURIComponent(apiKey)}`, {
        value: JSON.stringify(value),
      })
      if (response.code !== 0) {
        throw new RepositoryError({
          code: RepoErrorCodes.NETWORK_ERROR,
          message: response.message || `无法保存弹出面板设置项 ${key}`,
          platform: this.platform,
        })
      }
    }
  }

  async getUserHolidays(): Promise<UserHolidayEntry[]> {
    const response = await this.apiClient.get<ApiResponse<UserHolidayEntry[]>>('/holidays')
    if (response.code !== 0 || !response.data) {
      return []
    }
    return response.data
  }

  async addUserHoliday(
    date: string,
    name: string,
    category: 'holiday' | 'makeup',
    source?: 'custom' | 'api'
  ): Promise<void> {
    const response = await this.apiClient.post<ApiResponse<null>>('/holidays', {
      date,
      name,
      category,
      source: source ?? 'custom',
    })
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法添加节假日',
        platform: this.platform,
      })
    }
  }

  async removeUserHoliday(date: string, category: 'holiday' | 'makeup'): Promise<boolean> {
    // API: DELETE /holidays 请求体包含 { date, category }
    const response = await this.apiClient.delete<ApiResponse<null>>('/holidays', {
      date,
      category,
    })
    if (response.code !== 0) {
      return false
    }
    return true
  }

  // Web 端无需 localStorage 迁移
  async migrateFromLocalStorage(): Promise<void> {
    // Web 端无本地数据库，无需迁移
  }

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
