import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Calendar, CalendarEvent, CalendarView, DateRange } from '../types'
import { usePlatform, useCapabilities } from '@/platform/provider'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'
import { cloudSyncService } from '../services/cloudSync'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '@/utils/date'
import { debounce } from '@/utils/helpers'

const DAY_MS = 86400000

export const useCalendarStore = defineStore('calendar', () => {
  const calendars = ref<Calendar[]>([])
  const events = ref<CalendarEvent[]>([])
  const currentView = ref<CalendarView>('month')
  const currentDate = ref(new Date())
  const selectedDate = ref<Date | null>(null)
  const isInitialized = ref(false)
  const loadedRange = ref<{ start: number; end: number } | null>(null)
  const totalEventCount = ref<number>(0)

  function computeLoadRange(view: CalendarView, date: Date): { start: number; end: number } {
    const d = new Date(date)
    switch (view) {
      case 'day': {
        const start = startOfDay(d)
        const end = endOfDay(d)
        return {
          start: new Date(start.getTime() - DAY_MS).getTime(),
          end: new Date(end.getTime() + DAY_MS).getTime(),
        }
      }
      case 'week': {
        const weekStart = startOfWeek(d)
        const weekEnd = endOfWeek(d)
        return {
          start: new Date(weekStart.getTime() - 3 * DAY_MS).getTime(),
          end: new Date(weekEnd.getTime() + 3 * DAY_MS).getTime(),
        }
      }
      case 'month': {
        const monthStart = startOfMonth(d)
        const monthEnd = endOfMonth(d)
        return {
          start: new Date(monthStart.getTime() - 7 * DAY_MS).getTime(),
          end: new Date(monthEnd.getTime() + 7 * DAY_MS).getTime(),
        }
      }
      case 'year': {
        const firstMonth = startOfMonth(new Date(d.getFullYear(), 0, 1))
        const firstMonthEnd = endOfMonth(firstMonth)
        return {
          start: new Date(firstMonth.getTime() - 7 * DAY_MS).getTime(),
          end: new Date(firstMonthEnd.getTime() + 7 * DAY_MS).getTime(),
        }
      }
    }
  }

  async function loadYearView(date: Date): Promise<void> {
    const { eventRepo } = usePlatform()
    const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
    if (visibleCalendarIds.length === 0) {
      events.value = []
      return
    }
    const year = date.getFullYear()
    const monthlyRanges = Array.from({ length: 12 }, (_, i) => {
      const monthStart = startOfMonth(new Date(year, i, 1))
      const monthEnd = endOfMonth(monthStart)
      return {
        start: new Date(monthStart.getTime() - 7 * DAY_MS).getTime(),
        end: new Date(monthEnd.getTime() + 7 * DAY_MS).getTime(),
      }
    })
    const results = await Promise.all(
      monthlyRanges.map(range =>
        eventRepo.getByTimeRangeAndCalendars(range.start, range.end, visibleCalendarIds)
          .catch(() => [] as CalendarEvent[])
      )
    )
    // 去重合并（相邻月份缓冲区有重叠）
    const eventMap = new Map<number, CalendarEvent>()
    for (const monthEvents of results) {
      for (const event of monthEvents) {
        eventMap.set(event.id, event)
      }
    }
    events.value = Array.from(eventMap.values())
    loadedRange.value = {
      start: monthlyRanges[0].start,
      end: monthlyRanges[11].end,
    }
  }

  function isEventInRange(event: CalendarEvent, range: { start: number; end: number }): boolean {
    return event.startTime < range.end && event.endTime > range.start
  }

  async function initialize() {
    if (isInitialized.value) return

    try {
      const { calendarRepo, eventRepo } = usePlatform()

      try {
        const storedSettings = localStorage.getItem('app-settings')
        if (storedSettings) {
          const settings = JSON.parse(storedSettings)
          if (settings.defaultView) {
            currentView.value = settings.defaultView
          }
        }
      } catch (e) {
        console.error('Failed to load default view setting:', e)
      }

      const loadedCalendars = await calendarRepo.getAll()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars
      } else {
        const capabilities = useCapabilities()
        if (capabilities.dataPriority === 'local-first') {
          const created = await calendarRepo.create({
            name: '我的日历',
            color: '#4A90D9',
            type: 'local',
            visible: true,
            syncEnabled: false
          })
          calendars.value = [created]
          console.log('Default calendar saved to database:', created.id)
        }
      }

      // 按时间范围加载事件
      const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
      if (visibleCalendarIds.length === 0) {
        events.value = []
      } else if (currentView.value === 'year') {
        await loadYearView(currentDate.value)
      } else {
        const { start, end } = computeLoadRange(currentView.value, currentDate.value)
        const loadedEvents = await eventRepo.getByTimeRangeAndCalendars(start, end, visibleCalendarIds)
        events.value = loadedEvents
        loadedRange.value = { start, end }
      }

      // 获取事件总数
      try {
        totalEventCount.value = await eventRepo.getCount()
      } catch {
        totalEventCount.value = events.value.length
      }

      isInitialized.value = true
      console.log('Calendar store initialized (local data):', {
        calendars: calendars.value.length,
        events: events.value.length,
        defaultView: currentView.value
      })

      // 初始化完成后，触发 Rust 后端同步外部日历
      // 后端同步完成时通过 `external-sync-complete` 事件通知前端刷新
      const capabilities = useCapabilities()
      if (capabilities.hasExternalSync) {
        try {
          const { syncRepo } = usePlatform()
          // 监听后端同步完成事件，自动刷新数据
          syncRepo.onExternalSyncComplete(() => {
            reloadFromDatabase()
          })
          // 触发首次同步
          await syncRepo.triggerExternalSync()
        } catch (error) {
          console.error('[CalendarStore] 触发外部日历同步失败:', error)
        }
      }

    } catch (error) {
      console.error('Failed to initialize calendar store:', error)
      isInitialized.value = true
    }
  }

  const visibleCalendars = computed(() => calendars.value.filter(c => c.visible))

  const visibleEvents = computed(() => {
    const visibleIds = visibleCalendars.value.map(c => c.id)
    return events.value.filter(e => visibleIds.includes(e.calendarId))
  })

  const currentDateRange = computed((): DateRange => {
    const date = currentDate.value
    const year = date.getFullYear()
    const month = date.getMonth()

    switch (currentView.value) {
      case 'day':
        const startOfDay = new Date(year, month, date.getDate())
        return { start: startOfDay, end: new Date(startOfDay.getTime() + 86400000) }
      case 'week':
        const dayOfWeek = date.getDay()
        const startOfWeek = new Date(year, month, date.getDate() - dayOfWeek)
        return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 86400000) }
      case 'month':
        const startOfMonth = new Date(year, month, 1)
        const endOfMonth = new Date(year, month + 1, 0)
        return { start: startOfMonth, end: endOfMonth }
      case 'year':
        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) }
    }
  })

  const eventsForCurrentView = computed(() => {
    const { start, end } = currentDateRange.value
    return visibleEvents.value.filter(e => {
      return e.startTime < end.getTime() && e.endTime > start.getTime()
    })
  })

  function getValidCalendarId(calendarId: string | undefined): number {
    if (calendarId) {
      const parsed = parseInt(calendarId)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    const localCalendar = calendars.value.find(c => c.type === 'local')
    if (localCalendar) {
      const parsed = parseInt(localCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    const firstCalendar = calendars.value[0]
    if (firstCalendar) {
      const parsed = parseInt(firstCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    console.warn('[CalendarStore] 无法获取有效的日历 ID，使用默认值 1')
    return 1
  }

  async function addCalendar(calendar: Omit<Calendar, 'id'>) {
    const { calendarRepo } = usePlatform()
    const created = await calendarRepo.create({
      name: calendar.name,
      color: calendar.color,
      type: calendar.type || 'local',
      accountId: calendar.accountId ? parseInt(calendar.accountId) : undefined,
      visible: calendar.visible ?? true,
      syncEnabled: calendar.syncEnabled ?? false,
      readOnly: calendar.readOnly,
    })
    calendars.value.push(created)
    console.log('Calendar created:', created.id)
  }

  async function updateCalendar(id: string, updates: Partial<Calendar>) {
    const { calendarRepo } = usePlatform()
    const index = calendars.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const calId = parseInt(id)
      if (!isNaN(calId)) {
        await calendarRepo.update({
          id: calId,
          name: updates.name,
          color: updates.color,
          visible: updates.visible,
          syncEnabled: updates.syncEnabled
        })
        calendars.value[index] = { ...calendars.value[index], ...updates }
        console.log('Calendar updated:', id)
      } else {
        calendars.value[index] = { ...calendars.value[index], ...updates }
      }
    }
  }

  async function deleteCalendar(id: string) {
    const { calendarRepo, eventRepo } = usePlatform()
    const calId = parseInt(id)
    if (!isNaN(calId)) {
      await calendarRepo.delete(calId)
    }
    calendars.value = calendars.value.filter(c => c.id !== id)
    events.value = events.value.filter(e => e.calendarId !== id)
    console.log('Calendar deleted:', id)
  }

  async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const { eventRepo } = usePlatform()
    const capabilities = useCapabilities()

    const created = await eventRepo.createWithSync({
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      calendarId: getValidCalendarId(event.calendarId),
      color: event.color,
      reminder: event.reminder,
      repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
      location: event.location,
      externalId: event.externalId,
    })

    // 仅当事件在 loadedRange 内且属于可见日历时才加入内存
    const isVisible = visibleCalendars.value.some(c => c.id === event.calendarId)
    if (loadedRange.value && isEventInRange(created, loadedRange.value) && isVisible) {
      events.value.push(created)
    }
    totalEventCount.value++

    const targetCalendar = calendars.value.find(c => c.id === event.calendarId)
    if (targetCalendar?.type === 'online' && capabilities.dataPriority === 'local-first') {
      await cloudSyncService.triggerSync()
    }

    console.log('Event created:', created.id)
  }

  async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
    const { eventRepo } = usePlatform()
    const capabilities = useCapabilities()
    const index = events.value.findIndex(e => e.id === id)
    if (index === -1) return

    const event = events.value[index]

    const updated = await eventRepo.updateWithSync({
      id: parseInt(id),
      title: updates.title ?? event.title,
      description: updates.description ?? event.description,
      startTime: updates.startTime ?? event.startTime,
      endTime: updates.endTime ?? event.endTime,
      allDay: updates.allDay ?? event.allDay,
      calendarId: parseInt(updates.calendarId ?? event.calendarId) || 1,
      color: updates.color ?? event.color,
      reminder: updates.reminder ?? event.reminder,
      repeatRule: updates.repeatRule ? JSON.stringify(updates.repeatRule) : (event.repeatRule ? JSON.stringify(event.repeatRule) : undefined),
      location: updates.location ?? event.location,
      externalId: updates.externalId ?? event.externalId,
    })

    const isVisible = visibleCalendars.value.some(c => c.id === updated.calendarId)
    const isInRange = loadedRange.value && isEventInRange(updated, loadedRange.value)
    if (!isInRange || !isVisible) {
      // 事件移出范围或不可见，从内存移除
      events.value.splice(index, 1)
    } else {
      events.value[index] = updated
    }

    const calendar = calendars.value.find(c => c.id === event.calendarId)
    if (calendar?.type === 'online' && capabilities.dataPriority === 'local-first') {
      await cloudSyncService.triggerSync()
    }

    console.log('Event updated:', id)
  }

  async function deleteEvent(id: string) {
    const { eventRepo } = usePlatform()
    const capabilities = useCapabilities()
    const event = events.value.find(e => e.id === id)
    if (!event) return

    await eventRepo.deleteWithSync(parseInt(id))

    events.value = events.value.filter(e => e.id !== id)
    totalEventCount.value--

    const calendar = calendars.value.find(c => c.id === event.calendarId)
    if (calendar?.type === 'online' && capabilities.dataPriority === 'local-first') {
      await cloudSyncService.triggerSync()
    }

    console.log('Event deleted:', id)
  }

  function setView(view: CalendarView) {
    currentView.value = view
  }

  function navigateToDate(date: Date) {
    currentDate.value = date
  }

  function goToToday() {
    currentDate.value = new Date()
    selectedDate.value = new Date()
  }

  function next() {
    const date = new Date(currentDate.value)
    switch (currentView.value) {
      case 'day':
        date.setDate(date.getDate() + 1)
        break
      case 'week':
        date.setDate(date.getDate() + 7)
        break
      case 'month':
        date.setMonth(date.getMonth() + 1)
        break
      case 'year':
        date.setFullYear(date.getFullYear() + 1)
        break
    }
    currentDate.value = date
  }

  function prev() {
    const date = new Date(currentDate.value)
    switch (currentView.value) {
      case 'day':
        date.setDate(date.getDate() - 1)
        break
      case 'week':
        date.setDate(date.getDate() - 7)
        break
      case 'month':
        date.setMonth(date.getMonth() - 1)
        break
      case 'year':
        date.setFullYear(date.getFullYear() - 1)
        break
    }
    currentDate.value = date
  }

  function selectDate(date: Date) {
    selectedDate.value = date
  }

  watch([currentView, currentDate], async () => {
    if (!isInitialized.value || !loadedRange.value) return
    const newRange = computeLoadRange(currentView.value, currentDate.value)

    // 如果新窗口在已加载范围内，不重新加载
    if (newRange.start >= loadedRange.value.start &&
        newRange.end <= loadedRange.value.end) {
      return
    }

    // 超出已加载范围，重新加载
    const { eventRepo } = usePlatform()
    const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
    if (visibleCalendarIds.length === 0) {
      events.value = []
      return
    }
    if (currentView.value === 'year') {
      await loadYearView(currentDate.value)
    } else {
      const loadedEvents = await eventRepo.getByTimeRangeAndCalendars(
        newRange.start, newRange.end, visibleCalendarIds
      )
      events.value = loadedEvents
      loadedRange.value = newRange
    }
  })

  // watch visibleCalendars 变化，300ms 防抖后重新加载
  watch(visibleCalendars, debounce(async () => {
    if (!isInitialized.value || !loadedRange.value) return
    const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
    if (visibleCalendarIds.length === 0) {
      events.value = []
      return
    }
    const { eventRepo } = usePlatform()
    if (currentView.value === 'year') {
      await loadYearView(currentDate.value)
    } else {
      events.value = await eventRepo.getByTimeRangeAndCalendars(
        loadedRange.value.start, loadedRange.value.end, visibleCalendarIds
      )
    }
  }, 300), { deep: true })

  async function reloadFromDatabase(): Promise<void> {
    try {
      const { calendarRepo, eventRepo } = usePlatform()

      const loadedCalendars = await calendarRepo.getAll()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars
      }

      if (loadedRange.value) {
        const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
        if (visibleCalendarIds.length === 0) {
          events.value = []
        } else if (currentView.value === 'year') {
          await loadYearView(currentDate.value)
        } else {
          events.value = await eventRepo.getByTimeRangeAndCalendars(
            loadedRange.value.start, loadedRange.value.end, visibleCalendarIds
          )
        }
      } else {
        // loadedRange 为 null（异常场景），加载默认范围
        const defaultRange = computeLoadRange(currentView.value, currentDate.value)
        const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
        if (visibleCalendarIds.length === 0) {
          events.value = []
        } else {
          events.value = await eventRepo.getByTimeRangeAndCalendars(
            defaultRange.start, defaultRange.end, visibleCalendarIds
          )
        }
        loadedRange.value = defaultRange
      }

      try {
        totalEventCount.value = await eventRepo.getCount()
      } catch {
        totalEventCount.value = events.value.length
      }

      console.log('[CalendarStore] 数据已从数据库重新加载:', {
        calendars: calendars.value.length,
        events: events.value.length,
      })
    } catch (error) {
      console.error('[CalendarStore] 重新加载数据失败:', error)
    }
  }

  async function loginTransition(): Promise<void> {
    const { calendarRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()

    if (capabilities.dataPriority !== 'local-first') return

    await syncRepo.triggerCloudSync()

    const mainCalendar = calendars.value.find(c => c.type === 'local')
    if (mainCalendar) {
      await calendarRepo.updateType({
        id: parseInt(mainCalendar.id),
        type: 'online',
        syncEnabled: true,
      })
    }

    await reloadFromDatabase()
  }

  async function logoutTransition(): Promise<void> {
    const { calendarRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()

    if (capabilities.dataPriority !== 'local-first') return

    try {
      await syncRepo.triggerCloudSync()
    } catch (error) {
      console.warn('[CalendarStore] 退出前同步失败，本地数据可能不是最新:', error)
    }

    const mainCalendar = calendars.value.find(c => c.type === 'online')
    if (mainCalendar) {
      await calendarRepo.updateType({
        id: parseInt(mainCalendar.id),
        type: 'local',
        syncEnabled: false,
      })
    }

    await reloadFromDatabase()
  }

  return {
    calendars,
    events,
    currentView,
    currentDate,
    selectedDate,
    isInitialized,
    loadedRange,
    totalEventCount,
    initialize,
    reloadFromDatabase,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    addEvent,
    updateEvent,
    deleteEvent,
    loginTransition,
    logoutTransition,
    setView,
    navigateToDate,
    goToToday,
    next,
    prev,
    selectDate,
    visibleCalendars,
    visibleEvents,
    currentDateRange,
    eventsForCurrentView,
    getValidCalendarId
  }
})
