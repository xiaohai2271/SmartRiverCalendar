<template>
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

<script setup lang="ts">
import { onMounted, onUnmounted, watch, provide } from 'vue'
import { useSettingsStore } from './stores/settings'
import { useCalendarStore } from './stores/calendar'
import MiniCalendar from './components/calendar/MiniCalendar.vue'
import ReminderPopup from './components/reminder/ReminderPopup.vue'
import { checkAndInstallUpdate } from './services/updater'
import { startReminderService, stopReminderService, onReminderPopup, offReminderPopup, handleSnoozeReminder } from './services/reminder'
import { isTauri, enableClockHook, setClockHookBlockPopup } from './utils/tauri'
import { initWindowToggleListener } from './composables/useWindowToggle'
import type { CalendarEvent, Todo } from './types'

const settingsStore = useSettingsStore()
const calendarStore = useCalendarStore()

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

onMounted(() => {
  calendarStore.initialize()
  applyTheme()
  checkForUpdatesOnStartup()
  // 启动提醒服务
  startReminderService()

  // 监听稍后提醒事件
  window.addEventListener('reminder-snooze', handleSnoozeEvent as EventListener)

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
})

// 应用关闭时清理定时器
onUnmounted(() => {
  stopReminderService()
  // 移除事件监听
  window.removeEventListener('reminder-snooze', handleSnoozeEvent as EventListener)
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