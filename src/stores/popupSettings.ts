import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PopupSettings, PopupWindowSize } from '../types'
import { broadcastSettingsChange } from '../utils/broadcast'
import * as settingsService from '@/services/settings'

// 弹出面板默认设置
const DEFAULT_POPUP_SETTINGS: PopupSettings = {
  popupShowLunar: true,
  popupShowLunarFestival: true,
  popupShowSolarTerm: true,
  popupShowHoliday: true,
  popupShowEvents: true,
  popupCalendarShowLunar: true,
  popupCalendarHolidayColor: 'default',
  popupWindowSize: 'medium'
}

// localStorage 存储键名（用于降级）
const POPUP_SETTINGS_KEY = 'popup-settings'

// 设置键前缀
const SETTINGS_PREFIX = 'popup.'

export const usePopupSettingsStore = defineStore('popupSettings', () => {
  // 弹出面板设置状态
  const settings = ref<PopupSettings>({ ...DEFAULT_POPUP_SETTINGS })

  // 数据库可用性标志
  let dbAvailable = false

  /**
   * 从数据库或 localStorage 加载设置
   */
  async function loadPopupSettings(): Promise<void> {
    try {
      dbAvailable = await settingsService.isDatabaseAvailable()

      if (dbAvailable) {
        // 从数据库加载
        const dbSettings = await settingsService.getAllSettings(SETTINGS_PREFIX)
        if (dbSettings && dbSettings.length > 0) {
          const parsed: Partial<PopupSettings> = {}
          for (const [key, value] of dbSettings) {
            // 移除前缀，解析值
            const settingKey = key.replace(SETTINGS_PREFIX, '') as keyof PopupSettings
            try {
              parsed[settingKey] = JSON.parse(value)
            } catch {
              // 解析失败，跳过
            }
          }
          settings.value = { ...DEFAULT_POPUP_SETTINGS, ...parsed }
          console.log('[PopupSettings] 已从数据库加载设置:', settings.value)
        }
      } else {
        // 降级到 localStorage
        console.warn('[PopupSettings] 数据库不可用，降级到 localStorage 加载设置')
        const stored = settingsService.loadFromLocalStorage(POPUP_SETTINGS_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          settings.value = { ...DEFAULT_POPUP_SETTINGS, ...parsed }
        }
      }
    } catch (error) {
      console.error('[PopupSettings] 加载设置失败:', error)
      // 尝试从 localStorage 加载作为最终降级
      const stored = settingsService.loadFromLocalStorage(POPUP_SETTINGS_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          settings.value = { ...DEFAULT_POPUP_SETTINGS, ...parsed }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  /**
   * 保存设置到数据库或 localStorage
   */
  async function savePopupSettings(): Promise<void> {
    try {
      if (dbAvailable) {
        // 保存到数据库
        for (const [key, value] of Object.entries(settings.value)) {
          const settingKey = `${SETTINGS_PREFIX}${key}`
          await settingsService.setSetting(settingKey, JSON.stringify(value))
        }
        console.log('[PopupSettings] 已保存设置到数据库')
      } else {
        // 降级到 localStorage
        console.warn('[PopupSettings] 数据库不可用，降级到 localStorage 保存设置')
        localStorage.setItem(POPUP_SETTINGS_KEY, JSON.stringify(settings.value))
      }
    } catch (error) {
      console.error('[PopupSettings] 保存设置失败:', error)
      // 尝试保存到 localStorage 作为最终降级
      try {
        localStorage.setItem(POPUP_SETTINGS_KEY, JSON.stringify(settings.value))
      } catch {
        // 忽略存储错误
      }
    }
  }

  /**
   * 更新设置
   * @param updates 要更新的设置项
   */
  async function updatePopupSettings(updates: Partial<PopupSettings>): Promise<void> {
    const oldValues = { ...settings.value }
    settings.value = { ...settings.value, ...updates }
    await savePopupSettings()

    // 广播每个变更的设置项
    for (const key of Object.keys(updates) as (keyof PopupSettings)[]) {
      const newValue = updates[key]
      const oldValue = oldValues[key]
      if (newValue !== undefined && newValue !== oldValue) {
        broadcastSettingsChange(key, newValue)
      }
    }

    console.log('[PopupSettings] 设置已更新:', updates)
  }

  /**
   * 重置设置为默认值
   */
  async function resetPopupSettings(): Promise<void> {
    settings.value = { ...DEFAULT_POPUP_SETTINGS }
    await savePopupSettings()
    console.log('[PopupSettings] 设置已重置为默认值')
  }

  /**
   * 更新弹出窗口尺寸
   * @param size 窗口尺寸（small | medium | large）
   */
  async function updateWindowSize(size: PopupWindowSize): Promise<void> {
    const oldSize = settings.value.popupWindowSize
    if (oldSize === size) {
      console.log('[PopupSettings] 窗口尺寸未改变，跳过更新:', size)
      return
    }

    await updatePopupSettings({ popupWindowSize: size })
    console.log('[PopupSettings] 窗口尺寸已更新:', size)
  }

  // 初始化时异步加载设置
  loadPopupSettings()

  return {
    settings,
    loadPopupSettings,
    savePopupSettings,
    updatePopupSettings,
    resetPopupSettings,
    updateWindowSize
  }
})
