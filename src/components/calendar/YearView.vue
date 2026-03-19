<template>
  <div class="year-view">
    <div class="year-header">
      <h3>{{ currentYear }}</h3>
    </div>
    <div class="year-grid">
      <div v-for="month in 12" :key="month" class="month-card" @click="goToMonth(month - 1)">
        <div class="month-name">{{ monthNames[month - 1] }}</div>
        <div class="month-days">
          <div class="week-row">
            <span v-for="d in 7" :key="d" class="week-label">{{ weekLabels[d-1] }}</span>
          </div>
          <div v-for="(week, wi) in getMonthWeeks(month - 1)" :key="wi" class="week-row">
            <div
              v-for="(day, di) in week"
              :key="di"
              class="day-cell"
              :class="{ 'other-month': day.otherMonth, 'today': day.isToday }"
            >
              {{ day.day }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { getMonthDays, isToday as isTodayFn } from '../../utils/date'

const calendarStore = useCalendarStore()

const currentYear = computed(() => calendarStore.currentDate.getFullYear())

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const weekLabels = ['日', '一', '二', '三', '四', '五', '六']

function getMonthWeeks(month: number) {
  const date = new Date(currentYear.value, month, 1)
  const days = getMonthDays(date, 0) // Start from Sunday
  const weeks: any[][] = []

  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7).map(day => ({
      day: day.getDate(),
      otherMonth: day.getMonth() !== month,
      isToday: isTodayFn(day)
    }))
    weeks.push(week)
  }

  return weeks
}

function goToMonth(month: number) {
  const date = new Date(currentYear.value, month, 1)
  calendarStore.navigateToDate(date)
  calendarStore.setView('month')
}
</script>

<style scoped>
.year-view {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 16px;
}

.year-header {
  text-align: center;
  margin-bottom: 16px;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.month-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
}

.month-card:hover {
  background: var(--bg-hover);
}

.month-name {
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
}

.month-days {
  font-size: 12px;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}

.week-label {
  color: var(--text-secondary);
  font-size: 10px;
}

.day-cell {
  padding: 2px;
}

.day-cell.other-month {
  color: var(--text-secondary);
}

.day-cell.today {
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>