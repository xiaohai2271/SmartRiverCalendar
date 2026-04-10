import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Calendar, CalendarEvent, CalendarView, DateRange } from '../types'
import {
  invokeGetAllAccounts,
  invokeGetExternalCalendars,
  safeInvoke,
  invokeGetCalendars,
  invokeCreateCalendar,
  invokeUpdateCalendar,
  invokeDeleteCalendar,
  invokeGetEvents,
  invokeCreateEvent,
  invokeUpdateEvent,
  invokeDeleteEvent
} from '../utils/tauri'

// 默认日历 ID（前端生成的临时 ID，用于数据库为空时的默认日历）
const DEFAULT_CALENDAR_ID = 'default'

export const useCalendarStore = defineStore('calendar', () => {
  // State
  const calendars = ref<Calendar[]>([
    {
      id: DEFAULT_CALENDAR_ID,
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
      const loadedCalendars = await invokeGetCalendars()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars
      } else {
        // 数据库为空，保存默认日历到数据库
        const defaultCal = calendars.value[0]
        const created = await invokeCreateCalendar({
          name: defaultCal.name,
          color: defaultCal.color,
          type: defaultCal.type,
          visible: defaultCal.visible,
          syncEnabled: defaultCal.syncEnabled
        })
        if (created) {
          calendars.value = [created]
          console.log('Default calendar saved to database:', created.id)
        }
      }

      // 加载外部账号和日历
      await loadExternalCalendars()

      // 加载事件
      const loadedEvents = await invokeGetEvents()
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
            // 外部日历的 ID 格式: ext_{accountId}_{externalCalId}
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
                await invokeCreateCalendar({
                  name: newCal.name,
                  color: newCal.color,
                  type: newCal.type,
                  accountId: parseInt(account.id),
                  visible: newCal.visible,
                  syncEnabled: newCal.syncEnabled
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
              
              // 同步更新数据库中的信息
              const calId = parseInt(calendars.value[existingIndex].id)
              if (!isNaN(calId)) {
                try {
                  await invokeUpdateCalendar({
                    id: calId,
                    visible: calendars.value[existingIndex].visible,
                    syncEnabled: calendars.value[existingIndex].syncEnabled
                  })
                } catch (dbError) {
                  console.error(`更新外部日历 ${cal.name} 到数据库失败:`, dbError)
                }
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
      console.log('[loadExternalEvents] 开始加载外部事件', {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        totalCalendars: calendars.value.length
      })

      const externalCalendars = calendars.value.filter(c => c.type !== 'local')
      console.log('[loadExternalEvents] 外部日历数量:', externalCalendars.length)

      for (const calendar of externalCalendars) {
        if (!calendar.accountId) {
          console.log('[loadExternalEvents] 跳过日历（无 accountId）:', calendar.name)
          continue
        }

        console.log('[loadExternalEvents] 日历对象:', {
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
        console.log('[loadExternalEvents] safeInvoke 调用前 - 参数:', JSON.stringify(invokeArgs))

        // 调用 safeInvoke 获取事件
        const fetchedEvents = await safeInvoke<CalendarEvent[]>('get_external_events', invokeArgs)

        console.log('[loadExternalEvents] safeInvoke 调用后 - 返回值:', fetchedEvents === null ? 'null' : `获取到 ${fetchedEvents.length} 个事件`)

        if (fetchedEvents) {
          console.log('[loadExternalEvents] fetchedEvents 详情:', {
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

          console.log('[loadExternalEvents] calendarId 匹配检查:', {
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
          console.log('[loadExternalEvents] 本地旧事件数量:', oldEvents.length)

          const fetchedIds = new Set(fetchedEvents.map(e => e.id))

          // 找出当前范围内，本地有但服务器没有的事件（可能在其他端被删除），清理掉
          for (const old of oldEvents) {
            if (!fetchedIds.has(old.id)) {
              const oldId = parseInt(old.id)
              if (!isNaN(oldId)) {
                await invokeDeleteEvent(oldId)
              }
            }
          }

          console.log('[loadExternalEvents] 开始保存事件到数据库, 数量:', fetchedEvents.length)

          // 将服务器传来的最新事件全都覆盖保存到数据库，确保断网可用
          for (const newEv of fetchedEvents) {
            // 检查事件是否存在，决定是创建还是更新
            const existingEvent = events.value.find(e => e.id === newEv.id)
            const eventId = parseInt(newEv.id)
            
            if (existingEvent && !isNaN(eventId)) {
              // 更新现有事件
              await invokeUpdateEvent({
                id: eventId,
                title: newEv.title,
                description: newEv.description,
                startTime: newEv.startTime,
                endTime: newEv.endTime,
                allDay: newEv.allDay,
                calendarId: parseInt(newEv.calendarId) || 1,
                color: newEv.color,
                reminder: newEv.reminder,
                repeatRule: newEv.repeatRule ? JSON.stringify(newEv.repeatRule) : undefined,
                location: newEv.location,
                externalId: newEv.externalId
              })
            } else if (!isNaN(eventId)) {
              // 创建新事件
              await invokeCreateEvent({
                title: newEv.title,
                description: newEv.description,
                startTime: newEv.startTime,
                endTime: newEv.endTime,
                allDay: newEv.allDay,
                calendarId: parseInt(newEv.calendarId) || 1,
                color: newEv.color,
                reminder: newEv.reminder,
                repeatRule: newEv.repeatRule ? JSON.stringify(newEv.repeatRule) : undefined,
                location: newEv.location,
                externalId: newEv.externalId
              })
            }
          }

          console.log('[loadExternalEvents] 事件保存到数据库完成')

          // 更新前端状态库：剔除原来区间内的事件，将得到的新事件注入
          events.value = events.value.filter(e => !(e.calendarId === calendar.id && e.startTime >= startTime && e.startTime <= endTime))
          events.value.push(...fetchedEvents)

          console.log('[loadExternalEvents] 保存后事件状态:', {
            totalEvents: events.value.length,
            calendarEvents: events.value.filter(e => e.calendarId === calendar.id).length
          })
        } else {
          console.log('[loadExternalEvents] fetchedEvents 为 null 或 undefined')
        }
      }

      console.log('[loadExternalEvents] 加载外部事件完成')
    } catch (error) {
      console.error('[loadExternalEvents] 加载外部事件失败:', error)
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
  /**
   * 获取有效的日历 ID（数字格式）
   * 如果传入的 calendarId 无效，返回第一个本地日历的 ID
   */
  function getValidCalendarId(calendarId: string | undefined): number {
    if (calendarId) {
      const parsed = parseInt(calendarId)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    
    // 获取第一个本地日历
    const localCalendar = calendars.value.find(c => c.type === 'local')
    if (localCalendar) {
      const parsed = parseInt(localCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    
    // 如果仍然无法获取，返回 1
    console.warn('[CalendarStore] 无法获取有效的日历 ID，使用默认值 1')
    return 1
  }

  async function addCalendar(calendar: Omit<Calendar, 'id'>) {
    const created = await invokeCreateCalendar({
      name: calendar.name,
      color: calendar.color,
      type: calendar.type || 'local',
      accountId: calendar.accountId ? parseInt(calendar.accountId) : undefined,
      visible: calendar.visible ?? true,
      syncEnabled: calendar.syncEnabled ?? false
    })
    
    if (created) {
      calendars.value.push(created)
      console.log('Calendar created:', created.id)
    } else {
      console.error('Failed to create calendar')
    }
  }

  async function updateCalendar(id: string, updates: Partial<Calendar>) {
    const index = calendars.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const calId = parseInt(id)
      if (!isNaN(calId)) {
        const updated = await invokeUpdateCalendar({
          id: calId,
          name: updates.name,
          color: updates.color,
          visible: updates.visible,
          syncEnabled: updates.syncEnabled
        })
        
        if (updated) {
          calendars.value[index] = { ...calendars.value[index], ...updates }
          console.log('Calendar updated:', id)
        }
      } else {
        // 外部日历或临时 ID，仅更新本地状态
        calendars.value[index] = { ...calendars.value[index], ...updates }
      }
    }
  }

  async function deleteCalendar(id: string) {
    const calId = parseInt(id)
    if (!isNaN(calId)) {
      await invokeDeleteCalendar(calId)
    }
    
    calendars.value = calendars.value.filter(c => c.id !== id)
    events.value = events.value.filter(e => e.calendarId !== id)
    console.log('Calendar deleted:', id)
  }

  async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
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
        const result = await safeInvoke<any>('create_external_event', {
          accountId: targetCalendar.accountId || '',
          accountType: targetCalendar.accountType || targetCalendar.type || '',
          serverUrl: targetCalendar.serverUrl || '',
          username: targetCalendar.username || '',
          encryptedPassword: targetCalendar.encryptedPassword || '',
          calendarUrl: targetCalendar.calendarUrl || '',
          event: {
            id: '',
            title: event.title,
            description: event.description,
            startTime: event.startTime,
            endTime: event.endTime,
            allDay: event.allDay,
            location: event.location
          }
        })
        if (result && result.success) {
          // 创建成功后保存到本地数据库
          const newEvent: CalendarEvent = {
            ...event,
            id: result.external_id || `ext_${Date.now()}`,
            externalId: result.external_id,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          events.value.push(newEvent)

          // 保存到本地数据库以便离线查看
          const eventId = parseInt(newEvent.id)
          if (!isNaN(eventId)) {
            try {
              await invokeCreateEvent({
                title: newEvent.title,
                description: newEvent.description,
                startTime: newEvent.startTime,
                endTime: newEvent.endTime,
                allDay: newEvent.allDay,
                calendarId: parseInt(newEvent.calendarId) || 1,
                color: newEvent.color,
                reminder: newEvent.reminder,
                repeatRule: newEvent.repeatRule ? JSON.stringify(newEvent.repeatRule) : undefined,
                location: newEvent.location,
                externalId: newEvent.externalId
              })
            } catch (dbError) {
              console.error('保存外部事件到本地失败:', dbError)
            }
          }
        } else {
          console.error('创建外部事件失败：', result?.error || '无法获取结果')
        }
      } catch (error) {
        console.error('创建外部事件失败:', error)
      }
    } else {
      // 本地日历：保存到数据库
      const created = await invokeCreateEvent({
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
        externalId: event.externalId
      })
      
      if (created) {
        events.value.push(created)
        console.log('Event created:', created.id)
      } else {
        console.error('Failed to create event')
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
            event: {
              id: event.externalId || event.id,
              title: updates.title ?? event.title,
              description: updates.description ?? event.description,
              startTime: updates.startTime ?? event.startTime,
              endTime: updates.endTime ?? event.endTime,
              allDay: updates.allDay ?? event.allDay,
              location: updates.location ?? event.location
            }
          })
          if (result && result.success) {
            const updatedEvent = {
              ...event,
              ...updates,
              updatedAt: Date.now()
            }
            events.value[index] = updatedEvent

            // 更新本地数据库
            const eventId = parseInt(updatedEvent.id)
            if (!isNaN(eventId)) {
              try {
                await invokeUpdateEvent({
                  id: eventId,
                  title: updatedEvent.title,
                  description: updatedEvent.description,
                  startTime: updatedEvent.startTime,
                  endTime: updatedEvent.endTime,
                  allDay: updatedEvent.allDay,
                  calendarId: parseInt(updatedEvent.calendarId) || 1,
                  color: updatedEvent.color,
                  reminder: updatedEvent.reminder,
                  repeatRule: updatedEvent.repeatRule ? JSON.stringify(updatedEvent.repeatRule) : undefined,
                  location: updatedEvent.location,
                  externalId: updatedEvent.externalId
                })
              } catch (dbError) {
                console.error('更新外部事件到本地库失败:', dbError)
              }
            }
          } else {
            console.error('更新外部事件失败：', result?.error)
          }
        } catch (error) {
          console.error('调用更新外部事件失败:', error)
        }
      } else {
        // 本地日历事件：更新数据库
        const eventId = parseInt(id)
        if (!isNaN(eventId)) {
          const updated = await invokeUpdateEvent({
            id: eventId,
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
            externalId: updates.externalId ?? event.externalId
          })
          
          if (updated) {
            events.value[index] = updated
            console.log('Event updated:', id)
          }
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
          eventId: event.externalId || event.id
        })
        if (result && result.success) {
          events.value = events.value.filter(e => e.id !== id)
          const eventId = parseInt(id)
          if (!isNaN(eventId)) {
            try {
              await invokeDeleteEvent(eventId)
            } catch (dbError) {
              console.error('从本地库删除外部事件失败:', dbError)
            }
          }
        } else {
          console.error('删除外部事件失败：', result?.error)
        }
      } catch (error) {
        console.error('调用删除外部事件失败:', error)
      }
    } else {
      // 本地日历事件：从数据库删除
      const eventId = parseInt(id)
      if (!isNaN(eventId)) {
        await invokeDeleteEvent(eventId)
      }
      events.value = events.value.filter(e => e.id !== id)
      console.log('Event deleted:', id)
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
