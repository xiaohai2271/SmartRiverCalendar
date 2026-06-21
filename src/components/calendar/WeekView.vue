<template>
  <div class="week-view">
    <!-- Week header -->
    <div class="week-header">
      <div class="time-gutter"></div>
      <div class="days-header">
        <div
          v-for="day in weekDays"
          :key="day.date.toISOString()"
          class="day-header"
          :class="{ today: isToday(day.date) }"
        >
          <div class="day-name">{{ day.name }}</div>
          <div class="day-num">{{ day.date.getDate() }}</div>
        </div>
      </div>
    </div>

    <!-- 全天事件区域 -->
    <div class="all-day-row">
      <div class="time-gutter">
        <div class="all-day-label">全天</div>
      </div>
      <div class="days-all-day">
        <div v-for="day in weekDays" :key="day.date.toISOString()" class="day-all-day">
          <div
            v-for="event in getAllDayEvents(day.date)"
            :key="event.id"
            class="all-day-event"
            :style="{ borderLeftColor: getEventColor(event), backgroundColor: getEventColor(event) + '18' }"
            @click.stop="emit('edit-event', event)"
            @contextmenu="handleEventContextMenu($event, event)"
          >
            <span class="all-day-event-title">{{ event.title }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Week body -->
    <div class="week-body">
      <div class="time-gutter">
        <div v-for="hour in hours" :key="hour" class="time-slot">
          {{ hour }}:00
        </div>
      </div>
      <div class="days-grid-container">
        <div class="days-grid">
          <div v-for="day in weekDays" :key="day.date.toISOString()" class="day-column">
            <div
              v-for="hour in hours"
              :key="hour"
              class="hour-cell"
              :class="{ 'dragging': isDragging && dragStartDay && isSameDay(dragStartDay, day.date) && hour >= Math.min(dragStartHour, dragEndHour) && hour <= Math.max(dragStartHour, dragEndHour) }"
              @mousedown="handleMouseDown(day.date, hour, $event)"
              @mousemove="handleMouseMove(day.date, hour, $event)"
              @mouseup="handleMouseUp(day.date, hour, $event)"
            ></div>
          </div>
        </div>
        <div class="events-layer">
          <div v-for="day in weekDays" :key="'events-' + day.date.toISOString()" class="day-events-column">
            <div
              v-for="layout in getDayEventsLayout(day.date)"
              :key="layout.event.id"
              class="week-event timed"
              :style="{ top: `${layout.top}px`, height: `${layout.height}px`, left: layout.left, width: layout.width, background: layout.background }"
              @click.stop="emit('edit-event', layout.event)"
              @contextmenu="handleEventContextMenu($event, layout.event)"
            >
              <div class="event-time">{{ formatEventTime(layout.event) }}</div>
              <div class="event-title">{{ layout.event.title }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 事件块右键菜单 -->
    <EventBlockContextMenu
      v-model:visible="eventContextMenuVisible"
      :x="eventContextMenuState.x"
      :y="eventContextMenuState.y"
      @action="handleEventContextMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { useSettingsStore } from '../../stores/settings'
import { isSameDay, isToday as isTodayFn, startOfWeek, getWeekDays, formatTime } from '../../utils/date'
import type { CalendarEvent } from '../../types'
import EventBlockContextMenu from './EventBlockContextMenu.vue'
import type { EventBlockMenuAction } from '../../types'

const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
  'create-event': [date: Date, startHour: number, endHour: number]
  'delete-event': [event: CalendarEvent]
}>()

const calendarStore = useCalendarStore()
const settingsStore = useSettingsStore()

// 拖拽选择状态
const isDragging = ref(false)
const dragStartDay = ref<Date | null>(null)
const dragStartHour = ref(0)
const dragEndHour = ref(0)

// 事件块右键菜单状态
const eventContextMenuVisible = computed({
  get: () => eventContextMenuState.value.visible,
  set: (val: boolean) => { eventContextMenuState.value.visible = val }
})
const eventContextMenuState = ref({
  visible: false,
  x: 0,
  y: 0,
  event: null as CalendarEvent | null,
})

const hours = Array.from({ length: 24 }, (_, i) => i)

const weekDays = computed(() => {
  const firstDay = settingsStore.settings.firstDayOfWeek
  const start = startOfWeek(calendarStore.currentDate, firstDay)
  const days = []
  const dayNames = getWeekDays(firstDay)

  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    days.push({
      name: dayNames[i],
      date
    })
  }
  return days
})

