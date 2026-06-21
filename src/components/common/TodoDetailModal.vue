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
          class="todo-detail-modal elegant-modal-card fluent-card"
          @click="handleModalClick"
          @keydown.escape="handleClose"
        >
          <!-- 头部 - 大字标题排版，去除生硬边线 -->
          <div class="modal-header">
            <div class="title-with-interactive-check">
              <!-- 大号精致复选打勾框，点击支持完成状态切换（支持弹性动画） -->
              <span class="interactive-todo-checkbox" :class="{ checked: todo?.completed }">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark-svg">
                  <polyline points="2.5 6 4.5 8 9.5 3.5"/>
                </svg>
              </span>
              <h3 class="detail-title todo-title" :class="{ strikethrough: todo?.completed }">{{ todo?.title }}</h3>
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
              
              <!-- 1. 优先级属性 -->
              <div v-if="todo" class="meta-detail-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
                  </svg>
                  <span>优先级</span>
                </span>
                <span class="meta-row-value">
                  <span class="priority-badge-pill priority-badge" :class="todo.priority">
                    <span class="priority-badge-dot"></span>
                    <span>{{ priorityText }}</span>
                  </span>
                </span>
              </div>

              <!-- 2. 截止日期属性 -->
              <div v-if="todo?.dueDate" class="meta-detail-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>截止日期</span>
                </span>
                <span class="meta-row-value todo-due-date">{{ dueDateDisplay }}</span>
              </div>

              <!-- 3. 状态属性 -->
              <div v-if="todo" class="meta-detail-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>任务状态</span>
                </span>
                <span class="meta-row-value">
                  <span class="todo-status-pill todo-status" :class="statusClass">{{ statusText }}</span>
                </span>
              </div>

              <!-- 4. 描述属性 -->
              <div v-if="todo && hasDescription" class="meta-detail-row align-start">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span>任务描述</span>
                </span>
                <span class="meta-row-value todo-description">{{ todo.description }}</span>
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
.todo-detail-modal {
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

.title-with-interactive-check {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.interactive-todo-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 2px solid var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.check-mark-svg {
  color: white;
  transform: scale(0);
  transition: transform var(--transition-fast) cubic-bezier(0.12, 0.4, 0.29, 1.46);
}

.interactive-todo-checkbox.checked {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.interactive-todo-checkbox.checked .check-mark-svg {
  transform: scale(1);
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
  transition: all var(--transition-normal);
}

.detail-title.strikethrough {
  text-decoration: line-through;
  color: var(--text-tertiary);
  opacity: 0.8;
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

/* Metadata Detail Grid */
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

/* 优先级胶囊标签 */
.priority-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.priority-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.priority-badge-pill.high {
  background: rgba(255, 59, 48, 0.08);
  color: #FF3B30;
}
.priority-badge-pill.high .priority-badge-dot {
  background: #FF3B30;
}

.priority-badge-pill.medium {
  background: rgba(255, 149, 0, 0.08);
  color: #FF9500;
}
.priority-badge-pill.medium .priority-badge-dot {
  background: #FF9500;
}

.priority-badge-pill.low {
  background: rgba(52, 199, 89, 0.08);
  color: #34C759;
}
.priority-badge-pill.low .priority-badge-dot {
  background: #34C759;
}

.todo-due-date {
  font-weight: 600;
  color: var(--text-primary);
}

/* 状态胶囊 */
.todo-status-pill {
  display: inline-flex;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-md);
}

.todo-status-pill.completed {
  background: rgba(52, 199, 89, 0.08);
  color: #34C759;
}

.todo-status-pill.pending {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.todo-description {
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
