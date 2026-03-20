<template>
  <div class="day-view">
    <div class="day-header">
      <h3>{{ formattedDate }}</h3>
    </div>

    <!-- All day events -->
    <div v-if="allDayEvents.length > 0" class="all-day-section">
      <div class="all-day-label">全天</div>
      <div class="all-day-events">
        <div
          v-for="event in allDayEvents"
          :key="event.id"
          class="day-event all-day"
          :style="{ background: getEventColor(event) }"
          @click.stop="emit('edit-event', event)"
        >
          {{ event.title }}
        </div>
      </div>
    </div>

    <div class="day-body">
      <div class="time-column">
        <div v-for="hour in hours" :key="hour" class="time-slot">
          {{ hour }}:00
        </div>
      </div>
      <div class="events-container">
        <div class="hours-grid">
          <div v-for="hour in hours" :key="hour" class="hour-cell" @click="handleCellClick(hour)"></div>
        </div>
        <div class="events-layer">
          <div
            v-for="layout in dayEventsLayout"
            :key="layout.event.id"
            class="day-event timed"
            :style="layout"
            @click.stop="emit('edit-event', layout.event)"
          >
            <div class="event-time">{{ formatEventTime(layout.event) }}</div>
            <div class="event-title">{{ layout.event.title }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { formatDateLocale, formatTime, isSameDay } from '../../utils/date'
import type { CalendarEvent } from '../../types'

const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
}>()

const calendarStore = useCalendarStore()

const hours = Array.from({ length: 24 }, (_, i) => i)

const formattedDate = computed(() => {
  return formatDateLocale(calendarStore.currentDate, 'zh-CN')
})

const dayEvents = computed(() => {
  return calendarStore.events.filter(event =>
    isSameDay(new Date(event.startTime), calendarStore.currentDate)
  )
})

const allDayEvents = computed(() => {
  return dayEvents.value.filter(event => event.allDay)
})

const timedEvents = computed(() => {
  return dayEvents.value.filter(event => !event.allDay)
})

function getEventColor(event: CalendarEvent): string {
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}

// 计算事件布局（处理重叠）
interface EventLayout {
  event: CalendarEvent
  top: string
  height: string
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

    const top = (range.start / 60) * 60
    const height = ((range.end - range.start) / 60) * 60

    layouts.push({
      event: range.event,
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`,
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
      background: getEventColor(range.event)
    })
  }

  return layouts
}

const dayEventsLayout = computed(() => {
  return calculateEventsLayout(timedEvents.value)
})

function formatEventTime(event: CalendarEvent): string {
  const start = formatTime(new Date(event.startTime))
  const end = formatTime(new Date(event.endTime))
  return `${start} - ${end}`
}

function handleCellClick(hour: number) {
  const clickedDate = new Date(calendarStore.currentDate)
  clickedDate.setHours(hour, 0, 0, 0)
  calendarStore.selectDate(clickedDate)
}
</script>

<style scoped>
.day-view {
  background: var(--bg-secondary);
  border-radius: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.day-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.day-header h3 {
  margin: 0;
  font-size: 16px;
}

/* All day section */
.all-day-section {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.all-day-label {
  width: 50px;
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
  padding: 8px 6px;
}

.all-day-events {
  flex: 1;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-event.all-day {
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.day-event.all-day:hover {
  opacity: 0.9;
}

.day-body {
  flex: 1;
  display: flex;
  overflow-y: auto;
}

.time-column {
  width: 50px;
  flex-shrink: 0;
}

.time-slot {
  height: 60px;
  line-height: 60px;
  padding: 0 6px;
  font-size: 11px;
  color: var(--text-secondary);
  text-align: right;
}

.events-container {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
}

.hours-grid {
  flex: 1;
  min-height: 1440px; /* 24小时 * 60px/小时 */
}

.hour-cell {
  height: 60px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
  border-left: 1px solid var(--border-color);
  cursor: pointer;
}

.hour-cell:hover {
  background: var(--bg-hover);
}

.events-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  min-height: 1440px;
}

.day-event.timed {
  position: absolute;
  left: 4px;
  right: 4px;
  background: var(--accent-color);
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  overflow: hidden;
  pointer-events: auto;
  z-index: 1;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.day-event.timed:hover {
  transform: scale(1.02);
  box-shadow: var(--shadow-md);
  z-index: 10;
}

.event-time {
  font-size: 11px;
  opacity: 0.9;
}

.event-title {
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
