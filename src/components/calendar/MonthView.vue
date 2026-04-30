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
        @contextmenu="handleDayContextMenu($event, day)"
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
            <template v-for="badge in getBadgesForDay(day).slice(0, 3)" :key="badge.type">
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
            <template v-for="(laneEvent, idx) in getLaneEventsForDay(day)" :key="idx">
              <EventBar
                v-if="laneEvent"
                :event="laneEvent"
                :day="day"
                :calendar-color="getCalendarColor(laneEvent.calendarId)"
                @edit-event="emit('edit-event', $event)"
              />
              <div v-else class="event-lane event-lane--empty"></div>
            </template>
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
    <!-- 日期右键菜单 -->
    <DateCellContextMenu
      v-model:visible="contextMenuVisible"
      :x="contextMenuState.x"
      :y="contextMenuState.y"
      :event-count="contextMenuState.eventCount"
      :todo-count="contextMenuState.todoCount"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import { useSettingsStore } from '../../stores/settings'
import { getMonthDays, getWeekDays, isToday as isTodayFn, isEventOnDay } from '../../utils/date'
import { getLunarInfo as fetchLunarInfo, type LunarInfo } from '../../utils/lunar'
import { computeEventLanes } from '../../composables/useEventLanes'
import EventBar from './EventBar.vue'
import type { CalendarEvent } from '../../types'
import { REST_BADGE_CONFIG } from '../../types'
import DateCellContextMenu from './DateCellContextMenu.vue'
import type { DateCellMenuAction } from '../../types'

const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
  'view-day-schedules': [date: Date]
  'create-event': [date: Date]
  'view-todos': [date: Date]
  'create-todo': [date: Date]
}>()

const calendarStore = useCalendarStore()
const settingsStore = useSettingsStore()

const currentDate = computed(() => calendarStore.currentDate)
const settings = computed(() => settingsStore.settings)

// 事件泳道映射（用于多天事件排序）
const eventLanes = computed(() => {
  return computeEventLanes(calendarStore.events, currentDate.value)
})

// 事件显示模式
const displayStyle = computed(() => settings.value.monthEventDisplayStyle)

// 最大显示事件数量
const maxEventBars = 5
const maxEventIndicators = 9

// 显示设置
const showWeekend = computed(() => settings.value.showWeekend)
const showLunar = computed(() => settings.value.showLunar)
const showLunarFestival = computed(() => settings.value.showLunarFestival && settings.value.showLunar)
const showSolarTerm = computed(() => settings.value.showSolarTerm)
const showHoliday = computed(() => settings.value.showHoliday)
const showMakeupDay = computed(() => settings.value.showMakeupDay)

// 右键菜单状态
const contextMenuVisible = computed({
  get: () => contextMenuState.value.visible,
  set: (val: boolean) => { contextMenuState.value.visible = val }
})
const contextMenuState = ref({
  visible: false,
  x: 0,
  y: 0,
  date: new Date() as Date,
  eventCount: 0,
  todoCount: 0,
})

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
  const lanes = eventLanes.value

  // 排序：多天事件（有泳道）排在单天事件之前
  // 同类型事件按泳道号/开始时间排序
  return events.sort((a, b) => {
    const laneA = lanes.get(a.id) ?? Infinity
    const laneB = lanes.get(b.id) ?? Infinity

    // 多天事件（有泳道）排在单天事件之前
    if (laneA !== laneB) {
      if (laneA !== Infinity && laneB !== Infinity) return laneA - laneB
      if (laneA !== Infinity) return -1
      if (laneB !== Infinity) return 1
    }
    // 单天事件按开始时间排序
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })
}

/** 获取某天的泳道事件列表（包含空泳道占位） */
function getLaneEventsForDay(day: Date): (CalendarEvent | null)[] {
  const events = getEventsForDay(day)
  const lanes = eventLanes.value

  // 计算最大泳道号
  let maxLane = -1
  for (const event of events) {
    const lane = lanes.get(event.id)
    if (lane !== undefined && lane > maxLane) maxLane = lane
  }

  // 无泳道事件（单天事件），直接返回
  if (maxLane === -1) {
    return events.slice(0, maxEventBars)
  }

  // 构建泳道→事件映射（空泳道为 null）
  const result: (CalendarEvent | null)[] = []
  for (let i = 0; i <= maxLane; i++) {
    const event = events.find(e => lanes.get(e.id) === i)
    result.push(event || null)
  }

  // 添加单天事件到末尾
  const singleDayEvents = events.filter(e => !lanes.has(e.id))
  result.push(...singleDayEvents)

  // 返回结果（限制为 maxEventBars）
  return result.slice(0, maxEventBars)
}

