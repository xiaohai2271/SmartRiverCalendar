<template>
  <div class="popup-calendar-grid" :class="{ 'popup-calendar-grid--compact': size === 'small' }">
    <!-- 星期头部 -->
    <div class="weekday-header">
      <div v-for="day in weekDays" :key="day" class="weekday">{{ day }}</div>
    </div>

    <!-- 日期网格 -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in monthDays"
        :key="index"
        class="day-cell"
        :class="getDayCellClass(day)"
        @click="handleSelectDate(day)"
        @dblclick="handleCreateEvent(day)"
        @contextmenu.prevent="handleContextMenu(day, $event)"
      >
        <!-- 日期内容 -->
        <div class="day-content">
          <!-- 公历日期 -->
          <span class="day-number">{{ day.getDate() }}</span>

          <!-- 农历日期 -->
          <span v-if="showLunar && getLunarInfo(day)" class="lunar-text">
            {{ getLunarDisplay(day) }}
          </span>
        </div>

        <!-- 休/补徽标 -->
        <div v-if="getBadgesForDay(day).length > 0" class="day-badges">
          <span
            v-for="badge in getBadgesForDay(day)"
            :key="badge.type"
            :class="['badge', badge.type]"
            :title="badge.title"
          >
            {{ badge.text }}
          </span>
        </div>

        <!-- 事件圆点（始终渲染容器，避免对齐问题） -->
        <div class="event-dots" :class="{ 'event-dots--empty': getEventsForDay(day).length === 0 }">
          <template v-if="showEvents && getEventsForDay(day).length > 0">
            <span
              v-for="event in getEventsForDay(day).slice(0, maxEventDots)"
              :key="event.id"
              class="event-dot"
              :style="{ background: getEventColor(event) }"
              :title="event.title"
              @click.stop="handleViewEvent(event)"
            ></span>
            <span
              v-if="getEventsForDay(day).length > maxEventDots"
              class="more-dots"
              @click.stop="handleContextMenu(day, $event)"
            >
              +{{ getEventsForDay(day).length - maxEventDots }}
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePopupSettingsStore } from '@/stores/popupSettings'
import { useCalendarStore } from '@/stores/calendar'
import { getLunarInfo as fetchLunarInfo, type LunarInfo } from '@/utils/lunar'
import { getMonthDays, isToday as isTodayFn, isSameDay } from '@/utils/date'
import type { CalendarEvent, PopupWindowSize } from '@/types'

// Props 定义
const props = defineProps<{
  currentDate: Date
  selectedDate?: Date
  size?: PopupWindowSize
}>()

// Emits 定义
const emit = defineEmits<{
  'select-date': [date: Date]
  'create-event': [date: Date]
  'context-menu': [payload: { date: Date; x: number; y: number }]
  'view-event': [event: CalendarEvent]
}>()

// Store 实例
const popupSettings = usePopupSettingsStore()
const calendarStore = useCalendarStore()

// 最大显示事件圆点数量
const maxEventDots = 3

// 显示设置
const showLunar = computed(() => popupSettings.settings.popupCalendarShowLunar)
const showEvents = computed(() => popupSettings.settings.popupShowEvents)

// 周几显示（固定从周日开始）
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// 获取月份所有日期（7x6 网格）
const monthDays = computed(() => {
  return getMonthDays(props.currentDate, 0)
})

// 缓存农历信息，避免重复计算
const lunarInfoCache = computed(() => {
  const cache = new Map<string, LunarInfo>()
  const year = props.currentDate.getFullYear()
  const month = props.currentDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 缓存当月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    cache.set(date.toDateString(), fetchLunarInfo(date))
  }

  // 缓存上月末尾可能显示的日期
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  for (let i = 1; i <= firstDayOfMonth; i++) {
    const date = new Date(year, month, 1 - i)
    cache.set(date.toDateString(), fetchLunarInfo(date))
  }

  // 缓存下月开头可能显示的日期
  const remainingDays = 42 - (daysInMonth + firstDayOfMonth)
  for (let i = 1; i <= remainingDays; i++) {
    const date = new Date(year, month + 1, i)
    cache.set(date.toDateString(), fetchLunarInfo(date))
  }

  return cache
})

// 获取日期的农历信息
function getLunarInfo(day: Date): LunarInfo | undefined {
  return lunarInfoCache.value.get(day.toDateString())
}

// 判断是否为当月日期
function isCurrentMonth(day: Date): boolean {
  return day.getMonth() === props.currentDate.getMonth() &&
         day.getFullYear() === props.currentDate.getFullYear()
}

// 判断是否为今天
function isToday(day: Date): boolean {
  return isTodayFn(day)
}

// 判断是否被选中
function isSelected(day: Date): boolean {
  return props.selectedDate ? isSameDay(day, props.selectedDate) : false
}

// 获取农历显示文本
function getLunarDisplay(day: Date): string {
  const info = getLunarInfo(day)
  if (!info) return ''

  // 优先显示节日
  if (info.holidayName) return info.holidayName
  if (info.lunarFestival) return info.lunarFestival
  if (info.solarTerm) return info.solarTerm

  // 显示农历日期：初一显示月份，其他日期显示日期
  if (info.lunarDay === '初一') {
    return info.lunarMonth
  }
  return info.lunarDay
}

// 获取日期单元格的类名
function getDayCellClass(day: Date): Record<string, boolean> {
  return {
    'other-month': !isCurrentMonth(day),
    'today': isToday(day),
    'selected': isSelected(day)
  }
}

