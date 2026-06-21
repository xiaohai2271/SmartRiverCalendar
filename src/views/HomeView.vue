<template>
  <div class="home-view">
    <!-- 巨型 Hero 时间与当日核心面板 (TimeDisplay 内联 100% 宽度) -->
    <div class="hero-section">
      <TimeDisplay />
    </div>

    <!-- 4大核心统计格栅，替换 Emoji 并赋能 Hover 向上浮动与极光微阴影 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon-wrapper display-icon">
          <svg class="stat-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ todayEvents.length }}</div>
          <div class="stat-label">今日日程</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon-wrapper pending-icon">
          <svg class="stat-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            <path d="m9 14 2 2 4-4"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ todoStore.pendingTodos.length }}</div>
          <div class="stat-label">待办事项</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon-wrapper week-icon">
          <svg class="stat-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ weekEvents }}</div>
          <div class="stat-label">本周日程</div>
        </div>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon-wrapper month-icon">
          <svg class="stat-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
            <line x1="15" y1="3" x2="15" y2="21"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ monthEvents }}</div>
          <div class="stat-label">本月日程</div>
        </div>
      </div>
    </div>

    <!-- 待办与日程左右流式格栅 -->
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
            :class="{ overdue: isOverdue(todo), completed: todo.completed }"
            @contextmenu.prevent="handleTodoContextMenu($event, todo)"
            @click="todoDetailVisible = true; selectedTodo = todo"
          >
            <!-- 物理弹性反馈打勾 -->
            <label class="checkbox-wrapper" @click.stop>
              <input
                type="checkbox"
                :checked="todo.completed"
                @change="todoStore.toggleTodo(todo.id)"
                class="todo-checkbox"
              />
              <span class="checkbox-custom">
                <svg class="check-mark" width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1.5 4 4.5 7 8.5 1.5"/>
                </svg>
              </span>
            </label>
            <div class="todo-content">
              <div class="todo-title">{{ todo.title }}</div>
              <div class="todo-due" v-if="todo.dueDate">
                <svg class="due-icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ formatDueDate(todo.dueDate) }}
              </div>
            </div>
            <!-- Notion 级精细彩点优先级胶囊 -->
            <div class="todo-priority" :class="todo.priority">
              <span class="priority-dot"></span>
              {{ priorityLabels[todo.priority] }}
            </div>
            <!-- 快捷向右悬浮小箭头 -->
            <div class="hover-action-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
          
          <!-- 极简线描空白待办占位插画 -->
          <div v-if="upcomingTodos.length === 0" class="empty-state">
            <svg class="empty-illustration" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <path d="m9 14 2 2 4-4"/>
            </svg>
            <div class="empty-text">待办已清空，今天很轻松</div>
          </div>
        </div>
      </div>

      <!-- 即将到来的日程 -->
      <div class="events-section">
        <div class="section-header">
          <h2>即将到来</h2>
          <router-link to="/calendar" class="view-all">查看全部 →</router-link>
        </div>
        <div class="events-list">
          <!-- hover 触发专属微光与圆角 Ribbon 舒张 -->
          <div 
            v-for="event in upcomingEvents" 
            :key="event.id" 
            class="event-item" 
            @contextmenu.prevent="handleEventContextMenu($event, event)"
            @click="eventDetailVisible = true; selectedEvent = event"
          >
            <div class="event-color-ribbon" :style="{ '--calendar-color': getCalendarColor(event.calendarId) }"></div>
            <div class="event-info">
              <div class="event-title">{{ event.title }}</div>
              <div class="event-time">
                <svg class="time-icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                {{ formatEventTime(event) }}
              </div>
            </div>
            <!-- 快捷向右悬浮小箭头 -->
            <div class="hover-action-arrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
          
          <!-- 极简线描空白日程占位插画 -->
          <div v-if="upcomingEvents.length === 0" class="empty-state">
            <svg class="empty-illustration" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div class="empty-text">日程已完美规划，享受当下吧</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuPosition.x"
      :y="contextMenuPosition.y"
      :items="contextMenuItems"
      @update:visible="contextMenuVisible = $event"
    />

    <!-- 删除确认气泡 -->
    <ConfirmPopover
      :visible="confirmPopoverVisible"
      :message="'确定删除吗？'"
      confirm-text="删除"
      cancel-text="取消"
      :target-rect="confirmTargetRect"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
      @update:visible="confirmPopoverVisible = $event"
    />

    <!-- 待办详情弹窗 -->
    <TodoDetailModal
      :visible="todoDetailVisible"
      :todo="selectedTodo"
      @close="todoDetailVisible = false"
    />

    <!-- 日程详情弹窗 -->
    <EventDetailModal
      :visible="eventDetailVisible"
      :event="selectedEvent"
      @close="eventDetailVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { usePlatform } from '@/platform/provider'
