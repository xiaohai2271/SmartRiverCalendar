import { describe, it, expect } from 'vitest'
import {
  isMultiDayEvent,
  isEventOnDay,
  getEventSpanInfo
} from '../utils/date'
import { computeEventLanes } from '../composables/useEventLanes'
import type { CalendarEvent } from '../types'

// 辅助函数：创建指定日期时间的时间戳（毫秒）
function ts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month, day, hour, minute, second).getTime()
}

// 辅助函数：创建事件对象
function createEvent(
  id: string,
  startTime: number,
  endTime: number,
  allDay = false
): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    startTime,
    endTime,
    allDay,
    calendarId: 'cal-1',
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
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

// 泳道排序集成测试
// 模拟 MonthView 的 getEventsForDay() 行为，验证泳道排序逻辑

/** 模拟的泳道映射类型（与 useEventLanes.ts 保持一致） */
type EventLaneMap = Map<string, number>

/** 模拟 computeEventLanes 函数（实际在 useEventLanes.ts 中实现） */
function mockComputeEventLanes(events: any[], monthDate: Date): EventLaneMap {
  const laneMap = new Map<string, number>()
  const sortedEvents = [...events].sort((a, b) => {
    const spanA = getEventSpanInfo(a, monthDate).spanDays
    const spanB = getEventSpanInfo(b, monthDate).spanDays
    return spanB - spanA
  })

  let currentLane = 0
  const laneEndTime: number[] = []

  for (const event of sortedEvents) {
    let assignedLane = currentLane
    for (let lane = 0; lane <= currentLane; lane++) {
      if (!laneEndTime[lane] || laneEndTime[lane] <= event.startTime) {
        assignedLane = lane
        break
      }
    }
    laneMap.set(event.id, assignedLane)
    laneEndTime[assignedLane] = event.endTime
    if (assignedLane === currentLane) {
      currentLane++
    }
  }
  return laneMap
}

/** 模拟 getEventsForDay 的排序逻辑（集成泳道信息） */
function mockGetEventsForDayWithLanes(
  events: any[],
  day: Date,
  monthDate: Date
): (a: any, b: any) => number {
  // 预计算泳道和排序值
  const laneInfo = computeEventLanes(events.filter(isMultiDayEvent), monthDate)

  return (a: any, b: any) => {
    const aIsMultiDay = isMultiDayEvent(a)
    const bIsMultiDay = isMultiDayEvent(b)
    const aSpanDays = getEventSpanInfo(a, day).spanDays
    const bSpanDays = getEventSpanInfo(b, day).spanDays

    // 多天事件排在单天事件前面
    if (aIsMultiDay && !bIsMultiDay) return -1
    if (!aIsMultiDay && bIsMultiDay) return 1

    // 都是多天事件：按泳道号排序
    if (aIsMultiDay && bIsMultiDay) {
      const aLane = laneInfo.get(a.id) ?? 0
      const bLane = laneInfo.get(b.id) ?? 0
      if (aLane !== bLane) return aLane - bLane
      // 同泳道：按跨天数降序
      return bSpanDays - aSpanDays
    }

    // 都是单天事件：按开始时间升序排序
    return a.startTime - b.startTime
  }
}

