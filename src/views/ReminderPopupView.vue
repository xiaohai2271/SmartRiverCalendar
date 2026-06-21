<script setup lang="ts">
/**
 * ReminderPopupView - 提醒弹窗独立窗口视图
 * 用于独立窗口显示单个提醒
 *
 * 功能：
 * - 接收来自主窗口的提醒事件
 * - 显示 ReminderPopup 组件
 * - 处理用户操作（稍后提醒、标记完成、查看详情）
 * - 发送事件回主窗口
 *
 * 路由路径: /reminder-popup
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { onSettingsChange } from '@/utils/broadcast'
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, emit as tauriEmit } from '@tauri-apps/api/event'
import { useSettingsStore } from '@/stores/settings'
import { usePlatform } from '@/platform/provider'
import { positionReminderWindow } from '@/composables/useReminderPopup'
import ReminderPopup from '@/components/reminder/ReminderPopup.vue'
import type { ReminderPopupData } from '@/components/reminder/ReminderPopup.vue'

// Store 实例
const settingsStore = useSettingsStore()

// ==================== 状态管理 ====================

// 当前显示的提醒数据
const currentReminder = ref<ReminderPopupData | null>(null)

// 是否已收到过提醒数据（用于控制空状态显示）
const hasReceivedReminder = ref(false)

// 事件监听器清理函数
let unlistenReminder: (() => void) | null = null

// 主题监听器清理函数
let unlistenSettings: (() => void) | null = null

// ==================== 主题同步 ====================

/**
 * 应用主题到弹窗根元素
 * 优先从数据库读取最新主题设置
 */
async function applyPopupTheme(theme?: 'light' | 'dark' | 'auto') {
  let targetTheme: 'light' | 'dark' | 'auto' | undefined = theme
  if (!targetTheme) {
    try {
      const { settingsRepo } = usePlatform()
      const appSettings = await settingsRepo.loadAppSettings()
      targetTheme = appSettings.theme
    } catch {
      targetTheme = settingsStore.settings.theme
    }
  }

  const root = document.documentElement
  root.classList.remove('dark', 'light')

  if (targetTheme === 'dark') {
    root.classList.add('dark')
  } else if (targetTheme === 'light') {
    root.classList.add('light')
  }
  // 'auto' 模式依赖 CSS 媒体查询，不添加额外 class

  // 同步更新 settingsStore（保持内存状态一致）
  if (targetTheme !== settingsStore.settings.theme) {
    settingsStore.settings.theme = targetTheme
  }
}

// ==================== 提醒事件处理 ====================

/**
 * 处理接收到的提醒数据
 */
function handleReminderReceived(reminder: ReminderPopupData) {
  console.log('[ReminderPopupView] 收到提醒:', reminder.title)
  currentReminder.value = reminder
  hasReceivedReminder.value = true
}

// ==================== 用户操作处理 ====================

/**
 * 关闭提醒
 */
async function handleDismiss() {
  console.log('[ReminderPopupView] 关闭提醒')

  // 发送事件到主窗口
  await tauriEmit('reminder-action', {
    action: 'dismiss',
    reminderId: currentReminder.value?.id
  })

  // 隐藏窗口
  const window = getCurrentWebviewWindow()
  await window.hide()

  // 清空当前提醒
  currentReminder.value = null
}

/**
 * 稍后提醒
 */
async function handleSnooze(snoozeTime: number) {
  console.log('[ReminderPopupView] 稍后提醒:', new Date(snoozeTime).toLocaleString())

  // 发送事件到主窗口（必须包含 itemId）
  await tauriEmit('reminder-action', {
    action: 'snooze',
    reminderId: currentReminder.value?.id,
    itemId: currentReminder.value?.itemId,
    type: currentReminder.value?.type,
    snoozeTime
  })

  // 隐藏窗口
  const window = getCurrentWebviewWindow()
  await window.hide()

  // 清空当前提醒
  currentReminder.value = null
}

/**
 * 标记完成（仅待办）
 */
async function handleComplete() {
  console.log('[ReminderPopupView] 标记完成')

  // 发送事件到主窗口
  await tauriEmit('reminder-action', {
    action: 'complete',
    reminderId: currentReminder.value?.id,
    itemId: currentReminder.value?.itemId,
    type: currentReminder.value?.type
  })

  // 隐藏窗口
  const window = getCurrentWebviewWindow()
  await window.hide()

  // 清空当前提醒
  currentReminder.value = null
}

/**
 * 查看详情
 */
async function handleView() {
  console.log('[ReminderPopupView] 查看详情')

  // 发送事件到主窗口，请求在主窗口显示详情
  await tauriEmit('reminder-action', {
    action: 'view',
    reminderId: currentReminder.value?.id,
    itemId: currentReminder.value?.itemId,
    type: currentReminder.value?.type
  })

  // 隐藏窗口
  const window = getCurrentWebviewWindow()
  await window.hide()

  // 清空当前提醒
  currentReminder.value = null
}

// ==================== 生命周期 ====================

onMounted(async () => {
  console.log('[ReminderPopupView] 视图挂载，当前窗口 label:', getCurrentWebviewWindow().label)

  // 应用初始主题
  await applyPopupTheme()

  // 监听主题变更广播（实时响应主窗口的设置修改）
  unlistenSettings = onSettingsChange((key, value) => {
    console.log('[ReminderPopupView] 收到设置变更广播:', key, '=', value)
    // 处理主题变更
    if (key === 'theme' && typeof value === 'string') {
      applyPopupTheme(value as 'light' | 'dark' | 'auto')
    }
  })

  // 监听来自主窗口的提醒事件（先注册监听器，避免遗漏事件）
  unlistenReminder = await listen<ReminderPopupData>('show-reminder', (event) => {
    handleReminderReceived(event.payload)
  })

  // 定位窗口到右下角（必须 await，确保定位完成）
  const reminderWindow = await WebviewWindow.getByLabel('reminder-popup')
  if (reminderWindow) {
    await positionReminderWindow(reminderWindow)
  }

  // 告知主窗口：提醒窗口已准备好接收事件（定位完成后再发送）
  await tauriEmit('reminder-window-ready')

  console.log('[ReminderPopupView] 已准备好接收提醒事件')
  
})

onUnmounted(() => {
  console.log('[ReminderPopupView] 视图卸载')

  // 清理事件监听器
  if (unlistenReminder) {
    unlistenReminder()
    unlistenReminder = null
  }

  // 清理主题监听器
  if (unlistenSettings) {
    unlistenSettings()
    unlistenSettings = null
  }
})
</script>

<template>
  <div class="reminder-popup-view">
    <!-- 未收到提醒数据前不显示任何内容 -->
    <div v-if="!hasReceivedReminder" class="waiting-state"></div>

    <!-- 空状态（提醒被关闭后） -->
    <div v-else-if="!currentReminder" class="empty-state">
      <span class="empty-icon">🔔</span>
      <span class="empty-text">暂无提醒</span>
    </div>

    <!-- 提醒弹窗组件 -->
    <div v-else class="reminder-container">
      <ReminderPopup
        :reminder="currentReminder"
        reminder-mode="strong"
        @dismiss="handleDismiss"
        @snooze="handleSnooze"
        @complete="handleComplete"
        @view="handleView"
      />
    </div>
  </div>
</template>

<style scoped>
.reminder-popup-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  overflow: hidden;
  position: relative;
}

.waiting-state {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  font-size: 13px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-secondary);
  padding: 40px;
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
}

.empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
  color: var(--text-tertiary);
}

.reminder-container {
  display: flex;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
}
</style>