import { isSameDay, formatDateTime, formatDate, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from '../utils/date'
import type { CalendarEvent, Todo, MenuItem } from '../types'
import TimeDisplay from '../components/home/TimeDisplay.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import ConfirmPopover from '../components/common/ConfirmPopover.vue'
import TodoDetailModal from '../components/common/TodoDetailModal.vue'
import EventDetailModal from '../components/common/EventDetailModal.vue'

const calendarStore = useCalendarStore()
const todoStore = useTodoStore()
const { eventRepo } = usePlatform()

// 独立加载的事件数据（不依赖 Store 的 loadedRange）
const homeTodayEvents = ref<CalendarEvent[]>([])
const homeUpcomingEvents = ref<CalendarEvent[]>([])
const homeWeekEventCount = ref(0)
const homeMonthEventCount = ref(0)

async function loadHomeEvents() {
  const visibleCalendarIds = calendarStore.visibleCalendars.map(c => c.id)
  if (visibleCalendarIds.length === 0) {
    homeTodayEvents.value = []
    homeUpcomingEvents.value = []
    homeWeekEventCount.value = 0
    homeMonthEventCount.value = 0
    return
  }
  const now = new Date()
  const todayStart = startOfDay(now).getTime()
  const tomorrowStart = endOfDay(now).getTime()
  const weekStart = startOfWeek(now).getTime()
  const weekEnd = endOfWeek(now).getTime()
  const monthStart = startOfMonth(now).getTime()
  const monthEnd = endOfMonth(now).getTime()

  try {
    const [today, week, month, upcoming] = await Promise.all([
      eventRepo.getByTimeRangeAndCalendars(todayStart, tomorrowStart, visibleCalendarIds),
      eventRepo.getByTimeRangeAndCalendars(weekStart, weekEnd, visibleCalendarIds),
      eventRepo.getByTimeRangeAndCalendars(monthStart, monthEnd, visibleCalendarIds),
      eventRepo.getUpcoming(5, visibleCalendarIds),
    ])
    homeTodayEvents.value = today
    homeWeekEventCount.value = week.length
    homeMonthEventCount.value = month.length
    homeUpcomingEvents.value = upcoming
  } catch (error) {
    console.error('[HomeView] 加载首页事件失败:', error)
  }
}

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuItems = ref<MenuItem[]>([])
const selectedTodo = ref<Todo | null>(null)
const selectedEvent = ref<CalendarEvent | null>(null)

// 确认弹窗状态
const confirmPopoverVisible = ref(false)
const confirmTargetRect = ref<DOMRect | null>(null)
const confirmType = ref<'todo' | 'event'>('todo')

// 详情弹窗状态
const todoDetailVisible = ref(false)
const eventDetailVisible = ref(false)

onMounted(() => {
  todoStore.initialize()
  loadHomeEvents()
})

const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高'
}

const todayEvents = computed(() => {
  return homeTodayEvents.value
})

const weekEvents = computed(() => {
  return homeWeekEventCount.value
})

const monthEvents = computed(() => {
  return homeMonthEventCount.value
})