function isToday(date: Date): boolean {
  return isTodayFn(date)
}

function getEventsForDay(day: Date): CalendarEvent[] {
  return calendarStore.eventsForCurrentView.filter(event => {
    const eventDate = new Date(event.startTime)
    return isSameDay(eventDate, day)
  })
}

function getAllDayEvents(day: Date): CalendarEvent[] {
  return getEventsForDay(day).filter(event => event.allDay)
}

function getTimedEvents(day: Date): CalendarEvent[] {
  return getEventsForDay(day).filter(event => !event.allDay)
}

function getEventColor(event: CalendarEvent): string {
  if (event.color) return event.color
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}

// 计算事件布局（处理重叠）
interface EventLayout {
  event: CalendarEvent
  top: number
  height: number
  left: string
  width: string
  background: string
}

function calculateEventsLayout(events: CalendarEvent[]): EventLayout[] {
  if (events.length === 0) return []

  // 按开始时间排序
  const sorted = [...events].sort((a, b) => a.startTime - b.startTime)

  // 计算每个事件的时间范围（以分钟为单位，从0点开始）
  const eventRanges = sorted.map(event => {
    const startDate = new Date(event.startTime)
    const endDate = new Date(event.endTime)
    const start = startDate.getHours() * 60 + startDate.getMinutes()
    const end = endDate.getHours() * 60 + endDate.getMinutes()
    return {
      event,
      start: Math.max(0, start),
      end: Math.min(24 * 60, Math.max(start + 30, end)), // 最小30分钟
      column: 0
    }
  })

  // 检测重叠并分配列
  const columns: { end: number }[] = []

  for (const range of eventRanges) {
    // 找到第一个可以放置该事件的列
    let placed = false
    for (let col = 0; col < columns.length; col++) {
      if (columns[col].end <= range.start) {
        columns[col].end = range.end
        range.column = col
        placed = true
        break
      }
    }
    if (!placed) {
      range.column = columns.length
      columns.push({ end: range.end })
    }
  }

  // 计算每个事件在其重叠组中的位置
  const layouts: EventLayout[] = []

  for (const range of eventRanges) {
    // 找出与当前事件重叠的所有事件
    const overlapping = eventRanges.filter(r =>
      r.start < range.end && r.end > range.start
    )
    const maxColumn = Math.max(...overlapping.map(r => r.column))
    const totalColumns = maxColumn + 1
    const currentColumn = range.column

    const widthPercent = 100 / totalColumns
    const leftPercent = currentColumn * widthPercent

    const top = (range.start / 60) * 48
    const height = ((range.end - range.start) / 60) * 48

    layouts.push({
      event: range.event,
      top,
      height: Math.max(height, 24),
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
      background: getEventColor(range.event)
    })
  }

  return layouts
}

function getDayEventsLayout(day: Date): EventLayout[] {
  const timedEvents = getTimedEvents(day)
  return calculateEventsLayout(timedEvents)
}

// 拖拽创建日程处理函数
function handleMouseDown(date: Date, hour: number, event: MouseEvent) {
  event.preventDefault()
  isDragging.value = true
  dragStartDay.value = new Date(date)
  dragStartHour.value = hour
  dragEndHour.value = hour
}

function handleMouseMove(date: Date, hour: number, event: MouseEvent) {
  if (!isDragging.value) return
  event.preventDefault()
  // 只在同一天内拖拽
  if (dragStartDay.value && isSameDay(dragStartDay.value, date)) {
    dragEndHour.value = hour
  }
}

