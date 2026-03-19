<template>
  <div class="app-container" :class="{ 'dark': isDark }">
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from './stores/settings'
import MiniCalendar from './components/calendar/MiniCalendar.vue'

const settingsStore = useSettingsStore()

const isDark = computed(() => {
  if (settingsStore.settings.theme === 'dark') return true
  if (settingsStore.settings.theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
})
</script>

<style scoped>
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