import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { PopupSettings } from '../types'
import { broadcastSettingsChange } from '../utils/broadcast'

// 弹出面板默认设置
const DEFAULT_POPUP_SETTINGS: PopupSettings = {
  popupShowLunar: true,
  popupShowLunarFestival: true,
  popupShowSolarTerm: true,
  popupShowHoliday: true,
  popupShowEvents: true,
  popupCalendarShowLunar: true,
  popupCalendarHolidayColor: 'default'
}

// localStorage 存储键名
const POPUP_SETTINGS_KEY = 'popup-settings'

export const usePopupSettingsStore = defineStore('popupSettings', () => {
  // 弹出面板设置状态
  const settings = ref<PopupSettings>({ ...DEFAULT_POPUP_SETTINGS })

  /**
   * 从 localStorage 加载设置
   */
  function loadPopupSettings(): void {
    try {
      const stored = localStorage.getItem(POPUP_SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        settings.value = { ...DEFAULT_POPUP_SETTINGS, ...parsed }
        console.log('[PopupSettings] 已从 localStorage 加载设置:', settings.value)
      }
    } catch (error) {
      console.error('[PopupSettings] 加载设置失败:', error)
    }
  }

  /**
   * 保存设置到 localStorage
   */
  function savePopupSettings(): void {
    try {
      localStorage.setItem(POPUP_SETTINGS_KEY, JSON.stringify(settings.value))
      console.log('[PopupSettings] 已保存设置到 localStorage')
    } catch (error) {
      console.error('[PopupSettings] 保存设置失败:', error)
    }
  }

  /**
   * 更新设置
   * @param updates 要更新的设置项
   */
  function updatePopupSettings(updates: Partial<PopupSettings>): void {
    const oldValues = { ...settings.value }
    settings.value = { ...settings.value, ...updates }
    savePopupSettings()

    // 广播每个变更的设置项
    for (const key of Object.keys(updates) as (keyof PopupSettings)[]) {
      const newValue = updates[key]
      if (newValue !== undefined && newValue !== oldValues[key]) {
        broadcastSettingsChange(key, newValue)
      }
    }

    console.log('[PopupSettings] 设置已更新:', updates)
  }

  /**
   * 重置设置为默认值
   */
  function resetPopupSettings(): void {
    settings.value = { ...DEFAULT_POPUP_SETTINGS }
    savePopupSettings()
    console.log('[PopupSettings] 设置已重置为默认值')
  }

  // 初始化时加载设置
  loadPopupSettings()

  // 自动保存变更
  watch(settings, savePopupSettings, { deep: true })

  return {
    settings,
    loadPopupSettings,
    savePopupSettings,
    updatePopupSettings,
    resetPopupSettings
  }
})
