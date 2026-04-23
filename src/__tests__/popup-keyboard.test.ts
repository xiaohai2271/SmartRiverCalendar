/**
 * 弹出窗口键盘交互测试
 * 测试 Escape、方向键、Enter 键的键盘事件处理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// 模拟 Tauri 内部环境
beforeEach(() => {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    value: {},
    writable: true,
    configurable: true,
  })
})

// Mock hide 函数
const mockHide = vi.fn(() => Promise.resolve())

// 模拟事件发送
const mockEmit = vi.fn((_event?: string, _payload?: unknown) => Promise.resolve())

// 模拟 Tauri API - getCurrentWindow 返回 Promise
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => Promise.resolve({
    hide: mockHide,
    show: vi.fn(() => Promise.resolve()),
    setFocus: vi.fn(() => Promise.resolve()),
    onFocusChanged: vi.fn(() => Promise.resolve(() => {}))
  })
}))

vi.mock('@tauri-apps/api/event', () => ({
  emit: (event: string, payload?: unknown) => mockEmit(event, payload)
}))

// Mock stores
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: vi.fn(() => ({
    isInitialized: true,
    events: [],
    todos: [],
    calendars: [],
    initialize: vi.fn(() => Promise.resolve())
  }))
}))

vi.mock('@/stores/popupSettings', () => ({
  usePopupSettingsStore: vi.fn(() => ({
    settings: {
      popupCalendarShowLunar: true,
      popupShowEvents: true,
      popupShowHoliday: true,
      popupCalendarHolidayColor: 'default'
    },
    loadSettings: vi.fn()
  }))
}))

// 测试键盘事件处理函数逻辑（不依赖 Vue 组件挂载）
describe('弹出窗口键盘交互', () => {
  // 模拟组件状态
  const contextMenuVisible = ref(false)
  const yearMonthPickerVisible = ref(false)
  const selectedDate = ref<Date | undefined>(undefined)
  const currentDate = ref(new Date())

  // 格式化日期为字符串 YYYY-MM-DD
  function formatDateToString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 模拟导航到主界面
  async function navigateToMain(_payload: { action: string; date: string }) {
    await mockEmit('popup-navigate', _payload)
    await mockHide()
  }

  // 模拟选中日期导航
  function navigateSelectedDate(deltaDays: number) {
    if (!selectedDate.value) {
      selectedDate.value = new Date()
      return
    }

    const currentSelected = selectedDate.value as Date
    const newDate = new Date(currentSelected)
    newDate.setDate(newDate.getDate() + deltaDays)
    selectedDate.value = newDate

    if (newDate.getMonth() !== currentDate.value.getMonth() ||
        newDate.getFullYear() !== currentDate.value.getFullYear()) {
      currentDate.value = new Date(newDate.getFullYear(), newDate.getMonth(), 1)
    }
  }

  // 模拟确认选中日期
  async function confirmSelectedDate() {
    if (!selectedDate.value) {
      selectedDate.value = new Date()
    }
    await navigateToMain({
      action: 'createEvent',
      date: formatDateToString(selectedDate.value)
    })
  }

  // 模拟键盘事件处理
  async function handleKeydown(e: KeyboardEvent) {
    if (yearMonthPickerVisible.value || contextMenuVisible.value) {
      if (e.key === 'Escape') {
        contextMenuVisible.value = false
        yearMonthPickerVisible.value = false
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        await mockHide()
        break
      case 'ArrowLeft':
        e.preventDefault?.()
        navigateSelectedDate(-1)
        break
      case 'ArrowRight':
        e.preventDefault?.()
        navigateSelectedDate(1)
        break
      case 'ArrowUp':
        e.preventDefault?.()
        navigateSelectedDate(-7)
        break
      case 'ArrowDown':
        e.preventDefault?.()
        navigateSelectedDate(7)
        break
      case 'Enter':
        e.preventDefault?.()
        await confirmSelectedDate()
        break
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    contextMenuVisible.value = false
    yearMonthPickerVisible.value = false
    selectedDate.value = undefined
    currentDate.value = new Date()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Escape 键', () => {
    it('按下 Escape 键应该隐藏弹出窗口', async () => {
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(mockHide).toHaveBeenCalled()
    })

    it('右键菜单打开时按 Escape 应该只关闭菜单', async () => {
      contextMenuVisible.value = true
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
      
      expect(contextMenuVisible.value).toBe(false)
      expect(mockHide).not.toHaveBeenCalled()
    })

    it('年月选择器打开时按 Escape 应该只关闭选择器', async () => {
      yearMonthPickerVisible.value = true
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Escape' }))
      
      expect(yearMonthPickerVisible.value).toBe(false)
      expect(mockHide).not.toHaveBeenCalled()
    })
  })

  describe('方向键导航', () => {
    it('按下右箭头键应该将选中日期增加一天', async () => {
      selectedDate.value = new Date(2025, 0, 15)
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      
      expect(selectedDate.value?.getDate()).toBe(16)
      expect(selectedDate.value?.getMonth()).toBe(0)
    })

    it('按下左箭头键应该将选中日期减少一天', async () => {
      selectedDate.value = new Date(2025, 0, 15)
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      
      expect(selectedDate.value?.getDate()).toBe(14)
      expect(selectedDate.value?.getMonth()).toBe(0)
    })

    it('按下上箭头键应该将选中日期减少一周', async () => {
      selectedDate.value = new Date(2025, 0, 15)
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      
      expect(selectedDate.value?.getDate()).toBe(8)
      expect(selectedDate.value?.getMonth()).toBe(0)
    })

    it('按下下箭头键应该将选中日期增加一周', async () => {
      selectedDate.value = new Date(2025, 0, 15)
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      
      expect(selectedDate.value?.getDate()).toBe(22)
      expect(selectedDate.value?.getMonth()).toBe(0)
    })

    it('没有选中日期时按方向键应该选中今天', async () => {
      selectedDate.value = undefined
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      
      const today = new Date()
      expect(selectedDate.value).not.toBeNull()
      // handleKeydown 内部会设置 selectedDate 为今天，但 TypeScript 无法追踪此副作用
      // 使用非空断言，因为上面已验证 selectedDate.value 不为 null
      expect(selectedDate.value!.toDateString()).toBe(today.toDateString())
    })

    it('跨月导航应该更新当前月份', async () => {
      selectedDate.value = new Date(2025, 0, 31)
      currentDate.value = new Date(2025, 0, 1)
      
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      
      expect(selectedDate.value?.getMonth()).toBe(1)
      expect(currentDate.value.getMonth()).toBe(1)
    })
  })

  describe('Enter 键确认', () => {
    it('按下 Enter 键应该触发导航到主界面创建事件', async () => {
      selectedDate.value = new Date(2025, 0, 15)
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
      
      expect(mockEmit).toHaveBeenCalledWith('popup-navigate', {
        action: 'createEvent',
        date: '2025-01-15'
      })
      expect(mockHide).toHaveBeenCalled()
    })

    it('没有选中日期时按 Enter 应该选中今天并确认', async () => {
      selectedDate.value = undefined
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
      
      const today = new Date()
      const expectedDate = formatDateToString(today)
      
      expect(selectedDate.value).not.toBeNull()
      expect(mockEmit).toHaveBeenCalledWith('popup-navigate', {
        action: 'createEvent',
        date: expectedDate
      })
    })
  })

  describe('弹出窗口/菜单打开时的键盘事件', () => {
    it('年月选择器打开时不应该响应方向键', async () => {
      yearMonthPickerVisible.value = true
      selectedDate.value = new Date(2025, 0, 15)
      const initialDate = new Date(selectedDate.value)
      
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      
      expect(selectedDate.value?.getTime()).toBe(initialDate.getTime())
    })

    it('右键菜单打开时不应该响应方向键', async () => {
      contextMenuVisible.value = true
      selectedDate.value = new Date(2025, 0, 15)
      const initialDate = new Date(selectedDate.value)
      
      await handleKeydown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
      
      expect(selectedDate.value?.getTime()).toBe(initialDate.getTime())
    })

    it('年月选择器打开时不应该响应 Enter 键', async () => {
      yearMonthPickerVisible.value = true
      selectedDate.value = new Date(2025, 0, 15)
      
      await handleKeydown(new KeyboardEvent('keydown', { key: 'Enter' }))
      
      expect(mockEmit).not.toHaveBeenCalled()
      expect(mockHide).not.toHaveBeenCalled()
    })
  })
})
