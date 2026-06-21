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
  width: 100%;
}

.mini-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding: 0 4px;
}

.nav-btn {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  border-radius: 4px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.month-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}

.mini-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px 2px;
  text-align: center;
}

.weekday {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 2px 0;
  opacity: 0.8;
}

.day {
  font-size: clamp(10px, 1.1vw, 12px);
  font-weight: 500;
  padding: 4px 0;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.day:hover {
  background: var(--bg-hover);
}

.day.other-month {
  color: var(--text-tertiary);
  opacity: 0.35; /* 大幅降低非本月日期的透明度，视觉降噪 */
}

.day.today {
  background: var(--accent-color);
  color: white;
  font-weight: 600;
}

.day.selected {
  outline: 1.5px solid var(--accent-color);
  outline-offset: -1.5px;
  background: var(--accent-light);
  color: var(--accent-color);
}

.day.today.selected {
  color: white;
  background: var(--accent-color);
  outline-color: var(--accent-active);
}
</style>