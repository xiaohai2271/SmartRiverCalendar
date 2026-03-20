import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Calendar, CalendarEvent, CalendarView, DateRange } from '../types'
import {
  initDatabase,
  getAllCalendars,
  saveCalendar,
  deleteCalendar as dbDeleteCalendar,
  getAllEvents,
  saveEvent,
  deleteEvent as dbDeleteEvent
} from '../utils/database'

export const useCalendarStore = defineStore('calendar', () => {
  // State
  const calendars = ref<Calendar[]>([
    {
      id: 'default',
      name: '我的日历',
      color: '#4A90D9',
      type: 'local',
      visible: true,
      syncEnabled: false
    }
  ])

  const events = ref<CalendarEvent[]>([])
  const currentView = ref<CalendarView>('month') // 默认值，将在 initialize 中从设置读取
  const currentDate = ref(new Date())
  const selectedDate = ref<Date | null>(null)
  const isInitialized = ref(false)

  // 初始化数据库并加载数据
  async function initialize() {
    if (isInitialized.value) return

    try {
      await initDatabase()

      // 从 localStorage 加载默认视图设置
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

      // 加载日历
      const loadedCalendars = await getAllCalendars()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          type: c.type,
          accountId: c.account_id,
          visible: c.visible === 1,
          syncEnabled: c.sync_enabled === 1
        }))
      }

      // 加载事件
      const loadedEvents = await getAllEvents()
      events.value = loadedEvents

      isInitialized.value = true
      console.log('Calendar store initialized:', {
        calendars: calendars.value.length,
        events: events.value.length,
        defaultView: currentView.value
      })
    } catch (error) {
      console.error('Failed to initialize calendar store:', error)
    }
  }

  // Getters
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
      return e.startTime >= start.getTime() && e.startTime <= end.getTime()
    })
  })

  // Actions
  async function addCalendar(calendar: Omit<Calendar, 'id'>) {
    const id = `cal_${Date.now()}`
    const now = Date.now()
    const newCalendar: Calendar = { ...calendar, id }
    calendars.value.push(newCalendar)

    // 持久化
    try {
      await saveCalendar({
        ...newCalendar,
        createdAt: now,
        updatedAt: now
      })
    } catch (error) {
      console.error('Failed to save calendar:', error)
    }
  }

  async function updateCalendar(id: string, updates: Partial<Calendar>) {
    const index = calendars.value.findIndex(c => c.id === id)
    if (index !== -1) {
      calendars.value[index] = { ...calendars.value[index], ...updates }

      // 持久化
      try {
        await saveCalendar({
          ...calendars.value[index],
          updatedAt: Date.now()
        })
      } catch (error) {
        console.error('Failed to update calendar:', error)
      }
    }
  }

  async function deleteCalendar(id: string) {
    calendars.value = calendars.value.filter(c => c.id !== id)
    events.value = events.value.filter(e => e.calendarId !== id)

    // 持久化
    try {
      await dbDeleteCalendar(id)
    } catch (error) {
      console.error('Failed to delete calendar:', error)
    }
  }

  async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    const newEvent: CalendarEvent = {
      ...event,
      id: `evt_${now}`,
      createdAt: now,
      updatedAt: now
    }
    events.value.push(newEvent)

    // 持久化
    try {
      await saveEvent(newEvent)
    } catch (error) {
      console.error('Failed to save event:', error)
    }
  }

  async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
    const index = events.value.findIndex(e => e.id === id)
    if (index !== -1) {
      events.value[index] = {
        ...events.value[index],
        ...updates,
        updatedAt: Date.now()
      }

      // 持久化
      try {
        await saveEvent(events.value[index])
      } catch (error) {
        console.error('Failed to update event:', error)
      }
    }
  }

  async function deleteEvent(id: string) {
    events.value = events.value.filter(e => e.id !== id)

    // 持久化
    try {
      await dbDeleteEvent(id)
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
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

  return {
    // State
    calendars,
    events,
    currentView,
    currentDate,
    selectedDate,
    isInitialized,
    // Actions
    initialize,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    addEvent,
    updateEvent,
    deleteEvent,
    setView,
    navigateToDate,
    goToToday,
    next,
    prev,
    selectDate,
    // Getters
    visibleCalendars,
    visibleEvents,
    currentDateRange,
    eventsForCurrentView
  }
})