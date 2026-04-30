import { describe, it, expect } from 'vitest'
import { POPUP_WINDOW_SIZES, type PopupWindowSize, type PopupSettings } from '@/types'

describe('弹出窗口尺寸类型定义', () => {
  describe('PopupWindowSize 类型', () => {
    it('应该只接受 small、medium、large 三个值', () => {
      const smallSize: PopupWindowSize = 'small'
      const mediumSize: PopupWindowSize = 'medium'
      const largeSize: PopupWindowSize = 'large'

      expect(smallSize).toBe('small')
      expect(mediumSize).toBe('medium')
      expect(largeSize).toBe('large')
    })

    it('应该包含所有必需的尺寸选项', () => {
      const sizes: PopupWindowSize[] = ['small', 'medium', 'large']
      expect(sizes).toHaveLength(3)
      expect(sizes).toContain('small')
      expect(sizes).toContain('medium')
      expect(sizes).toContain('large')
    })
  })

  describe('POPUP_WINDOW_SIZES 常量', () => {
    it('应该定义 small 尺寸', () => {
      expect(POPUP_WINDOW_SIZES.small).toBeDefined()
      expect(POPUP_WINDOW_SIZES.small.width).toBe(280)
      expect(POPUP_WINDOW_SIZES.small.height).toBe(400)
    })

    it('应该定义 medium 尺寸', () => {
      expect(POPUP_WINDOW_SIZES.medium).toBeDefined()
      expect(POPUP_WINDOW_SIZES.medium.width).toBe(340)
      expect(POPUP_WINDOW_SIZES.medium.height).toBe(480)
    })

    it('应该定义 large 尺寸', () => {
      expect(POPUP_WINDOW_SIZES.large).toBeDefined()
      expect(POPUP_WINDOW_SIZES.large.width).toBe(400)
      expect(POPUP_WINDOW_SIZES.large.height).toBe(560)
    })

    it('尺寸应按从小到大顺序递增', () => {
      const smallWidth = POPUP_WINDOW_SIZES.small.width
      const mediumWidth = POPUP_WINDOW_SIZES.medium.width
      const largeWidth = POPUP_WINDOW_SIZES.large.width

      const smallHeight = POPUP_WINDOW_SIZES.small.height
      const mediumHeight = POPUP_WINDOW_SIZES.medium.height
      const largeHeight = POPUP_WINDOW_SIZES.large.height

      expect(smallWidth).toBeLessThan(mediumWidth)
      expect(mediumWidth).toBeLessThan(largeWidth)

      expect(smallHeight).toBeLessThan(mediumHeight)
      expect(mediumHeight).toBeLessThan(largeHeight)
    })

    it('尺寸常量应包含正确的类型定义', () => {
      // as const 确保类型层面的只读性
      expect(typeof POPUP_WINDOW_SIZES).toBe('object')
      expect(POPUP_WINDOW_SIZES.small).toHaveProperty('width')
      expect(POPUP_WINDOW_SIZES.small).toHaveProperty('height')
    })
  })

  describe('PopupSettings 接口扩展', () => {
    it('应该支持 popupWindowSize 字段', () => {
      const settings: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true,
        popupWindowSize: 'medium'
      }

      expect(settings.popupWindowSize).toBe('medium')
    })

    it('popupWindowSize 应为可选字段', () => {
      const settings: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true
        // popupWindowSize 未设置，应该允许
      }

      expect(settings.popupWindowSize).toBeUndefined()
    })

    it('应该支持所有 PopupWindowSize 值', () => {
      const smallSettings: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true,
        popupWindowSize: 'small'
      }

      const mediumSettings: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true,
        popupWindowSize: 'medium'
      }

      const largeSettings: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true,
        popupWindowSize: 'large'
      }

      expect(smallSettings.popupWindowSize).toBe('small')
      expect(mediumSettings.popupWindowSize).toBe('medium')
      expect(largeSettings.popupWindowSize).toBe('large')
    })
  })
})