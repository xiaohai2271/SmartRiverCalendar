<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '@/stores/calendar'
import { formatDate, formatTime } from '@/utils/date'
import type { CalendarEvent } from '@/types'

const props = defineProps<{
  visible: boolean
  event: CalendarEvent | null
}>()

const emit = defineEmits<{
  close: []
}>()

const calendarStore = useCalendarStore()

// 获取日历颜色
const calendarColor = computed(() => {
  if (!props.event) return '#4A90D9'
  const calendar = calendarStore.calendars.find(c => c.id === props.event!.calendarId)
  return calendar?.color ?? '#4A90D9'
})

// 时间显示文本
const timeDisplay = computed(() => {
  if (!props.event) return ''
  if (props.event.allDay) return '全天'

  const startDate = new Date(props.event.startTime)
  const endDate = new Date(props.event.endTime)
  return `${formatDate(startDate)} ${formatTime(startDate)} - ${formatTime(endDate)}`
})

// 是否显示描述
const hasDescription = computed(() => {
  return props.event?.description && props.event.description.trim().length > 0
})

// 关闭模态框
function handleClose() {
  emit('close')
}

// 点击遮罩层关闭
function handleOverlayClick() {
  handleClose()
}

// 阻止模态框内容区域点击冒泡
function handleModalClick(e: MouseEvent) {
  e.stopPropagation()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible && event"
        class="modal-overlay"
        @click="handleOverlayClick"
      >
        <div
          class="event-detail-modal elegant-modal-card"
          @click="handleModalClick"
          @keydown.escape="handleClose"
        >
          <!-- 头部 - 大字标题排版，去除生硬边线 -->
          <div class="modal-header">
            <div class="title-with-color-dot">
              <!-- 精致日历颜色呼吸小圆点，色彩克制，画龙点睛 -->
              <span class="calendar-color-dot calendar-color-bar" :style="{ backgroundColor: calendarColor }"></span>
              <h3 class="detail-title">{{ event.title }}</h3>
            </div>
            <button class="close-btn" @click="handleClose" type="button">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 内容 - Notion & Todoist 风格的属性对齐网格 -->
          <div class="modal-body">
            <div class="metadata-detail-grid">
              
              <!-- 1. 时间属性 -->
              <div class="meta-detail-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>时间区间</span>
                </span>
                <span class="meta-row-value detail-time">{{ timeDisplay }}</span>
              </div>

              <!-- 2. 描述属性 -->
              <div v-if="hasDescription" class="meta-detail-row align-start">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>事件描述</span>
                </span>
                <span class="meta-row-value detail-description">{{ event.description }}</span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* 模态框 */
.event-detail-modal {
  position: relative;
  width: 440px;
  max-width: 90vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  animation: scaleIn var(--transition-smooth);
}

/* 头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 10px 24px;
}

.title-with-color-dot {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.calendar-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.detail-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 内容 */
.modal-body {
  padding: 16px 24px 24px 24px;
}

/* Metadata Detail Grid (Notion & Apple style) */
.metadata-detail-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.02);
}

.meta-detail-row {
  display: flex;
  align-items: center;
}

.meta-detail-row.align-start {
  align-items: flex-start;
}

.meta-row-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.meta-svg-icon {
  color: var(--text-tertiary);
}

.meta-row-value {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-word;
}

.detail-time {
  font-weight: 600;
  color: var(--text-primary);
}

.detail-description {
  line-height: 1.5;
  color: var(--text-secondary);
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .event-detail-modal,
.modal-leave-active .event-detail-modal {
  transition: transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease;
}

.modal-enter-from .event-detail-modal {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .event-detail-modal {
  opacity: 0;
  transform: scale(0.95);
}
</style>
