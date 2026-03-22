# 日历数据管理流程

## 目录
1. [概述](#概述)
2. [数据模型](#数据模型)
3. [状态管理](#状态管理)
4. [数据操作](#数据操作)
5. [数据库集成](#数据库集成)
6. [视图数据流](#视图数据流)

## 概述

小河日历使用Pinia进行状态管理，结合SQLite数据库实现数据的持久化。支持多日历管理、事件存储和视图状态管理。

## 数据模型

### 日历 (Calendar)
```typescript
interface Calendar {
  id: string
  name: string
  color: string
  type: 'local' | 'remote'
  accountId?: string
  visible: boolean
  syncEnabled: boolean
}
```

### 事件 (CalendarEvent)
```typescript
interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  startTime: number  // Unix时间戳
  endTime: number
  allDay: boolean
  location?: string
  reminder?: number  // 提前提醒分钟数
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  createdAt: number
  updatedAt: number
}
```

### 视图类型 (CalendarView)
```typescript
type CalendarView = 'day' | 'week' | 'month' | 'year'
```

## 状态管理

### Store结构
```typescript
export const useCalendarStore = defineStore('calendar', () => {
  // State
  const calendars = ref<Calendar[]>([...])
  const events = ref<CalendarEvent[]>([])
  const currentView = ref<CalendarView>('month')
  const currentDate = ref(new Date())
  const selectedDate = ref<Date | null>(null)
  const isInitialized = ref(false)

  // Getters
  const visibleCalendars = computed(...)
  const visibleEvents = computed(...)
  const currentDateRange = computed(...)
  const eventsForCurrentView = computed(...)

  // Actions
  async function initialize() {...}
  async function addCalendar(calendar) {...}
  async function updateCalendar(id, updates) {...}
  async function deleteCalendar(id) {...}
  async function addEvent(event) {...}
  async function updateEvent(id, updates) {...}
  async function deleteEvent(id) {...}
  function setView(view) {...}
  function navigateToDate(date) {...}
  function goToToday() {...}
  function next() {...}
  function prev() {...}
  function selectDate(date) {...}

  return {...}
})
```

## 数据操作

### 日历操作
1. **添加日历**
   ```typescript
   async function addCalendar(calendar: Omit<Calendar, 'id'>) {
     const id = `cal_${Date.now()}`
     const now = Date.now()
     const newCalendar: Calendar = { ...calendar, id }
     calendars.value.push(newCalendar)
     await saveCalendar({ ...newCalendar, createdAt: now, updatedAt: now })
   }
   ```

2. **更新日历**
   ```typescript
   async function updateCalendar(id: string, updates: Partial<Calendar>) {
     const index = calendars.value.findIndex(c => c.id === id)
     if (index !== -1) {
       calendars.value[index] = { ...calendars.value[index], ...updates }
       await saveCalendar({ ...calendars.value[index], updatedAt: Date.now() })
     }
   }
   ```

3. **删除日历**
   ```typescript
   async function deleteCalendar(id: string) {
     calendars.value = calendars.value.filter(c => c.id !== id)
     events.value = events.value.filter(e => e.calendarId !== id)
     await dbDeleteCalendar(id)
   }
   ```

### 事件操作
1. **添加事件**
   ```typescript
   async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
     const now = Date.now()
     const newEvent: CalendarEvent = {
       ...event,
       id: `evt_${now}`,
       createdAt: now,
       updatedAt: now
     }
     events.value.push(newEvent)
     await saveEvent(newEvent)
   }
   ```

2. **更新事件**
   ```typescript
   async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
     const index = events.value.findIndex(e => e.id === id)
     if (index !== -1) {
       events.value[index] = {
         ...events.value[index],
         ...updates,
         updatedAt: Date.now()
       }
       await saveEvent(events.value[index])
     }
   }
   ```

3. **删除事件**
   ```typescript
   async function deleteEvent(id: string) {
     events.value = events.value.filter(e => e.id !== id)
     await dbDeleteEvent(id)
   }
   ```

## 数据库集成

### 数据库操作函数
```typescript
import {
  initDatabase,
  getAllCalendars,
  saveCalendar,
  deleteCalendar as dbDeleteCalendar,
  getAllEvents,
  saveEvent,
  deleteEvent as dbDeleteEvent
} from '../utils/database'
```

### 初始化流程
```typescript
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
    } else {
      // 数据库为空，保存默认日历到数据库
      const now = Date.now()
      await saveCalendar({
        ...calendars.value[0],
        createdAt: now,
        updatedAt: now
      })
    }

    // 加载事件
    const loadedEvents = await getAllEvents()
    events.value = loadedEvents

    isInitialized.value = true
  } catch (error) {
    console.error('Failed to initialize calendar store:', error)
  }
}
```

## 视图数据流

### 日期范围计算
```typescript
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
```

### 事件过滤
```typescript
const visibleEvents = computed(() => {
  const visibleIds = visibleCalendars.value.map(c => c.id)
  return events.value.filter(e => visibleIds.includes(e.calendarId))
})

const eventsForCurrentView = computed(() => {
  const { start, end } = currentDateRange.value
  return visibleEvents.value.filter(e => {
    return e.startTime >= start.getTime() && e.startTime <= end.getTime()
  })
})
```

## 相关文件

- 状态管理: `src/stores/calendar.ts`
- 数据库操作: `src/utils/database.ts`
- 类型定义: `src/types/index.ts`
- 日历组件: `src/components/calendar/`