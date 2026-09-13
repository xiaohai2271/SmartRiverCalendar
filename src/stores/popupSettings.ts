import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PopupSettings, PopupWindowSize } from '../types'
import { broadcastSettingsChange } from '../utils/broadcast'
import { usePlatform } from '@/platform/provider'

// 弹出面板默认设置
const DEFAULT_POPUP_SETTINGS: PopupSettings = {
  popupShowLunar: true,
  popupShowLunarFestival: true,
  popupShowSolarTerm: true,
  popupShowHoliday: true,
  popupShowEvents: true,
  popupCalendarShowLunar: true,
  popupWindowSize: 'medium'
}

export const usePopupSettingsStore = defineStore('popupSettings', () => {
  // 弹出面板设置状态
  const settings = ref<PopupSettings>({ ...DEFAULT_POPUP_SETTINGS })

  /**
   * 从 Repository 加载设置
   */
  async function loadPopupSettings(): Promise<void> {
    try {
      const { settingsRepo } = usePlatform()
      const loaded = await settingsRepo.loadPopupSettings()
      settings.value = { ...DEFAULT_POPUP_SETTINGS, ...loaded }
      console.log('[PopupSettings] 已加载设置:', settings.value)
    } catch (error) {
      console.error('[PopupSettings] 加载设置失败:', error)
    }
  }

  /**
   * 保存设置到 Repository
   */
  async function savePopupSettings(): Promise<void> {
    try {
      const { settingsRepo } = usePlatform()
      await settingsRepo.savePopupSettings(settings.value)
      console.log('[PopupSettings] 已保存设置')
    } catch (error) {
      console.error('[PopupSettings] 保存设置失败:', error)
    }
  }

  /**
   * 更新设置
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
