import { describe, it, expect, vi } from 'vitest'
import {
  generateId,
  debounce,
  throttle,
  clamp,
  deepClone
} from '../utils/helpers'

describe('辅助函数', () => {
  // generateId 测试
  describe('generateId', () => {
    it('应该生成带前缀的唯一ID', () => {
      const id = generateId('test')
      expect(id).toMatch(/^test_\d+_[a-z0-9]+$/)
    })

    it('应该生成默认前缀的ID', () => {
      const id = generateId()
      expect(id).toMatch(/^id_\d+_[a-z0-9]+$/)
    })

    it('应该生成不重复的ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })
  })

  // debounce 测试
  describe('debounce', () => {
    it('应该在延迟后调用函数', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      expect(fn).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('应该在多次调用时只执行最后一次', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })

    it('应该传递参数给被调用的函数', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)

      debouncedFn('arg1', 'arg2')
      vi.advanceTimersByTime(100)

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
      vi.useRealTimers()
    })
  })

  // throttle 测试
  describe('throttle', () => {
    it('应该立即调用函数', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该限制调用频率', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn()
      throttledFn()
      throttledFn()

      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(100)
      throttledFn()

      expect(fn).toHaveBeenCalledTimes(2)
      vi.useRealTimers()
    })

    it('应该传递参数给被调用的函数', () => {
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)

      throttledFn('arg1', 'arg2')
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2')
    })
  })

  // clamp 测试
  describe('clamp', () => {
    it('应该将值限制在范围内', () => {
      expect(clamp(5, 0, 10)).toBe(5)
    })

    it('应该将小于最小值的值限制为最小值', () => {
      expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('应该将大于最大值的值限制为最大值', () => {
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('应该处理边界值', () => {
      expect(clamp(0, 0, 10)).toBe(0)
      expect(clamp(10, 0, 10)).toBe(10)
    })

    it('应该处理负数范围', () => {
      expect(clamp(-15, -10, -5)).toBe(-10)
      expect(clamp(-3, -10, -5)).toBe(-5)
    })
  })

  // deepClone 测试
  describe('deepClone', () => {
    it('应该深度克隆对象', () => {
      const original = {
        name: 'test',
        nested: { value: 123 },
        array: [1, 2, { a: 'b' }]
      }

      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.nested).not.toBe(original.nested)
      expect(cloned.array).not.toBe(original.array)
    })

    it('应该克隆数组', () => {
      const original = [1, 2, [3, 4]]
      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned[2]).not.toBe(original[2])
    })

    it('应该处理基本类型', () => {
      expect(deepClone(42)).toBe(42)
      expect(deepClone('string')).toBe('string')
      expect(deepClone(true)).toBe(true)
      expect(deepClone(null)).toBe(null)
    })

    it('应该处理日期对象（转换为字符串）', () => {
      const date = new Date()
      const cloned = deepClone(date)
      expect(typeof cloned).toBe('string')
    })
  })
})