// 获取某天的徽标列表（仅休/补）
function getBadgesForDay(day: Date): Array<{ type: string; text: string; title: string }> {
  const info = getLunarInfo(day)
  if (!info) return []

  const badges: Array<{ type: string; text: string; title: string }> = []

  // 补班日（"补"）— 优先判断
  if (info.isWorkDay) {
    badges.push({ type: 'makeup', text: '补', title: info.workDayName || '补班' })
  }

  // 休息日（"休"）— 周末或法定节假日（排除补班日）
  if ((info.isWeekend || info.isHoliday) && !info.isWorkDay) {
    badges.push({ type: 'rest', text: '休', title: info.isHoliday ? (info.holidayName || '节假日') : '周末' })
  }

  return badges
}

// 获取某天的事件列表
function getEventsForDay(day: Date): CalendarEvent[] {
  return calendarStore.eventsForCurrentView.filter(event => {
    const eventDate = new Date(event.startTime)
    return isSameDay(eventDate, day)
  })
}

// 获取事件颜色
function getEventColor(event: CalendarEvent): string {
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return event.color || calendar?.color || '#4A90D9'
}

// 事件处理
function handleSelectDate(day: Date) {
  emit('select-date', day)
}

function handleCreateEvent(day: Date) {
  emit('create-event', day)
}

function handleContextMenu(day: Date, event: MouseEvent) {
  emit('context-menu', { date: day, x: event.clientX, y: event.clientY })
}

function handleViewEvent(event: CalendarEvent) {
  emit('view-event', event)
}
</script>

<style scoped>
.popup-calendar-grid {
  user-select: none;
}

/* 星期头部 */
.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: var(--popup-space-xs);
}

.weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--popup-text-secondary);
  padding: var(--popup-space-xs) 0;
  background: transparent;
}

/* 日期网格 */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  flex: 1;
  border: 1px solid var(--popup-border-color);
  border-radius: var(--popup-radius-md);
  overflow: hidden;
}

/* 日期单元格 */
.day-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--day-cell-padding, 3px 1px);
  background: var(--popup-bg-secondary);
  cursor: pointer;
  transition: all var(--popup-transition-fast);
  position: relative;
}

.day-cell:hover {
  background: var(--popup-bg-hover);
}

.day-cell.other-month {
  background: var(--popup-bg-tertiary);
}

.day-cell.other-month .day-number,
.day-cell.other-month .lunar-text {
  color: var(--popup-text-tertiary);
}

/* 今天样式 */
.day-cell.today {
  background: var(--popup-accent-light);
}

.day-cell.today .day-number {
  background: var(--popup-accent-color);
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  box-shadow: var(--popup-shadow-sm);
}

/* 紧凑模式：今天背景框缩小 */
.popup-calendar-grid--compact .day-cell.today .day-number {
  width: 18px;
  height: 18px;
}

/* 选中样式 */
.day-cell.selected:not(.today) {
  box-shadow: inset 0 0 0 2px var(--popup-accent-color);
  border-radius: var(--popup-radius-sm);
}

/* 日期内容 */
.day-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  width: 100%;
}

.day-number {
  font-size: 13px;
  font-weight: 500;
  color: var(--popup-text-primary);
  line-height: 1.2;
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lunar-text {
  font-size: 9px;
  color: var(--popup-text-secondary);
  line-height: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 事件圆点 */
.event-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  margin-top: 8px;
  flex-wrap: wrap;
  max-width: 100%;
}

/* 紧凑模式：圆点上边距缩小 */
.popup-calendar-grid--compact .event-dots {
  margin-top: 2px;
}

.event-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--popup-transition-fast);
  flex-shrink: 0;
}

.event-dot:hover {
  transform: scale(1.8);
}

.more-dots {
  font-size: 8px;
  color: var(--popup-text-secondary);
  background: var(--popup-bg-tertiary);
  padding: 0 3px;
  border-radius: 3px;
  cursor: pointer;
  line-height: 1.2;
  transition: all var(--popup-transition-fast);
}

.more-dots:hover {
  background: var(--popup-bg-hover);
  color: var(--popup-text-primary);
}

.event-dots--empty {
  visibility: hidden;
}

/* 休/补徽标 - 右上角绝对定位 */
.day-badges {
  position: absolute;
  top: 2px;
  right: 0px;
  display: flex;
  gap: 0px;
}

.badge {
  font-size: 9px;
  padding: 0 3px;
  border-radius: 2px;
  white-space: nowrap;
  line-height: 1.3;
}

.badge.rest {
  background: #f0fdf4;
  color: #16a34a;
  font-weight: 600;
}

.badge.makeup {
  background: #fee2e2;
  color: #dc2626;
  font-weight: 600;
}

/* 紧凑模式：徽标去背景，靠右上 */
.popup-calendar-grid--compact .day-badges {
  top: 1px;
  right: 3px;
}

.popup-calendar-grid--compact .badge {
  padding: 0;
  line-height: 1;
}

.popup-calendar-grid--compact .badge.rest {
  background: none;
}

.popup-calendar-grid--compact .badge.makeup {
  background: none;
}

/* 深色模式适配 - 所有尺寸均无背景 */
:global(.dark .badge.rest) {
  background: transparent;
  color: #86efac;
}

:global(.dark .badge.makeup) {
  background: transparent;
  color: #fca5a5;
}
</style>
