import { describe, it, expect } from 'vitest'
import { isEventOnDay } from '../utils/date'

// 辅助函数：创建指定日期时间的时间戳（毫秒）
function ts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month, day, hour, minute, second).getTime()
}

// 辅助函数：创建事件对象
interface SimpleEvent {
  id: string
  startTime: number
  endTime: number
  title?: string
  allDay?: boolean
}

function createEvent(
  id: string,
  startTime: number,
  endTime: number,
  allDay = false
): SimpleEvent {
  return {
    id,
    title: `Event ${id}`,
    startTime,
    endTime,
    allDay
  }
}

/**
 * 时间交集匹配函数（模拟 ScheduleView 中的筛选逻辑）
 * 重叠条件：event.startTime < searchEnd && event.endTime > searchStart
 */
function eventsOverlapRange(
  event: SimpleEvent,
  searchStart: number,
  searchEnd: number
): boolean {
  return event.startTime < searchEnd && event.endTime > searchStart
}

describe('时间交集匹配逻辑', () => {
  describe('事件完全在范围内', () => {
    it('事件完全落在搜索范围内应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0) // 1月17日结束 + 1天

      // 事件：1月16日 09:00 - 18:00
      const event = createEvent('e1', ts(2024, 0, 16, 9, 0), ts(2024, 0, 16, 18, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('全天事件完全落在搜索范围内应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 全天事件：1月16日
      const event = createEvent('e2', ts(2024, 0, 16, 0, 0), ts(2024, 0, 17, 0, 0), true)

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })
  })

  describe('事件部分重叠', () => {
    it('事件开始时间在搜索范围内应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月14日 20:00 - 1月16日 10:00（开始时间在搜索范围内）
      const event = createEvent('e3', ts(2024, 0, 14, 20, 0), ts(2024, 0, 16, 10, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('事件结束时间在搜索范围内应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月16日 10:00 - 1月18日 20:00（结束时间在搜索范围内）
      const event = createEvent('e4', ts(2024, 0, 16, 10, 0), ts(2024, 0, 18, 20, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('事件完全包含搜索范围应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月14日 00:00 - 1月20日 00:00（完全包含搜索范围）
      const event = createEvent('e5', ts(2024, 0, 14, 0, 0), ts(2024, 0, 20, 0, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('事件开始时间恰好在搜索范围边界应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月17日 00:00 - 1月18日 10:00（开始时间恰好在搜索范围结束边界）
      const event = createEvent('e6', ts(2024, 0, 17, 0, 0), ts(2024, 0, 18, 10, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('事件结束时间恰好在搜索范围边界应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月14日 10:00 - 1月15日 00:00:01（结束时间刚过搜索范围开始边界）
      const event = createEvent('e7', ts(2024, 0, 14, 10, 0), ts(2024, 0, 15, 0, 0, 1))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })
  })

  describe('事件无重叠', () => {
    it('事件完全在搜索范围之前不应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月13日 09:00 - 1月14日 18:00（完全在之前）
      const event = createEvent('e8', ts(2024, 0, 13, 9, 0), ts(2024, 0, 14, 18, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(false)
    })

    it('事件完全在搜索范围之后不应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月18日 09:00 - 1月20日 18:00（完全在之后）
      const event = createEvent('e9', ts(2024, 0, 18, 9, 0), ts(2024, 0, 20, 18, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(false)
    })

    it('事件结束时间恰好在搜索开始边界不应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月14日 09:00 - 1月15日 00:00（结束时间恰好在搜索范围开始边界）
      const event = createEvent('e10', ts(2024, 0, 14, 9, 0), ts(2024, 0, 15, 0, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(false)
    })

    it('事件开始时间恰好在搜索结束边界不应匹配', () => {
      // 搜索范围：1月15日 - 1月17日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月18日 00:00 - 1月19日 18:00（开始时间恰好在搜索范围结束边界）
      const event = createEvent('e11', ts(2024, 0, 18, 0, 0), ts(2024, 0, 19, 18, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(false)
    })
  })

  describe('只有开始日期或只有结束日期', () => {
    it('只有开始日期时，endTime > searchStart 的事件应匹配', () => {
      // 搜索开始：1月15日
      const searchStart = ts(2024, 0, 15, 0, 0)

      // 事件：1月15日 10:00 - 1月16日 18:00（endTime > searchStart）
      const event1 = createEvent('e12', ts(2024, 0, 15, 10, 0), ts(2024, 0, 16, 18, 0))
      expect(event1.endTime > searchStart).toBe(true)

      // 事件：1月14日 09:00 - 1月14日 18:00（endTime <= searchStart）
      const event2 = createEvent('e13', ts(2024, 0, 14, 9, 0), ts(2024, 0, 14, 18, 0))
      expect(event2.endTime > searchStart).toBe(false)
    })

    it('只有结束日期时，startTime < searchEnd 的事件应匹配', () => {
      // 搜索结束：1月17日（包含当天）
      const searchEnd = ts(2024, 0, 18, 0, 0)

      // 事件：1月16日 10:00 - 1月18日 18:00（startTime < searchEnd）
      const event1 = createEvent('e14', ts(2024, 0, 16, 10, 0), ts(2024, 0, 18, 18, 0))
      expect(event1.startTime < searchEnd).toBe(true)

      // 事件：1月18日 00:00 - 1月20日 18:00（startTime >= searchEnd）
      const event2 = createEvent('e15', ts(2024, 0, 18, 0, 0), ts(2024, 0, 20, 18, 0))
      expect(event2.startTime < searchEnd).toBe(false)
    })
  })

  describe('边界情况', () => {
    it('跨月事件应正确判断', () => {
      // 搜索范围：1月31日 - 2月2日
      const searchStart = ts(2024, 0, 31, 0, 0)
      const searchEnd = ts(2024, 1, 3, 0, 0) // 2月2日结束 + 1天

      // 事件：1月31日 09:00 - 2月2日 18:00
      const event = createEvent('e16', ts(2024, 0, 31, 9, 0), ts(2024, 1, 2, 18, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('跨年事件应正确判断', () => {
      // 搜索范围：2024年12月31日 - 2025年1月2日
      const searchStart = ts(2024, 11, 31, 0, 0)
      const searchEnd = ts(2025, 0, 3, 0, 0)

      // 事件：2024年12月31日 20:00 - 2025年1月2日 10:00
      const event = createEvent('e17', ts(2024, 11, 31, 20, 0), ts(2025, 0, 2, 10, 0))

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })

    it('全天事件（结束为次日00:00）应正确判断', () => {
      // 搜索范围：1月15日 - 1月16日
      const searchStart = ts(2024, 0, 15, 0, 0)
      const searchEnd = ts(2024, 0, 17, 0, 0) // 1月16日结束 + 1天

      // 全天事件：1月15日
      const event = createEvent('e18', ts(2024, 0, 15, 0, 0), ts(2024, 0, 16, 0, 0), true)

      expect(eventsOverlapRange(event, searchStart, searchEnd)).toBe(true)
    })
  })
})

/**
 * 固定分组函数（模拟 ScheduleView 中的分组逻辑）
 */
interface EventGroup {
  key: 'yesterday' | 'today' | 'tomorrow' | 'nextWeek'
  title: string
  events: SimpleEvent[]
}

function getGroupTitle(date: Date): string {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekDay = weekDays[date.getDay()]
  return `${year}年${month}月${day}日 周${weekDay}`
}

function groupEventsByFixedGroups(events: SimpleEvent[], baseDate: Date): EventGroup[] {
  const today = new Date(baseDate)
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // 创建固定分组结构
  const groups: EventGroup[] = [
    { key: 'yesterday', title: getGroupTitle(yesterday), events: [] },
    { key: 'today', title: getGroupTitle(today), events: [] },
    { key: 'tomorrow', title: getGroupTitle(tomorrow), events: [] },
    { key: 'nextWeek', title: '未来一周', events: [] }
  ]

  // 为每个事件分配到对应的分组
  for (const event of events) {
    // 检查事件是否属于昨日分组
    if (isEventOnDay(event, yesterday)) {
      groups[0].events.push(event)
    }
    // 检查事件是否属于今日分组
    if (isEventOnDay(event, today)) {
      groups[1].events.push(event)
    }
    // 检查事件是否属于明日分组
    if (isEventOnDay(event, tomorrow)) {
      groups[2].events.push(event)
    }
    // 检查事件是否属于未来一周分组（未来2-7天）
    for (let i = 2; i <= 7; i++) {
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + i)
      if (isEventOnDay(event, futureDate)) {
        groups[3].events.push(event)
        break // 每个跨天事件在未来一周分组只显示一次
      }
    }
  }

  // 过滤掉空分组，并移除重复事件（使用事件ID去重）
  return groups
    .map(group => ({
      ...group,
      events: [...new Map(group.events.map(e => [e.id, e])).values()]
    }))
    .filter(group => group.events.length > 0)
}

describe('固定分组逻辑', () => {
  // 固定基准日期：2024年1月15日
  const baseDate = new Date(2024, 0, 15, 0, 0, 0)

  describe('昨日分组', () => {
    it('发生在昨日的事件应分配到昨日分组', () => {
      // 事件：1月14日 09:00 - 18:00
      const event = createEvent('e1', ts(2024, 0, 14, 9, 0), ts(2024, 0, 14, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.length).toBe(1)
      expect(groups[0].key).toBe('yesterday')
      expect(groups[0].events.length).toBe(1)
      expect(groups[0].events[0].id).toBe('e1')
    })

    it('跨天事件（昨日开始）应在昨日分组显示', () => {
      // 事件：1月14日 20:00 - 1月16日 10:00
      const event = createEvent('e2', ts(2024, 0, 14, 20, 0), ts(2024, 0, 16, 10, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.some(g => g.key === 'yesterday' && g.events.some(e => e.id === 'e2'))).toBe(true)
    })
  })

  describe('今日分组', () => {
    it('发生在今日的事件应分配到今日分组', () => {
      // 事件：1月15日 09:00 - 18:00
      const event = createEvent('e3', ts(2024, 0, 15, 9, 0), ts(2024, 0, 15, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.length).toBe(1)
      expect(groups[0].key).toBe('today')
      expect(groups[0].events.length).toBe(1)
      expect(groups[0].events[0].id).toBe('e3')
    })

    it('全天事件发生在今日应分配到今日分组', () => {
      // 全天事件：1月15日
      const event = createEvent('e4', ts(2024, 0, 15, 0, 0), ts(2024, 0, 16, 0, 0), true)

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.some(g => g.key === 'today' && g.events.some(e => e.id === 'e4'))).toBe(true)
    })
  })

  describe('明日分组', () => {
    it('发生在明日的事件应分配到明日分组', () => {
      // 事件：1月16日 09:00 - 18:00
      const event = createEvent('e5', ts(2024, 0, 16, 9, 0), ts(2024, 0, 16, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.length).toBe(1)
      expect(groups[0].key).toBe('tomorrow')
      expect(groups[0].events.length).toBe(1)
      expect(groups[0].events[0].id).toBe('e5')
    })
  })

  describe('未来一周分组', () => {
    it('发生在未来2-7天的事件应分配到未来一周分组', () => {
      // 事件：1月17日 09:00 - 18:00（未来2天）
      const event1 = createEvent('e6', ts(2024, 0, 17, 9, 0), ts(2024, 0, 17, 18, 0))
      // 事件：1月20日 09:00 - 18:00（未来5天）
      const event2 = createEvent('e7', ts(2024, 0, 20, 9, 0), ts(2024, 0, 20, 18, 0))

      const groups = groupEventsByFixedGroups([event1, event2], baseDate)

      expect(groups.some(g => g.key === 'nextWeek' && g.events.length === 2)).toBe(true)
    })

    it('发生在未来8天的事件不应分配到未来一周分组', () => {
      // 事件：1月23日 09:00 - 18:00（未来8天）
      const event = createEvent('e8', ts(2024, 0, 23, 9, 0), ts(2024, 0, 23, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.length).toBe(0) // 事件不在任何固定分组内
    })

    it('跨天事件在未来一周分组只显示一次', () => {
      // 跨天事件：1月17日 09:00 - 1月20日 18:00（跨越未来2-5天）
      const event = createEvent('e9', ts(2024, 0, 17, 9, 0), ts(2024, 0, 20, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      const nextWeekGroup = groups.find(g => g.key === 'nextWeek')
      if (nextWeekGroup) {
        expect(nextWeekGroup.events.length).toBe(1)
        expect(nextWeekGroup.events[0].id).toBe('e9')
      }
    })
  })

  describe('跨天事件多组显示', () => {
    it('跨天事件应在多个分组中显示', () => {
      // 跨天事件：1月14日 20:00 - 1月16日 10:00（跨越昨日、今日、明日）
      const event = createEvent('e10', ts(2024, 0, 14, 20, 0), ts(2024, 0, 16, 10, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      // 应出现在昨日、今日、明日三个分组
      expect(groups.length).toBe(3)
      expect(groups.map(g => g.key)).toEqual(['yesterday', 'today', 'tomorrow'])

      // 每个分组都包含该事件
      for (const group of groups) {
        expect(group.events.some(e => e.id === 'e10')).toBe(true)
      }
    })

    it('跨天事件跨越未来一周应在多个分组显示', () => {
      // 跨天事件：1月15日 09:00 - 1月20日 18:00（跨越今日、明日、未来一周）
      const event = createEvent('e11', ts(2024, 0, 15, 9, 0), ts(2024, 0, 20, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      // 应出现在今日、明日、未来一周三个分组
      expect(groups.length).toBe(3)
      expect(groups.map(g => g.key)).toEqual(['today', 'tomorrow', 'nextWeek'])
    })
  })

  describe('事件ID去重', () => {
    it('同一事件在分组内不应重复', () => {
      // 事件：1月15日 09:00 - 18:00
      const event = createEvent('e12', ts(2024, 0, 15, 9, 0), ts(2024, 0, 15, 18, 0))

      // 重复添加同一事件
      const events = [event, event]

      const groups = groupEventsByFixedGroups(events, baseDate)

      // 今日分组内应只有一个事件（去重）
      const todayGroup = groups.find(g => g.key === 'today')
      expect(todayGroup?.events.length).toBe(1)
    })

    it('不同事件在分组内应保持独立', () => {
      // 事件1：1月15日 09:00 - 10:00
      const event1 = createEvent('e13', ts(2024, 0, 15, 9, 0), ts(2024, 0, 15, 10, 0))
      // 事件2：1月15日 14:00 - 15:00
      const event2 = createEvent('e14', ts(2024, 0, 15, 14, 0), ts(2024, 0, 15, 15, 0))

      const groups = groupEventsByFixedGroups([event1, event2], baseDate)

      // 今日分组内应有两个不同事件
      const todayGroup = groups.find(g => g.key === 'today')
      expect(todayGroup?.events.length).toBe(2)
      expect(todayGroup?.events.map(e => e.id)).toEqual(['e13', 'e14'])
    })
  })

  describe('空分组过滤', () => {
    it('空分组应被过滤掉', () => {
      // 事件：1月20日 09:00 - 18:00（未来5天，只在未来一周分组）
      const event = createEvent('e15', ts(2024, 0, 20, 9, 0), ts(2024, 0, 20, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      // 只有未来一周分组，其他空分组被过滤
      expect(groups.length).toBe(1)
      expect(groups[0].key).toBe('nextWeek')
    })

    it('所有分组为空时应返回空数组', () => {
      // 事件：1月25日 09:00 - 18:00（未来10天，不在固定分组范围内）
      const event = createEvent('e16', ts(2024, 0, 25, 9, 0), ts(2024, 0, 25, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      expect(groups.length).toBe(0)
    })
  })

  describe('分组标题格式', () => {
    it('分组标题应为 YYYY年M月D日 周X 格式', () => {
      // 事件：1月15日
      const event = createEvent('e17', ts(2024, 0, 15, 9, 0), ts(2024, 0, 15, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      const todayGroup = groups.find(g => g.key === 'today')
      expect(todayGroup?.title).toBe('2024年1月15日 周一')
    })

    it('未来一周分组标题应为固定文本', () => {
      // 事件：1月17日
      const event = createEvent('e18', ts(2024, 0, 17, 9, 0), ts(2024, 0, 17, 18, 0))

      const groups = groupEventsByFixedGroups([event], baseDate)

      const nextWeekGroup = groups.find(g => g.key === 'nextWeek')
      expect(nextWeekGroup?.title).toBe('未来一周')
    })
  })
})