/** 徽标信息 */
interface BadgeInfo {
  type: string
  text: string
  title: string
}

/** 获取某天的徽标列表（按优先级排序，最多3个） */
function getBadgesForDay(day: Date): BadgeInfo[] {
  const info = getLunarInfo(day)
  if (!info) return []

  const badges: BadgeInfo[] = []

  // 优先级 1：补班日（"补"）— 调休补班（优先判断，避免与"休"冲突）
  if (showMakeupDay.value && info.isWorkDay) {
    badges.push({
      type: 'makeup',
      text: REST_BADGE_CONFIG.makeup.text,
      title: info.workDayName || '补班'
    })
  }

  // 优先级 1：休息日（"休"） — 周末或法定节假日（排除补班日）
  if (showMakeupDay.value && (info.isWeekend || info.isHoliday) && !info.isWorkDay) {
    badges.push({
      type: 'rest',
      text: REST_BADGE_CONFIG.rest.text,
      title: info.isHoliday ? (info.holidayName || '节假日') : '周末'
    })
  }

  // 优先级 2：法定节假日名称（仅在非休/补徽标时显示，避免重复）
  if (showHoliday.value && info.holidayName && !badges.some(b => b.type === 'rest' || b.type === 'makeup')) {
    badges.push({ type: 'holiday', text: info.holidayName, title: info.holidayName })
  } else if (showLunarFestival.value && info.lunarFestival && !badges.some(b => b.type === 'rest' || b.type === 'makeup')) {
    // 优先级 3：农历节日（当没有法定节假日和休/补徽标时显示）
    badges.push({ type: 'festival', text: info.lunarFestival, title: info.lunarFestival })
  }

  // 优先级 4：节气（独立显示）
  if (showSolarTerm.value && info.solarTerm) {
    badges.push({ type: 'solar-term', text: info.solarTerm, title: info.solarTerm })
  }

  return badges.slice(0, 3)
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

/** 日期单元格右键菜单 */
function handleDayContextMenu(event: MouseEvent, day: Date) {
  event.preventDefault()
  const eventsForDay = getEventsForDay(day)
  contextMenuState.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    date: day,
    eventCount: eventsForDay.length,
    todoCount: 0, // 待办功能后续集成
  }
}

/** 处理右键菜单动作 */
function handleContextMenuAction(action: DateCellMenuAction) {
  const date = contextMenuState.value.date
  switch (action) {
    case 'viewEvents':
      emit('view-day-schedules', date)
      break
    case 'createEvent':
      emit('create-event', date)
      break
    case 'viewTodos':
      emit('view-todos', date)
      break
    case 'createTodo':
      emit('create-todo', date)
      break
    case 'switchToDayView':
      calendarStore.selectDate(date)
      calendarStore.navigateToDate(date)
      calendarStore.setView('day')
      break
    case 'switchToWeekView':
      calendarStore.selectDate(date)
      calendarStore.navigateToDate(date)
      calendarStore.setView('week')
      break
  }
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

/* 今天 - 主题色 */
.day-cell.today {
  background: var(--accent-light);
  outline: 1.5px solid var(--accent-color);
  outline-offset: -1.5px;
  border-radius: var(--radius-md);
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

/* 空泳道占位 - 保持多天事件视觉连续 */
.event-lane--empty {
  height: 4px;
  margin-bottom: 2px;
  visibility: hidden;
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

.badge.rest {
  background: #e0f2fe;
  color: #0284c7;
  font-weight: 600;
}

.badge.makeup {
  background: #fee2e2;
  color: #dc2626;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .day-cell.today {
    background: var(--accent-light);
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

  .badge.rest {
    background: rgba(14, 165, 233, 0.15);
    color: #7dd3fc;
  }
}
</style>
