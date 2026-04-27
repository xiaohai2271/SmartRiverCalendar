/**
 * 泳道分配逻辑
 * 用于月视图中跨天事件的垂直布局优化
 */

import type { CalendarEvent } from '@/types'
import { startOfDay } from '@/utils/date'

/**
 * 事件泳道映射
 * key: event.id
 * value: lane number (0, 1, 2, ...)
 */
export type EventLaneMap = Map<string, number>

/**
 * 判断两个事件在日期级是否重叠
 * 使用 startOfDay 将时间戳转换为日期进行比较
 * 如果两个事件在同一天出现，则视为重叠
 *
 * @param a 第一个事件
 * @param b 第二个事件
 * @returns 是否重叠
 */
export function eventsOverlapOnDate(a: CalendarEvent, b: CalendarEvent): boolean {
  const aStartDay = startOfDay(new Date(a.startTime)).getTime()
  const aEndDay = startOfDay(new Date(a.endTime)).getTime()
  const bStartDay = startOfDay(new Date(b.startTime)).getTime()
  const bEndDay = startOfDay(new Date(b.endTime)).getTime()

  // 日期级重叠判断：A的开始日 <= B的结束日 && B的开始日 <= A的结束日
  return aStartDay <= bEndDay && bStartDay <= aEndDay
}

/**
 * 计算事件在月视图中的泳道分配
 * 使用贪心算法为事件分配泳道号，避免重叠
 *
 * 算法：
 * 1. 按 startTime 升序排序事件
 * 2. 逐个分配泳道：
 *    - 检查当前事件与已分配事件是否重叠
 *    - 找到第一个不重叠的泳道号
 *    - 如果都重叠，则创建新泳道
 *
 * @param events 事件列表
 * @param monthDate 月份日期（用于过滤当月事件，当前实现未使用）
 * @returns 事件ID到泳道号的映射
 */
export function computeEventLanes(events: CalendarEvent[], monthDate: Date): EventLaneMap {
  const laneMap = new Map<string, number>()
  const laneEndTimes: number[] = [] // 记录每个泳道的最后一个事件结束时间

  // 按 startTime 升序排序
  const sortedEvents = [...events].sort((a, b) => a.startTime - b.startTime)

  // 逐个分配泳道
  for (const event of sortedEvents) {
    const eventStartDay = startOfDay(new Date(event.startTime)).getTime()

    // 查找可用的泳道
    let assignedLane = -1
    for (let lane = 0; lane < laneEndTimes.length; lane++) {
      // 检查当前事件与该泳道的最后一个事件是否重叠
      const laneLastEndDay = laneEndTimes[lane]
      // 如果当前事件的开始日在该泳道最后一个事件的结束日之后，可以复用该泳道
      if (eventStartDay > laneLastEndDay) {
        assignedLane = lane
        break
      }
    }

    // 如果没有可用泳道，创建新泳道
    if (assignedLane === -1) {
      assignedLane = laneEndTimes.length
    }

    // 更新泳道映射
    laneMap.set(event.id, assignedLane)
    laneEndTimes[assignedLane] = startOfDay(new Date(event.endTime)).getTime()
  }

  return laneMap
}