const upcomingEvents = computed(() => {
  return homeUpcomingEvents.value
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

// 待办右键菜单
function handleTodoContextMenu(e: MouseEvent, todo: Todo) {
  e.preventDefault()
  selectedTodo.value = todo
  selectedEvent.value = null
  contextMenuItems.value = [
    { label: '编辑', icon: '✏️', action: () => { contextMenuVisible.value = false } },
    { label: '删除', icon: '🗑️', separator: true, action: () => showDeleteConfirm('todo', e) },
    { label: todo.completed ? '标记未完成' : '标记完成', icon: '✅', action: () => handleToggleTodo() },
    { label: '详情', icon: '📋', action: () => { todoDetailVisible.value = true; contextMenuVisible.value = false } }
  ]
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

// 日程右键菜单
function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
  e.preventDefault()
  selectedEvent.value = event
  selectedTodo.value = null
  contextMenuItems.value = [
    { label: '编辑', icon: '✏️', action: () => { contextMenuVisible.value = false } },
    { label: '删除', icon: '🗑️', separator: true, action: () => showDeleteConfirm('event', e) },
    { label: '详情', icon: '📋', action: () => { eventDetailVisible.value = true; contextMenuVisible.value = false } }
  ]
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

// 显示删除确认
function showDeleteConfirm(type: 'todo' | 'event', e: MouseEvent) {
  confirmType.value = type
  confirmTargetRect.value = (e.target as HTMLElement).getBoundingClientRect()
  confirmPopoverVisible.value = true
  contextMenuVisible.value = false
}

// 确认删除
function handleConfirmDelete() {
  if (confirmType.value === 'todo' && selectedTodo.value) {
    todoStore.deleteTodo(selectedTodo.value.id)
  } else if (confirmType.value === 'event' && selectedEvent.value) {
    calendarStore.deleteEvent(selectedEvent.value.id)
  }
  confirmPopoverVisible.value = false
  selectedTodo.value = null
  selectedEvent.value = null
}

// 取消删除
function handleCancelDelete() {
  confirmPopoverVisible.value = false
}

// 切换待办完成状态
function handleToggleTodo() {
  if (selectedTodo.value) {
    todoStore.toggleTodo(selectedTodo.value.id)
  }
  contextMenuVisible.value = false
}
</script>

<style scoped>
.home-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

/* 巨型时间 Hero Banner 区域 */
.hero-section {
  width: 100%;
  margin-bottom: 24px;
}

/* 统计卡片格栅 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.02);
  transition: all var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1);
  cursor: pointer;
}

/* Hover 浮动 2px 伴随轻度阴影放大与自适应线标缩放 */
.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
}

.stat-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  transition: all var(--transition-fast);
}

/* 自适应色标背景及前景色 */
.stat-icon-wrapper.display-icon {
  background: rgba(0, 120, 212, 0.08);
  color: var(--accent-color);
}
.stat-icon-wrapper.pending-icon {
  background: rgba(46, 204, 113, 0.08);
  color: #2ecc71;
}
.stat-icon-wrapper.week-icon {
  background: rgba(155, 89, 182, 0.08);
  color: #9b59b6;
}
.stat-icon-wrapper.month-icon {
  background: rgba(230, 126, 34, 0.08);
  color: #e67e22;
}

.stat-card:hover .stat-icon-wrapper {
  transform: scale(1.08);
}

.stat-svg {
  color: inherit;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif;
  line-height: 1.1;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  margin-top: 2px;
}

/* Content Grid - 左右完美对称流式格栅 */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding: 0 6px;
}

.section-header h2 {
  font-size: 16.5px;
  font-weight: 650;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.3px;
}

.view-all {
  font-size: 13px;
  color: var(--accent-color);
  text-decoration: none;
  font-weight: 500;
  transition: opacity var(--transition-fast);
}

.view-all:hover {
  opacity: 0.8;
}

/* Todos & Events 嵌套悬浮微光容器 */
.todos-list,
.events-list {
  background: color-mix(in srgb, var(--bg-secondary) 85%, transparent);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-light);
  border-radius: 18px; /* 增大圆角 */
  padding: 6px; /* 嵌套呼吸内衬 */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.01);
  display: flex;
  flex-direction: column;
}

/* 空气流线卡片 - 彻底消灭通栏分割线 */
.todo-item,
.event-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-bottom: none !important; /* 彻底消灭生硬的黑线 */
  border-radius: 12px; /* 条目自身带有大圆角 */
  margin-bottom: 4px; /* 气泡间距 */
  transition: all var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.todo-item:last-child,
