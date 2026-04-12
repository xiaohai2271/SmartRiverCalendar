import { describe, it, expect } from 'vitest'
import type { Monitor } from '@tauri-apps/api/window'
import {
  calculatePopupPosition,
  findMonitorByClockRect,
  getPrimaryMonitor,
  type PopupRect,
} from '../composables/useCalendarPopup'

// 弹出窗口尺寸配置（与 useCalendarPopup.ts 保持一致）
const POPUP_WIDTH = 360
const POPUP_HEIGHT = 500
const POPUP_MARGIN = 8

/**
 * 创建模拟显示器
 */
function createMockMonitor(
  x: number,
  y: number,
  width: number,
  height: number,
  name: string | null = null
): Monitor {
  return {
    name,
    size: { width, height, type: 'Physical' } as unknown as Monitor['size'],
    position: { x, y, type: 'Physical' } as unknown as Monitor['position'],
    workArea: {
      position: { x, y, type: 'Physical' } as unknown as Monitor['position'],
      size: { width, height, type: 'Physical' } as unknown as Monitor['size'],
    },
    scaleFactor: 1,
  }
}

describe('弹出窗口定位逻辑', () => {
  describe('calculatePopupPosition 边界检查', () => {
    it('时钟在屏幕右下角，弹出窗口应向上弹出', () => {
      const monitor = createMockMonitor(0, 0, 1920, 1080)
      const clockRect: PopupRect = {
        left: 1700,
        top: 1030,
        right: 1920,
        bottom: 1080,
      }

      const position = calculatePopupPosition(clockRect, monitor)

      // 弹出窗口应在时钟上方
      expect(position.y).toBeLessThan(clockRect.top)
      // 弹出窗口不应超出屏幕边界
      expect(position.x).toBeGreaterThanOrEqual(monitor.position.x + POPUP_MARGIN)
      expect(position.y).toBeGreaterThanOrEqual(monitor.position.y + POPUP_MARGIN)
      expect(position.x + POPUP_WIDTH).toBeLessThanOrEqual(
        monitor.position.x + monitor.size.width - POPUP_MARGIN
      )
      expect(position.y + POPUP_HEIGHT).toBeLessThanOrEqual(
        monitor.position.y + monitor.size.height - POPUP_MARGIN
      )
    })

    it('时钟在屏幕左下角，弹出窗口应水平调整', () => {
      const monitor = createMockMonitor(0, 0, 1920, 1080)
      const clockRect: PopupRect = {
        left: 0,
        top: 1030,
        right: 220,
        bottom: 1080,
      }

      const position = calculatePopupPosition(clockRect, monitor)

      // 弹出窗口不应超出屏幕左边界
      expect(position.x).toBeGreaterThanOrEqual(monitor.position.x + POPUP_MARGIN)
      // 弹出窗口应在时钟上方
      expect(position.y).toBeLessThan(clockRect.top)
    })

    it('时钟在屏幕顶部，弹出窗口应向下弹出', () => {
      const monitor = createMockMonitor(0, 0, 1920, 1080)
      const clockRect: PopupRect = {
        left: 1700,
        top: 0,
        right: 1920,
        bottom: 50,
      }

      const position = calculatePopupPosition(clockRect, monitor)

      // 弹出窗口应在时钟下方
      expect(position.y).toBeGreaterThanOrEqual(clockRect.bottom + POPUP_MARGIN)
    })

    it('副屏显示器（负坐标），弹出窗口应正确定位', () => {
      // 副屏在主屏左侧，坐标为负
      const monitor = createMockMonitor(-1920, 0, 1920, 1080)
      const clockRect: PopupRect = {
        left: -220,
        top: 1030,
        right: 0,
        bottom: 1080,
      }

      const position = calculatePopupPosition(clockRect, monitor)

      // 弹出窗口应在副屏范围内
      expect(position.x).toBeGreaterThanOrEqual(monitor.position.x + POPUP_MARGIN)
      expect(position.x + POPUP_WIDTH).toBeLessThanOrEqual(
        monitor.position.x + monitor.size.width - POPUP_MARGIN
      )
    })

    it('小屏幕场景，弹出窗口应适配屏幕尺寸', () => {
      // 小屏幕（如平板）
      const monitor = createMockMonitor(0, 0, 800, 600)
      const clockRect: PopupRect = {
        left: 580,
        top: 550,
        right: 800,
        bottom: 600,
      }

      const position = calculatePopupPosition(clockRect, monitor)

      // 弹出窗口应在屏幕范围内
      expect(position.x).toBeGreaterThanOrEqual(monitor.position.x + POPUP_MARGIN)
      expect(position.y).toBeGreaterThanOrEqual(monitor.position.y + POPUP_MARGIN)
      expect(position.x + POPUP_WIDTH).toBeLessThanOrEqual(
        monitor.position.x + monitor.size.width - POPUP_MARGIN
      )
      expect(position.y + POPUP_HEIGHT).toBeLessThanOrEqual(
        monitor.position.y + monitor.size.height - POPUP_MARGIN
      )
    })
  })

  describe('findMonitorByClockRect 查找显示器', () => {
    it('时钟在主屏，返回主显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        createMockMonitor(1920, 0, 1920, 1080, 'Secondary'),
      ]
      const clockRect: PopupRect = {
        left: 1700,
        top: 1030,
        right: 1920,
        bottom: 1080,
      }

      const result = findMonitorByClockRect(clockRect, monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Primary')
    })

    it('时钟在副屏，返回副显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        createMockMonitor(1920, 0, 1920, 1080, 'Secondary'),
      ]
      const clockRect: PopupRect = {
        left: 3620,
        top: 1030,
        right: 3840,
        bottom: 1080,
      }

      const result = findMonitorByClockRect(clockRect, monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Secondary')
    })

    it('时钟在副屏（左侧负坐标），返回正确的副显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        createMockMonitor(-1920, 0, 1920, 1080, 'Secondary Left'),
      ]
      const clockRect: PopupRect = {
        left: -220,
        top: 1030,
        right: 0,
        bottom: 1080,
      }

      const result = findMonitorByClockRect(clockRect, monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Secondary Left')
    })

    it('时钟坐标不在任何显示器内，返回 null', () => {
      const monitors: Monitor[] = [createMockMonitor(0, 0, 1920, 1080, 'Primary')]
      const clockRect: PopupRect = {
        left: 5000,
        top: 5000,
        right: 5220,
        bottom: 5050,
      }

      const result = findMonitorByClockRect(clockRect, monitors)

      expect(result).toBeNull()
    })
  })

  describe('getPrimaryMonitor 获取主显示器', () => {
    it('返回位置在 (0, 0) 的显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(-1920, 0, 1920, 1080, 'Secondary Left'),
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        createMockMonitor(1920, 0, 1920, 1080, 'Secondary Right'),
      ]

      const result = getPrimaryMonitor(monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Primary')
    })

    it('没有显示器在 (0, 0)，返回第一个显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(-1920, 0, 1920, 1080, 'Left Monitor'),
        createMockMonitor(1920, 0, 1920, 1080, 'Right Monitor'),
      ]

      const result = getPrimaryMonitor(monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Left Monitor')
    })

    it('显示器列表为空，返回 null', () => {
      const monitors: Monitor[] = []

      const result = getPrimaryMonitor(monitors)

      expect(result).toBeNull()
    })

    it('单个显示器，返回该显示器', () => {
      const monitors: Monitor[] = [createMockMonitor(0, 0, 1920, 1080, 'Only Monitor')]

      const result = getPrimaryMonitor(monitors)

      expect(result).not.toBeNull()
      expect(result?.name).toBe('Only Monitor')
    })
  })

  describe('显示器断开连接回退逻辑', () => {
    it('目标显示器不可用时，应回退到主显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        // 注意：没有副显示器
      ]

      // 时钟坐标指向一个不存在的副屏
      const clockRect: PopupRect = {
        left: 3620,
        top: 1030,
        right: 3840,
        bottom: 1080,
      }

      // 查找显示器会返回 null
      const foundMonitor = findMonitorByClockRect(clockRect, monitors)
      expect(foundMonitor).toBeNull()

      // 应该回退到主显示器
      const fallbackMonitor = getPrimaryMonitor(monitors)
      expect(fallbackMonitor).not.toBeNull()
      expect(fallbackMonitor?.name).toBe('Primary')
    })

    it('时钟坐标超出所有显示器范围，回退到主显示器', () => {
      const monitors: Monitor[] = [
        createMockMonitor(0, 0, 1920, 1080, 'Primary'),
        createMockMonitor(1920, 0, 1920, 1080, 'Secondary'),
      ]

      // 时钟坐标超出范围
      const clockRect: PopupRect = {
        left: 5000,
        top: 5000,
        right: 5220,
        bottom: 5050,
      }

      const foundMonitor = findMonitorByClockRect(clockRect, monitors)
      expect(foundMonitor).toBeNull()

      // 回退到主显示器
      const fallbackMonitor = getPrimaryMonitor(monitors)
      expect(fallbackMonitor?.name).toBe('Primary')
    })
  })
})
