import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCalendarStore } from '@/stores/calendar'
import type { Calendar, CalendarEvent } from '@/types'

const mockCalendarRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  updateType: vi.fn(),
}

const mockEventRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const mockSettingsRepo = {
  get: vi.fn(),
  set: vi.fn(),
  getAll: vi.fn(),
}

const mockSyncRepo = {
  getAllAccounts: vi.fn(),
  getExternalEvents: vi.fn(),
  getExternalCalendars: vi.fn(),
  createExternalEvent: vi.fn(),
  updateExternalEvent: vi.fn(),
  deleteExternalEvent: vi.fn(),
  triggerCloudSync: vi.fn(),
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    calendarRepo: mockCalendarRepo,
    eventRepo: mockEventRepo,
    settingsRepo: mockSettingsRepo,
    syncRepo: mockSyncRepo,
  }),
  useCapabilities: () => ({
    dataPriority: 'local-first',
    hasLocalDatabase: true,
    hasOfflineMode: true,
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
}))

vi.mock('@/services/cloudSync', () => ({
  cloudSyncService: {
    triggerSync: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: vi.fn(() => ({
    settings: { defaultView: 'month' },
  })),
}))

function createMockCalendar(overrides: Partial<Calendar> = {}): Calendar {
  return {
    id: '1',
    name: '我的日历',
    color: '#4A90D9',
    type: 'local',
    visible: true,
    syncEnabled: false,
    ...overrides,
  }
}

function createMockEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: '10',
    title: '测试事件',
    startTime: Date.now(),
    endTime: Date.now() + 3600000,
    allDay: false,
    calendarId: '1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('Calendar Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialize', () => {
    it('应在 local-first 平台日历为空时自动创建默认日历', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([])
      mockCalendarRepo.create.mockResolvedValue(createMockCalendar({ id: '1', name: '我的日历' }))
      mockEventRepo.getAll.mockResolvedValue([])
      mockSyncRepo.getAllAccounts.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      expect(mockCalendarRepo.create).toHaveBeenCalledWith({
        name: '我的日历',
        color: '#4A90D9',
        type: 'local',
        visible: true,
        syncEnabled: false,
      })
      expect(store.calendars).toHaveLength(1)
      expect(store.isInitialized).toBe(true)
    })

    it('应加载已有日历而不创建默认日历', async () => {
      const existingCalendar = createMockCalendar({ id: '5', name: '已有日历' })
      mockCalendarRepo.getAll.mockResolvedValue([existingCalendar])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      expect(mockCalendarRepo.create).not.toHaveBeenCalled()
      expect(store.calendars).toHaveLength(1)
      expect(store.calendars[0].name).toBe('已有日历')
    })

    it('应加载事件数据', async () => {
      const existingEvent = createMockEvent({ id: '100', title: '已有事件' })
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([existingEvent])

      const store = useCalendarStore()
      await store.initialize()

      expect(store.events).toHaveLength(1)
      expect(store.events[0].title).toBe('已有事件')
    })

    it('不应重复初始化', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()
      await store.initialize()

      expect(mockCalendarRepo.getAll).toHaveBeenCalledTimes(1)
    })

    it('初始化失败时仍应标记为已初始化', async () => {
      mockCalendarRepo.getAll.mockRejectedValue(new Error('数据库错误'))

      const store = useCalendarStore()
      await store.initialize()

      expect(store.isInitialized).toBe(true)
    })
  })

  describe('addEvent', () => {
    it('应在本地日历创建事件', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])
      mockEventRepo.create.mockResolvedValue(createMockEvent({ id: '20' }))

      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: '新事件',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
        calendarId: '1',
      })

      expect(mockEventRepo.create).toHaveBeenCalled()
      expect(store.events).toHaveLength(1)
    })

    it('应在只读外部日历上拒绝创建事件', async () => {
      const readOnlyCalendar = createMockCalendar({
        id: '2',
        type: 'exchange',
        readOnly: true,
      })
      mockCalendarRepo.getAll.mockResolvedValue([readOnlyCalendar])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: '新事件',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
        calendarId: '2',
      })

      expect(mockEventRepo.create).not.toHaveBeenCalled()
    })

    it('日历不存在时应直接返回', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar({ id: '1' })])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      await store.addEvent({
        title: '新事件',
        startTime: Date.now(),
        endTime: Date.now() + 3600000,
        allDay: false,
        calendarId: '999',
      })

      expect(mockEventRepo.create).not.toHaveBeenCalled()
      expect(store.events).toHaveLength(0)
    })
  })

  describe('updateEvent', () => {
    it('应在本地日历更新事件', async () => {
      const existingEvent = createMockEvent({ id: '10' })
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([existingEvent])
      const updatedEvent = { ...existingEvent, title: '更新后' }
      mockEventRepo.update.mockResolvedValue(updatedEvent)

      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('10', { title: '更新后' })

      expect(mockEventRepo.update).toHaveBeenCalled()
      expect(store.events[0].title).toBe('更新后')
    })

    it('事件不存在时不应执行更新', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      await store.updateEvent('999', { title: '不存在' })

      expect(mockEventRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteEvent', () => {
    it('应在本地日历删除事件', async () => {
      const existingEvent = createMockEvent({ id: '10' })
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([existingEvent])

      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('10')

      expect(mockEventRepo.delete).toHaveBeenCalledWith(10)
      expect(store.events).toHaveLength(0)
    })

    it('事件不存在时应直接返回', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      await store.deleteEvent('999')

      expect(mockEventRepo.delete).not.toHaveBeenCalled()
    })
  })

  describe('addCalendar', () => {
    it('应创建新日历并加入列表', async () => {
      const existingCalendar = createMockCalendar({ id: '1', name: '我的日历' })
      mockCalendarRepo.getAll.mockResolvedValue([existingCalendar])
      mockEventRepo.getAll.mockResolvedValue([])
      mockCalendarRepo.create.mockResolvedValue(createMockCalendar({ id: '3', name: '工作日历' }))

      const store = useCalendarStore()
      await store.initialize()

      await store.addCalendar({
        name: '工作日历',
        color: '#FF0000',
        type: 'local',
        visible: true,
        syncEnabled: false,
      })

      expect(mockCalendarRepo.create).toHaveBeenCalled()
      expect(store.calendars).toHaveLength(2)
      expect(store.calendars[1].name).toBe('工作日历')
    })
  })

  describe('updateCalendar', () => {
    it('应更新本地日历属性', async () => {
      const calendar = createMockCalendar({ id: '1' })
      mockCalendarRepo.getAll.mockResolvedValue([calendar])
      mockEventRepo.getAll.mockResolvedValue([])
      mockCalendarRepo.update.mockResolvedValue({ ...calendar, name: '新名称' })

      const store = useCalendarStore()
      await store.initialize()

      await store.updateCalendar('1', { name: '新名称' })

      expect(mockCalendarRepo.update).toHaveBeenCalled()
      expect(store.calendars[0].name).toBe('新名称')
    })

    it('日历不存在时不应执行更新', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar({ id: '1' })])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      await store.updateCalendar('999', { name: '不存在' })

      expect(mockCalendarRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteCalendar', () => {
    it('应删除日历及其关联事件', async () => {
      const calendar = createMockCalendar({ id: '1' })
      const event = createMockEvent({ id: '10', calendarId: '1' })
      mockCalendarRepo.getAll.mockResolvedValue([calendar])
      mockEventRepo.getAll.mockResolvedValue([event])

      const store = useCalendarStore()
      await store.initialize()

      await store.deleteCalendar('1')

      expect(mockCalendarRepo.delete).toHaveBeenCalledWith(1)
      expect(store.calendars).toHaveLength(0)
      expect(store.events).toHaveLength(0)
    })
  })

  describe('视图导航', () => {
    it('应切换当前视图', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      store.setView('week')
      expect(store.currentView).toBe('week')
    })

    it('应导航到指定日期', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      const targetDate = new Date(2025, 5, 15)
      store.navigateToDate(targetDate)
      expect(store.currentDate).toEqual(targetDate)
    })

    it('goToToday 应设置当前日期和选中日期为今天', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar()])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      store.navigateToDate(new Date(2020, 0, 1))
      store.goToToday()

      expect(store.selectedDate).toBeTruthy()
    })
  })

  describe('getValidCalendarId', () => {
    it('应返回有效的数字日历 ID', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar({ id: '3' })])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      const result = store.getValidCalendarId('3')
      expect(result).toBe(3)
    })

    it('无效 ID 时应回退到本地日历', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([createMockCalendar({ id: '5' })])
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()

      const result = store.getValidCalendarId('abc')
      expect(result).toBe(5)
    })

    it('无可用日历时应返回 1 作为兜底', async () => {
      mockCalendarRepo.getAll.mockResolvedValue([])
      mockCalendarRepo.create.mockResolvedValue(createMockCalendar({ id: '1' }))
      mockEventRepo.getAll.mockResolvedValue([])

      const store = useCalendarStore()
      await store.initialize()
      store.calendars = []

      const result = store.getValidCalendarId('abc')
      expect(result).toBe(1)
    })
  })

  describe('reloadFromDatabase', () => {
    it('应重新加载日历和事件数据', async () => {
      const calendar = createMockCalendar()
      const event = createMockEvent()
      mockCalendarRepo.getAll.mockResolvedValue([calendar])
      mockEventRepo.getAll.mockResolvedValue([event])

      const store = useCalendarStore()
      await store.initialize()

      const newCalendar = createMockCalendar({ id: '2', name: '新日历' })
      const newEvent = createMockEvent({ id: '20', title: '新事件' })
      mockCalendarRepo.getAll.mockResolvedValue([calendar, newCalendar])
      mockEventRepo.getAll.mockResolvedValue([event, newEvent])

      await store.reloadFromDatabase()

      expect(store.calendars).toHaveLength(2)
      expect(store.events).toHaveLength(2)
    })
  })

  describe('visibleCalendars / visibleEvents', () => {
    it('应过滤出可见日历的事件', async () => {
      const visibleCal = createMockCalendar({ id: '1', visible: true })
      const hiddenCal = createMockCalendar({ id: '2', visible: false })
      const event1 = createMockEvent({ id: '10', calendarId: '1' })
      const event2 = createMockEvent({ id: '20', calendarId: '2' })
      mockCalendarRepo.getAll.mockResolvedValue([visibleCal, hiddenCal])
      mockEventRepo.getAll.mockResolvedValue([event1, event2])

      const store = useCalendarStore()
      await store.initialize()

      expect(store.visibleCalendars).toHaveLength(1)
      expect(store.visibleCalendars[0].id).toBe('1')
      expect(store.visibleEvents).toHaveLength(1)
      expect(store.visibleEvents[0].id).toBe('10')
    })
  })
})
