import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Calendar, CalendarEvent, CalendarView, DateRange } from '../types'
import {
  initDatabase,
  getAllCalendars,
  saveCalendar,
  deleteCalendar as dbDeleteCalendar,
  getAllEvents,
  saveEvent,
  deleteEvent as dbDeleteEvent,
  cleanupDuplicateAccounts
} from '../utils/database'
import {
  invokeGetAllAccounts,
  invokeGetExternalCalendars,
  safeInvoke
} from '../utils/tauri'

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

      // 清理重复账号
      await cleanupDuplicateAccounts()

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

      // 加载本地日历
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
        console.log('Default calendar saved to database')
      }

      // 加载外部账号和日历
      await loadExternalCalendars()

      // 加载事件
      const loadedEvents = await getAllEvents()
      events.value = loadedEvents

      // 加载外部事件：根据当前视图范围初始化加载
      const { start, end } = currentDateRange.value
      await loadExternalEvents(start.getTime(), end.getTime())

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

  // 加载外部日历
  async function loadExternalCalendars() {
    try {
      const accounts = await invokeGetAllAccounts()
      if (!accounts || accounts.length === 0) return

      for (const account of accounts) {
        try {
          const externalCalendars = await invokeGetExternalCalendars(account)
          if (!externalCalendars) {
            console.warn(`[CalendarStore] No calendars found for account: ${account.username} (${account.id})`)
            continue
          }

          console.log(`[CalendarStore] Loaded ${externalCalendars.length} calendars for account: ${account.username}`)

          for (const cal of externalCalendars) {
            const calendarId = `ext_${account.id}_${cal.id}`
            const existingIndex = calendars.value.findIndex(c => c.id === calendarId)

            if (existingIndex === -1) {
              // 添加新的外部日历
              const newCal: Calendar = {
                id: calendarId,
                name: cal.name,
                color: cal.color || '#6B7280',
                type: account.type,
                accountId: account.id,
                accountType: account.type,
                serverUrl: account.serverUrl,
                username: account.username,
                encryptedPassword: account.encryptedPassword,
                calendarUrl: cal.url,
                readOnly: cal.readOnly ?? false,
                visible: true,
                syncEnabled: true
              }
              calendars.value.push(newCal)
              
              // 持久化到数据库
              try {
                await saveCalendar({
                  ...newCal,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                })
                console.log(`[CalendarStore] 已将外部日历 ${cal.name} 保存到数据库`)
              } catch (dbError) {
                console.error(`保存外部日历 ${cal.name} 失败:`, dbError)
              }
            } else {
              // 更新已存在的外部日历凭证和权限
              calendars.value[existingIndex] = {
                ...calendars.value[existingIndex],
                accountType: account.type,
                serverUrl: account.serverUrl,
                username: account.username,
                encryptedPassword: account.encryptedPassword,
                calendarUrl: cal.url,
                readOnly: cal.readOnly ?? false,
              }
              
              // 同步更新数据库中的信息（特别是 readOnly 状态）
              try {
                await saveCalendar({
                  ...calendars.value[existingIndex],
                  updatedAt: Date.now()
                })
              } catch (dbError) {
                console.error(`更新外部日历 ${cal.name} 到数据库失败:`, dbError)
              }
            }
          }
          console.log(`[CalendarStore] 账号 ${account.username} 处理完成，当前总日历数: ${calendars.value.length}`)
        } catch (error) {
          console.error(`加载账号 ${account.username} 的外部日历失败:`, error)
        }
      }
    } catch (error) {
      console.error('加载外部日历发生严重错误:', error)
    }
  }

  // 加载外部事件并与本地数据库进行协调同步
  async function loadExternalEvents(startTime: number, endTime: number) {
    try {
      // [DIAGNOSTIC] 函数被调用
      console.log('[DIAGNOSTIC][loadExternalEvents] 开始加载外部事件', {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalCalendars: calendars.value.length
      })

      const externalCalendars = calendars.value.filter(c => c.type !== 'local')
      console.log('[DIAGNOSTIC][loadExternalEvents] 外部日历数量:', externalCalendars.length)

      for (const calendar of externalCalendars) {
        if (!calendar.accountId) {
          console.log('[DIAGNOSTIC][loadExternalEvents] 跳过日历（无 accountId）:', calendar.name)
          continue
        }

        // [DIAGNOSTIC] 打印外部日历对象的关键字段
        console.log('[DIAGNOSTIC][loadExternalEvents] 日历对象:', {
          id: calendar.id,
          name: calendar.name,
          type: calendar.type,
          accountId: calendar.accountId,
          accountType: calendar.accountType,
          serverUrl: calendar.serverUrl,
          username: calendar.username,
          encryptedPassword: calendar.encryptedPassword ? '***已设置***' : '未设置',
          calendarUrl: calendar.calendarUrl
        })

        const invokeArgs = {
          accountId: calendar.accountId || '',
          accountType: calendar.accountType || calendar.type || '',
          serverUrl: calendar.serverUrl || '',
          username: calendar.username || '',
          encryptedPassword: calendar.encryptedPassword || '',
          calendarUrl: calendar.calendarUrl || '',
          calendarId: calendar.id || '',
          startTime: startTime,
          endTime: endTime
        }
        console.log('[DIAGNOSTIC][loadExternalEvents] safeInvoke 调用前 - 参数:', JSON.stringify(invokeArgs))

        // [DIAGNOSTIC] 调用 safeInvoke 获取事件
        const fetchedEvents = await safeInvoke<CalendarEvent[]>('get_external_events', invokeArgs)

        // [DIAGNOSTIC] safeInvoke 调用后
        console.log('[DIAGNOSTIC][loadExternalEvents] safeInvoke 调用后 - 返回值:', fetchedEvents === null ? 'null' : `获取到 ${fetchedEvents.length} 个事件`)

        if (fetchedEvents) {
          // [DIAGNOSTIC] fetchedEvents 的内容和格式
          console.log('[DIAGNOSTIC][loadExternalEvents] fetchedEvents 详情:', {
            count: fetchedEvents.length,
            sample: fetchedEvents.slice(0, 2).map(e => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime,
              endTime: e.endTime,
              calendarId: e.calendarId,
              externalId: e.externalId
            }))
          })

          console.log(`[loadExternalEvents] 从日历 ${calendar.name} 获取到 ${fetchedEvents.length} 个事件`)

          // [DIAGNOSTIC] calendarId 匹配情况
          console.log('[DIAGNOSTIC][loadExternalEvents] calendarId 匹配检查:', {
            calendarId: calendar.id,
            matchedEvents: fetchedEvents.filter(e => e.calendarId === calendar.id).length,
            mismatchedEvents: fetchedEvents.filter(e => e.calendarId !== calendar.id).length
          })

          // 查出本地 store 里，当前日历下且在本次查询时间段内的旧事件
          const oldEvents = events.value.filter(e =>
            e.calendarId === calendar.id &&
            e.startTime >= startTime &&
            e.startTime <= endTime
          )
          console.log('[DIAGNOSTIC][loadExternalEvents] 本地旧事件数量:', oldEvents.length)

          const fetchedIds = new Set(fetchedEvents.map(e => e.id))

          // 找出当前范围内，本地有但服务器没有的事件（可能在其他端被删除），清理掉
          for (const old of oldEvents) {
            if (!fetchedIds.has(old.id)) {
              await dbDeleteEvent(old.id)
            }
          }

          // [DIAGNOSTIC] 事件保存到数据库的状态
          console.log('[DIAGNOSTIC][loadExternalEvents] 开始保存事件到数据库, 数量:', fetchedEvents.length)

          // 将服务器传来的最新事件全都覆盖保存到数据库，确保断网可用
          for (const newEv of fetchedEvents) {
            const evToSave = {
              ...newEv,
              createdAt: Date.now(),
              updatedAt: Date.now()
            }
            await saveEvent(evToSave)
          }

          console.log('[DIAGNOSTIC][loadExternalEvents] 事件保存到数据库完成')

          // 更新前端状态库：剔除原来区间内的事件，将得到的新事件注入
          events.value = events.value.filter(e => !(e.calendarId === calendar.id && e.startTime >= startTime && e.startTime <= endTime))
          events.value.push(...fetchedEvents)

          // [DIAGNOSTIC] 保存后的状态
          console.log('[DIAGNOSTIC][loadExternalEvents] 保存后事件状态:', {
            totalEvents: events.value.length,
            calendarEvents: events.value.filter(e => e.calendarId === calendar.id).length
          })
        } else {
          console.log('[DIAGNOSTIC][loadExternalEvents] fetchedEvents 为 null 或 undefined')
        }
      }

      console.log('[DIAGNOSTIC][loadExternalEvents] 加载外部事件完成')
    } catch (error) {
      console.error('[DIAGNOSTIC][loadExternalEvents] 加载外部事件失败:', error)
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

    // 检测目标日历类型
    const targetCalendar = calendars.value.find(c => c.id === event.calendarId)
    if (targetCalendar && targetCalendar.type !== 'local') {
      // 只读日历检查
      if (targetCalendar.readOnly) {
        console.error('创建事件失败：该日历为只读模式，不支持写入事件')
        return
      }
      // 外部日历：调用 Rust 命令
      try {
        // 传递完整的账号信息和日历 URL
        const result = await safeInvoke<any>('create_external_event', {
          accountId: targetCalendar.accountId || '',
          accountType: targetCalendar.accountType || targetCalendar.type || '',
          serverUrl: targetCalendar.serverUrl || '',
          username: targetCalendar.username || '',
          encryptedPassword: targetCalendar.encryptedPassword || '',
          calendarUrl: targetCalendar.calendarUrl || '',
          event: newEvent
        })
        if (result && result.success) {
          const finalEvent = { ...newEvent, externalId: result.external_id }
          events.value.push(finalEvent)

          // 成功后同样将数据落库以便离线查看
          try {
            await saveEvent(finalEvent)
          } catch (dbError) {
            console.error('保存外部事件到本地失败:', dbError)
          }
        } else {
          console.error('创建外部事件失败：', result?.error || '无法获取结果')
        }
      } catch (error) {
        console.error('创建外部事件失败:', error)
      }
    } else {
      // 本地日历：保存到数据库
      events.value.push(newEvent)
      try {
        await saveEvent(newEvent)
      } catch (error) {
        console.error('Failed to save event:', error)
      }
    }
  }

  async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
    const index = events.value.findIndex(e => e.id === id)
    if (index !== -1) {
      const event = events.value[index]
      const calendar = calendars.value.find(c => c.id === event.calendarId)

      if (calendar && calendar.type !== 'local') {
        // 外部日历事件：调用 Rust 命令
        try {
          const result = await safeInvoke<any>('update_external_event', {
            accountId: calendar.accountId || '',
            accountType: calendar.accountType || calendar.type || '',
            serverUrl: calendar.serverUrl || '',
            username: calendar.username || '',
            encryptedPassword: calendar.encryptedPassword || '',
            calendarUrl: calendar.calendarUrl || '',
            event: { ...event, ...updates }
          })
          if (result && result.success) {
            const updatedEvent = {
              ...event,
              ...updates,
              updatedAt: Date.now()
            }
            events.value[index] = updatedEvent

            try {
              await saveEvent(updatedEvent)
            } catch (dbError) {
              console.error('更新外部事件到本地库失败:', dbError)
            }
          } else {
            console.error('更新外部事件失败：', result?.error)
          }
        } catch (error) {
          console.error('调用更新外部事件失败:', error)
        }
      } else {
        // 本地日历事件：更新数据库
        events.value[index] = {
          ...event,
          ...updates,
          updatedAt: Date.now()
        }
        try {
          await saveEvent(events.value[index])
        } catch (error) {
          console.error('Failed to update event:', error)
        }
      }
    }
  }

  async function deleteEvent(id: string) {
    const event = events.value.find(e => e.id === id)
    if (!event) return

    const calendar = calendars.value.find(c => c.id === event.calendarId)

    if (calendar && calendar.type !== 'local') {
      // 外部日历事件：调用 Rust 命令
      try {
        const result = await safeInvoke<any>('delete_external_event', {
          accountId: calendar.accountId || '',
          accountType: calendar.accountType || calendar.type || '',
          serverUrl: calendar.serverUrl || '',
          username: calendar.username || '',
          encryptedPassword: calendar.encryptedPassword || '',
          calendarUrl: calendar.calendarUrl || '',
          eventId: id
        })
        if (result && result.success) {
          events.value = events.value.filter(e => e.id !== id)
          try {
            await dbDeleteEvent(id)
          } catch (dbError) {
            console.error('从本地库删除外部事件失败:', dbError)
          }
        } else {
          console.error('删除外部事件失败:', result?.error)
        }
      } catch (error) {
        console.error('调用删除外部事件失败:', error)
      }
    } else {
      // 本地日历事件：从数据库删除
      events.value = events.value.filter(e => e.id !== id)
      try {
        await dbDeleteEvent(id)
      } catch (error) {
        console.error('Failed to delete event:', error)
      }
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

  // 监听 currentDateRange 变化，触发按需网络查询
  watch(() => currentDateRange.value, (newRange) => {
    if (isInitialized.value) {
      loadExternalEvents(newRange.start.getTime(), newRange.end.getTime())
    }
  }, { deep: true })

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
    loadExternalCalendars,
    loadExternalEvents,
    // Getters
    visibleCalendars,
    visibleEvents,
    currentDateRange,
    eventsForCurrentView
  }
})