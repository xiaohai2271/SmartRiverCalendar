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
          class="event-detail-modal fluent-card"
          @click="handleModalClick"
          @keydown.escape="handleClose"
        >
          <!-- 日历颜色条 -->
          <div
            class="calendar-color-bar"
            :style="{ backgroundColor: calendarColor }"
          ></div>

          <!-- 头部 -->
          <div class="modal-header">
            <h3 class="detail-title">{{ event.title }}</h3>
            <button class="close-btn" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 内容 -->
          <div class="modal-body">
            <!-- 时间 -->
            <div class="detail-row">
              <span class="detail-label">时间</span>
              <span class="detail-time">{{ timeDisplay }}</span>
            </div>

            <!-- 描述 -->
            <div v-if="hasDescription" class="detail-row">
              <span class="detail-label">描述</span>
              <span class="detail-description">{{ event.description }}</span>
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
  width: 480px;
  max-width: 90vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* 日历颜色条 */
.calendar-color-bar {
  height: 4px;
  width: 100%;
  flex-shrink: 0;
}

/* 头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.detail-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
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
  border-radius: var(--radius-sm);
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
  padding: 16px 18px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 40px;
  flex-shrink: 0;
}

.detail-time,
.detail-description {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
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
