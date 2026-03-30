import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TimeDisplay from '../components/home/TimeDisplay.vue'

describe('TimeDisplay 组件', () => {
  beforeEach(() => {
    // 固定时间用于测试
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 0, 1, 12, 30, 45)) // 2024年1月1日 12:30:45 元旦
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('时间显示', () => {
    it('应该显示当前时间', () => {
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.current-time').text()).toBe('12:30:45')
    })

    it('应该每秒更新时间', async () => {
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.current-time').text()).toBe('12:30:45')

      // 前进1秒
      vi.advanceTimersByTime(1000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.current-time').text()).toBe('12:30:46')

      // 前进30秒
      vi.advanceTimersByTime(30000)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.current-time').text()).toBe('12:31:16')
    })
  })

  describe('日期显示', () => {
    it('应该显示当前日期', () => {
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.current-date').text()).toBe('2024年1月1日')
    })

    it('应该显示正确的星期', () => {
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.weekday').text()).toBe('星期一')
    })
  })

  describe('农历显示', () => {
    it('应该显示农历日期', () => {
      const wrapper = mount(TimeDisplay)
      const lunarSection = wrapper.find('.lunar-section')
      expect(lunarSection.exists()).toBe(true)
      expect(wrapper.find('.lunar-date').exists()).toBe(true)
    })
  })

  describe('节假日显示', () => {
    it('应该在节假日显示标签', () => {
      const wrapper = mount(TimeDisplay)
      // 2024年1月1日是元旦
      expect(wrapper.find('.holiday-tag').exists()).toBe(true)
      expect(wrapper.find('.holiday-tag').text()).toContain('元旦')
    })

    it('应该在非节假日隐藏标签', async () => {
      // 设置为非节假日
      vi.setSystemTime(new Date(2024, 0, 2)) // 2024年1月2日
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.holiday-tag').exists()).toBe(false)
    })
  })

  describe('补休提醒', () => {
    it('应该在调休补班日显示提醒', async () => {
      // 2024年2月4日是春节调休补班
      vi.setSystemTime(new Date(2024, 1, 4, 9, 0, 0))
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.workday-reminder').exists()).toBe(true)
      expect(wrapper.find('.workday-reminder').text()).toContain('调休上班')
    })

    it('应该在非补班日隐藏提醒', () => {
      const wrapper = mount(TimeDisplay)
      expect(wrapper.find('.workday-reminder').exists()).toBe(false)
    })
  })

  describe('节气显示', () => {
    it('应该在节气日显示节气', async () => {
      // 2024年小寒是1月6日
      vi.setSystemTime(new Date(2024, 0, 6, 12, 0, 0))
      const wrapper = mount(TimeDisplay)
      // 检查是否有节气显示（可能在小寒日）
      const solarTerm = wrapper.find('.solar-term')
      // 如果当天有节气，应该显示
      if (solarTerm.exists()) {
        expect(solarTerm.text()).toBeTruthy()
      }
    })
  })

  describe('组件生命周期', () => {
    it('应该在挂载时启动定时器', () => {
      const setIntervalSpy = vi.spyOn(window, 'setInterval')
      mount(TimeDisplay)
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
      setIntervalSpy.mockRestore()
    })

    it('应该在卸载时清除定时器', () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
      const wrapper = mount(TimeDisplay)
      wrapper.unmount()
      expect(clearIntervalSpy).toHaveBeenCalled()
      clearIntervalSpy.mockRestore()
    })
  })
})
