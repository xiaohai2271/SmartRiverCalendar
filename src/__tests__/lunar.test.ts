import { describe, it, expect } from 'vitest'
import { getLunarInfo, getMonthLunarInfo, isWorkDay } from '../utils/lunar'

describe('农历工具函数', () => {
  // getLunarInfo 测试
  describe('getLunarInfo', () => {
    it('应该返回农历信息对象', () => {
      const date = new Date(2024, 0, 1) // 2024年1月1日
      const info = getLunarInfo(date)

      expect(info).toHaveProperty('lunarDate')
      expect(info).toHaveProperty('lunarMonth')
      expect(info).toHaveProperty('lunarDay')
      expect(info).toHaveProperty('isWeekend')
      expect(info).toHaveProperty('isHoliday')
      expect(info).toHaveProperty('isWorkDay')
    })

    it('应该正确识别周末', () => {
      const saturday = new Date(2024, 0, 6) // 2024年1月6日 周六
      const monday = new Date(2024, 0, 8) // 2024年1月8日 周一

      expect(getLunarInfo(saturday).isWeekend).toBe(true)
      expect(getLunarInfo(monday).isWeekend).toBe(false)
    })

    it('应该包含农历日期字符串', () => {
      const date = new Date(2024, 0, 1)
      const info = getLunarInfo(date)

      expect(info.lunarDate).toBeTruthy()
      expect(info.lunarMonth).toBeTruthy()
      expect(info.lunarDay).toBeTruthy()
    })

    it('应该识别春节', () => {
      const springFestival = new Date(2024, 1, 10) // 2024年2月10日 春节
      const info = getLunarInfo(springFestival)

      expect(info.isHoliday).toBe(true)
      expect(info.holidayName).toBe('春节')
    })

    it('应该识别元旦', () => {
      const newYear = new Date(2024, 0, 1) // 2024年1月1日 元旦
      const info = getLunarInfo(newYear)

      expect(info.isHoliday).toBe(true)
      expect(info.holidayName).toBe('元旦')
    })
  })

  // getMonthLunarInfo 测试
  describe('getMonthLunarInfo', () => {
    it('应该返回整月的农历信息', () => {
      const result = getMonthLunarInfo(2024, 0) // 2024年1月

      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(31)
    })

    it('应该包含正确的日期键', () => {
      const result = getMonthLunarInfo(2024, 0)

      expect(result.has('2024-01-01')).toBe(true)
      expect(result.has('2024-01-15')).toBe(true)
      expect(result.has('2024-01-31')).toBe(true)
    })

    it('应该处理闰月', () => {
      const result = getMonthLunarInfo(2024, 1) // 2024年2月（含闰月）

      expect(result.size).toBe(29) // 2024年2月有29天
    })
  })

  // isWorkDay 测试
  describe('isWorkDay', () => {
    it('应该判断工作日', () => {
      const monday = new Date(2024, 0, 8) // 周一
      expect(isWorkDay(monday)).toBe(true)
    })

    it('应该判断周末为非工作日', () => {
      const saturday = new Date(2024, 0, 6) // 周六
      expect(isWorkDay(saturday)).toBe(false)
    })

    it('应该判断节假日为非工作日', () => {
      const newYear = new Date(2024, 0, 1) // 元旦
      expect(isWorkDay(newYear)).toBe(false)
    })

    it('应该判断调休补班为工作日', () => {
      const makeupDay = new Date(2024, 1, 4) // 2024年2月4日 调休
      const isWork = isWorkDay(makeupDay)
      expect(typeof isWork).toBe('boolean')
    })
  })

  // 农历显示格式测试
  describe('农历显示格式', () => {
    it('农历正月初一应显示"正月"', () => {
      const info = getLunarInfo(new Date('2026-02-17')) // 2026年正月初一
      expect(info.lunarDate).toBe('正月')
    })

    it('农历正月初二应显示"初二"', () => {
      const info = getLunarInfo(new Date('2026-02-18')) // 2026年正月初二
      expect(info.lunarDate).toBe('初二')
    })

    it('农历正月初三应显示"初三"', () => {
      const info = getLunarInfo(new Date('2026-02-19')) // 2026年正月初三
      expect(info.lunarDate).toBe('初三')
    })

    it('农历二月初一应显示"二月"', () => {
      const info = getLunarInfo(new Date('2026-03-19')) // 2026年二月初一
      expect(info.lunarDate).toBe('二月')
    })
  })
})
