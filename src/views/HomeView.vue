<template>
  <div class="home-view">
    <div class="welcome-section">
      <h1>欢迎使用小河日历</h1>
      <p>掌控时间，让生活更有节奏</p>
    </div>

    <!-- 实时时间显示 -->
    <TimeDisplay />

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-info">
          <div class="stat-value">{{ todayEvents.length }}</div>
          <div class="stat-label">今日日程</div>
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
          <div class="stat-label">本周日程</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📆</div>
        <div class="stat-info">
          <div class="stat-value">{{ monthEvents }}</div>
          <div class="stat-label">本月日程</div>
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
            @contextmenu.prevent="(e) => handleContextMenu(e, todo)"
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

        <!-- 右键菜单 -->
        <ContextMenu
          v-model:visible="contextMenuVisible"
          :position="contextMenuPosition"
          :items="todoMenuItems"
        />

        <!-- 删除确认气泡 -->
        <!-- 用于定位删除确认气泡的虚拟元素 -->
        <div
          ref="deleteConfirmTargetRef"
          style="position: fixed; width: 1px; height: 1px; pointer-events: none; z-index: -1;"
        />
        <ConfirmPopover
          v-model:visible="confirmPopoverVisible"
          :target="deleteConfirmTargetRef"
          title="确定要删除此待办事项吗？"
          confirm-text="删除"
          cancel-text="取消"
          @confirm="confirmDelete"
          @cancel="cancelDelete"
        />

        <!-- 待办详情弹窗 -->
        <TodoDetailModal
          v-model:visible="detailModalVisible"
          :todo="selectedTodo"
          @close="detailModalVisible = false"
        />
      </div>

      <!-- 即将到来的日程 -->
      <div class="events-section">
        <div class="section-header">
          <h2>即将到来</h2>
          <router-link to="/calendar" class="view-all">查看全部 →</router-link>
        </div>
        <div class="events-list">
          <div
            v-for="event in upcomingEvents"
            :key="event.id"
            class="event-item"
            @contextmenu.prevent="(e) => handleEventContextMenu(e, event)"
          >
            <div class="event-color" :style="{ background: getCalendarColor(event.calendarId) }"></div>
            <div class="event-info">
              <div class="event-title">{{ event.title }}</div>
              <div class="event-time">{{ formatEventTime(event) }}</div>
            </div>
          </div>
          <div v-if="upcomingEvents.length === 0" class="empty-state">
            暂无即将到来的日程
          </div>
        </div>

        <!-- 日程右键菜单 -->
        <ContextMenu
          v-model:visible="eventContextMenuVisible"
          :position="eventContextMenuPosition"
          :items="eventMenuItems"
        />

        <!-- 日程删除确认气泡定位元素 -->
        <div
          ref="eventDeleteConfirmTargetRef"
          style="position: fixed; width: 1px; height: 1px; pointer-events: none; z-index: -1;"
        />

        <!-- 日程删除确认气泡 -->
        <ConfirmPopover
          v-model:visible="eventConfirmPopoverVisible"
          :target="eventDeleteConfirmTargetRef"
          title="确定要删除此日程吗？"
          confirm-text="删除"
          cancel-text="取消"
          @confirm="confirmDeleteEvent"
          @cancel="cancelDeleteEvent"
        />

        <!-- 日程详情弹窗 -->
        <EventDetailModal
          :visible="eventDetailModalVisible"
          :event="selectedEvent"
          @close="closeEventDetailModal"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import { useTodoStore } from '../stores/todo'
import { isSameDay, formatDateTime, formatDate } from '../utils/date'
import type { CalendarEvent, Todo } from '../types'
import TimeDisplay from '../components/home/TimeDisplay.vue'
import ContextMenu from '../components/common/ContextMenu.vue'
import ConfirmPopover from '../components/common/ConfirmPopover.vue'
import TodoDetailModal from '../components/common/TodoDetailModal.vue'
import EventDetailModal from '../components/common/EventDetailModal.vue'
import { useRouter } from 'vue-router'

const calendarStore = useCalendarStore()
const todoStore = useTodoStore()
const router = useRouter()

// ========== 待办项右键菜单相关状态 ==========
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedTodo = ref<Todo | null>(null)
const confirmPopoverVisible = ref(false)
const deleteTargetPosition = ref({ x: 0, y: 0 })
const deleteConfirmTargetRef = ref<HTMLElement | null>(null)
const detailModalVisible = ref(false)

// ========== 日程项右键菜单相关状态 ==========
const eventContextMenuVisible = ref(false)
const eventContextMenuPosition = ref({ x: 0, y: 0 })
const selectedEvent = ref<CalendarEvent | null>(null)
const eventConfirmPopoverVisible = ref(false)
const eventDeleteTargetPosition = ref({ x: 0, y: 0 })
const eventDeleteConfirmTargetRef = ref<HTMLElement | null>(null)
const eventDetailModalVisible = ref(false)

