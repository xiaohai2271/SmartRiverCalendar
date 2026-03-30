<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '@/types'
import { formatDateLocale } from '@/utils/date'

// Props 定义
interface Props {
  visible: boolean
  todo: Todo | null
}

const props = defineProps<Props>()

// Emits 定义
const emit = defineEmits<{
  close: []
}>()

// 优先级配置
const priorityConfig = {
  low: { label: '低', class: 'priority-low' },
  medium: { label: '中', class: 'priority-medium' },
  high: { label: '高', class: 'priority-high' }
}

// 格式化截止日期
const formattedDueDate = computed(() => {
  if (!props.todo?.dueDate) return '未设置'
  return formatDateLocale(new Date(props.todo.dueDate))
})

// 格式化创建时间
const formattedCreatedAt = computed(() => {
  if (!props.todo?.createdAt) return ''
  const date = new Date(props.todo.createdAt)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

// 关闭弹窗
function handleClose() {
  emit('close')
}

// 点击遮罩层关闭
function handleOverlayClick() {
  handleClose()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleOverlayClick">
        <div class="detail-modal fluent-card" @keydown.escape="handleClose">
          <!-- 头部 -->
          <div class="modal-header">
            <h3>待办详情</h3>
            <button class="close-btn" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 内容区域 -->
          <div v-if="todo" class="modal-body">
            <!-- 标题 -->
            <div class="detail-item">
              <span class="detail-label">标题</span>
              <span class="detail-value title-value">{{ todo.title }}</span>
            </div>

            <!-- 完成状态 -->
            <div class="detail-item">
              <span class="detail-label">状态</span>
              <span :class="['status-badge', todo.completed ? 'completed' : 'pending']">
                {{ todo.completed ? '已完成' : '未完成' }}
              </span>
            </div>

            <!-- 优先级 -->
            <div class="detail-item">
              <span class="detail-label">优先级</span>
              <span :class="['priority-badge', priorityConfig[todo.priority].class]">
                {{ priorityConfig[todo.priority].label }}
              </span>
            </div>

            <!-- 截止日期 -->
            <div class="detail-item">
              <span class="detail-label">截止日期</span>
              <span class="detail-value">{{ formattedDueDate }}</span>
            </div>

            <!-- 描述 -->
            <div v-if="todo.description" class="detail-item">
              <span class="detail-label">描述</span>
              <span class="detail-value description-value">{{ todo.description }}</span>
            </div>

            <!-- 创建时间 -->
            <div class="detail-item">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ formattedCreatedAt }}</span>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="modal-footer">
            <button class="fluent-button" @click="handleClose">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal Overlay */
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

/* Detail Modal */
.detail-modal {
  width: 440px;
  max-width: 90vw;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* Modal Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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

/* Modal Body */
.modal-body {
  padding: 24px;
}

/* Detail Item */
.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 15px;
  color: var(--text-primary);
  line-height: 1.5;
}

.title-value {
  font-size: 18px;
  font-weight: 600;
}

.description-value {
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bg-tertiary);
  padding: 12px;
  border-radius: var(--radius-md);
  margin-top: 4px;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
}

.status-badge.completed {
  background: #dcfce7;
  color: #16a34a;
}

.status-badge.pending {
  background: #fef3c7;
  color: #d97706;
}

/* Priority Badge */
.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
}

.priority-low {
  background: #e2e8f0;
  color: #475569;
}

.priority-medium {
  background: #fef3c7;
  color: #d97706;
}

.priority-high {
  background: #fee2e2;
  color: #dc2626;
}

/* Modal Footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 24px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* Fluent Button */
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-button:hover {
  background: var(--bg-hover);
}

.fluent-button:active {
  transform: scale(0.98);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .detail-modal,
.modal-leave-active .detail-modal {
  transition: transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease;
}

.modal-enter-from .detail-modal {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .detail-modal {
  opacity: 0;
  transform: scale(0.95);
}
</style>
