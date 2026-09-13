// 两端共享的默认设置定义
// Tauri 和 Web 的 settings repo 均从此处导入，避免重复定义

import type { AppSettings, PopupSettings } from '@/types'

/** 获取默认应用设置 */
export function getDefaultAppSettings(): AppSettings {
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
export function getDefaultPopupSettings(): PopupSettings {
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
