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
            <span
              v-for="day in week"
              :key="day.key"
              class="day-cell"
              :class="{ 'today': day.isToday }"
            >{{ day.day || '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { useSettingsStore } from '../../stores/settings'
import { isToday as isTodayFn, getWeekDays } from '../../utils/date'
import type { CalendarEvent } from '../../types'

const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
}>()

const calendarStore = useCalendarStore()
const settingsStore = useSettingsStore()

const currentYear = computed(() => calendarStore.currentDate.getFullYear())

const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const weekLabels = computed(() => getWeekDays(settingsStore.settings.firstDayOfWeek))

function getMonthWeeks(month: number) {
  const year = currentYear.value
  const firstDayOfWeek = settingsStore.settings.firstDayOfWeek

  // 该月第一天和最后一天
  const firstDate = new Date(year, month, 1)
  const lastDate = new Date(year, month + 1, 0)
  const totalDays = lastDate.getDate()

  // 第一天是周几（0=周日），根据 firstDayOfWeek 偏移
  let startDow = firstDate.getDay() - firstDayOfWeek
  if (startDow < 0) startDow += 7

  const weeks: { key: string; day: number | ''; isToday: boolean }[][] = []
  let currentWeek: { key: string; day: number | ''; isToday: boolean }[] = []

  // 第一行前导空白
  for (let i = 0; i < startDow; i++) {
    currentWeek.push({ key: `e-${i}`, day: '', isToday: false })
  }

  // 填充日期
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d)
    currentWeek.push({
      key: `${month}-${d}`,
      day: d,
      isToday: isTodayFn(date)
    })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  // 最后一行尾部空白
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ key: `e-tail-${currentWeek.length}`, day: '', isToday: false })
    }
    weeks.push(currentWeek)
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
  padding: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.year-header {
  text-align: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.year-header h3 {
  margin: 0;
  font-size: 16px;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.month-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 6px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.month-card:hover {
  background: var(--bg-hover);
}

.month-name {
  font-weight: 600;
  margin-bottom: 4px;
  text-align: center;
  font-size: 12px;
  flex-shrink: 0;
}

.month-days {
  font-size: 11px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.week-label {
  color: var(--text-secondary);
  font-size: 9px;
  line-height: 1.2;
}

.day-cell {
  line-height: 1.4;
  font-size: 11px;
}

.day-cell.today {
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}
</style>