onMounted(() => {
  todoStore.initialize()
})

const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高'
}

// 右键菜单项配置
const todoMenuItems = computed(() => [
  {
    label: '编辑',
    icon: '✏️',
    action: handleEdit
  },
  {
    label: '删除',
    icon: '🗑️',
    action: handleDelete
  },
  {
    label: selectedTodo.value?.completed ? '标记未完成' : '标记完成',
    icon: '✅',
    action: handleToggle
  },
  {
    label: '详情',
    icon: '📋',
    action: handleDetail
  }
])

/**
 * 处理待办项右键点击事件
 * @param event 鼠标事件
 * @param todo 点击的待办项
 */
function handleContextMenu(event: MouseEvent, todo: Todo) {
  event.preventDefault()
  selectedTodo.value = todo
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuVisible.value = true
}

/**
 * 处理编辑操作
 * 首页没有编辑功能，跳转到待办页面
 */
function handleEdit() {
  // 首页没有编辑弹窗，可以跳转到待办页面
  // 这里选择显示提示信息
  console.log('编辑待办项:', selectedTodo.value?.id)
  // TODO: 如果需要跳转，可以使用 router.push('/todos')
}

/**
 * 处理删除操作
 * 显示确认气泡
 */
function handleDelete() {
  // 使用右键菜单位置作为确认气泡的参考位置
  deleteTargetPosition.value = { ...contextMenuPosition.value }
  confirmPopoverVisible.value = true

  // 在下一帧更新定位元素的位置
  requestAnimationFrame(() => {
    if (deleteConfirmTargetRef.value) {
      deleteConfirmTargetRef.value.style.left = `${deleteTargetPosition.value.x}px`
      deleteConfirmTargetRef.value.style.top = `${deleteTargetPosition.value.y}px`
    }
  })
}

/**
 * 确认删除待办项
 */
function confirmDelete() {
  if (selectedTodo.value) {
    todoStore.deleteTodo(selectedTodo.value.id)
  }
}

/**
 * 取消删除操作
 */
function cancelDelete() {
  // 取消删除，无需额外操作
}

/**
 * 处理切换完成状态操作
 */
function handleToggle() {
  if (selectedTodo.value) {
    todoStore.toggleTodo(selectedTodo.value.id)
  }
}

/**
 * 处理查看详情操作
 */
function handleDetail() {
  detailModalVisible.value = true
}

// ========== 日程项菜单配置（注意：没有"完成"选项，日程无此状态） ==========
const eventMenuItems = computed(() => [
  { label: '编辑', icon: '✏️', action: handleEventEdit },
  { label: '删除', icon: '🗑️', action: handleEventDelete },
  { label: '详情', icon: '📋', action: handleEventDetail }
])

/**
 * 处理日程项右键点击事件
 */
function handleEventContextMenu(event: MouseEvent, evt: CalendarEvent) {
  event.preventDefault()
  selectedEvent.value = evt
  eventContextMenuPosition.value = { x: event.clientX, y: event.clientY }
  eventContextMenuVisible.value = true
}

/**
 * 处理编辑日程
 * 跳转到日程视图
 */
function handleEventEdit() {
  if (!selectedEvent.value) return
  router.push('/calendar')
  eventContextMenuVisible.value = false
}

/**
 * 处理删除日程
 * 显示气泡确认框
 */
function handleEventDelete() {
  // 使用右键菜单位置作为确认气泡的参考位置
  eventDeleteTargetPosition.value = { ...eventContextMenuPosition.value }
  eventConfirmPopoverVisible.value = true

  // 在下一帧更新定位元素的位置
  requestAnimationFrame(() => {
    if (eventDeleteConfirmTargetRef.value) {
      eventDeleteConfirmTargetRef.value.style.left = `${eventDeleteTargetPosition.value.x}px`
      eventDeleteConfirmTargetRef.value.style.top = `${eventDeleteTargetPosition.value.y}px`
    }
  })
}

/**
 * 确认删除日程
 */
async function confirmDeleteEvent() {
  if (!selectedEvent.value) return
  try {
    await calendarStore.deleteEvent(selectedEvent.value.id)
    console.log('日程删除成功:', selectedEvent.value.title)
  } catch (error) {
    console.error('删除日程失败:', error)
  }
  eventConfirmPopoverVisible.value = false
  selectedEvent.value = null
}

/**
 * 取消删除日程
 */
function cancelDeleteEvent() {
  eventConfirmPopoverVisible.value = false
  selectedEvent.value = null
}

/**
 * 处理查看日程详情
 * 打开详情弹窗
 */
function handleEventDetail() {
  if (!selectedEvent.value) return
  eventDetailModalVisible.value = true
  eventContextMenuVisible.value = false
}

/**
 * 关闭日程详情弹窗
 */
function closeEventDetailModal() {
  eventDetailModalVisible.value = false
  selectedEvent.value = null
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
  padding: 16px 0 8px;
}

.welcome-section h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}

.welcome-section p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
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
