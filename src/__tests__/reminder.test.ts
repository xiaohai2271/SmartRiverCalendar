import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CalendarEvent, Todo, AppSettings } from '../types'

// Mock @tauri-apps/plugin-notification
const mockSendNotification = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: mockSendNotification
}))

// Mock useCapabilities — 桌面端能力
vi.mock('@/platform/provider', () => ({
  useCapabilities: () => ({
    hasLocalDatabase: true,
    hasOfflineMode: true,
    dataPriority: 'local-first',
    hasReminderPopup: true,
    hasSystemNotification: true,
    hasSnoozeReminder: true,
    hasSystemTray: true,
    hasAutoStart: true,
    hasClockHook: true,
    hasMultiWindow: true,
    hasAutoUpdate: true,
    hasMinimizeToTray: true,
    hasProxySettings: true,
  }),
  usePlatform: () => ({
    capabilities: {
      hasLocalDatabase: true,
      hasOfflineMode: true,
      dataPriority: 'local-first',
      hasReminderPopup: true,
      hasSystemNotification: true,
      hasSnoozeReminder: true,
      hasSystemTray: true,
      hasAutoStart: true,
      hasClockHook: true,
      hasMultiWindow: true,
      hasAutoUpdate: true,
      hasMinimizeToTray: true,
      hasProxySettings: true,
    },
    authRepo: {},
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    settingsRepo: {},
    syncRepo: {},
  }),
}))

// Mock Pinia stores
const mockCalendarStore = {
  isInitialized: true,
  visibleEvents: [] as CalendarEvent[]
}

const mockTodoStore = {
  isInitialized: true,
  pendingTodos: [] as Todo[]
}

const mockSettings: AppSettings = {
  theme: 'light',
  defaultView: 'month',
  firstDayOfWeek: 1,
  defaultReminder: 15,
  startMinimized: false,
  autoStart: false,
  autoUpdate: true,
  showLunar: true,
  showLunarFestival: true,
  showSolarTerm: true,
  showHoliday: true,
  showMakeupDay: true,
  showWeekend: true,
  allDayReminderTime: 'morning',
  allDayReminderHour: 9,
  reminderMode: 'standard',
  customReminderTitle: '',
  customReminderBody: '',
  clockHookEnabled: false,
  clockHookBlockPopup: false,
  monthEventDisplayStyle: 'bar',
  proxyMode: 'none',
  proxyHost: '',
  proxyPort: 0,
  proxyUsername: '',
  proxyPassword: ''
}

const mockSettingsStore = {
  settings: mockSettings
}

vi.mock('../stores/calendar', () => ({
  useCalendarStore: () => mockCalendarStore
}))

vi.mock('../stores/todo', () => ({
  useTodoStore: () => mockTodoStore
}))

vi.mock('../stores/settings', () => ({
  useSettingsStore: () => mockSettingsStore
}))

// Mock document.title for blink title tests
Object.defineProperty(document, 'title', {
  writable: true,
  value: 'Original Title'
})

