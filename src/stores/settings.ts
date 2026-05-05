import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppSettings } from '../types'
import * as settingsService from '../services/settings'
import { broadcastSettingsChange } from '../utils/broadcast'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  defaultView: 'month',
  firstDayOfWeek: 1, // Monday
  defaultReminder: 15,
  startMinimized: false,
  autoStart: false,
  autoUpdate: true, // 默认开启自动更新
  // 日历显示设置（默认全部开启）
  showLunar: true,
  showLunarFestival: true,
  showSolarTerm: true,
  showHoliday: true,
  showMakeupDay: true,
  showWeekend: true,
  monthEventDisplayStyle: 'bar', // 月视图事件显示模式（默认横条）
  // 提醒设置
  allDayReminderTime: 'morning', // 全天事件提醒时间：前一天晚上/当天早上
  allDayReminderHour: 9, // 全天事件提醒小时（默认9点）
  reminderMode: 'standard', // 提醒强度：标准/强提醒/静默
  customReminderTitle: '', // 自定义通知标题模板
  customReminderBody: '', // 自定义通知正文模板
  // 系统集成设置
  clockHookEnabled: false, // 默认关闭，需用户主动开启
  clockHookBlockPopup: false, // 默认不阻止系统弹窗
  // 网络代理设置
  proxyMode: 'none', // 默认不走代理
  proxyHost: '',
  proxyPort: 0,
  proxyUsername: '',
  proxyPassword: '',
}

/**
 * 从数据库设置数组解析为 AppSettings 对象
 * @param settings 数据库返回的键值对数组 [['app.theme', '"dark"'], ...]
 * @returns 部分 AppSettings 对象
 */
function parseSettingsFromDb(settings: [string, string][]): Partial<AppSettings> {
  const result: Partial<AppSettings> = {}
  for (const [key, value] of settings) {
    const fieldName = key.replace('app.', '') as keyof AppSettings
    try {
      result[fieldName] = JSON.parse(value)
    } catch {
      // JSON 解析失败，直接使用原始值
      ;(result as Record<string, unknown>)[fieldName] = value
    }
  }
  return result
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  /**
   * 从数据库或 localStorage 加载设置
   * 优先使用数据库，不可用时降级到 localStorage
   */
  async function loadSettings(): Promise<void> {
    try {
      const dbAvailable = await settingsService.isDatabaseAvailable()
      
      if (dbAvailable) {
        // 从数据库加载
        const dbSettings = await settingsService.getAllSettings('app.')
        if (dbSettings.length > 0) {
          const parsed = parseSettingsFromDb(dbSettings)
          settings.value = { ...DEFAULT_SETTINGS, ...parsed }
        }
      } else {
        // 降级到 localStorage
        console.warn('[settings] 数据库不可用，降级到 localStorage 加载设置')
        const stored = settingsService.loadFromLocalStorage('app-settings')
        if (stored) {
          settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
        }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
      // 加载失败时保持默认值
    }
  }

  /**
   * 保存设置到数据库或 localStorage
   * 优先使用数据库，不可用时降级到 localStorage
   */
  async function saveSettings(): Promise<void> {
    try {
      const dbAvailable = await settingsService.isDatabaseAvailable()
      
      if (dbAvailable) {
        // 保存到数据库：逐项保存每个设置字段
        for (const [key, value] of Object.entries(settings.value)) {
          await settingsService.setSetting(`app.${key}`, JSON.stringify(value))
        }
      } else {
        // 降级到 localStorage
        console.warn('[settings] 数据库不可用，降级到 localStorage 保存设置')
        localStorage.setItem('app-settings', JSON.stringify(settings.value))
      }
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  // 更新设置并自动保存，主题变更时广播给其他窗口（如弹窗）
  async function updateSettings(updates: Partial<AppSettings>): Promise<void> {
    // 检测主题变更，广播给其他窗口
    if (updates.theme !== undefined && updates.theme !== settings.value.theme) {
      broadcastSettingsChange('theme', updates.theme)
    }

    settings.value = { ...settings.value, ...updates }
    await saveSettings()
  }

  /**
   * 重置设置为默认值并保存
   */
  async function resetSettings(): Promise<void> {
    settings.value = { ...DEFAULT_SETTINGS }
    await saveSettings()
  }

  // 初始化加载设置
  loadSettings()

  return {
    settings,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings
  }
})
