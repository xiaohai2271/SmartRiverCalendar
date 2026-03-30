<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarEvent } from '@/types'
import { useCalendarStore } from '@/stores/calendar'
import { formatDateLocale, formatTime } from '@/utils/date'

// Props 定义
interface Props {
  visible: boolean
  event: CalendarEvent | null
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  close: []
}>()

// 获取日历 store
const calendarStore = useCalendarStore()

// 计算日历信息
const calendarInfo = computed(() => {
  if (!props.event) return null
  return calendarStore.calendars.find(c => c.id === props.event?.calendarId)
})

// 格式化开始时间
const formattedStartTime = computed(() => {
  if (!props.event) return ''
  const date = new Date(props.event.startTime)
  if (props.event.allDay) {
    return formatDateLocale(date)
  }
  return `${formatDateLocale(date)} ${formatTime(date)}`
})

// 格式化结束时间
const formattedEndTime = computed(() => {
  if (!props.event) return ''
  const date = new Date(props.event.endTime)
  if (props.event.allDay) {
    return formatDateLocale(date)
  }
  return `${formatDateLocale(date)} ${formatTime(date)}`
})

// 关闭弹窗
function handleClose() {
  emit('close')
}

// 点击遮罩关闭
function handleOverlayClick() {
  handleClose()
}
</script>

<template>
  <teleport to="body">
    <Transition name="modal">
      <div v-if="visible && event" class="modal-overlay" @click.self="handleOverlayClick">
        <div class="event-modal fluent-card" @keydown.escape="handleClose">
          <!-- 弹窗头部 -->
          <div class="modal-header">
            <h3>日程详情</h3>
            <button class="close-btn" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 弹窗内容 -->
          <div class="modal-body">
            <!-- 标题 -->
            <div class="detail-row">
              <div class="detail-label">标题</div>
              <div class="detail-value title-value">{{ event.title }}</div>
            </div>

            <!-- 时间信息 -->
            <div class="detail-row">
              <div class="detail-label">开始时间</div>
              <div class="detail-value">
                {{ formattedStartTime }}
                <span v-if="event.allDay" class="all-day-tag">全天</span>
              </div>
            </div>

            <div class="detail-row">
              <div class="detail-label">结束时间</div>
              <div class="detail-value">{{ formattedEndTime }}</div>
            </div>

            <!-- 日历信息 -->
            <div class="detail-row">
              <div class="detail-label">日历</div>
              <div class="detail-value">
                <span
                  v-if="calendarInfo"
                  class="calendar-badge"
                  :style="{ borderLeftColor: calendarInfo.color }"
                >
                  {{ calendarInfo.name }}
                </span>
                <span v-else>未知日历</span>
              </div>
            </div>

            <!-- 描述 -->
            <div class="detail-row">
              <div class="detail-label">描述</div>
              <div class="detail-value description-value">
                {{ event.description || '无' }}
              </div>
            </div>
          </div>

          <!-- 底部操作区 -->
          <div class="modal-footer">
            <button class="fluent-button" @click="handleClose">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </teleport>
</template>

<style scoped>
/* 模态框遮罩 */
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

/* 模态框容器 */
.event-modal {
  width: 420px;
  max-width: 90vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 模态框头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

/* 关闭按钮 */
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
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 模态框内容 */
.modal-body {
  padding: 16px 18px;
  flex: 1;
}

/* 详情行 */
.detail-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  width: 80px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-value {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  word-break: break-word;
}

/* 标题样式 */
.title-value {
  font-weight: 600;
  font-size: 15px;
}

/* 全天标签 */
.all-day-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  font-size: 11px;
  background: var(--accent-light);
  color: var(--accent-color);
  border-radius: var(--radius-sm);
}

/* 日历徽章 */
.calendar-badge {
  display: inline-block;
  padding: 4px 10px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  border-left: 3px solid;
  font-size: 13px;
}

/* 描述值 */
.description-value {
  white-space: pre-wrap;
}

/* 模态框底部 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color);
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .event-modal,
.modal-leave-to .event-modal {
  transform: scale(0.95);
}
</style>
