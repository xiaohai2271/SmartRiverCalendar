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
          <div class="stat-value">{{ todoStore.pendingTodos.length }}</div>
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

    <div class="content-grid">
      <!-- 待办事项 -->
      <div class="todos-section">
        <div class="section-header">
          <h2>近期待办</h2>
          <router-link to="/todos" class="view-all">查看全部 →</router-link>
        </div>
        <div class="todos-list">
          <div
            v-for="todo in upcomingTodos"
            :key="todo.id"
            class="todo-item"
            :class="{ overdue: isOverdue(todo) }"
          >
            <label class="checkbox-wrapper" @click.stop>
              <input
                type="checkbox"
                :checked="todo.completed"
                @change="todoStore.toggleTodo(todo.id)"
                class="todo-checkbox"
              />
              <span class="checkbox-custom"></span>
            </label>
            <div class="todo-content">
              <div class="todo-title">{{ todo.title }}</div>
              <div class="todo-due" v-if="todo.dueDate">
                <span class="due-icon">📅</span>
                {{ formatDueDate(todo.dueDate) }}
              </div>
            </div>
            <div class="todo-priority" :class="todo.priority">
              {{ priorityLabels[todo.priority] }}
            </div>
          </div>
          <div v-if="upcomingTodos.length === 0" class="empty-state">
            暂无待办事项
          </div>
        </div>
      </div>

      <!-- 即将到来的事件 -->
      <div class="events-section">
        <div class="section-header">
          <h2>即将到来</h2>
          <router-link to="/calendar" class="view-all">查看全部 →</router-link>
        </div>
        <div class="events-list">
          <div v-for="event in upcomingEvents" :key="event.id" class="event-item">
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { isSameDay, formatDateTime, formatDate } from '../utils/date'
import type { CalendarEvent, Todo } from '../types'

const calendarStore = useCalendarStore()
const todoStore = useTodoStore()

onMounted(() => {
  todoStore.initialize()
})

const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高'
}

const todayEvents = computed(() => {
  const today = new Date()
  return calendarStore.events.filter(e => isSameDay(new Date(e.startTime), today))
})

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

// 按截止日期排序的待办事项（未完成的，top 5）
const upcomingTodos = computed(() => {
  return todoStore.todos
    .filter(t => !t.completed)
    .sort((a, b) => {
      // 没有截止日期的排后面
      if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate - b.dueDate
    })
    .slice(0, 5)
})

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return todo.dueDate < today.getTime()
}

function formatDueDate(timestamp: number): string {
  const date = new Date(timestamp)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todoDate = new Date(date)
  todoDate.setHours(0, 0, 0, 0)

  if (todoDate.getTime() === today.getTime()) {
    return '今天'
  } else if (todoDate.getTime() === tomorrow.getTime()) {
    return '明天'
  } else if (todoDate.getTime() < today.getTime()) {
    return '已过期'
  } else {
    return formatDate(date)
  }
}

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
  padding: 24px;
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
  box-shadow: var(--shadow-sm);
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

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.view-all {
  font-size: 13px;
  color: var(--accent-color);
  text-decoration: none;
}

.view-all:hover {
  text-decoration: underline;
}

/* Todos Section */
.todos-list {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-item:hover {
  background: var(--bg-hover);
}

.todo-item.overdue {
  background: rgba(220, 38, 38, 0.05);
}

/* Custom Checkbox */
.checkbox-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.todo-checkbox {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.checkbox-custom {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-strong);
  border-radius: 5px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-custom::after {
  content: '';
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0);
  transition: transform var(--transition-fast);
}

.todo-checkbox:checked + .checkbox-custom {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.todo-checkbox:checked + .checkbox-custom::after {
  transform: rotate(45deg) scale(1);
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-weight: 500;
  font-size: 14px;
}

.todo-due {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.todo-item.overdue .todo-due {
  color: #dc2626;
}

.due-icon {
  font-size: 10px;
}

.todo-priority {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.todo-priority.low {
  background: #e2e8f0;
  color: #475569;
}

.todo-priority.medium {
  background: #fef3c7;
  color: #d97706;
}

.todo-priority.high {
  background: #fee2e2;
  color: #dc2626;
}

/* Events Section */
.events-list {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.event-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
}

.event-item:last-child {
  border-bottom: none;
}

.event-item:hover {
  background: var(--bg-hover);
}

.event-color {
  width: 4px;
  height: 36px;
  border-radius: 2px;
}

.event-info {
  flex: 1;
}

.event-title {
  font-weight: 500;
  font-size: 14px;
}

.event-time {
  color: var(--text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .content-grid {
    grid-template-columns: 1fr;
  }
}
</style>
