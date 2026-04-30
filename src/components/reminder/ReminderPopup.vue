<template>
  <Transition name="popup">
    <div
      v-if="reminder"
      class="reminder-popup"
      :class="{ 'is-todo': reminder.type === 'todo' }"
    >
      <!-- 弹窗头部 -->
      <div class="popup-header">
        <div class="popup-icon">
          <span v-if="reminder.type === 'event'">📅</span>
          <span v-else>✅</span>
        </div>
        <div class="popup-title-section">
          <div class="popup-title">{{ reminder.title }}</div>
          <div class="popup-time">{{ formatTime(reminder.triggerTime) }}</div>
        </div>
        <button
          v-if="actualShowCloseButton"
          class="popup-close"
          @click="dismissReminder"
          title="关闭"
        >
          ✕
        </button>
      </div>

      <!-- 弹窗内容 -->
      <div class="popup-body">
        <div class="popup-description" v-if="reminder.body">
          {{ reminder.body }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="popup-actions">
        <button class="popup-btn btn-snooze" @click="snoozeReminder">
          <span class="btn-icon">⏰</span>
          <span>稍后提醒</span>
        </button>
        <button
          v-if="reminder.type === 'todo'"
          class="popup-btn btn-complete"
          @click="completeTodo"
        >
          <span class="btn-icon">✓</span>
          <span>标记完成</span>
        </button>
        <button class="popup-btn btn-view" @click="viewDetails">
          <span class="btn-icon">👁</span>
          <span>查看详情</span>
        </button>
      </div>

      <!-- 自动消失进度条 -->
      <div class="popup-progress">
        <div
          class="progress-bar"
          :style="{ width: `${progressWidth}%` }"
        ></div>
      </div>
    </div>
  </Transition>
  <!-- 提示消息 -->
  <Transition name="toast">
    <div v-if="toastVisible" class="reminder-toast">
      {{ toastMessage }}
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTodoStore } from '../../stores/todo'
import { markReminderAsViewed } from '../../services/reminder'
import type { CalendarEvent, Todo } from '../../types'

// 提醒数据接口
export interface ReminderPopupData {
  id: string
  type: 'event' | 'todo'
  title: string
  body: string
  triggerTime: number
  itemId: string
  itemData: CalendarEvent | Todo
  createdAt: number
}

// 提醒强度类型
type ReminderMode = 'standard' | 'strong' | 'silent'

// 默认显示时长配置（毫秒）
const DEFAULT_DURATIONS: Record<ReminderMode, number> = {
  standard: 10000, // 10秒
  strong: 30000,   // 30秒
  silent: 5000     // 5秒
}

// 默认关闭按钮显示配置
const DEFAULT_SHOW_CLOSE_BUTTON: Record<ReminderMode, boolean> = {
  standard: true,
  strong: true,
  silent: false
}

// Props 定义
interface Props {
  reminder: ReminderPopupData | null
  duration?: number
  showCloseButton?: boolean
  reminderMode?: ReminderMode
}

const props = withDefaults(defineProps<Props>(), {
  duration: undefined,
  showCloseButton: undefined,
  reminderMode: 'standard'
})

// Emits 定义
const emit = defineEmits<{
  dismiss: []
  snooze: [snoozeTime: number]
  complete: []
  view: []
}>()

// 提示消息状态
const toastMessage = ref('')
const toastVisible = ref(false)

// 进度条相关
const progressWidth = ref(100)
let progressInterval: ReturnType<typeof setInterval> | null = null
let autoDismissTimeout: ReturnType<typeof setTimeout> | null = null

// 路由和 store
const router = useRouter()
const todoStore = useTodoStore()

// 稍后提醒时间（毫秒）- 统一使用5分钟
const SNOOZE_DURATION = 5 * 60 * 1000

// 计算实际显示时长
const actualDuration = computed(() => {
  if (props.duration !== undefined) {
    return props.duration
  }
  return DEFAULT_DURATIONS[props.reminderMode]
})

// 计算是否显示关闭按钮
const actualShowCloseButton = computed(() => {
  if (props.showCloseButton !== undefined) {
    return props.showCloseButton
  }
  return DEFAULT_SHOW_CLOSE_BUTTON[props.reminderMode]
})

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 启动自动消失定时器
function startAutoDismiss() {
  // 清除之前的定时器
  clearTimers()

  const duration = actualDuration.value
  const startTime = Date.now()

  // 设置进度条更新定时器
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime
    const remaining = Math.max(0, duration - elapsed)
    progressWidth.value = (remaining / duration) * 100
  }, 100)

  // 设置自动消失定时器
  autoDismissTimeout = setTimeout(() => {
    dismissReminder()
  }, duration)
}

