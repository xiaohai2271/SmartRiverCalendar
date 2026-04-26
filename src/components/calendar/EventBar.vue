<template>
  <div
    class="event-bar"
    :class="{
      'is-start': spanInfo.isStart,
      'is-end': spanInfo.isEnd,
      'is-middle': spanInfo.isMiddle,
      'is-all-day': event.allDay
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

  // 全天事件或单日事件：无特殊边距
  if (props.event.allDay || !isMultiDay.value) {
    return style
  }

  // 跨天事件：根据时间比例计算边距
  const startDate = new Date(props.event.startTime)
  const endDate = new Date(props.event.endTime)

  // 开始日：右边距根据开始时间在当天的比例
  if (spanInfo.value.isStart) {
    const minutes = startDate.getHours() * 60 + startDate.getMinutes()
    const ratio = minutes / (24 * 60)
    style.marginRight = `${ratio * 100}%`
  }

  // 结束日：左边距根据结束时间在当天的比例
  if (spanInfo.value.isEnd) {
    const minutes = endDate.getHours() * 60 + endDate.getMinutes()
    const ratio = minutes / (24 * 60)
    style.marginLeft = `${ratio * 100}%`
  }

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
  border-radius: 2px;
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

/* 全天事件 */
.event-bar.is-all-day {
  height: 4px;
  border-radius: 2px;
}
</style>
