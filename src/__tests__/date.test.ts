import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatTime,
  formatDateTime,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  daysInMonth,
  weekOfYear,
  isSameDay,
  isToday,
  isPast,
  isFuture,
  getMonthDays,
  getWeekDays,
  formatRelativeTime
} from '../utils/date'

describe('日期工具函数', () => {
  // 测试 formatDate
  describe('formatDate', () => {
    it('应该正确格式化日期为 YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15) // 2024-01-15
      expect(formatDate(date)).toBe('2024-01-15')
    })

    it('应该补零个位数的月份和日期', () => {
      const date = new Date(2024, 2, 5) // 2024-03-05
      expect(formatDate(date)).toBe('2024-03-05')
    })

    it('应该处理年末日期', () => {
      const date = new Date(2024, 11, 31) // 2024-12-31
      expect(formatDate(date)).toBe('2024-12-31')
    })
  })

  // 测试 formatTime
  describe('formatTime', () => {
    it('应该正确格式化时间为 HH:MM', () => {
      const date = new Date(2024, 0, 1, 14, 30)
      expect(formatTime(date)).toBe('14:30')
    })

    it('应该补零个位数的小时和分钟', () => {
      const date = new Date(2024, 0, 1, 9, 5)
      expect(formatTime(date)).toBe('09:05')
    })

    it('应该处理午夜时间', () => {
      const date = new Date(2024, 0, 1, 0, 0)
      expect(formatTime(date)).toBe('00:00')
    })
  })

  // 测试 formatDateTime
  describe('formatDateTime', () => {
    it('应该正确格式化日期时间', () => {
      const date = new Date(2024, 5, 15, 14, 30)
      expect(formatDateTime(date)).toBe('2024-06-15 14:30')
    })
  })

  // 测试 startOfDay
  describe('startOfDay', () => {
    it('应该返回当天开始时间', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45)
      const start = startOfDay(date)
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)
      expect(start.getMilliseconds()).toBe(0)
    })
  })

  // 测试 endOfDay
  describe('endOfDay', () => {
    it('应该返回当天结束时间', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45)
      const end = endOfDay(date)
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
      expect(end.getMilliseconds()).toBe(999)
    })
  })

  // 测试 startOfWeek
  describe('startOfWeek', () => {
    it('应该返回周一作为一周开始（默认）', () => {
      // 2024-01-17 是周三
      const date = new Date(2024, 0, 17)
      const start = startOfWeek(date)
      expect(start.getDay()).toBe(1) // 周一
      expect(start.getDate()).toBe(15)
    })

    it('应该支持自定义一周开始日', () => {
      // 2024-01-17 是周三
      const date = new Date(2024, 0, 17)
      const start = startOfWeek(date, 0) // 周日开始
      expect(start.getDay()).toBe(0) // 周日
      expect(start.getDate()).toBe(14)
    })
  })

  // 测试 startOfMonth
  describe('startOfMonth', () => {
    it('应该返回月份第一天', () => {
      const date = new Date(2024, 5, 15)
      const start = startOfMonth(date)
      expect(start.getDate()).toBe(1)
      expect(start.getMonth()).toBe(5)
    })
  })

  // 测试 endOfMonth
  describe('endOfMonth', () => {
    it('应该返回月份最后一天', () => {
      const date = new Date(2024, 1, 15) // 2月
      const end = endOfMonth(date)
      expect(end.getDate()).toBe(29) // 2024是闰年
      expect(end.getMonth()).toBe(1)
    })

    it('应该处理非闰年2月', () => {
      const date = new Date(2023, 1, 15)
      const end = endOfMonth(date)
      expect(end.getDate()).toBe(28)
    })
  })

  // 测试 daysInMonth
  describe('daysInMonth', () => {
    it('应该返回月份天数', () => {
      expect(daysInMonth(new Date(2024, 0, 1))).toBe(31) // 1月
      expect(daysInMonth(new Date(2024, 1, 1))).toBe(29) // 2月闰年
      expect(daysInMonth(new Date(2023, 1, 1))).toBe(28) // 2月非闰年
      expect(daysInMonth(new Date(2024, 3, 1))).toBe(30) // 4月
    })
  })

  // 测试 isSameDay
  describe('isSameDay', () => {
    it('应该判断同一天', () => {
      const date1 = new Date(2024, 0, 15, 10, 30)
      const date2 = new Date(2024, 0, 15, 20, 45)
      expect(isSameDay(date1, date2)).toBe(true)
    })

    it('应该判断不同天', () => {
      const date1 = new Date(2024, 0, 15)
      const date2 = new Date(2024, 0, 16)
      expect(isSameDay(date1, date2)).toBe(false)
    })

    it('应该判断不同月份', () => {
      const date1 = new Date(2024, 0, 15)
      const date2 = new Date(2024, 1, 15)
      expect(isSameDay(date1, date2)).toBe(false)
    })
  })

  // 测试 isToday
  describe('isToday', () => {
    it('应该判断今天', () => {
      expect(isToday(new Date())).toBe(true)
    })

    it('应该判断非今天', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(isToday(yesterday)).toBe(false)
    })
  })

  // 测试 isPast 和 isFuture
  describe('isPast 和 isFuture', () => {
    it('应该判断过去的时间', () => {
      const past = new Date(Date.now() - 10000)
      expect(isPast(past)).toBe(true)
      expect(isFuture(past)).toBe(false)
    })

    it('应该判断未来的时间', () => {
      const future = new Date(Date.now() + 10000)
      expect(isFuture(future)).toBe(true)
      expect(isPast(future)).toBe(false)
    })
  })

  // 测试 getWeekDays
  describe('getWeekDays', () => {
    it('应该返回周一到周日的数组（默认）', () => {
      const days = getWeekDays(1)
      expect(days).toEqual(['一', '二', '三', '四', '五', '六', '日'])
    })

    it('应该返回周日到周六的数组', () => {
      const days = getWeekDays(0)
      expect(days).toEqual(['日', '一', '二', '三', '四', '五', '六'])
    })
  })

  // 测试 getMonthDays
  describe('getMonthDays', () => {
    it('应该返回42个日期（6周）', () => {
      const date = new Date(2024, 0, 15)
      const days = getMonthDays(date)
      expect(days.length).toBe(42)
    })

    it('第一个日期应该是周一开始的那周', () => {
      const date = new Date(2024, 0, 15)
      const days = getMonthDays(date, 1)
      // 2024年1月1日是周一，所以第一天应该是1月1日
      expect(days[0].getMonth()).toBe(0)
      expect(days[0].getDate()).toBe(1)
    })
  })

  // 测试 formatRelativeTime
  describe('formatRelativeTime', () => {
    it('应该返回"刚刚"表示很短的时间差', () => {
      const now = Date.now()
      expect(formatRelativeTime(now)).toBe('刚刚')
    })

    it('应该返回过去的时间', () => {
      const past = Date.now() - 3600000 // 1小时前
      expect(formatRelativeTime(past)).toBe('1小时前')
    })

    it('应该返回未来的时间', () => {
      const future = Date.now() + 86400000 // 1天后
      expect(formatRelativeTime(future)).toBe('1天后')
    })
  })

  // 测试 weekOfYear
  describe('weekOfYear', () => {
    it('应该返回年中的第几周', () => {
      const date = new Date(2024, 0, 1) // 年初
      expect(weekOfYear(date)).toBe(0)
    })

    it('应该处理年末', () => {
      const date = new Date(2024, 11, 31) // 年末
      expect(weekOfYear(date)).toBeGreaterThan(50)
    })
  })
})