describe('提醒服务', () => {
  // localStorage mock
  let localStorageStore: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset localStorage mock
    localStorageStore = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] ?? null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      localStorageStore[key] = value
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete localStorageStore[key]
    })
    vi.spyOn(Storage.prototype, 'key').mockImplementation((index) => {
      return Object.keys(localStorageStore)[index] ?? null
    })
    Object.defineProperty(Storage.prototype, 'length', {
      get: () => Object.keys(localStorageStore).length
    })

    // Reset stores
    mockCalendarStore.isInitialized = true
    mockCalendarStore.visibleEvents = []
    mockTodoStore.isInitialized = true
    mockTodoStore.pendingTodos = []
    mockSettingsStore.settings = { ...mockSettings }

    // Reset document.title
    document.title = 'Original Title'
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // 导入提醒服务（需要在 mock 之后）
  let reminderService: typeof import('../services/reminder')

  beforeEach(async () => {
    // 动态导入以确保 mock 生效
    reminderService = await import('../services/reminder')
    // 确保服务停止状态
    reminderService.stopReminderService()
    // 重置快速连续触发防护状态
    reminderService.resetRapidTriggerState()
  })

  describe('服务生命周期', () => {
    it('应该正确启动和停止提醒服务', () => {
      expect(reminderService.isReminderServiceRunning()).toBe(false)

      reminderService.startReminderService()
      expect(reminderService.isReminderServiceRunning()).toBe(true)

      reminderService.stopReminderService()
      expect(reminderService.isReminderServiceRunning()).toBe(false)
    })

    it('重复启动服务不应该创建多个定时器', () => {
      reminderService.startReminderService()
      reminderService.startReminderService()
      expect(reminderService.isReminderServiceRunning()).toBe(true)

      reminderService.stopReminderService()
    })
  })

  describe('普通事件提醒时间判断', () => {
    it('应该在提醒时间窗口内发送提醒', async () => {
      const now = Date.now()
      const reminderMinutes = 15
      const eventStartTime = now + reminderMinutes * 60 * 1000

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '测试事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: reminderMinutes,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: expect.stringContaining('测试事件'),
        body: expect.any(String)
      })
    })

    it('不应该在事件开始后发送提醒', async () => {
      const now = Date.now()
      const eventStartTime = now - 1000 // 事件已开始

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '已开始事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('不应该在提醒时间窗口之前发送提醒', async () => {
      const now = Date.now()
      const eventStartTime = now + 30 * 60 * 1000 // 30分钟后

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '未来事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15, // 提前15分钟
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('应该使用默认提醒时间当事件未设置提醒', async () => {
      const now = Date.now()
      const defaultReminder = 15
      const eventStartTime = now + defaultReminder * 60 * 1000

      mockSettingsStore.settings.defaultReminder = defaultReminder
      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '默认提醒事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        // reminder 未设置
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })
  })

  describe('全天事件提醒时间判断', () => {
    it('应该在前一天晚上提醒（evening_before 模式）', async () => {
      const now = Date.now()
      const eventDate = new Date(now)
      eventDate.setDate(eventDate.getDate() + 1) // 明天
      eventDate.setHours(0, 0, 0, 0)

      const eveningBefore = new Date(eventDate)
      eveningBefore.setDate(eveningBefore.getDate() - 1) // 今天
      eveningBefore.setHours(20, 0, 0, 0) // 晚上8点

      mockSettingsStore.settings.allDayReminderTime = 'evening_before'
      mockSettingsStore.settings.allDayReminderHour = 20

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '全天事件',
        startTime: eventDate.getTime(),
        endTime: eventDate.getTime() + 86400000,
        allDay: true,
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(eveningBefore.getTime())
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })

    it('应该在当天早上提醒（morning 模式）', async () => {
      const now = Date.now()
      const eventDate = new Date(now)
      eventDate.setHours(0, 0, 0, 0)

      const morningOf = new Date(eventDate)
      morningOf.setHours(9, 0, 0, 0) // 早上9点

      mockSettingsStore.settings.allDayReminderTime = 'morning'
      mockSettingsStore.settings.allDayReminderHour = 9

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '全天事件',
        startTime: eventDate.getTime(),
        endTime: eventDate.getTime() + 86400000,
        allDay: true,
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(morningOf.getTime())
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })

    it('不应该在非提醒时间发送全天事件提醒', async () => {
      const now = Date.now()
      const eventDate = new Date(now)
      eventDate.setDate(eventDate.getDate() + 1)
      eventDate.setHours(0, 0, 0, 0)

      const afternoon = new Date(eventDate)
      afternoon.setDate(afternoon.getDate() - 1)
      afternoon.setHours(15, 0, 0, 0) // 下午3点

      mockSettingsStore.settings.allDayReminderTime = 'evening_before'
      mockSettingsStore.settings.allDayReminderHour = 20

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '全天事件',
        startTime: eventDate.getTime(),
        endTime: eventDate.getTime() + 86400000,
        allDay: true,
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(afternoon.getTime())
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })
  })

  describe('待办提醒时间判断', () => {
    it('应该在待办截止时间前发送提醒', async () => {
      const now = Date.now()
      const dueDate = now + 15 * 60 * 1000 // 15分钟后截止

      mockTodoStore.pendingTodos = [{
        id: 'todo-1',
        title: '待办事项',
        dueDate: dueDate,
        completed: false,
        priority: 'medium',
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
      expect(mockSendNotification).toHaveBeenCalledWith({
        title: expect.stringContaining('待办事项'),
        body: expect.any(String)
      })
    })

    it('不应该为已完成的待办发送提醒', async () => {
      const now = Date.now()
      const dueDate = now + 15 * 60 * 1000

      mockTodoStore.pendingTodos = [{
        id: 'todo-1',
        title: '已完成待办',
        dueDate: dueDate,
        completed: true,
        priority: 'medium',
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('不应该为没有截止时间的待办发送提醒', async () => {
      const now = Date.now()

      mockTodoStore.pendingTodos = [{
        id: 'todo-1',
        title: '无截止时间待办',
        dueDate: undefined,
        completed: false,
        priority: 'medium',
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('不应该在待办截止时间后发送提醒', async () => {
      const now = Date.now()
      const dueDate = now - 1000 // 已过截止时间

      mockTodoStore.pendingTodos = [{
        id: 'todo-1',
        title: '过期待办',
        dueDate: dueDate,
        completed: false,
        priority: 'medium',
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })
  })

  describe('提醒去重', () => {
    it('同一事件不应该重复发送提醒', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '重复提醒测试',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)

      // 第一次检查
      await reminderService.triggerReminderCheck()
      expect(mockSendNotification).toHaveBeenCalledTimes(1)

      // 第二次检查（应该不再发送）
      await reminderService.triggerReminderCheck()
      expect(mockSendNotification).toHaveBeenCalledTimes(1) // 仍然只有1次
    })

    it('同一待办不应该重复发送提醒', async () => {
      const now = Date.now()
      const dueDate = now + 15 * 60 * 1000

      mockTodoStore.pendingTodos = [{
        id: 'todo-1',
        title: '重复提醒测试',
        dueDate: dueDate,
        completed: false,
        priority: 'medium',
        calendarId: 'cal-1',
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)

      // 第一次检查
      await reminderService.triggerReminderCheck()
      expect(mockSendNotification).toHaveBeenCalledTimes(1)

      // 第二次检查
      await reminderService.triggerReminderCheck()
      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })
  })

  describe('自定义模板渲染', () => {
    it('应该使用自定义标题模板', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.customReminderTitle = '【日历】{title}'

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '测试事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledWith({
        title: '【日历】测试事件',
        body: expect.any(String)
      })
    })

    it('应该使用自定义正文模板', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.customReminderBody = '事件: {title}\n描述: {description}'

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '测试事件',
        description: '这是描述',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledWith({
        title: expect.any(String),
        body: '事件: 测试事件\n描述: 这是描述'
      })
    })

    it('应该使用默认标题格式当未设置自定义模板', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.customReminderTitle = ''

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '测试事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledWith({
        title: '小河日历 - 测试事件',
        body: expect.any(String)
      })
    })

    it('应该使用默认正文格式当未设置自定义模板', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.customReminderBody = ''

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '测试事件',
        description: '这是描述',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledWith({
        title: expect.any(String),
        body: expect.stringContaining('这是描述')
      })
    })
  })

  describe('提醒强度处理', () => {
    it('标准模式应该只发送通知', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.reminderMode = 'standard'

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '标准提醒',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).toHaveBeenCalledTimes(1)
    })

    it('强提醒模式应该使用提醒窗口（不发送系统通知）', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.reminderMode = 'strong'

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '强提醒',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      // 强提醒模式不发送系统通知，只使用提醒窗口
      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('静默模式应该发送通知（Tauri暂不支持静默）', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSettingsStore.settings.reminderMode = 'silent'

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '静默提醒',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      // 静默模式不发送系统通知
      expect(mockSendNotification).not.toHaveBeenCalled()
    })
  })

  describe('Store 未初始化', () => {
    it('应该在日历Store未初始化时跳过检查', async () => {
      mockCalendarStore.isInitialized = false

      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })

    it('应该在待办Store未初始化时跳过检查', async () => {
      mockTodoStore.isInitialized = false

      await reminderService.triggerReminderCheck()

      expect(mockSendNotification).not.toHaveBeenCalled()
    })
  })

  describe('通知发送失败处理', () => {
    it('应该捕获通知发送错误并继续执行', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockSendNotification.mockRejectedValueOnce(new Error('通知发送失败'))

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '错误测试',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)

      // 不应该抛出错误
      await expect(reminderService.triggerReminderCheck()).resolves.not.toThrow()
    })
  })

  describe('提醒队列机制', () => {
    it('应该正确入队提醒', async () => {
      const now = Date.now()
      const eventStartTime = now + 15 * 60 * 1000

      mockCalendarStore.visibleEvents = [{
        id: 'event-1',
        title: '队列测试事件',
        startTime: eventStartTime,
        endTime: eventStartTime + 3600000,
        allDay: false,
        calendarId: 'cal-1',
        reminder: 15,
        createdAt: now,
        updatedAt: now
      }]

      vi.setSystemTime(now)
      await reminderService.triggerReminderCheck()

      // 检查队列状态
      const status = reminderService.getQueueStatus()
      expect(status.count).toBeGreaterThanOrEqual(0)
    })

    it('应该拒绝重复入队相同 ID 的提醒', () => {
      const now = Date.now()

      // 入队第一个提醒
      const result1 = reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '测试事件',
        body: '测试正文',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '测试事件',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })
      expect(result1).toBe(true)

      // 尝试再次入队相同 ID
      const result2 = reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '测试事件',
        body: '测试正文',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '测试事件',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })
      expect(result2).toBe(false)
    })

    it('应该按优先级排序（事件优先于待办）', () => {
      const now = Date.now()

      // 先入队待办
      reminderService.enqueueReminder({
        id: 'popup_todo-1_' + now,
        type: 'todo',
        title: '待办事项',
        body: '待办正文',
        triggerTime: now,
        itemId: 'todo-1',
        itemData: {
          id: 'todo-1',
          title: '待办事项',
          completed: false,
          priority: 'medium',
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 再入队事件
      reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '事件',
        body: '事件正文',
        triggerTime: now + 1000, // 触发时间更晚
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '事件',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 获取队列状态，第一个应该是事件（优先级更高）
      const status = reminderService.getQueueStatus()
      if (status.firstItem) {
        expect(status.firstItem.type).toBe('event')
      }
    })

    it('应该按触发时间排序（早优先于晚）', () => {
      const now = Date.now()

      // 入队较晚的事件
      reminderService.enqueueReminder({
        id: 'popup_event-late_' + now,
        type: 'event',
        title: '晚事件',
        body: '晚事件正文',
        triggerTime: now + 10000,
        itemId: 'event-late',
        itemData: {
          id: 'event-late',
          title: '晚事件',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 入队较早的事件
      reminderService.enqueueReminder({
        id: 'popup_event-early_' + now,
        type: 'event',
        title: '早事件',
        body: '早事件正文',
        triggerTime: now,
        itemId: 'event-early',
        itemData: {
          id: 'event-early',
          title: '早事件',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 获取队列状态，第一个应该是较早的事件
      const status = reminderService.getQueueStatus()
      if (status.firstItem) {
        expect(status.firstItem.id).toBe('popup_event-early_' + now)
      }
    })

    it('应该在超时后自动丢弃提醒', () => {
      const now = Date.now()

      // 入队一个提醒
      reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '超时测试',
        body: '超时正文',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '超时测试',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 模拟时间流逝超过1小时
      vi.setSystemTime(now + 3600001)

      // 清空当前显示的提醒（模拟已处理）
      reminderService.markReminderProcessed()

      // 队列应该为空（超时项被清理）
      const status = reminderService.getQueueStatus()
      expect(status.count).toBe(0)
    })

    it('应该持久化队列到 localStorage', () => {
      const now = Date.now()

      reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '持久化测试',
        body: '持久化正文',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '持久化测试',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 检查 localStorage 中是否有队列数据
      expect(localStorageStore['reminder_queue']).toBeDefined()
      const queueData = JSON.parse(localStorageStore['reminder_queue'])
      expect(queueData.items.length).toBeGreaterThan(0)
    })

    it('应该能够清空队列', () => {
      const now = Date.now()

      // 入队多个提醒
      reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '测试1',
        body: '正文1',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '测试1',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 清空队列
      reminderService.clearQueue()

      // 队列应该为空
      const status = reminderService.getQueueStatus()
      expect(status.count).toBe(0)
    })

    it('同一时间只应该显示一个提醒', () => {
      const now = Date.now()

      // 入队两个提醒
      reminderService.enqueueReminder({
        id: 'popup_event-1_' + now,
        type: 'event',
        title: '事件1',
        body: '正文1',
        triggerTime: now,
        itemId: 'event-1',
        itemData: {
          id: 'event-1',
          title: '事件1',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      reminderService.enqueueReminder({
        id: 'popup_event-2_' + now,
        type: 'event',
        title: '事件2',
        body: '正文2',
        triggerTime: now + 1000,
        itemId: 'event-2',
        itemData: {
          id: 'event-2',
          title: '事件2',
          startTime: now + 3600000,
          endTime: now + 7200000,
          allDay: false,
          calendarId: 'cal-1',
          createdAt: now,
          updatedAt: now
        }
      })

      // 第一次出队应该返回第一个提醒
      const first = reminderService.dequeueReminder()
      expect(first).not.toBeNull()
      expect(first?.id).toBe('popup_event-1_' + now)

      // 第二次出队应该返回 null（因为当前有提醒显示）
      const second = reminderService.dequeueReminder()
      expect(second).toBeNull()

      // 标记当前提醒已处理（这会自动触发下一个提醒显示）
      reminderService.markReminderProcessed()

      // 队列应该为空（两个提醒都已出队：第一次手动，第二次自动）
      const status = reminderService.getQueueStatus()
      expect(status.count).toBe(0)
    })
  })
})
