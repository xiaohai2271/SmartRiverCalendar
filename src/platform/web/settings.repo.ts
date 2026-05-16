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
    const response = await this.apiClient.get<ApiResponse<Record<string, unknown>>>('/settings/app')
    if (response.code !== 0 || !response.data) {
      // 远端无设置时返回默认值
      return this.getDefaultAppSettings()
    }
    return { ...this.getDefaultAppSettings(), ...response.data } as AppSettings
  }

  async saveAppSettings(settings: AppSettings): Promise<void> {
    const response = await this.apiClient.post<ApiResponse<null>>('/settings/app', settings)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法保存应用设置',
        platform: this.platform,
      })
    }
  }

  async loadPopupSettings(): Promise<PopupSettings> {
    const response = await this.apiClient.get<ApiResponse<Record<string, unknown>>>('/settings/popup')
    if (response.code !== 0 || !response.data) {
      return this.getDefaultPopupSettings()
    }
    return { ...this.getDefaultPopupSettings(), ...response.data } as PopupSettings
  }

  async savePopupSettings(settings: PopupSettings): Promise<void> {
    const response = await this.apiClient.post<ApiResponse<null>>('/settings/popup', settings)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法保存弹出面板设置',
        platform: this.platform,
      })
    }
  }

  async getUserHolidays(): Promise<UserHolidayEntry[]> {
    const response = await this.apiClient.get<ApiResponse<UserHolidayEntry[]>>('/settings/holidays')
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
    const response = await this.apiClient.post<ApiResponse<null>>('/settings/holidays', {
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
    const response = await this.apiClient.delete<ApiResponse<boolean>>(`/settings/holidays/${date}/${category}`)
    if (response.code !== 0) {
      return false
    }
    return response.data ?? true
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
