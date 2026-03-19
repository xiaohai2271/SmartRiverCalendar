<template>
  <div class="home-view">
    <div class="welcome-section">
      <h1>欢迎使用小河日历</h1>
      <p>掌控时间，让生活更有节奏</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-info">
          <div class="stat-value">{{ todayEvents.length }}</div>
          <div class="stat-label">今日事件</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-info">
          <div class="stat-value">{{ pendingTodos }}</div>
          <div class="stat-label">待办事项</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏰</div>
        <div class="stat-info">
          <div class="stat-value">{{ weekEvents }}</div>
          <div class="stat-label">本周事件</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📆</div>
        <div class="stat-info">
          <div class="stat-value">{{ monthEvents }}</div>
          <div class="stat-label">本月事件</div>
        </div>
      </div>
    </div>

    <div class="quick-actions">
      <h2>快捷操作</h2>
      <div class="action-buttons">
        <button class="action-btn primary" @click="$router.push('/calendar')">
          <span>📅</span> 查看日历
        </button>
        <button class="action-btn" @click="$router.push('/todos')">
          <span>✅</span> 管理待办
        </button>
        <button class="action-btn" @click="$router.push('/settings')">
          <span>⚙️</span> 系统设置
        </button>
      </div>
    </div>

    <div class="upcoming-section">
      <h2>即将到来</h2>
      <div class="upcoming-list">
        <div v-for="event in upcomingEvents" :key="event.id" class="upcoming-item">
          <div class="event-color" :style="{ background: getCalendarColor(event.calendarId) }"></div>
          <div class="event-info">
            <div class="event-title">{{ event.title }}</div>
            <div class="event-time">{{ formatEventTime(event) }}</div>
          </div>
        </div>
        <div v-if="upcomingEvents.length === 0" class="empty-state">
          暂无即将到来的事件
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import { isSameDay, formatDateTime } from '../utils/date'
import type { CalendarEvent } from '../types'

const calendarStore = useCalendarStore()

const todayEvents = computed(() => {
  const today = new Date()
  return calendarStore.events.filter(e => isSameDay(new Date(e.startTime), today))
})

const pendingTodos = computed(() => 0) // TODO: Implement todo store

const weekEvents = computed(() => {
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return calendarStore.events.filter(e => {
    const eventDate = new Date(e.startTime)
    return eventDate >= now && eventDate <= weekLater
  }).length
})

const monthEvents = computed(() => {
  const now = new Date()
  const monthLater = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
  return calendarStore.events.filter(e => {
    const eventDate = new Date(e.startTime)
    return eventDate >= now && eventDate <= monthLater
  }).length
})

const upcomingEvents = computed(() => {
  const now = Date.now()
  return calendarStore.events
    .filter(e => e.startTime > now)
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 5)
})

function getCalendarColor(calendarId: string): string {
  const calendar = calendarStore.calendars.find(c => c.id === calendarId)
  return calendar?.color || '#4A90D9'
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return '全天事件'
  }
  return formatDateTime(new Date(event.startTime))
}
</script>

<style scoped>
.home-view {
  max-width: 900px;
  margin: 0 auto;
}

.welcome-section {
  text-align: center;
  padding: 40px 0;
}

.welcome-section h1 {
  font-size: 32px;
  margin-bottom: 8px;
}

.welcome-section p {
  color: var(--text-secondary);
  font-size: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.stat-icon {
  font-size: 32px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 14px;
}

.quick-actions {
  margin-bottom: 32px;
}

.quick-actions h2 {
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-hover);
}

.action-btn.primary {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.action-btn.primary:hover {
  opacity: 0.9;
}

.upcoming-section h2 {
  margin-bottom: 16px;
}

.upcoming-list {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}

.upcoming-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.upcoming-item:last-child {
  border-bottom: none;
}

.event-color {
  width: 4px;
  height: 40px;
  border-radius: 2px;
}

.event-title {
  font-weight: 500;
}

.event-time {
  color: var(--text-secondary);
  font-size: 13px;
  margin-top: 4px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>