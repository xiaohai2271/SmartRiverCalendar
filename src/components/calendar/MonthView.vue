<template>
  <div class="month-view">
    <!-- Weekday headers -->
    <div class="weekday-header">
      <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
    </div>

    <!-- Calendar grid -->
    <div class="month-grid">
      <div
        v-for="(day, index) in monthDays"
        :key="index"
        class="day-cell"
        :class="{
          'other-month': !isSameMonth(day, currentDate),
          'today': isToday(day),
          'weekend': showWeekend && isWeekend(day),
          'holiday': showHoliday && getLunarInfo(day)?.isHoliday,
          'workday': showMakeupDay && getLunarInfo(day)?.isWorkDay
        }"
        @click="selectDay(day)"
      >
        <div class="day-header">
          <span class="day-number">{{ day.getDate() }}</span>
          <!-- 农历信息 -->
          <span
            v-if="showLunar"
            class="lunar-date"
            :class="{ 'other-lunar': !isSameMonth(day, currentDate), 'festival': shouldShowFestival(day) }"
          >
            {{ getLunarInfo(day)?.lunarDate }}
          </span>
        </div>

        <!-- 节日标识 -->
        <div v-if="showAnyBadge" class="day-badges">
          <!-- 农历节日 -->
          <span
            v-if="showLunarFestival && getLunarInfo(day)?.lunarFestival"
            class="badge festival"
            :title="getLunarInfo(day)?.lunarFestival"
          >
            {{ getLunarInfo(day)?.lunarFestival }}
          </span>
          <!-- 法定节假日 -->
          <span
            v-if="showHoliday && getLunarInfo(day)?.holidayName"
            class="badge holiday"
            :title="getLunarInfo(day)?.holidayName"
          >
            {{ getLunarInfo(day)?.holidayName }}
          </span>
          <!-- 补休/调休 -->
          <span
            v-if="showMakeupDay && getLunarInfo(day)?.isWorkDay"
            class="badge makeup"
            :title="getLunarInfo(day)?.workDayName"
          >
            补
          </span>
          <!-- 节气 -->
          <span
            v-if="showSolarTerm && getLunarInfo(day)?.solarTerm"
            class="badge solar-term"
            :title="getLunarInfo(day)?.solarTerm"
          >
            {{ getLunarInfo(day)?.solarTerm }}
          </span>
        </div>

        <!-- 事件点 -->
        <div class="day-events">
          <div
            v-for="event in getEventsForDay(day)"
            :key="event.id"
            class="event-dot"
            :style="{ background: getEventColor(event) }"
            :title="event.title"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { useSettingsStore } from '../../stores/settings'
import { getMonthDays, getWeekDays, isSameDay, isToday as isTodayFn } from '../../utils/date'
import { getLunarInfo as fetchLunarInfo, type LunarInfo } from '../../utils/lunar'
import type { CalendarEvent } from '../../types'

const calendarStore = useCalendarStore()
const settingsStore = useSettingsStore()

const currentDate = computed(() => calendarStore.currentDate)
const settings = computed(() => settingsStore.settings)

// 显示设置
const showLunar = computed(() => settings.value.showLunar)
const showLunarFestival = computed(() => settings.value.showLunarFestival && settings.value.showLunar)
const showSolarTerm = computed(() => settings.value.showSolarTerm)
const showHoliday = computed(() => settings.value.showHoliday)
const showMakeupDay = computed(() => settings.value.showMakeupDay)
const showWeekend = computed(() => settings.value.showWeekend)

const showAnyBadge = computed(() =>
  showLunarFestival.value ||
  showHoliday.value ||
  showMakeupDay.value ||
  showSolarTerm.value
)

const weekDays = computed(() => getWeekDays(1)) // Monday first

const monthDays = computed(() => getMonthDays(currentDate.value, 1))

// 缓存当月农历信息
const lunarInfoCache = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const cache = new Map<string, LunarInfo>()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    cache.set(date.toDateString(), fetchLunarInfo(date))
  }
  return cache
})

function isSameMonth(date: Date, compareDate: Date): boolean {
  return date.getMonth() === compareDate.getMonth() && date.getFullYear() === compareDate.getFullYear()
}

function isToday(date: Date): boolean {
  return isTodayFn(date)
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6
}

function getLunarInfo(day: Date): LunarInfo | undefined {
  return lunarInfoCache.value.get(day.toDateString())
}

function shouldShowFestival(day: Date): boolean {
  const info = getLunarInfo(day)
  if (!info) return false
  const hasLunarFestival = showLunarFestival.value && !!info.lunarFestival
  const hasHoliday = showHoliday.value && !!info.holidayName
  return hasLunarFestival || hasHoliday
}

function getEventsForDay(day: Date): CalendarEvent[] {
  return calendarStore.events.filter(event => {
    const eventDate = new Date(event.startTime)
    return isSameDay(eventDate, day)
  })
}

function getEventColor(event: CalendarEvent): string {
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}

function selectDay(day: Date) {
  calendarStore.selectDate(day)
  calendarStore.navigateToDate(day)
}
</script>

<style scoped>
.month-view {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 16px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  padding: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 14px;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--border-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.day-cell {
  min-height: 100px;
  background: var(--bg-secondary);
  padding: 6px 8px;
  cursor: pointer;
  transition: background var(--transition-fast);
  position: relative;
}

.day-cell:hover {
  background: var(--bg-hover);
}

.day-cell.other-month {
  background: var(--bg-primary);
}

.day-cell.other-month .lunar-date {
  color: var(--text-tertiary);
}

.day-cell.weekend:not(.holiday) {
  background: rgba(255, 245, 245, 0.5);
}

.day-cell.holiday {
  background: #fef0ef;
}

.day-cell.workday {
  background: #e8f4fd;
}

.day-cell.today {
  background: var(--accent-light);
}

.day-header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.day-number {
  font-size: 15px;
  font-weight: 600;
}

.day-cell.today .day-number {
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.lunar-date {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
}

.lunar-date.festival {
  color: #dc2626;
  font-weight: 600;
}

.day-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 4px;
}

.badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
  white-space: nowrap;
}

.badge.festival {
  background: #fef2f2;
  color: #dc2626;
}

.badge.holiday {
  background: #fef2f2;
  color: #dc2626;
}

.badge.makeup {
  background: #dbeafe;
  color: #2563eb;
}

.badge.solar-term {
  background: #f0fdf4;
  color: #16a34a;
}

.day-events {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 6px;
}

.event-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

@media (prefers-color-scheme: dark) {
  .day-cell.weekend:not(.holiday) {
    background: rgba(255, 255, 255, 0.03);
  }

  .day-cell.holiday {
    background: rgba(220, 38, 38, 0.1);
  }

  .day-cell.workday {
    background: rgba(37, 99, 235, 0.1);
  }

  .badge.festival,
  .badge.holiday {
    background: rgba(220, 38, 38, 0.2);
  }

  .badge.makeup {
    background: rgba(37, 99, 235, 0.2);
  }

  .badge.solar-term {
    background: rgba(22, 163, 74, 0.2);
  }
}
</style>