function handleMouseUp(_date: Date, _hour: number, event: MouseEvent) {
  if (!isDragging.value) return
  event.preventDefault()

  // 计算选中的时间范围
  const startHour = Math.min(dragStartHour.value, dragEndHour.value)
  const endHour = Math.max(dragStartHour.value, dragEndHour.value) + 1

  // 触发创建事件
  if (dragStartDay.value) {
    emit('create-event', dragStartDay.value, startHour, endHour)
  }

  // 重置拖拽状态
  isDragging.value = false
  dragStartDay.value = null
  dragStartHour.value = 0
  dragEndHour.value = 0
}

function formatEventTime(event: CalendarEvent): string {
  const start = formatTime(new Date(event.startTime))
  const end = formatTime(new Date(event.endTime))
  return `${start}-${end}`
}

/** 事件块右键菜单 */
function handleEventContextMenu(event: MouseEvent, calendarEvent: CalendarEvent) {
  event.preventDefault()
  event.stopPropagation()
  eventContextMenuState.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    event: calendarEvent,
  }
}

/** 处理事件块右键菜单动作 */
function handleEventContextMenuAction(action: EventBlockMenuAction) {
  const event = eventContextMenuState.value.event
  if (!event) return
  switch (action) {
    case 'edit':
    case 'detail':
      emit('edit-event', event)
      break
    case 'delete':
      emit('delete-event', event)
      break
  }
}
</script>

<style scoped>
.week-view {
  background: var(--bg-secondary);
  border-radius: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.week-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.time-gutter {
  width: 50px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.days-header {
  flex: 1;
  display: flex;
}

.day-header {
  flex: 1;
  text-align: center;
  padding: 8px 0;
  border-left: 1px solid var(--border-color);
}

.day-header.today {
  background: rgba(74, 144, 217, 0.1);
}

.day-name {
  font-size: 11px;
  color: var(--text-secondary);
}

.day-num {
  font-size: 18px;
  font-weight: 600;
}

.day-header.today .day-num {
  background: var(--accent-color);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

/* 全天事件区域 */
.all-day-row {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.all-day-label {
  height: 32px;
  padding: 8px 6px;
  font-size: 10px;
  color: var(--text-secondary);
  text-align: right;
}

.days-all-day {
  flex: 1;
  display: flex;
}

.day-all-day {
  flex: 1;
  border-left: 1px solid var(--border-color);
  padding: 2px 4px;
  min-height: 32px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.all-day-event {
  display: flex;
  align-items: center;
  border-left: 3px solid var(--accent-color);
  border-radius: 3px;
  padding: 2px 6px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.all-day-event:hover {
  opacity: 0.85;
}

.all-day-event-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Week body */
.week-body {
  flex: 1;
  display: flex;
  overflow-x: hidden;
  overflow-y: overlay;
}

/* 滚动条不挤占内容位置 */
.week-body::-webkit-scrollbar {
  width: 0;
}

.week-body::-webkit-scrollbar-track {
  background: transparent;
}

.week-body::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

.time-slot {
  height: 48px;
  line-height: 48px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.days-grid-container {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.days-grid {
  flex: 1;
  display: flex;
  min-height: 1152px; /* 24小时 * 48px/小时 */
}

.day-column {
  flex: 1;
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.hour-cell {
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.hour-cell:hover {
  background: var(--bg-hover);
}

.hour-cell.dragging {
  background: rgba(74, 144, 217, 0.2);
  border-color: var(--accent-color);
}

/* Events layer */
.events-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  pointer-events: none;
  min-height: 1152px;
}

.day-events-column {
  flex: 1;
  position: relative;
  pointer-events: none;
  border-left: 1px solid var(--border-color);
}

.week-event.timed {
  position: absolute;
  left: 2px;
  right: 2px;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  overflow: hidden;
  cursor: pointer;
  z-index: 1;
  pointer-events: auto;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.week-event.timed:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-md);
  z-index: 10;
}

.event-time {
  font-size: 10px;
  opacity: 0.9;
}

.event-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
