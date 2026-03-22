<template>
  <Teleport to="body">
    <TransitionGroup name="popup" tag="div" class="reminder-popup-container">
      <div
        v-for="reminder in activeReminders"
        :key="reminder.id"
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
          <button class="popup-close" @click="dismissReminder(reminder.id)" title="关闭">
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
          <button class="popup-btn btn-snooze" @click="snoozeReminder(reminder)">
            <span class="btn-icon">⏰</span>
            <span>稍后提醒</span>
          </button>
          <button
            v-if="reminder.type === 'todo'"
            class="popup-btn btn-complete"
            @click="completeTodo(reminder)"
          >
            <span class="btn-icon">✓</span>
            <span>标记完成</span>
          </button>
          <button class="popup-btn btn-view" @click="viewDetails(reminder)">
            <span class="btn-icon">👁</span>
            <span>查看详情</span>
          </button>
        </div>

        <!-- 自动消失进度条 -->
        <div class="popup-progress">
          <div
            class="progress-bar"
            :style="{ width: `${getProgressWidth(reminder)}%` }"
          ></div>
        </div>
      </div>
    </TransitionGroup>
    <!-- 提示消息 -->
    <Transition name="toast">
      <div v-if="toastVisible" class="reminder-toast">
        {{ toastMessage }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useTodoStore } from '../../stores/todo'
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

// 自动消失时间（毫秒）
const AUTO_DISMISS_TIMEOUT = 10000

// 稍后提醒时间（毫秒）
const SNOOZE_DURATION = 5 * 60 * 1000

// 活跃的提醒列表
const activeReminders = ref<ReminderPopupData[]>([])

// 提示消息状态
const toastMessage = ref('')
const toastVisible = ref(false)

// 进度条定时器
const progressIntervals = new Map<string, ReturnType<typeof setInterval>>()

// 路由和 store
const router = useRouter()
const todoStore = useTodoStore()

// 注入提醒事件总线
const reminderBus = inject<{
  on: (callback: (data: ReminderPopupData) => void) => void
  off: (callback: (data: ReminderPopupData) => void) => void
}>('reminderBus')

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 获取进度条宽度
function getProgressWidth(reminder: ReminderPopupData): number {
  const elapsed = Date.now() - reminder.createdAt
  const remaining = Math.max(0, AUTO_DISMISS_TIMEOUT - elapsed)
  return (remaining / AUTO_DISMISS_TIMEOUT) * 100
}

// 添加提醒
function addReminder(data: ReminderPopupData) {
  // 检查是否已存在相同提醒
  const existingIndex = activeReminders.value.findIndex(r => r.id === data.id)
  if (existingIndex !== -1) {
    return
  }

  // 添加到列表
  activeReminders.value.push(data)

  // 设置自动消失定时器
  const timeoutId = setTimeout(() => {
    dismissReminder(data.id)
  }, AUTO_DISMISS_TIMEOUT)

  // 设置进度条更新定时器
  const progressInterval = setInterval(() => {
    // 触发响应式更新
    const index = activeReminders.value.findIndex(r => r.id === data.id)
    if (index !== -1) {
      activeReminders.value[index] = { ...activeReminders.value[index] }
    }
  }, 100)

  progressIntervals.set(data.id, progressInterval)

  // 存储 timeoutId 用于清理
  ;(data as any)._timeoutId = timeoutId
}

// 关闭提醒
function dismissReminder(id: string) {
  const index = activeReminders.value.findIndex(r => r.id === id)
  if (index !== -1) {
    // 清理定时器
    const reminder = activeReminders.value[index]
    if ((reminder as any)._timeoutId) {
      clearTimeout((reminder as any)._timeoutId)
    }

    // 清理进度条定时器
    const progressInterval = progressIntervals.get(id)
    if (progressInterval) {
      clearInterval(progressInterval)
      progressIntervals.delete(id)
    }

    // 从列表中移除
    activeReminders.value.splice(index, 1)
  }
}

