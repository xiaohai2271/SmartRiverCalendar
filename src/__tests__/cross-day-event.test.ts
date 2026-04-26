import { describe, it, expect } from 'vitest'
import {
  isMultiDayEvent,
  isEventOnDay,
  getEventSpanInfo
} from '../utils/date'

// 辅助函数：创建指定日期时间的时间戳（毫秒）
function ts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month, day, hour, minute, second).getTime()
}

describe('跨天事件工具函数', () => {
  describe('isMultiDayEvent', () => {
    it('单日事件应返回 false', () => {
      // 同一天内开始和结束
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
      expect(isMultiDayEvent(event)).toBe(false)
    })

    it('跨1天的事件应返回 true', () => {
      // 1月15日晚 → 1月16日上午
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 16, 10, 0) }
      expect(isMultiDayEvent(event)).toBe(true)
    })

    it('跨多天的事件应返回 true', () => {
      // 1月15日 → 1月18日
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 18, 18, 0) }
      expect(isMultiDayEvent(event)).toBe(true)
    })

    it('全天事件结束时间为次日00:00应返回 false', () => {
      // 1月15日 00:00 → 1月16日 00:00，视为单天全天事件
      const event = { startTime: ts(2024, 0, 15, 0, 0), endTime: ts(2024, 0, 16, 0, 0) }
      expect(isMultiDayEvent(event)).toBe(false)
    })

    it('跨月事件应返回 true', () => {
      // 1月31日 → 2月2日
      const event = { startTime: ts(2024, 0, 31, 9, 0), endTime: ts(2024, 1, 2, 18, 0) }
      expect(isMultiDayEvent(event)).toBe(true)
    })

    it('跨年事件应返回 true', () => {
      // 2024年12月31日 → 2025年1月2日
      const event = { startTime: ts(2024, 11, 31, 20, 0), endTime: ts(2025, 0, 2, 10, 0) }
      expect(isMultiDayEvent(event)).toBe(true)
    })

    it('午夜边界：结束时间恰好在次日00:00:00应视为全天事件', () => {
      const event = { startTime: ts(2024, 5, 10, 0, 0), endTime: ts(2024, 5, 11, 0, 0) }
      expect(isMultiDayEvent(event)).toBe(false)
    })

    it('结束时间超过次日00:00应返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 0, 0), endTime: ts(2024, 0, 16, 0, 0, 1) }
      expect(isMultiDayEvent(event)).toBe(true)
    })
  })

  describe('isEventOnDay', () => {
    it('单日事件在同一天应返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 15))).toBe(true)
    })

    it('单日事件不在同一天应返回 false', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 16))).toBe(false)
    })

    it('跨天事件在开始天应返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 17, 10, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 15))).toBe(true)
    })

    it('跨天事件在结束天应返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 17, 10, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 17))).toBe(true)
    })

    it('跨天事件在中间天应返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 17, 10, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 16))).toBe(true)
    })

    it('跨天事件在范围外应返回 false', () => {
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 17, 10, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 14))).toBe(false)
      expect(isEventOnDay(event, new Date(2024, 0, 18))).toBe(false)
    })

    it('全天事件（结束为次日00:00）应在开始天返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 0, 0), endTime: ts(2024, 0, 16, 0, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 15))).toBe(true)
    })

    it('全天事件（结束为次日00:00）不应在次日返回 true', () => {
      const event = { startTime: ts(2024, 0, 15, 0, 0), endTime: ts(2024, 0, 16, 0, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 16))).toBe(false)
    })

    it('跨月事件应正确判断', () => {
      const event = { startTime: ts(2024, 0, 31, 9, 0), endTime: ts(2024, 1, 2, 18, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 31))).toBe(true)
      expect(isEventOnDay(event, new Date(2024, 1, 1))).toBe(true)
      expect(isEventOnDay(event, new Date(2024, 1, 2))).toBe(true)
      expect(isEventOnDay(event, new Date(2024, 1, 3))).toBe(false)
    })

    it('day 参数的时间部分不影响判断', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
      expect(isEventOnDay(event, new Date(2024, 0, 15, 22, 0))).toBe(true)
    })
  })

  describe('getEventSpanInfo', () => {
    it('单日事件：isStart=isEnd=true, isMiddle=false, spanDays=1', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 15))
      expect(info).toEqual({ isStart: true, isEnd: true, isMiddle: false, spanDays: 1 })
    })

    it('跨天事件在开始天：isStart=true, isEnd=false', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 17, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 15))
      expect(info).toEqual({ isStart: true, isEnd: false, isMiddle: false, spanDays: 3 })
    })

    it('跨天事件在中间天：isStart=false, isEnd=false, isMiddle=true', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 17, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 16))
      expect(info).toEqual({ isStart: false, isEnd: false, isMiddle: true, spanDays: 3 })
    })

    it('跨天事件在结束天：isStart=false, isEnd=true', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 17, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 17))
      expect(info).toEqual({ isStart: false, isEnd: true, isMiddle: false, spanDays: 3 })
    })

    it('跨2天事件：spanDays=2', () => {
      const event = { startTime: ts(2024, 0, 15, 20, 0), endTime: ts(2024, 0, 16, 10, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 15))
      expect(info.spanDays).toBe(2)
      expect(info.isStart).toBe(true)
      expect(info.isEnd).toBe(false)
    })

    it('全天事件（结束为次日00:00）在开始天：spanDays=1, isStart=isEnd=true', () => {
      const event = { startTime: ts(2024, 0, 15, 0, 0), endTime: ts(2024, 0, 16, 0, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 15))
      expect(info).toEqual({ isStart: true, isEnd: true, isMiddle: false, spanDays: 1 })
    })

    it('跨月事件应正确计算 spanDays', () => {
      const event = { startTime: ts(2024, 0, 31, 9, 0), endTime: ts(2024, 1, 2, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 1, 1))
      expect(info.spanDays).toBe(3)
      expect(info.isMiddle).toBe(true)
    })

    it('不在事件范围内的天应返回全 false', () => {
      const event = { startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 17, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 14))
      expect(info).toEqual({ isStart: false, isEnd: false, isMiddle: false, spanDays: 3 })
    })

    it('跨7天事件应正确计算 spanDays=7', () => {
      const event = { startTime: ts(2024, 0, 1, 9, 0), endTime: ts(2024, 0, 7, 18, 0) }
      const info = getEventSpanInfo(event, new Date(2024, 0, 4))
      expect(info.spanDays).toBe(7)
      expect(info.isMiddle).toBe(true)
    })
  })

  describe('毫秒精度容差', () => {
    it('单天事件 endTime 为次日 00:00:00.001 应识别为单天', () => {
      const event = {
        startTime: ts(2024, 0, 15, 0, 0),
        endTime: new Date(2024, 0, 16, 0, 0, 0, 1).getTime(), // 次日零点 + 1ms
        allDay: false
      }
      expect(isMultiDayEvent(event as any)).toBe(false)
    })

    it('getEventSpanInfo 对毫秒偏差的单天事件应返回 spanDays=1', () => {
      const event = {
        startTime: ts(2024, 0, 15, 0, 0),
        endTime: new Date(2024, 0, 16, 0, 0, 0, 500).getTime(), // 次日零点 + 500ms
        allDay: false
      }
      const info = getEventSpanInfo(event as any, new Date(2024, 0, 15))
      expect(info.spanDays).toBe(1)
      expect(info.isStart).toBe(true)
      expect(info.isEnd).toBe(true)
    })

    it('单天事件 endTime 为次日 00:00:00.999 仍在容差内', () => {
      const event = {
        startTime: ts(2024, 0, 15, 0, 0),
        endTime: new Date(2024, 0, 16, 0, 0, 0, 999).getTime(), // 次日零点 + 999ms
        allDay: false
      }
      expect(isMultiDayEvent(event as any)).toBe(false)
    })

    it('单天事件 endTime 为次日 00:00:01（超过容差）应识别为跨天', () => {
      const event = {
        startTime: ts(2024, 0, 15, 0, 0),
        endTime: ts(2024, 0, 16, 0, 0, 1), // 次日零点 + 1s（超出容差）
        allDay: false
      }
      expect(isMultiDayEvent(event as any)).toBe(true)
    })
  })
})