.event-item:last-child {
  margin-bottom: 0;
}

.todo-item:hover {
  background: var(--bg-hover);
}

.todo-item.overdue {
  background: rgba(231, 76, 60, 0.02);
}

.todo-item.overdue:hover {
  background: rgba(231, 76, 60, 0.05);
}

/* 物理弹性打勾复选框 */
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
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-strong);
  border-radius: 5px;
  transition: all var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1.2);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.check-mark {
  transform: scale(0);
  transition: transform var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1.3);
  stroke-dasharray: 20;
  stroke-dashoffset: 0;
}

.todo-checkbox:checked + .checkbox-custom {
  background: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 2px 6px rgba(0, 120, 212, 0.25);
  animation: checkboxPop var(--transition-fast) ease-out;
}

.todo-checkbox:checked + .checkbox-custom .check-mark {
  transform: scale(1);
}

@keyframes checkboxPop {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-title {
  font-weight: 500; /* 微调至 500，避免过重 */
  font-size: 13.8px;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

/* 已完成待办联动淡出与删除线 */
.todo-item.completed .todo-title {
  color: var(--text-tertiary);
  text-decoration: line-through;
  opacity: 0.6;
}

.todo-due {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-secondary);
  opacity: 0.8; /* 调整透明度形成良好视觉梯度 */
  margin-top: 4px;
  font-weight: 500;
}

.due-icon-svg {
  color: inherit;
}

.todo-item.overdue .todo-due {
  color: #e74c3c;
  opacity: 1;
}

/* Notion 级彩点优先级胶囊 */
.todo-priority {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: transform var(--transition-fast);
}

.priority-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.todo-priority.low {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.todo-priority.low .priority-dot {
  background: var(--text-tertiary);
}

.todo-priority.medium {
  background: rgba(243, 156, 18, 0.08);
  color: #d35400;
}
.todo-priority.medium .priority-dot {
  background: #f39c12;
}

.todo-priority.high {
  background: rgba(231, 76, 60, 0.08);
  color: #c0392b;
}
.todo-priority.high .priority-dot {
  background: #e74c3c;
}

/* Events Section (日程微光色带 Ribbon) */
.event-item:hover {
  /* 悬浮时产生专属日历色的极淡半透明背景 */
  background: color-mix(in srgb, var(--calendar-color, var(--accent-color)) 4.5%, var(--bg-secondary));
}

.event-color-ribbon {
  width: 3.5px;
  height: 28px;
  border-radius: 2px;
  background: var(--calendar-color, var(--accent-color));
  transition: all var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1);
}

/* hover 触发色条圆角拓宽 */
.event-item:hover .event-color-ribbon {
  width: 5.5px;
  border-radius: 3px;
  box-shadow: 0 1px 6px color-mix(in srgb, var(--calendar-color, var(--accent-color)) 40%, transparent);
}

.event-info {
  flex: 1;
}

.event-title {
  font-weight: 500; /* 微调至 500 */
  font-size: 13.8px;
  color: var(--text-primary);
}

.event-time {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--text-secondary);
  opacity: 0.8;
  font-size: 11.5px;
  margin-top: 4px;
  font-weight: 500;
}

.time-icon-svg {
  color: inherit;
  opacity: 0.8;
}

/* 快捷向右原位浮现箭头线标 */
.hover-action-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  opacity: 0;
  transform: translateX(-6px);
  transition: all var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1);
  margin-left: 4px;
  width: 14px;
  height: 14px;
}

.todo-item:hover .hover-action-arrow,
.event-item:hover .hover-action-arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--accent-color);
}

/* hover 时，优先级标签轻轻向左位移为小箭头让出空间，极其灵动 */
.todo-item:hover .todo-priority {
  transform: translateX(-2px);
}

/* 精美禅意空白占位插画 */
.empty-state {
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-illustration {
  color: var(--text-tertiary);
  opacity: 0.35;
  transition: opacity var(--transition-fast);
}

.empty-state:hover .empty-illustration {
  opacity: 0.55;
}

.empty-text {
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: -0.1px;
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
