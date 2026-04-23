<template>
  <!-- 弹出窗口：只渲染独立视图 -->
  <template v-if="isPopupWindow">
    <router-view />
  </template>

  <!-- 主窗口：完整布局 -->
  <template v-else>
  <!-- 顶部拖动区域 -->
  <div class="titlebar" data-tauri-drag-region></div>

  <div class="app-container">
    <!-- Sidebar - Fluent Design -->
    <aside class="sidebar fluent-card">
      <div class="logo">
        <div class="logo-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="18" rx="3" fill="var(--accent-color)"/>
            <path d="M3 10H21" stroke="white" stroke-width="2"/>
            <path d="M8 3V6" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M16 3V6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="logo-text">小河日历</span>
      </div>

      <nav class="nav-menu">
        <router-link to="/" class="nav-item" :class="{ active: $route.path === '/' }">
          <span class="nav-icon">🏠</span>
          <span>首页</span>
        </router-link>
        <router-link to="/calendar" class="nav-item" :class="{ active: $route.path === '/calendar' }">
          <span class="nav-icon">📆</span>
          <span>日历</span>
        </router-link>
        <router-link to="/todos" class="nav-item" :class="{ active: $route.path === '/todos' }">
          <span class="nav-icon">✅</span>
          <span>待办</span>
        </router-link>
        <router-link to="/schedules" class="nav-item" :class="{ active: $route.path === '/schedules' }">
          <span class="nav-icon">📋</span>
          <span>日程</span>
        </router-link>
        <router-link to="/settings" class="nav-item" :class="{ active: $route.path === '/settings' }">
          <span class="nav-icon">⚙️</span>
          <span>设置</span>
        </router-link>
      </nav>

      <!-- Mini Calendar -->
      <div class="mini-calendar">
        <MiniCalendar />
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>

  <!-- 提醒弹窗组件 -->
  <ReminderPopup />
  </template>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch, provide, ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useRouter } from 'vue-router'
import { useSettingsStore } from './stores/settings'
import { useCalendarStore } from './stores/calendar'
import MiniCalendar from './components/calendar/MiniCalendar.vue'
import ReminderPopup from './components/reminder/ReminderPopup.vue'
import { checkAndInstallUpdate } from './services/updater'
import { startReminderService, stopReminderService, onReminderPopup, offReminderPopup, handleSnoozeReminder } from './services/reminder'
import { isTauri, enableClockHook, setClockHookBlockPopup } from './utils/tauri'
import { initWindowToggleListener } from './composables/useWindowToggle'
import type { CalendarEvent, Todo, PopupNavigationPayload } from './types'

const settingsStore = useSettingsStore()
const calendarStore = useCalendarStore()
const router = useRouter()

// 检测当前是否为弹出窗口
const isPopupWindow = getCurrentWindow().label === 'calendar-popup'

// popup-navigate 事件监听器取消函数
const unlistenPopupNavigate = ref<UnlistenFn | null>(null)

// ==================== 调试页面触发逻辑 ====================
const debugInputBuffer = ref('')
const debugInputTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 处理选中变化事件
function handleSelectionChange() {
  const selection = window.getSelection()
  if (selection && selection.toString().includes('小河日历')) {
    // 选中了包含"小河日历"的文字，准备接收输入
    debugInputBuffer.value = ''
  }
}

// 处理键盘输入
function handleKeyDown(event: KeyboardEvent) {
  // 只处理字母键
  if (event.key.length === 1 && /[a-zA-Z]/.test(event.key)) {
    const selection = window.getSelection()
    // 检查是否有选中包含"小河日历"的文字
    if (selection && selection.toString().includes('小河日历')) {
      // 添加到缓冲区
      debugInputBuffer.value += event.key.toLowerCase()
      
      // 清除之前的定时器
      if (debugInputTimer.value) {
        clearTimeout(debugInputTimer.value)
      }
      
      // 设置超时清空缓冲区（2秒无输入则重置）
      debugInputTimer.value = setTimeout(() => {
        debugInputBuffer.value = ''
      }, 2000)
      
      // 检查是否输入了 "debug"
      if (debugInputBuffer.value === 'debug') {
        debugInputBuffer.value = ''
        router.push('/debug')
      }
    }
  }
}

// 提醒事件总线
const reminderBus = {
  on: (callback: (data: {
    id: string
    type: 'event' | 'todo'
    title: string
    body: string
    triggerTime: number
    itemId: string
    itemData: CalendarEvent | Todo
  }) => void) => {
    onReminderPopup(callback)
  },
  off: (callback: (data: {
    id: string
    type: 'event' | 'todo'
    title: string
    body: string
    triggerTime: number
    itemId: string
    itemData: CalendarEvent | Todo
  }) => void) => {
    offReminderPopup(callback)
  }
}

// 提供事件总线给子组件
provide('reminderBus', reminderBus)

// 处理稍后提醒事件
function handleSnoozeEvent(event: CustomEvent) {
  const { itemId, snoozeTime } = event.detail
  handleSnoozeReminder(itemId, snoozeTime)
}