// 稍后提醒
function snoozeReminder(reminder: ReminderPopupData) {
  // 发出自定义事件，通知 reminder.ts 稍后提醒
  const snoozeEvent = new CustomEvent('reminder-snooze', {
    detail: {
      itemId: reminder.itemId,
      type: reminder.type,
      snoozeTime: Date.now() + SNOOZE_DURATION
    }
  })
  window.dispatchEvent(snoozeEvent)

  // 显示提示消息
  const snoozeMinutes = SNOOZE_DURATION / 60000
  toastMessage.value = `${snoozeMinutes}分钟后再提醒`
  toastVisible.value = true

  // 延迟关闭弹窗，让用户看到提示
  setTimeout(() => {
    toastVisible.value = false
    dismissReminder(reminder.id)
  }, 2000)
}

// 标记待办完成
async function completeTodo(reminder: ReminderPopupData) {
  if (reminder.type === 'todo') {
    try {
      await todoStore.toggleTodo(reminder.itemId)
      console.log('待办已标记完成:', reminder.title)
    } catch (error) {
      console.error('标记待办完成失败:', error)
    }
  }

  // 关闭弹窗
  dismissReminder(reminder.id)
}

// 查看详情
function viewDetails(reminder: ReminderPopupData) {
  if (reminder.type === 'event') {
    // 导航到日历视图，显示事件详情
    router.push({
      path: '/calendar',
      query: { eventId: reminder.itemId }
    })
  } else {
    // 导航到待办视图
    router.push({
      path: '/todos',
      query: { todoId: reminder.itemId }
    })
  }

  // 关闭弹窗
  dismissReminder(reminder.id)
}

// 处理提醒事件
function handleReminderEvent(data: ReminderPopupData) {
  addReminder(data)
}

// 组件挂载时注册事件监听
onMounted(() => {
  if (reminderBus) {
    reminderBus.on(handleReminderEvent)
  }
})

// 组件卸载时清理
onUnmounted(() => {
  if (reminderBus) {
    reminderBus.off(handleReminderEvent)
  }

  // 清理所有定时器
  activeReminders.value.forEach(reminder => {
    if ((reminder as any)._timeoutId) {
      clearTimeout((reminder as any)._timeoutId)
    }
  })

  progressIntervals.forEach(interval => {
    clearInterval(interval)
  })
  progressIntervals.clear()
})

// 暴露方法供外部调用
defineExpose({
  addReminder,
  dismissReminder
})
</script>

<style scoped>
/* 提醒弹窗容器 */
.reminder-popup-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10000;
  display: flex;
  flex-direction: column-reverse;
  gap: 12px;
  max-width: 380px;
  width: 100%;
  pointer-events: none;
}

/* 单个提醒弹窗 */
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
}

/* 待办类型弹窗的特殊样式 */
.reminder-popup.is-todo {
  border-left: 4px solid var(--accent-color);
}

/* 弹窗头部 */
.popup-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 16px 12px;
}

.popup-icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
}

.popup-title-section {
  flex: 1;
  min-width: 0;
}

.popup-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 4px;
  word-break: break-word;
}

.popup-time {
  font-size: 12px;
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
  padding: 0 16px 12px;
}

.popup-description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  word-break: break-word;
}

/* 操作按钮 */
.popup-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.popup-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 12px;
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
  font-size: 14px;
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
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color), #50e6ff);
  transition: width 0.1s linear;
  position: absolute;
  top: 0;
  left: 0;
}

/* 弹窗动画 */
.popup-enter-active {
  animation: popup-enter 0.3s ease-out;
}

.popup-leave-active {
  animation: popup-leave 0.2s ease-in;
}

.popup-move {
  transition: transform 0.3s ease;
}

@keyframes popup-enter {
  from {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes popup-leave {
  from {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(100%) scale(0.9);
  }
}

/* 提示消息 */
.reminder-toast {
  position: fixed;
  bottom: 100px;
  right: 20px;
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
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes toast-leave {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}

/* 响应式适配 */
@media (max-width: 480px) {
  .reminder-popup-container {
    bottom: 10px;
    right: 10px;
    left: 10px;
    max-width: none;
  }

  .popup-actions {
    flex-wrap: wrap;
  }

  .popup-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
  }

  .popup-btn:last-child {
    flex: 1 1 100%;
  }
}
</style>
