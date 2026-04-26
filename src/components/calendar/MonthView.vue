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
        <!-- 日期头部 -->
        <div class="day-header">
          <div class="day-header-left">
            <span class="day-number">{{ day.getDate() }}</span>
            <!-- 农历信息 -->
            <span
              v-if="showLunar"
              class="lunar-date"
              :class="{ 'festival': shouldShowFestival(day) }"
            >
              {{ getLunarInfo(day)?.lunarDate }}
            </span>
          </div>
          <!-- 节日标识（右上角） -->
          <div v-if="showAnyBadge" class="day-badges">
            <template v-for="(badge, index) in getBadgesForDay(day).slice(0, 3)" :key="badge.type">
              <span
                :class="['badge', badge.type]"
                :title="badge.title"
              >
                {{ badge.text }}
              </span>
            </template>
          </div>
        </div>

        <!-- 事件显示区域 -->
        <div class="events-container">
          <!-- 横条模式 -->
          <div v-if="displayStyle === 'bar'" class="event-bars">
            <EventBar
              v-for="event in getEventsForDay(day).slice(0, maxEventBars)"
              :key="event.id"
              :event="event"
              :day="day"
              :calendar-color="getCalendarColor(event.calendarId)"
              @edit-event="emit('edit-event', $event)"
            />
            <span
              v-if="getEventsForDay(day).length > maxEventBars"
              class="more-events"
              :title="`${getEventsForDay(day).length} 个日程`"
              @click.stop="emit('view-day-schedules', day)"
            >
              +{{ getEventsForDay(day).length - maxEventBars }}
            </span>
          </div>

          <!-- 圆点模式 -->
          <div v-else class="events-indicator">
            <span
              v-for="event in getEventsForDay(day).slice(0, maxEventIndicators)"
              :key="event.id"
              class="event-dot"
              :style="{ backgroundColor: getEventColor(event) }"
              :title="event.title"
              @click.stop="emit('edit-event', event)"
            ></span>
            <span
              v-if="getEventsForDay(day).length > maxEventIndicators"
              class="more-events"
              :title="`${getEventsForDay(day).length} 个日程`"
              @click.stop="emit('view-day-schedules', day)"
            >
              +{{ getEventsForDay(day).length - maxEventIndicators }}
            </span>
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
import { getMonthDays, getWeekDays, isToday as isTodayFn, isEventOnDay, getEventSpanInfo } from '../../utils/date'
import { getLunarInfo as fetchLunarInfo, type LunarInfo } from '../../utils/lunar'
import EventBar from './EventBar.vue'
import type { CalendarEvent } from '../../types'

const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
  'view-day-schedules': [date: Date]
}>()

const calendarStore = useCalendarStore()
const settingsStore = useSettingsStore()

const currentDate = computed(() => calendarStore.currentDate)
const settings = computed(() => settingsStore.settings)

// 事件显示模式
const displayStyle = computed(() => settings.value.monthEventDisplayStyle)

// 最大显示事件数量
const maxEventBars = 5
const maxEventIndicators = 9

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

const weekDays = computed(() => getWeekDays(settings.value.firstDayOfWeek))

const monthDays = computed(() => getMonthDays(currentDate.value, settings.value.firstDayOfWeek))

