<template>
  <div class="week-view">
    <!-- Week header -->
    <div class="week-header">
      <div class="time-gutter"></div>
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

    <!-- Week body -->
    <div class="week-body">
      <div class="time-gutter">
        <div v-for="hour in hours" :key="hour" class="time-slot">
          {{ hour }}:00
        </div>
      </div>
      <div class="days-grid">
        <div v-for="day in weekDays" :key="day.date.toISOString()" class="day-column">
          <div v-for="hour in hours" :key="hour" class="hour-cell" @click="handleCellClick(day.date, hour)"></div>
          <!-- Events -->
          <div
            v-for="event in getEventsForDay(day.date)"
            :key="event.id"
            class="week-event"
            :style="getEventStyle(event)"
            :class="{ 'all-day': event.allDay }"
          >
            <div class="event-title">{{ event.title }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { isSameDay, isToday as isTodayFn, startOfWeek } from '../../utils/date'
import type { CalendarEvent } from '../../types'

const calendarStore = useCalendarStore()

const hours = Array.from({ length: 24 }, (_, i) => i)

const weekDays = computed(() => {
  const start = startOfWeek(calendarStore.currentDate, 1)
  const days = []
  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

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
  return calendarStore.events.filter(event => {
    const eventDate = new Date(event.startTime)
    return isSameDay(eventDate, day)
  })
}

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
    top: `${startHour * 48}px`,
    height: `${duration * 48}px`,
    background: calendar?.color || '#4A90D9'
  }
}

function handleCellClick(date: Date, hour: number) {
  const clickedDate = new Date(date)
  clickedDate.setHours(hour, 0, 0, 0)
  calendarStore.selectDate(clickedDate)
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
}

.time-gutter {
  width: 60px;
  flex-shrink: 0;
}

.day-header {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  border-left: 1px solid var(--border-color);
}

.day-header.today {
  background: rgba(74, 144, 217, 0.1);
}

.day-name {
  font-size: 12px;
  color: var(--text-secondary);
}

.day-num {
  font-size: 20px;
  font-weight: 600;
}

.day-header.today .day-num {
  background: var(--accent-color);
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 4px;
}

.week-body {
  flex: 1;
  display: flex;
  overflow-y: auto;
}

.time-slot {
  height: 48px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.days-grid {
  flex: 1;
  display: flex;
}

.day-column {
  flex: 1;
  position: relative;
  border-left: 1px solid var(--border-color);
}

.hour-cell {
  height: 48px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}

.hour-cell:hover {
  background: var(--bg-hover);
}

.week-event {
  position: absolute;
  left: 2px;
  right: 2px;
  background: var(--accent-color);
  color: white;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  overflow: hidden;
  cursor: pointer;
}

.week-event.all-day {
  position: relative;
  margin-bottom: 2px;
}

.event-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>