describe('月视图泳道集成场景', () => {
  it('getEventsForDay应返回带泳道信息的事件列表', () => {
    // 创建多天事件（应有泳道）
    const multiDayEvent1 = {
      id: 'event1',
      startTime: ts(2024, 0, 10, 9, 0),
      endTime: ts(2024, 0, 12, 18, 0) // 3天
    }
    const multiDayEvent2 = {
      id: 'event2',
      startTime: ts(2024, 0, 11, 10, 0),
      endTime: ts(2024, 0, 13, 17, 0) // 3天
    }
    // 创建单天事件（无泳道）
    const singleDayEvent = {
      id: 'event3',
      startTime: ts(2024, 0, 11, 14, 0),
      endTime: ts(2024, 0, 11, 15, 0)
    }

    const events = [singleDayEvent, multiDayEvent1, multiDayEvent2]
    const day = new Date(2024, 0, 11)
    const monthDate = new Date(2024, 0, 1)

    // 计算泳道
    const laneMap = mockComputeEventLanes(events, monthDate)
    void laneMap // 标记为已使用，避免 TS6133 警告

    // 排序（模拟 getEventsForDay 行为）
    const sorted = [...events].sort(mockGetEventsForDayWithLanes(events, day, monthDate))

    // 验证：多天事件排在前面
    expect(sorted[0].id).toBe('event1') // 泳道0，跨天数3
    expect(sorted[1].id).toBe('event2') // 泳道1，跨天数3
    expect(sorted[2].id).toBe('event3') // 单天事件排在最后
  })

  it('跨月边界事件的泳道应一致', () => {
    // 跨月事件：3/31 → 4/2
    const crossMonthEvent = {
      id: 'cross-month',
      startTime: ts(2024, 2, 31, 9, 0), // 3月31日
      endTime: ts(2024, 3, 2, 18, 0) // 4月2日
    }

    const monthDate = new Date(2024, 3, 1) // 4月

    // 在4月视图中计算泳道
    const laneMap = mockComputeEventLanes([crossMonthEvent], monthDate)

    // 验证：跨月事件在4月视图中有泳道
    expect(laneMap.get('cross-month')).toBeDefined()

    // 验证在4月的每一天都有正确的跨天数
    const day1 = new Date(2024, 3, 1) // 4月1日
    const day2 = new Date(2024, 3, 2) // 4月2日
    expect(getEventSpanInfo(crossMonthEvent, day1).spanDays).toBe(3)
    expect(getEventSpanInfo(crossMonthEvent, day2).spanDays).toBe(3)
  })

  it('仅有单天事件时按开始时间排序', () => {
    // 3个单天事件，时间不同
    const event1 = { id: 'e1', startTime: ts(2024, 0, 15, 10, 0), endTime: ts(2024, 0, 15, 11, 0) }
    const event2 = { id: 'e2', startTime: ts(2024, 0, 15, 9, 0), endTime: ts(2024, 0, 15, 10, 0) }
    const event3 = { id: 'e3', startTime: ts(2024, 0, 15, 14, 0), endTime: ts(2024, 0, 15, 15, 0) }

    const events = [event1, event2, event3]
    const day = new Date(2024, 0, 15)
    const monthDate = new Date(2024, 0, 1)

    const sorted = [...events].sort(mockGetEventsForDayWithLanes(events, day, monthDate))

    // 验证：无泳道时，按开始时间升序排序
    expect(sorted[0].id).toBe('e2') // 9:00
    expect(sorted[1].id).toBe('e1') // 10:00
    expect(sorted[2].id).toBe('e3') // 14:00
  })

  it('多天事件应在单天事件之前', () => {
    // 多天事件
    const multiDayEvent = {
      id: 'multi',
      startTime: ts(2024, 0, 14, 9, 0),
      endTime: ts(2024, 0, 16, 18, 0) // 3天
    }
    // 单天事件（开始时间更早）
    const singleDayEvent = {
      id: 'single',
      startTime: ts(2024, 0, 15, 8, 0), // 早于多天事件的开始时间
      endTime: ts(2024, 0, 15, 9, 0)
    }

    const events = [singleDayEvent, multiDayEvent]
    const day = new Date(2024, 0, 15)
    const monthDate = new Date(2024, 0, 1)

    const sorted = [...events].sort(mockGetEventsForDayWithLanes(events, day, monthDate))

    // 验证：多天事件排在前面，即使单天事件开始时间更早
    expect(sorted[0].id).toBe('multi') // 多天事件优先
    expect(sorted[1].id).toBe('single') // 单天事件在后
  })

  it('事件数超过maxEventBars时正确截断', () => {
    const maxEventBars = 5

    // 创建6个事件（超过限制）
    const multiDay1 = { id: 'm1', startTime: ts(2024, 0, 10, 9, 0), endTime: ts(2024, 0, 15, 18, 0) }
    const multiDay2 = { id: 'm2', startTime: ts(2024, 0, 11, 10, 0), endTime: ts(2024, 0, 14, 17, 0) }
    const single1 = { id: 's1', startTime: ts(2024, 0, 15, 8, 0), endTime: ts(2024, 0, 15, 9, 0) }
    const single2 = { id: 's2', startTime: ts(2024, 0, 15, 10, 0), endTime: ts(2024, 0, 15, 11, 0) }
    const single3 = { id: 's3', startTime: ts(2024, 0, 15, 12, 0), endTime: ts(2024, 0, 15, 13, 0) }
    const single4 = { id: 's4', startTime: ts(2024, 0, 15, 14, 0), endTime: ts(2024, 0, 15, 15, 0) }

    const events = [single1, single2, single3, single4, multiDay1, multiDay2]
    const day = new Date(2024, 0, 15)
    const monthDate = new Date(2024, 0, 1)

    const sorted = [...events].sort(mockGetEventsForDayWithLanes(events, day, monthDate))

    // 验证：前5个事件被显示，超过的部分被截断
    const visibleEvents = sorted.slice(0, maxEventBars)
    const hiddenCount = Math.max(0, events.length - maxEventBars)

    expect(visibleEvents.length).toBe(maxEventBars)
    expect(hiddenCount).toBe(1) // 有1个事件被隐藏

    // 验证：多天事件排在前面
    expect(visibleEvents[0].id).toBe('m1')
    expect(visibleEvents[1].id).toBe('m2')

    // 验证：单天事件按开始时间排序
    expect(visibleEvents[2].id).toBe('s1') // 8:00
    expect(visibleEvents[3].id).toBe('s2') // 10:00
    expect(visibleEvents[4].id).toBe('s3') // 12:00

    // s4 被截断
    expect(sorted[5].id).toBe('s4')
  })
})

