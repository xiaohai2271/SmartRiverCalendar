import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { AppSettings } from '../types'

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
  // 提醒设置
  allDayReminderTime: 'morning', // 全天事件提醒时间：前一天晚上/当天早上
  allDayReminderHour: 9, // 全天事件提醒小时（默认9点）
  reminderMode: 'standard', // 提醒强度：标准/强提醒/静默
  customReminderTitle: '', // 自定义通知标题模板
  customReminderBody: '', // 自定义通知正文模板
  // 系统集成设置
  clockHookEnabled: false, // 默认关闭，需用户主动开启
  clockHookBlockPopup: false, // 默认不阻止系统弹窗
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })

  // Load settings from localStorage
  function loadSettings() {
    try {
      const stored = localStorage.getItem('app-settings')
      if (stored) {
        settings.value = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  // Save settings to localStorage
  function saveSettings() {
    try {
      localStorage.setItem('app-settings', JSON.stringify(settings.value))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  function updateSettings(updates: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...updates }
    saveSettings()
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    saveSettings()
  }

  // Initialize
  loadSettings()

  // Auto-save on changes
  watch(settings, saveSettings, { deep: true })

  return {
    settings,
    loadSettings,
    saveSettings,
    updateSettings,
    resetSettings
  }
})