// 处理弹出窗口导航事件
async function handlePopupNavigate(payload: PopupNavigationPayload) {
  try {
    // 显示并聚焦主窗口
    const mainWindow = await WebviewWindow.getByLabel('main')
    if (mainWindow) {
      await mainWindow.show()
      await mainWindow.setFocus()
    }
    
    // 根据动作类型处理
    switch (payload.action) {
      case 'createEvent':
        // 切换到日历页，创建事件（预填日期）
        await router.push('/calendar')
        // TODO: 打开事件创建弹窗，预填日期
        break
      case 'viewEvents':
        // 切换到日历页，定位到该日
        await router.push('/calendar')
        // TODO: 切换到日视图，定位到该日期
        break
      case 'viewEventDetail':
        // 切换到日历页，打开事件详情
        await router.push('/calendar')
        // TODO: 打开事件详情弹窗
        break
      case 'createTodo':
        // 切换到待办页，创建待办
        await router.push('/todos')
        // TODO: 打开待办创建弹窗，预填日期
        break
      case 'viewTodos':
        // 切换到待办页，查看当日截止待办
        await router.push('/todos')
        // TODO: 过滤当日截止待办
        break
      case 'openMain':
        // 仅打开主窗口
        await router.push('/')
        break
    }
  } catch (error) {
    console.error('[App] 处理弹出窗口导航失败:', error)
  }
}

onMounted(async () => {
  // 获取窗口标签
  const windowLabel = getCurrentWindow().label
  
  // 弹出窗口只做最小化初始化
  if (windowLabel === 'calendar-popup') {
    calendarStore.initialize()
    applyTheme()
    return
  }
  
  // 主窗口初始化 - 优先渲染界面，后台加载非关键数据
  
  // 1. 立即应用主题（同步操作，快速完成）
  applyTheme()
  
  // 2. 启动核心数据加载（不等待完成，让界面先渲染）
  calendarStore.initialize()
  
  // 3. 异步加载非关键功能（不阻塞界面渲染）
  setTimeout(() => {
    // 启动提醒服务
    startReminderService()
    
    // 检查更新（后台进行，不影响启动速度）
    checkForUpdatesOnStartup()
    
    // 初始化窗口切换事件监听
    if (isTauri()) {
      initWindowToggleListener()
    }
    
    // 根据设置决定是否启用时钟 Hook
    if (isTauri() && settingsStore.settings.clockHookEnabled) {
      enableClockHook().then(async () => {
        await setClockHookBlockPopup(settingsStore.settings.clockHookBlockPopup)
      }).catch((e) => {
        console.error('时钟点击检测功能启动失败:', e)
        settingsStore.updateSettings({ clockHookEnabled: false })
      })
    }
  }, 100) // 延迟 100ms，让界面先渲染

  // 监听稍后提醒事件
  window.addEventListener('reminder-snooze', handleSnoozeEvent as EventListener)

  // 监听弹出窗口导航事件（不阻塞）
  if (isTauri()) {
    listen<PopupNavigationPayload>('popup-navigate', (event) => {
      handlePopupNavigate(event.payload)
    }).then((unlisten) => {
      unlistenPopupNavigate.value = unlisten
    })
  }

  // 添加调试页面触发监听器（全局）
  document.addEventListener('selectionchange', handleSelectionChange)
  document.addEventListener('keydown', handleKeyDown)
})

// 应用关闭时清理定时器
onUnmounted(() => {
  stopReminderService()
  // 移除事件监听
  window.removeEventListener('reminder-snooze', handleSnoozeEvent as EventListener)
  // 取消 popup-navigate 事件监听
  if (unlistenPopupNavigate.value) {
    unlistenPopupNavigate.value()
  }
  // 移除调试页面触发监听器
  document.removeEventListener('selectionchange', handleSelectionChange)
  document.removeEventListener('keydown', handleKeyDown)
  // 清除输入缓冲定时器
  if (debugInputTimer.value) {
    clearTimeout(debugInputTimer.value)
  }
})

// 应用主题到 :root
function applyTheme() {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  
  if (settingsStore.settings.theme === 'dark') {
    root.classList.add('dark')
  } else if (settingsStore.settings.theme === 'light') {
    root.classList.add('light')
  }
  // 'auto' 模式依赖 CSS 媒体查询
}

// 监听主题设置变化
watch(() => settingsStore.settings.theme, applyTheme)

// 启动时检查更新
async function checkForUpdatesOnStartup() {
  if (isTauri() && settingsStore.settings.autoUpdate) {
    try {
      await checkAndInstallUpdate(true)
    } catch (error) {
      console.error('自动更新检查失败:', error)
    }
  }
}
</script>

<style scoped>
/* 顶部拖动区域 - 不影响布局的透明覆盖层 */
.titlebar {
  height: 24px;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  background: transparent;
  cursor: grab;
  transition: background var(--transition-fast);
}

.titlebar:hover {
  background: rgba(0, 0, 0, 0.05);
}

.titlebar:active {
  cursor: grabbing;
  background: rgba(0, 0, 0, 0.08);
}

.app-container {
  display: flex;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.sidebar {
  width: 260px;
  margin: 12px;
  margin-right: 0;
  padding: 16px;
  display: flex;
  flex-direction: column;
  /* Fluent Design - Subtle shadow */
  box-shadow: var(--shadow-sm);
  /* Acrylic-like effect */
  backdrop-filter: blur(30px) saturate(180%);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 20px;
}

.logo-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.3px;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-decoration: none;
  transition: all var(--transition-fast);
  font-weight: 500;
}

.nav-item:hover {
  background: var(--bg-hover);
}

.nav-item.active {
  background: var(--accent-color);
  color: white;
  box-shadow: 0 2px 4px rgba(0, 120, 212, 0.3);
}

.nav-icon {
  font-size: 18px;
}

.mini-calendar {
  margin-top: auto;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
}

.main-content {
  flex: 1;
  overflow: auto;
  padding: 12px;
  padding-left: 0;
}

/* Page transitions - Fluent smooth */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-smooth), transform var(--transition-smooth);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>