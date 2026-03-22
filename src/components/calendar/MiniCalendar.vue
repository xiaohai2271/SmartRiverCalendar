<template>
  <div class="mini-calendar">
    <div class="mini-header">
      <button class="nav-btn" @click="prevMonth">‹</button>
      <span class="month-label">{{ monthLabel }}</span>
      <button class="nav-btn" @click="nextMonth">›</button>
    </div>
    <div class="mini-grid">
      <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
      <div
        v-for="(day, index) in days"
        :key="index"
        class="day"
        :class="{
          'other-month': !day.isCurrentMonth,
          'today': day.isToday,
          'selected': day.isSelected
        }"
        @click="selectDate(day.date)"
      >
        {{ day.dayNum }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { getMonthDays, isToday as isTodayFn, isSameDay } from '../../utils/date'

const calendarStore = useCalendarStore()

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const currentMonth = ref(new Date())

const monthLabel = computed(() => {
  return `${currentMonth.value.getFullYear()}年${currentMonth.value.getMonth() + 1}月`
})

const days = computed(() => {
  const monthDate = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1)
  const allDays = getMonthDays(monthDate, 0)

  return allDays.map(date => ({
    date,
    dayNum: date.getDate(),
    isCurrentMonth: date.getMonth() === currentMonth.value.getMonth(),
    isToday: isTodayFn(date),
    isSelected: calendarStore.selectedDate ? isSameDay(date, calendarStore.selectedDate) : false
  }))
})

function prevMonth() {
  const date = new Date(currentMonth.value)
  date.setMonth(date.getMonth() - 1)
  currentMonth.value = date
}

function nextMonth() {
  const date = new Date(currentMonth.value)
  date.setMonth(date.getMonth() + 1)
  currentMonth.value = date
}

function selectDate(date: Date) {
  calendarStore.navigateToDate(date)
  calendarStore.selectDate(date)
}
</script>

<style scoped>
.mini-calendar {
  user-select: none;
}

.mini-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.nav-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  border-radius: 4px;
}

.nav-btn:hover {
  background: var(--bg-hover);
}

.month-label {
  font-size: 14px;
  font-weight: 500;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}

.weekday {
  font-size: 10px;
  color: var(--text-secondary);
  padding: 4px 0;
}

.day {
  font-size: 12px;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
}

.day:hover {
  background: var(--bg-hover);
}

.day.other-month {
  color: var(--text-secondary);
}

.day.today {
  background: var(--accent-color);
  color: white;
}

.day.selected {
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}
</style>