// 清除定时器
function clearTimers() {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }
  if (autoDismissTimeout) {
    clearTimeout(autoDismissTimeout)
    autoDismissTimeout = null
  }
}

// 关闭提醒
function dismissReminder() {
  clearTimers()
  emit('dismiss')
}

// 显示提示消息
function showToast(message: string, duration: number = 2000) {
  toastMessage.value = message
  toastVisible.value = true

  // 自动隐藏提示
  setTimeout(() => {
    toastVisible.value = false
  }, duration)
}

// 稍后提醒
function snoozeReminder() {
  // 先清除自动消失定时器，防止定时器触发 dismiss
  clearTimers()

  const snoozeTime = Date.now() + SNOOZE_DURATION

  // 显示提示消息
  showToast('5分钟后再提醒')

  // 只发出 snooze 事件，不调用 dismissReminder()
  // 由 ReminderPopupView 的 handleSnooze 控制窗口隐藏
  emit('snooze', snoozeTime)
}

// 标记待办完成
async function completeTodo() {
  if (props.reminder?.type === 'todo') {
    try {
      await todoStore.toggleTodo(props.reminder.itemId)
    } catch (error) {
      console.error('标记待办完成失败:', error)
    }
  }

  emit('complete')
  // 关闭弹窗
  dismissReminder()
}

// 查看详情
function viewDetails() {
  if (!props.reminder) return

  // 标记为已查看，防止在有效期内重复提醒
  markReminderAsViewed(props.reminder.itemId)

  emit('view')

  if (props.reminder.type === 'event') {
    // 导航到日历视图，显示事件详情
    router.push({
      path: '/calendar',
      query: { eventId: props.reminder.itemId }
    })
  } else {
    // 导航到待办视图
    router.push({
      path: '/todos',
      query: { todoId: props.reminder.itemId }
    })
  }

  // 关闭弹窗
  dismissReminder()
}

// 组件挂载时启动定时器
onMounted(() => {
  if (props.reminder) {
    startAutoDismiss()
  }
})

// 组件卸载时清理
onUnmounted(() => {
  clearTimers()
})
</script>

<style scoped>
/* 弹窗样式 - 适配独立窗口（320x160） */
.reminder-popup {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  pointer-events: auto;
  position: relative;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 待办类型弹窗的特殊样式 */
.reminder-popup.is-todo {
  border-left: 4px solid var(--accent-color);
}

/* 弹窗头部 */
.popup-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 6px;
  flex-shrink: 0;
}

.popup-icon {
  font-size: 20px;
  flex-shrink: 0;
  line-height: 1;
}

.popup-title-section {
  flex: 1;
  min-width: 0;
}

.popup-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popup-time {
  font-size: 11px;
  color: var(--text-tertiary);
}

.popup-close {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  font-size: 14px;
  line-height: 1;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.popup-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* 弹窗内容 */
.popup-body {
  padding: 0 12px 6px;
  flex: 1;
  overflow: hidden;
}

.popup-description {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
  word-break: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 操作按钮 - 始终水平排列 */
.popup-actions {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.popup-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.popup-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-color);
}

.popup-btn:active {
  transform: scale(0.98);
}

.btn-icon {
  font-size: 12px;
}

/* 稍后提醒按钮 */
.btn-snooze:hover {
  background: var(--warning-light);
  border-color: var(--warning-color);
  color: var(--warning-text);
}

/* 标记完成按钮 */
.btn-complete:hover {
  background: var(--success-light);
  border-color: var(--success-color);
  color: var(--success-text);
}

/* 查看详情按钮 */
.btn-view:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* 自动消失进度条 */
.popup-progress {
  height: 3px;
  background: var(--bg-tertiary);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), #50e6ff);
  transition: width 0.1s linear;
  position: absolute;
  top: 0;
  left: 0;
}

/* 弹窗动画 - 滑入/滑出 */
.popup-enter-active {
  animation: popup-enter 0.3s ease-out;
}

.popup-leave-active {
  animation: popup-leave 0.2s ease-in;
}

@keyframes popup-enter {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes popup-leave {
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
}

/* 提示消息 */
.reminder-toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 20px;
  box-shadow: var(--shadow-lg);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  z-index: 10001;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

/* 提示消息动画 */
.toast-enter-active {
  animation: toast-enter 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-leave 0.2s ease-in;
}

@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toast-leave {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
  }
}
</style>
