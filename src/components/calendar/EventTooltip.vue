<template>
  <Transition name="tooltip">
    <div
      v-if="visible && event"
      class="event-tooltip"
      :style="tooltipStyle"
      :class="{ 'is-all-day': event.allDay }"
    >
      <!-- 事件颜色标识条 -->
      <div class="tooltip-color-bar" :style="{ background: calendarColor }"></div>

      <!-- 事件内容 -->
      <div class="tooltip-content">
        <!-- 标题 -->
        <div class="tooltip-title">{{ event.title }}</div>

        <!-- 时间范围 -->
        <div class="tooltip-time">
          <span class="time-icon">🕐</span>
          <span class="time-text">{{ formattedTime }}</span>
        </div>

        <!-- 日历名称 -->
        <div class="tooltip-calendar">
          <span class="calendar-dot" :style="{ background: calendarColor }"></span>
          <span class="calendar-name">{{ calendarName }}</span>
        </div>

        <!-- 描述（如果有） -->
        <div v-if="event.description" class="tooltip-description">
          {{ event.description }}
        </div>

        <!-- 地点（如果有） -->
        <div v-if="event.location" class="tooltip-location">
          <span class="location-icon">📍</span>
          <span class="location-text">{{ event.location }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { formatDate, formatTime } from '@/utils/date'
import type { CalendarEvent } from '@/types'

// Props 定义
interface TooltipPosition {
  x: number
  y: number
}

const props = defineProps<{
  event: CalendarEvent | null
  visible: boolean
  position: TooltipPosition
}>()

// 获取日历 store
const calendarStore = useCalendarStore()

// 计算样式（绝对定位）
const tooltipStyle = computed(() => {
  // 基础偏移量，避免 tooltip 紧贴鼠标
  const offsetX = 12
  const offsetY = 12

  // 获取视口尺寸
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1920
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 1080

  // 预估 tooltip 尺寸
  const estimatedWidth = 280
  const estimatedHeight = 150

  // 计算位置，考虑边界溢出
  let left = props.position.x + offsetX
  let top = props.position.y + offsetY

  // 防止右侧溢出
  if (left + estimatedWidth > viewportWidth) {
    left = props.position.x - estimatedWidth - offsetX
  }

  // 防止底部溢出
  if (top + estimatedHeight > viewportHeight) {
    top = props.position.y - estimatedHeight - offsetY
  }

  // 确保不小于 0
  left = Math.max(8, left)
  top = Math.max(8, top)

  return {
    left: `${left}px`,
    top: `${top}px`
  }
})

// 获取日历名称
const calendarName = computed(() => {
  if (!props.event) return ''
  const calendar = calendarStore.calendars.find(c => c.id === props.event!.calendarId)
  return calendar?.name || '未知日历'
})

// 获取日历颜色
const calendarColor = computed(() => {
  if (!props.event) return '#4A90D9'
  const calendar = calendarStore.calendars.find(c => c.id === props.event!.calendarId)
  return calendar?.color || '#4A90D9'
})

// 格式化时间显示
const formattedTime = computed(() => {
  if (!props.event) return ''

  const startDate = new Date(props.event.startTime)
  const endDate = new Date(props.event.endTime)

  // 全天事件
  if (props.event.allDay) {
    const startStr = formatDate(startDate)
    const endStr = formatDate(endDate)

    // 同一天
    if (startStr === endStr) {
      return '全天'
    }

    // 跨天
    return `${startStr} - ${endStr}（全天）`
  }

  // 普通事件
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)
  const startTimeStr = formatTime(startDate)
  const endTimeStr = formatTime(endDate)

  // 同一天
  if (startDateStr === endDateStr) {
    return `${startDateStr} ${startTimeStr} - ${endTimeStr}`
  }

  // 跨天
  return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`
})
</script>

<style scoped>
/* Tooltip 容器 */
.event-tooltip {
  position: fixed;
  z-index: 1000;
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  min-width: 240px;
  max-width: 320px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* 全天事件特殊样式 */
.event-tooltip.is-all-day {
  border-left: 4px solid transparent;
}

/* 颜色标识条 */
.tooltip-color-bar {
  width: 4px;
  flex-shrink: 0;
}

/* 内容区域 */
.tooltip-content {
  flex: 1;
  padding: 12px 14px;
  min-width: 0;
}

/* 标题 */
.tooltip-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 8px;
  word-break: break-word;
}

/* 时间 */
.tooltip-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.time-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.time-text {
  line-height: 1.4;
}

/* 日历名称 */
.tooltip-calendar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.calendar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.calendar-name {
  line-height: 1.3;
}

/* 描述 */
.tooltip-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 地点 */
.tooltip-location {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.location-icon {
  font-size: 11px;
  flex-shrink: 0;
}

.location-text {
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 动画效果 - 淡入淡出 */
.tooltip-enter-active {
  animation: tooltip-enter var(--transition-fast) ease-out;
}

.tooltip-leave-active {
  animation: tooltip-leave var(--transition-fast) ease-in;
}

@keyframes tooltip-enter {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes tooltip-leave {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}

/* 响应式适配 */
@media (max-width: 480px) {
  .event-tooltip {
    min-width: 200px;
    max-width: 280px;
  }

  .tooltip-content {
    padding: 10px 12px;
  }

  .tooltip-title {
    font-size: 13px;
  }

  .tooltip-time,
  .tooltip-calendar {
    font-size: 12px;
  }
}
</style>
