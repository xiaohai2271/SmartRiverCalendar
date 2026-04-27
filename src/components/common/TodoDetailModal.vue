<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '@/utils/date'
import type { Todo } from '@/types'

const props = defineProps<{
  visible: boolean
  todo: Todo | null
}>()

const emit = defineEmits<{
  close: []
}>()

// 是否有描述
const hasDescription = computed(() => {
  return props.todo?.description && props.todo.description.trim().length > 0
})

// 优先级文本
const priorityText = computed(() => {
  if (!props.todo) return ''
  const map: Record<Todo['priority'], string> = {
    high: '高',
    medium: '中',
    low: '低'
  }
  return map[props.todo.priority]
})

// 截止日期格式化
const dueDateDisplay = computed(() => {
  if (!props.todo?.dueDate) return ''
  return formatDate(new Date(props.todo.dueDate))
})

// 状态文本
const statusText = computed(() => {
  if (!props.todo) return ''
  return props.todo.completed ? '已完成' : '未完成'
})

// 状态 CSS 类
const statusClass = computed(() => {
  if (!props.todo) return ''
  return props.todo.completed ? 'completed' : 'pending'
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
        v-if="visible"
        class="modal-overlay"
        @click="handleOverlayClick"
      >
        <div
          class="todo-detail-modal fluent-card"
          @click="handleModalClick"
          @keydown.escape="handleClose"
        >
          <!-- 头部 -->
          <div class="modal-header">
            <h3 class="todo-title">{{ todo?.title }}</h3>
            <button class="close-btn" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 内容 -->
          <div class="modal-body">
            <!-- 描述 -->
            <div v-if="hasDescription" class="detail-row">
              <span class="detail-label">描述</span>
              <span class="todo-description">{{ todo!.description }}</span>
            </div>

            <!-- 优先级 -->
            <div class="detail-row">
              <span class="detail-label">优先级</span>
              <span class="priority-badge" :class="todo?.priority">{{ priorityText }}</span>
            </div>

            <!-- 截止日期 -->
            <div v-if="todo?.dueDate" class="detail-row">
              <span class="detail-label">截止日期</span>
              <span class="todo-due-date">{{ dueDateDisplay }}</span>
            </div>

            <!-- 状态 -->
            <div class="detail-row">
              <span class="detail-label">状态</span>
              <span class="todo-status" :class="statusClass">{{ statusText }}</span>
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
.todo-detail-modal {
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

/* 头部 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.todo-title {
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

.todo-description {
  font-size: 13px;
  color: var(--text-primary);
  word-break: break-word;
}

/* 优先级标签 */
.priority-badge {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.priority-badge.high {
  background: rgba(255, 59, 48, 0.1);
  color: #FF3B30;
}

.priority-badge.medium {
  background: rgba(255, 149, 0, 0.1);
  color: #FF9500;
}

.priority-badge.low {
  background: rgba(52, 199, 89, 0.1);
  color: #34C759;
}

/* 截止日期 */
.todo-due-date {
  font-size: 13px;
  color: var(--text-primary);
}

/* 状态 */
.todo-status {
  font-size: 13px;
  font-weight: 500;
}

.todo-status.completed {
  color: #34C759;
}

.todo-status.pending {
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

.modal-enter-active .todo-detail-modal,
.modal-leave-active .todo-detail-modal {
  transition: transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease;
}

.modal-enter-from .todo-detail-modal {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .todo-detail-modal {
  opacity: 0;
  transform: scale(0.95);
}
</style>