// 缓存所有日期的农历信息（包括上月末尾和下月开头）
const lunarInfoCache = computed(() => {
  const cache = new Map<string, LunarInfo>()
  for (const day of monthDays.value) {
    cache.set(day.toDateString(), fetchLunarInfo(day))
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
  const events = calendarStore.events.filter(event => {
    return isEventOnDay(event, day)
  })
  
  // 按跨天数降序排序，跨天数多的排在前面
  // 如果跨天数相同，按开始时间升序排序，确保顺序稳定
  return events.sort((a, b) => {
    const spanA = getEventSpanInfo(a, day).spanDays
    const spanB = getEventSpanInfo(b, day).spanDays
    if (spanB !== spanA) {
      return spanB - spanA
    }
    // 跨天数相同时，按开始时间排序
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })
}

/** 徽标信息 */
interface BadgeInfo {
  type: string
  text: string
  title: string
}

/** 获取某天的徽标列表（已去重，最多3个） */
function getBadgesForDay(day: Date): BadgeInfo[] {
  const info = getLunarInfo(day)
  if (!info) return []

  const badges: BadgeInfo[] = []

  // 法定节假日（优先级最高）
  if (showHoliday.value && info.holidayName) {
    badges.push({ type: 'holiday', text: info.holidayName, title: info.holidayName })
  } else if (showLunarFestival.value && info.lunarFestival) {
    // 农历节日（当没有法定节假日时显示）
    badges.push({ type: 'festival', text: info.lunarFestival, title: info.lunarFestival })
  }

  // 节气（独立显示）
  if (showSolarTerm.value && info.solarTerm) {
    badges.push({ type: 'solar-term', text: info.solarTerm, title: info.solarTerm })
  }

  // 补休/调休（独立显示）
  if (showMakeupDay.value && info.isWorkDay) {
    badges.push({ type: 'makeup', text: '补', title: info.workDayName || '补班' })
  }

  return badges
}

function getEventColor(event: CalendarEvent): string {
  if (event.color) return event.color
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}

function getCalendarColor(calendarId: string): string {
  const calendar = calendarStore.calendars.find(c => c.id === calendarId)
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
  padding: 12px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  padding: 8px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 14px;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: var(--border-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.day-cell {
  min-height: 80px;
  background: var(--bg-secondary);
  padding: 6px 0;
  cursor: pointer;
  transition: background var(--transition-fast);
  position: relative;
  display: flex;
  flex-direction: column;
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

/* 周末 - 极浅绿色 */
.day-cell.weekend:not(.holiday):not(.workday) {
  background: rgba(220, 252, 231, 0.35);
}

/* 法定节假日 - 极浅绿色，带左侧色条 */
.day-cell.holiday {
  background: rgba(220, 252, 231, 0.4);
  border-left: 3px solid #86efac;
}

/* 补班日 - 极浅红色，带左侧色条 */
.day-cell.workday {
  background: rgba(254, 226, 226, 0.35);
  border-left: 3px solid #fca5a5;
}

/* 今天 - 主题色 */
.day-cell.today {
  background: var(--accent-light);
  outline: 2px solid var(--accent-color);
  outline-offset: -2px;
}

/* 修复 today 格子跨天事件横条对齐问题 */
.day-cell.today .event-bars {
  margin-top: 0;
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2px;
  min-height: 26px;
  height: 45px;
  padding: 0 8px;
}

.day-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 26px;  /* 确保与今日圆形日期高度一致 */
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

/* 事件横条区域 - 使用负 margin 突破格子内边距，实现跨天事件视觉连续 */
.event-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 事件容器 */
.events-container {
  margin-top: 4px;
  height: 40px;
}

/* 事件圆点指示器 */
.events-indicator {
  display: flex;
  align-items: center;
  gap: 3px;
  margin: 0 8px;
}

.event-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.event-dot:hover {
  transform: scale(1.2);
}

.more-events {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  cursor: pointer;
}

.more-events:hover {
  background: var(--bg-hover);
}

/* 节日标识 - 右上角竖向排列 */
.day-badges {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 1px;
  flex-shrink: 0;
}

.badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.badge.festival {
  background: #fef2f2;
  color: #dc2626;
}

.badge.holiday {
  background: #dcfce7;
  color: rgba(40, 7, 255, 0.76);
}

.badge.makeup {
  background: #dbeafe;
  color: #2563eb;
}

.badge.solar-term {
  background: #f0fdf4;
  color: #16a34a;
}

@media (prefers-color-scheme: dark) {
  /* 周末 - 深色模式极浅绿色 */
  .day-cell.weekend:not(.holiday):not(.workday) {
    background: rgba(34, 197, 94, 0.08);
  }

  /* 法定节假日 - 深色模式极浅绿色 */
  .day-cell.holiday {
    background: rgba(34, 197, 94, 0.1);
    border-left-color: #86efac;
  }

  /* 补班日 - 深色模式极浅红色 */
  .day-cell.workday {
    background: rgba(239, 68, 68, 0.1);
    border-left-color: #fca5a5;
  }

  .badge.festival,
  .badge.holiday {
    background: rgba(34, 197, 94, 0.15);
    color: rgba(40, 7, 255, 0.76);
  }

  .badge.makeup {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  .badge.solar-term {
    background: rgba(22, 163, 74, 0.15);
  }
}
</style>
