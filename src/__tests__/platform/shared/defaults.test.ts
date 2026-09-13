import { describe, it, expect } from 'vitest'
import { getDefaultAppSettings, getDefaultPopupSettings } from '@/platform/shared/defaults'

describe('共享默认设置', () => {
  describe('getDefaultAppSettings', () => {
    it('应返回包含所有预期键的完整对象', () => {
      const settings = getDefaultAppSettings()

      expect(settings).toHaveProperty('theme')
      expect(settings).toHaveProperty('defaultView')
      expect(settings).toHaveProperty('firstDayOfWeek')
      expect(settings).toHaveProperty('defaultReminder')
      expect(settings).toHaveProperty('startMinimized')
      expect(settings).toHaveProperty('autoStart')
      expect(settings).toHaveProperty('autoUpdate')
      expect(settings).toHaveProperty('showLunar')
      expect(settings).toHaveProperty('showLunarFestival')
      expect(settings).toHaveProperty('showSolarTerm')
      expect(settings).toHaveProperty('showHoliday')
      expect(settings).toHaveProperty('showMakeupDay')
      expect(settings).toHaveProperty('showWeekend')
      expect(settings).toHaveProperty('monthEventDisplayStyle')
      expect(settings).toHaveProperty('allDayReminderTime')
      expect(settings).toHaveProperty('allDayReminderHour')
      expect(settings).toHaveProperty('reminderMode')
      expect(settings).toHaveProperty('customReminderTitle')
      expect(settings).toHaveProperty('customReminderBody')
      expect(settings).toHaveProperty('clockHookEnabled')
      expect(settings).toHaveProperty('clockHookBlockPopup')
      expect(settings).toHaveProperty('proxyMode')
      expect(settings).toHaveProperty('proxyHost')
      expect(settings).toHaveProperty('proxyPort')
      expect(settings).toHaveProperty('proxyUsername')
      expect(settings).toHaveProperty('proxyPassword')
    })

    it('默认值应符合预期', () => {
      const settings = getDefaultAppSettings()

      expect(settings.theme).toBe('auto')
      expect(settings.defaultView).toBe('month')
      expect(settings.firstDayOfWeek).toBe(1)
      expect(settings.defaultReminder).toBe(15)
      expect(settings.startMinimized).toBe(false)
      expect(settings.autoStart).toBe(false)
      expect(settings.autoUpdate).toBe(true)
      expect(settings.showLunar).toBe(true)
      expect(settings.showLunarFestival).toBe(true)
      expect(settings.showSolarTerm).toBe(true)
      expect(settings.showHoliday).toBe(true)
      expect(settings.showMakeupDay).toBe(true)
      expect(settings.showWeekend).toBe(true)
      expect(settings.monthEventDisplayStyle).toBe('dot')
      expect(settings.allDayReminderTime).toBe('morning')
      expect(settings.allDayReminderHour).toBe(9)
      expect(settings.reminderMode).toBe('standard')
      expect(settings.customReminderTitle).toBe('')
      expect(settings.customReminderBody).toBe('')
      expect(settings.clockHookEnabled).toBe(false)
      expect(settings.clockHookBlockPopup).toBe(false)
      expect(settings.proxyMode).toBe('none')
      expect(settings.proxyHost).toBe('')
      expect(settings.proxyPort).toBe(0)
      expect(settings.proxyUsername).toBe('')
      expect(settings.proxyPassword).toBe('')
    })

    it('每次调用应返回新实例（非共享引用）', () => {
      const settings1 = getDefaultAppSettings()
      const settings2 = getDefaultAppSettings()

      expect(settings1).not.toBe(settings2)
      expect(settings1).toEqual(settings2)

      settings1.theme = 'dark'
      expect(settings2.theme).toBe('auto')
    })

    it('修改返回值不应影响后续调用', () => {
      const settings1 = getDefaultAppSettings()
      settings1.theme = 'dark'
      settings1.defaultView = 'year'
      settings1.showLunar = false

      const settings2 = getDefaultAppSettings()
      expect(settings2.theme).toBe('auto')
      expect(settings2.defaultView).toBe('month')
      expect(settings2.showLunar).toBe(true)
    })
  })

  describe('getDefaultPopupSettings', () => {
    it('应返回包含所有预期键的完整对象', () => {
      const settings = getDefaultPopupSettings()

      expect(settings).toHaveProperty('popupShowLunar')
      expect(settings).toHaveProperty('popupShowLunarFestival')
      expect(settings).toHaveProperty('popupShowSolarTerm')
      expect(settings).toHaveProperty('popupShowHoliday')
      expect(settings).toHaveProperty('popupShowEvents')
      expect(settings).toHaveProperty('popupCalendarShowLunar')
      expect(settings).toHaveProperty('popupWindowSize')
    })

    it('默认值应符合预期', () => {
      const settings = getDefaultPopupSettings()

      expect(settings.popupShowLunar).toBe(true)
      expect(settings.popupShowLunarFestival).toBe(true)
      expect(settings.popupShowSolarTerm).toBe(true)
      expect(settings.popupShowHoliday).toBe(true)
      expect(settings.popupShowEvents).toBe(true)
      expect(settings.popupCalendarShowLunar).toBe(true)
      expect(settings.popupWindowSize).toBe('medium')
    })

    it('每次调用应返回新实例（非共享引用）', () => {
      const settings1 = getDefaultPopupSettings()
      const settings2 = getDefaultPopupSettings()

      expect(settings1).not.toBe(settings2)
      expect(settings1).toEqual(settings2)

      settings1.popupShowLunar = false
      expect(settings2.popupShowLunar).toBe(true)
    })

    it('修改返回值不应影响后续调用', () => {
      const settings1 = getDefaultPopupSettings()
      settings1.popupShowLunar = false
      settings1.popupShowEvents = false
      settings1.popupWindowSize = 'large'

      const settings2 = getDefaultPopupSettings()
      expect(settings2.popupShowLunar).toBe(true)
      expect(settings2.popupShowEvents).toBe(true)
      expect(settings2.popupWindowSize).toBe('medium')
    })
  })
})
