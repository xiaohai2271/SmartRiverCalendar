<template>
  <div
    class="event-bar"
    :class="{
      'is-start': spanInfo.isStart,
      'is-end': spanInfo.isEnd,
      'is-middle': spanInfo.isMiddle
    }"
    :style="barStyle"
    @click.stop="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
  ></div>

  <!-- 悬浮提示 -->
  <EventTooltip
    :event="event"
    :visible="tooltipVisible"
    :position="tooltipPosition"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import EventTooltip from './EventTooltip.vue'
import { isMultiDayEvent, getEventSpanInfo } from '@/utils/date'
import type { CalendarEvent } from '@/types'

// Props 定义
interface Props {
  /** 事件对象 */
  event: CalendarEvent
  /** 当前显示的日期 */
  day: Date
  /** 所属日历的颜色 */
  calendarColor: string
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  'edit-event': [event: CalendarEvent]
}>()

// 工具提示状态
const tooltipVisible = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

// 获取事件跨度信息
const spanInfo = computed(() => {
  return getEventSpanInfo(props.event, props.day)
})

// 判断是否跨天事件
const isMultiDay = computed(() => {
  return isMultiDayEvent(props.event)
})

// 计算横条样式
const barStyle = computed(() => {
  const color = props.event.color || props.calendarColor
  const style: Record<string, string> = {
    background: color
  }

  // 非全天事件：根据时间比例计算左右边距
  const startDate = new Date(props.event.startTime)
  const endDate = new Date(props.event.endTime)
  const dayStart = new Date(props.day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(props.day)
  dayEnd.setHours(23, 59, 59, 999)

  // 事件开始于当天0点之前（含）且结束于当天末尾之后（含）→ 视为全天，占满整行
  const startsBeforeDay = startDate.getTime() <= dayStart.getTime()
  const endsAfterDay = endDate.getTime() >= dayEnd.getTime()
  // 结束时间为次日 00:00:00 也视为覆盖整天
  const endsAtNextDayMidnight = (() => {
    const nextDay = new Date(props.day)
    nextDay.setDate(nextDay.getDate() + 1)
    nextDay.setHours(0, 0, 0, 0)
    return Math.abs(endDate.getTime() - nextDay.getTime()) < 60000
  })()

  if (startsBeforeDay && (endsAfterDay || endsAtNextDayMidnight)) {
    return style
  }

  // 计算事件在当天内的可见起止时间
  const visibleStart = startDate.getTime() > dayStart.getTime() ? startDate : dayStart
  const visibleEnd = endDate.getTime() < dayEnd.getTime() ? endDate : dayEnd

  // 左边距：事件开始时间占全天比例
  const startMinutes = visibleStart.getHours() * 60 + visibleStart.getMinutes()
  const leftRatio = startMinutes / (24 * 60)
  style.marginLeft = `${leftRatio * 100}%`

  // 右边距：事件结束后剩余时间占全天比例
  const endMinutes = visibleEnd.getHours() * 60 + visibleEnd.getMinutes()
  const rightRatio = 1 - endMinutes / (24 * 60)
  style.marginRight = `${rightRatio * 100}%`

  return style
})

// 点击事件
function handleClick() {
  emit('edit-event', props.event)
}

// 鼠标进入
function handleMouseEnter() {
  tooltipVisible.value = true
}

// 鼠标离开
function handleMouseLeave() {
  tooltipVisible.value = false
}

// 鼠标移动（更新提示位置）
function handleMouseMove(event: MouseEvent) {
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
}
</script>

<style scoped>
.event-bar {
  height: 4px;
  cursor: pointer;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
  margin-bottom: 2px;
}

.event-bar:hover {
  opacity: 0.85;
  transform: scaleY(1.2);
}

/* 跨天事件样式 */
.event-bar.is-start {
  border-top-left-radius: 2px;
  border-bottom-left-radius: 2px;
}

.event-bar.is-end {
  border-top-right-radius: 2px;
  border-bottom-right-radius: 2px;
}

.event-bar.is-middle {
  border-radius: 0;
}
</style>
