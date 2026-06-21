import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Calendar, CalendarEvent, CalendarView, DateRange } from '../types'
import { usePlatform, useCapabilities } from '@/platform/provider'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'
import { cloudSyncService } from '../services/cloudSync'
import { getValidCalendarId } from '@/utils/calendar-helpers'

export const useCalendarStore = defineStore('calendar', () => {
  // State
  const calendars = ref<Calendar[]>([])

  const events = ref<CalendarEvent[]>([])
  const currentView = ref<CalendarView>('month')
  const currentDate = ref(new Date())
  const selectedDate = ref<Date | null>(null)
  const isInitialized = ref(false)

  // 初始化数据库并加载数据
  async function initialize() {
    if (isInitialized.value) return

    try {
      const { calendarRepo, eventRepo } = usePlatform()

      // 通过 settingsStore 获取默认视图设置
      try {
        const { useSettingsStore } = await import('./settings')
        const settingsStore = useSettingsStore()
        const defaultView = settingsStore.settings?.defaultView
        if (defaultView) {
          currentView.value = defaultView
        }
      } catch (e) {
        console.warn('[CalendarStore] 无法加载默认视图设置:', e)
      }

      // 1. 加载日历数据
      const loadedCalendars = await calendarRepo.getAll()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars
      } else {
        // 仅本地优先平台（桌面端）在数据库为空时自动创建默认日历
        // 远程优先平台（Web端）不自动创建，日历数据来源于服务端
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
        // Web端：服务端注册时已创建默认日历，保持空列表
      }

      // 2. 加载本地事件（快速操作）
      const loadedEvents = await eventRepo.getAll()
      events.value = loadedEvents

      // 3. 先标记初始化完成，让界面先渲染
      isInitialized.value = true
      console.log('Calendar store initialized (local data):', {
        calendars: calendars.value.length,
        events: events.value.length,
        defaultView: currentView.value
      })

      // 4. 延迟加载外部数据（网络请求，不阻塞界面）
      setTimeout(async () => {
        try {
          await loadExternalCalendars()
          const { start, end } = currentDateRange.value
          await loadExternalEvents(start.getTime(), end.getTime())
          console.log('External data loaded successfully')
        } catch (error) {
          console.error('Failed to load external data:', error)
        }
      }, 200)

    } catch (error) {
      console.error('Failed to initialize calendar store:', error)
      isInitialized.value = true
    }
  }

  // 加载外部日历
  async function loadExternalCalendars() {
    try {
      const { syncRepo, calendarRepo } = usePlatform()
      const accounts = await syncRepo.getAllAccounts()
      if (!accounts || accounts.length === 0) return

      for (const account of accounts) {
        try {
          await syncRepo.getExternalEvents({
            accountId: account.id,
            accountType: account.type,
            serverUrl: account.serverUrl,
            username: account.username,
            encryptedPassword: account.encryptedPassword || '',
            calendarUrl: '',
            calendarId: '',
            startTime: 0,
            endTime: Date.now() * 2,
          })

          const calList = await syncRepo.getExternalCalendars({
            accountId: account.id,
            accountType: account.type,
            serverUrl: account.serverUrl,
            username: account.username,
            encryptedPassword: account.encryptedPassword || '',
            calendarUrl: '',
          })

          if (!calList || calList.length === 0) {
            console.warn(`[CalendarStore] No calendars found for account: ${account.username} (${account.id})`)
            continue
          }

          for (const cal of calList) {
            const calendarId = `ext_${account.id}_${cal.id}`
            const existingIndex = calendars.value.findIndex(c => 
              c.id === calendarId ||
              (c.accountId === String(account.id) && c.type === account.type)
            )

            if (existingIndex === -1) {
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
                readOnly: cal.readOnly,
                visible: true,
                syncEnabled: true
              }
              calendars.value.push(newCal)

              // 仅本地优先平台（桌面端）将外部日历保存到本地数据库
              // 远程优先平台（Web端）外部日历已存在于服务端，无需重复创建
              const capabilities = useCapabilities()
              if (capabilities.dataPriority === 'local-first') {
                try {
                  const created = await calendarRepo.create({
                    name: newCal.name,
                    color: newCal.color,
                    type: newCal.type,
                    accountId: parseInt(account.id),
                    visible: newCal.visible,
                    syncEnabled: newCal.syncEnabled
                  })
                  // 同步回填生成的真实自增整数 ID 给前端内存日历对象，确保后续事件外键正确
                  newCal.id = String(created.id)
                  console.log(`[CalendarStore] 已将外部日历 ${cal.name} 保存到数据库，回填 ID: ${created.id}`)
                } catch (dbError) {
                  console.error(`保存外部日历 ${cal.name} 失败:`, dbError)
                }
              }
            } else {
              calendars.value[existingIndex] = {
                ...calendars.value[existingIndex],
                accountType: account.type,
                serverUrl: account.serverUrl,
                username: account.username,
                encryptedPassword: account.encryptedPassword,
                calendarUrl: cal.url,
                readOnly: cal.readOnly,
              }

              // 仅本地优先平台更新本地数据库
              const capabilities = useCapabilities()
              if (capabilities.dataPriority === 'local-first') {
                const calId = parseInt(calendars.value[existingIndex].id)
                if (!isNaN(calId)) {
                  try {
                    await calendarRepo.update({
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
          }
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
      const { syncRepo, eventRepo } = usePlatform()

      // 仅同步真正的外部日历（exchange/caldav），online 日历的事件由 eventRepo 管理
      const externalCalendars = calendars.value.filter(c => c.type === 'exchange' || c.type === 'caldav')

      for (const calendar of externalCalendars) {
        if (!calendar.accountId) continue

        const fetchedEvents = await syncRepo.getExternalEvents({
          accountId: calendar.accountId,
          accountType: calendar.accountType || calendar.type,
          serverUrl: calendar.serverUrl || '',
          username: calendar.username || '',
          encryptedPassword: calendar.encryptedPassword || '',
          calendarUrl: calendar.calendarUrl || '',
          calendarId: calendar.id,
          startTime,
          endTime,
        })

        if (fetchedEvents && fetchedEvents.length > 0) {
          // 查出本地 store 里，当前日历下且在本次查询时间段内的旧事件
          const oldEvents = events.value.filter(e =>
            e.calendarId === calendar.id &&
            e.startTime >= startTime &&
            e.startTime <= endTime
          )

          const fetchedIds = new Set(fetchedEvents.map(e => e.id))

          // 找出当前范围内，本地有但服务器没有的事件（可能在其他端被删除），清理掉
          for (const old of oldEvents) {
            if (!fetchedIds.has(old.id)) {
              const oldId = parseInt(old.id)
              if (!isNaN(oldId)) {
                await eventRepo.delete(oldId)
              }
            }
          }

          // 将服务器传来的最新事件全都覆盖保存到数据库
          for (const newEv of fetchedEvents) {
            const existingEvent = events.value.find(e => e.id === newEv.id)
            const eventId = parseInt(newEv.id)

            if (existingEvent && !isNaN(eventId)) {
              await eventRepo.update({
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
              await eventRepo.create({
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

          // 更新前端状态库
          events.value = events.value.filter(e => !(e.calendarId === calendar.id && e.startTime >= startTime && e.startTime <= endTime))
          events.value.push(...fetchedEvents)
        }
      }
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

  /** 获取有效的日历 ID（封装共享函数，自动传入当前日历列表） */
  function getValidCalendarIdWrapper(calendarId: string | undefined): number {
    return getValidCalendarId(calendarId, calendars.value)
  }

  async function addCalendar(calendar: Omit<Calendar, 'id'>) {
    const { calendarRepo } = usePlatform()
    const created = await calendarRepo.create({
      name: calendar.name,
      color: calendar.color,
      type: calendar.type || 'local',
      accountId: calendar.accountId ? parseInt(calendar.accountId) : undefined,
      visible: calendar.visible ?? true,
      syncEnabled: calendar.syncEnabled ?? false
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
    const { calendarRepo } = usePlatform()
    const calId = parseInt(id)
    if (!isNaN(calId)) {
      await calendarRepo.delete(calId)
    }
    calendars.value = calendars.value.filter(c => c.id !== id)
    events.value = events.value.filter(e => e.calendarId !== id)
    console.log('Calendar deleted:', id)
  }

  async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    const { eventRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()
    const targetCalendar = calendars.value.find(c => c.id === event.calendarId)

    if (!targetCalendar) return

    // ── 外部日历（Exchange/CalDAV）：保持现有逻辑不变 ──
    if (targetCalendar.type === 'exchange' || targetCalendar.type === 'caldav') {
      // 外部日历只读检查
      if (targetCalendar.readOnly) {
        console.error('创建事件失败：该日历为只读模式，不支持写入事件')
        return
      }
      try {
        const result = await syncRepo.createExternalEvent({
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
        if (result.success) {
          const newEvent: CalendarEvent = {
            ...event,
            id: result.externalId || `ext_${Date.now()}`,
            externalId: result.externalId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          events.value.push(newEvent)

          // 保存到本地数据库以便离线查看
          const eventId = parseInt(newEvent.id)
          if (!isNaN(eventId)) {
            try {
              await eventRepo.create({
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
          console.error('创建外部事件失败：', result.error || '无法获取结果')
        }
      } catch (error) {
        console.error('创建外部事件失败:', error)
      }
      return
    }

    // ── 本地日历：直接写本地 SQLite（所有端一致） ──
    if (targetCalendar.type === 'local') {
      const created = await eventRepo.create({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        calendarId: getValidCalendarIdWrapper(event.calendarId),
        color: event.color,
        reminder: event.reminder,
        repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
        location: event.location,
        externalId: event.externalId
      })
      events.value.push(created)
      console.log('Event created:', created.id)
      return
    }

    // ── 在线日历 + 在线：写本地 SQLite + 触发云同步 ──
    //
    // 写入策略说明：
    // 采用"先写本地，再同步推送"模式，而非"直接调远端 API"模式。
    // 原因：
    // 1. 保持 local-first 原则——本地 SQLite 始终是权威数据源
    // 2. 统一写入路径——无论在线/离线，事件都先写本地，降低分支复杂度
    // 3. 离线降级无缝——在线时写本地+即时同步，离线时写本地+记录 sync_log，
    //    两种路径的本地写入逻辑完全一致，仅在同步时机有差异
    // 4. Rust 后端自动追踪——CRUD 操作由 Rust 端自动记录 sync_log，
    //    前端只需触发 cloudSyncService.triggerSync() 即可推送
    if (targetCalendar.type === 'online' && navigator.onLine) {
      const created = await eventRepo.create({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        calendarId: getValidCalendarIdWrapper(event.calendarId),
        color: event.color,
        reminder: event.reminder,
        repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
        location: event.location,
        externalId: event.externalId
      })
      events.value.push(created)

      // Rust 后端 create_event 已自动记录 sync_log，此处直接触发云同步
      await cloudSyncService.triggerSync()
      console.log('Event created (online):', created.id)
      return
    }

    // ── 在线日历 + 离线 + 支持离线模式：写本地 + Rust 自动追踪 sync_log ──
    if (targetCalendar.type === 'online' && !navigator.onLine && capabilities.hasOfflineMode) {
      const created = await eventRepo.create({
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        calendarId: getValidCalendarIdWrapper(event.calendarId),
        color: event.color,
        reminder: event.reminder,
        repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
        location: event.location,
        externalId: event.externalId
      })
      events.value.push(created)
      // Rust 后端 create_event 已自动记录 sync_log，联网后由自动同步推送
      console.log('Event created (offline, pending sync):', created.id)
      return
    }

    // ── 在线日历 + 离线 + 不支持离线模式（Web端）：提示网络不可用 ──
    throw new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: '网络不可用，无法创建事件',
      platform: 'web',
    })
  }

  async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
    const { eventRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()
    const index = events.value.findIndex(e => e.id === id)
    if (index !== -1) {
      const event = events.value[index]
      const calendar = calendars.value.find(c => c.id === event.calendarId)

      // ── 外部日历（Exchange/CalDAV）：保持现有逻辑不变 ──
      if (calendar && (calendar.type === 'exchange' || calendar.type === 'caldav')) {
        try {
          const result = await syncRepo.updateExternalEvent({
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
          if (result.success) {
            const updatedEvent = { ...event, ...updates, updatedAt: Date.now() }
            events.value[index] = updatedEvent

            const eventId = parseInt(updatedEvent.id)
            if (!isNaN(eventId)) {
              try {
                await eventRepo.update({
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
            console.error('更新外部事件失败：', result.error)
          }
        } catch (error) {
          console.error('调用更新外部事件失败:', error)
        }
        return
      }

      // ── 本地日历：直接更新本地 SQLite ──
      if (calendar && calendar.type === 'local') {
        const eventId = parseInt(id)
        if (!isNaN(eventId)) {
          const updated = await eventRepo.update({
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
          events.value[index] = updated
          console.log('Event updated:', id)
        }
        return
      }

      // ── 在线日历 + 在线：更新本地 SQLite + 触发云同步 ──
      if (calendar && calendar.type === 'online' && navigator.onLine) {
        const eventId = parseInt(id)
        if (!isNaN(eventId)) {
          const updated = await eventRepo.update({
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
          events.value[index] = updated

          // Rust 后端 update_event 已自动记录 sync_log，此处直接触发云同步
          await cloudSyncService.triggerSync()
          console.log('Event updated (online):', id)
        }
        return
      }

      // ── 在线日历 + 离线 + 支持离线模式：更新本地 + Rust 自动追踪 sync_log ──
      if (calendar && calendar.type === 'online' && !navigator.onLine && capabilities.hasOfflineMode) {
        const eventId = parseInt(id)
        if (!isNaN(eventId)) {
          const updated = await eventRepo.update({
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
          events.value[index] = updated
          // Rust 后端 update_event 已自动记录 sync_log，联网后由自动同步推送
          console.log('Event updated (offline, pending sync):', id)
        }
        return
      }

      // ── 在线日历 + 离线 + 不支持离线模式（Web端） ──
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: '网络不可用，无法更新事件',
        platform: 'web',
      })
    }
  }

  async function deleteEvent(id: string) {
    const { eventRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()
    const event = events.value.find(e => e.id === id)
    if (!event) return

    const calendar = calendars.value.find(c => c.id === event.calendarId)

    // ── 外部日历（Exchange/CalDAV）：保持现有逻辑不变 ──
    if (calendar && (calendar.type === 'exchange' || calendar.type === 'caldav')) {
      try {
        const result = await syncRepo.deleteExternalEvent({
          accountId: calendar.accountId || '',
          accountType: calendar.accountType || calendar.type || '',
          serverUrl: calendar.serverUrl || '',
          username: calendar.username || '',
          encryptedPassword: calendar.encryptedPassword || '',
          calendarUrl: calendar.calendarUrl || '',
          eventId: event.externalId || event.id
        })
        if (result.success) {
          events.value = events.value.filter(e => e.id !== id)
          const eventId = parseInt(id)
          if (!isNaN(eventId)) {
            try {
              await eventRepo.delete(eventId)
            } catch (dbError) {
              console.error('从本地库删除外部事件失败:', dbError)
            }
          }
        } else {
          console.error('删除外部事件失败：', result.error)
        }
      } catch (error) {
        console.error('调用删除外部事件失败:', error)
      }
      return
    }

    // ── 本地日历：直接从本地 SQLite 删除 ──
    if (calendar && calendar.type === 'local') {
      const eventId = parseInt(id)
      if (!isNaN(eventId)) {
        await eventRepo.delete(eventId)
      }
      events.value = events.value.filter(e => e.id !== id)
      console.log('Event deleted:', id)
      return
    }

      // ── 在线日历 + 在线：删除本地 + 触发云同步 ──
    if (calendar && calendar.type === 'online' && navigator.onLine) {
      const eventId = parseInt(id)
      if (!isNaN(eventId)) {
        await eventRepo.delete(eventId)
      }
      events.value = events.value.filter(e => e.id !== id)

      // Rust 后端 delete_event 已自动记录 sync_log，此处直接触发云同步
      await cloudSyncService.triggerSync()
      console.log('Event deleted (online):', id)
      return
    }

    // ── 在线日历 + 离线 + 支持离线模式：删除本地 + Rust 自动追踪 sync_log ──
    // 注意：离线删除时，事件仍从本地 SQLite 删除（保证离线可用性），
    // 但 sync_log 记录了删除操作，联网后会推送删除到远端
    if (calendar && calendar.type === 'online' && !navigator.onLine && capabilities.hasOfflineMode) {
      const eventId = parseInt(id)
      if (!isNaN(eventId)) {
        await eventRepo.delete(eventId)
      }
      events.value = events.value.filter(e => e.id !== id)
      // Rust 后端 delete_event 已自动记录 sync_log，联网后由自动同步推送
      console.log('Event deleted (offline, pending sync):', id)
      return
    }

    // ── 在线日历 + 离线 + 不支持离线模式（Web端） ──
    throw new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: '网络不可用，无法删除事件',
      platform: 'web',
    })
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

  /**
   * 从数据库重新加载数据
   * 同步完成后调用，将远端变更刷新到前端 Store
   */
  async function reloadFromDatabase(): Promise<void> {
    try {
      const { calendarRepo, eventRepo } = usePlatform()

      // 重新加载日历
      const loadedCalendars = await calendarRepo.getAll()
      if (loadedCalendars.length > 0) {
        calendars.value = loadedCalendars
      }

      // 重新加载事件
      const loadedEvents = await eventRepo.getAll()
      events.value = loadedEvents

      console.log('[CalendarStore] 数据已从数据库重新加载:', {
        calendars: calendars.value.length,
        events: events.value.length,
      })
    } catch (error) {
      console.error('[CalendarStore] 重新加载数据失败:', error)
    }
  }

  /**
   * 登录后日历身份切换
   *
   * 流程：触发双向同步 → 切换日历 type → 刷新数据
   *
   * 多端通用性说明：
   * - 桌面端：全量双向同步后切换，网络稳定，耗时短
   * - 移动端：增量同步后切换，网络不稳定时可能较长，需显示进度
   * - Web端：直接返回（Web端日历天然在线，dataPriority='remote-first'）
   *
   * @throws RepositoryError 同步或切换失败时抛出
   */
  async function loginTransition(): Promise<void> {
    const { calendarRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()

    // 仅 local-first 平台需要切换（桌面端 + 移动端）
    if (capabilities.dataPriority !== 'local-first') return

    // 1. 触发双向同步（Rust 后端执行：上传本地新数据 + 下拉远端新数据 + 去重）
    await syncRepo.triggerCloudSync()

    // 2. 将主日历的 type 从 'local' 切换为 'online'
    const mainCalendar = calendars.value.find(c => c.type === 'local')
    if (mainCalendar) {
      await calendarRepo.updateType({
        id: parseInt(mainCalendar.id),
        type: 'online',
        syncEnabled: true,
      })
    }

    // 3. 重新加载数据（同步后远端事件已写入 SQLite，type 已更新）
    await reloadFromDatabase()
  }

  /**
   * 退出前日历身份切换
   *
   * 流程：最终同步 → 切换日历 type → 刷新数据
   *
   * 多端通用性说明：
   * - 桌面端：完整同步后切换，确保本地数据完整
   * - 移动端：同桌面端，退出前必须同步以保证离线后数据可用
   * - Web端：直接返回（Web端无本地数据需保留）
   */
  async function logoutTransition(): Promise<void> {
    const { calendarRepo, syncRepo } = usePlatform()
    const capabilities = useCapabilities()

    if (capabilities.dataPriority !== 'local-first') return

    // 1. 退出前最终同步（确保远端最新数据已保存到本地）
    try {
      await syncRepo.triggerCloudSync()
    } catch (error) {
      // 同步失败不阻塞退出，但记录警告
      console.warn('[CalendarStore] 退出前同步失败，本地数据可能不是最新:', error)
    }

    // 2. 将主日历的 type 从 'online' 切换回 'local'
    const mainCalendar = calendars.value.find(c => c.type === 'online')
    if (mainCalendar) {
      await calendarRepo.updateType({
        id: parseInt(mainCalendar.id),
        type: 'local',
        syncEnabled: false,
      })
    }

    // 3. 重新加载数据
    await reloadFromDatabase()
  }

  return {
    calendars,
    events,
    currentView,
    currentDate,
    selectedDate,
    isInitialized,
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
    loadExternalCalendars,
    loadExternalEvents,
    visibleCalendars,
    visibleEvents,
    currentDateRange,
    eventsForCurrentView,
    getValidCalendarId: getValidCalendarIdWrapper
  }
})