describe('泳道分配算法', () => {
  it('不重叠的跨天事件应共享同一泳道', () => {
    // Event A: 4月1日 00:00 → 4月2日 00:00
    const eventA = createEvent('A', ts(2024, 3, 1, 0, 0), ts(2024, 3, 2, 0, 0))
    // Event B: 4月3日 00:00 → 4月4日 00:00
    const eventB = createEvent('B', ts(2024, 3, 3, 0, 0), ts(2024, 3, 4, 0, 0))

    const events = [eventA, eventB]
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    expect(lanes.get(eventA.id)).toBe(0)
    expect(lanes.get(eventB.id)).toBe(0)
  })

  it('重叠的跨天事件应占用不同泳道', () => {
    // Event A: 4月1日 00:00 → 4月3日 00:00
    const eventA = createEvent('A', ts(2024, 3, 1, 0, 0), ts(2024, 3, 3, 0, 0))
    // Event B: 4月2日 00:00 → 4月4日 00:00（与A在4月2日重叠）
    const eventB = createEvent('B', ts(2024, 3, 2, 0, 0), ts(2024, 3, 4, 0, 0))

    const events = [eventA, eventB]
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    expect(lanes.get(eventA.id)).toBe(0)
    expect(lanes.get(eventB.id)).toBe(1)
  })

  it('三事件链应正确紧凑分配', () => {
    // Event A: 4月1日 → 4月2日
    const eventA = createEvent('A', ts(2024, 3, 1, 0, 0), ts(2024, 3, 2, 0, 0))
    // Event B: 4月2日 → 4月3日（与A在4月2日重叠）
    const eventB = createEvent('B', ts(2024, 3, 2, 0, 0), ts(2024, 3, 3, 0, 0))
    // Event C: 4月3日 → 4月4日（与B在4月3日重叠，但与A不重叠）
    const eventC = createEvent('C', ts(2024, 3, 3, 0, 0), ts(2024, 3, 4, 0, 0))

    const events = [eventA, eventB, eventC]
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    // 紧凑分配：A和C不重叠，可共享泳道0；B与两者重叠，占用泳道1
    expect(lanes.get(eventA.id)).toBe(0)
    expect(lanes.get(eventB.id)).toBe(1)
    expect(lanes.get(eventC.id)).toBe(0)
  })

  it('用户报告场景：部分重叠应分配不同泳道', () => {
    // 用户反馈：4月1日00:00→4月2日09:00 与 4月2日10:00→4月3日15:00
    // 这两个事件在4月2日09:00-10:00之间有空隙，理论上不重叠
    // 但按照日视图的粒度（以天为单位），它们都覆盖了4月2日这一天
    // 因此应视为重叠，分配不同泳道

    // Event E1: 4月1日 00:00 → 4月2日 09:00
    const eventE1 = createEvent('E1', ts(2024, 3, 1, 0, 0), ts(2024, 3, 2, 9, 0))
    // Event E2: 4月2日 10:00 → 4月3日 15:00
    const eventE2 = createEvent('E2', ts(2024, 3, 2, 10, 0), ts(2024, 3, 3, 15, 0))

    const events = [eventE1, eventE2]
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    // 两个事件都覆盖4月2日，视为重叠，占用不同泳道
    expect(lanes.get(eventE1.id)).toBe(0)
    expect(lanes.get(eventE2.id)).toBe(1)
  })

  it('空事件列表返回空映射', () => {
    const events: CalendarEvent[] = []
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    expect(lanes.size).toBe(0)
  })

  it('单个事件应分配到泳道0', () => {
    const event = createEvent('single', ts(2024, 3, 1, 9, 0), ts(2024, 3, 1, 18, 0))

    const events = [event]
    const monthDate = new Date(2024, 3, 1) // 2024年4月

    const lanes = computeEventLanes(events, monthDate)

    expect(lanes.get(event.id)).toBe(0)
    expect(lanes.size).toBe(1)
  })
})
