<template>
  <div class="day-view">
    <div class="day-header">
      <h3>{{ formattedDate }}</h3>
    </div>
    <div class="day-body">
      <div class="time-column">
        <div v-for="hour in hours" :key="hour" class="time-label">
          {{ hour }}:00
        </div>
      </div>
      <div class="events-column">
        <div
          v-for="hour in hours"
          :key="hour"
          class="hour-row"
          @click="handleCellClick(hour)"
        ></div>
        <div
          v-for="event in dayEvents"
          :key="event.id"
          class="day-event"
          :style="getEventStyle(event)"
        >
          <div class="event-time">{{ formatEventTime(event) }}</div>
          <div class="event-title">{{ event.title }}</div>
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

function getEventStyle(event: CalendarEvent): any {
  if (event.allDay) {
    return {}
  }
  const startDate = new Date(event.startTime)
  const endDate = new Date(event.endTime)
  const startHour = startDate.getHours() + startDate.getMinutes() / 60
  const duration = (endDate.getTime() - startDate.getTime()) / 3600000

  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)

  return {
    top: `${startHour * 60}px`,
    height: `${Math.max(duration * 60, 30)}px`,
    background: calendar?.color || '#4A90D9'
  }
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return '全天'
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
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.day-body {
  flex: 1;
  display: flex;
  overflow-y: auto;
}

.time-column {
  width: 60px;
  flex-shrink: 0;
}

.time-label {
  height: 60px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.events-column {
  flex: 1;
  position: relative;
  border-left: 1px solid var(--border-color);
}

.hour-row {
  height: 60px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.hour-row:hover {
  background: var(--bg-hover);
}

.day-event {
  position: absolute;
  left: 4px;
  right: 4px;
  background: var(--accent-color);
  color: white;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
}

.event-time {
  font-size: 12px;
  opacity: 0.9;
}

.event-title {
  font-weight: 500;
}
</style>