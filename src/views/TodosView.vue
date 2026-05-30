<template>
  <div class="todos-view">
    <!-- Header -->
    <div class="todos-header">
      <div class="header-left">
        <h2 class="page-title">待办事项</h2>
        <span class="todo-count">{{ todoStore.pendingTodos.length }} 项待完成</span>
      </div>
      <button class="fluent-button primary add-btn" @click="openAddModal">
        <span class="btn-icon">+</span>
        <span>新建待办</span>
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="filter-tabs">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        :class="['tab', { active: filter === tab.value }]"
        @click="filter = tab.value"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Todos List -->
    <div class="todos-list">
      <TransitionGroup name="todo">
        <div
          v-for="todo in filteredTodos"
          :key="todo.id"
          class="todo-item fluent-card"
          :class="{ completed: todo.completed }"
          @contextmenu.prevent="handleTodoContextMenu($event, todo)"
        >
          <label class="checkbox-wrapper">
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="todoStore.toggleTodo(todo.id)"
              class="todo-checkbox"
            />
            <span class="checkbox-custom"></span>
          </label>
          
          <div class="todo-content" @click="openEditModal(todo)">
            <div class="todo-title">{{ todo.title }}</div>
            <div class="todo-meta">
              <span v-if="todo.dueDate" class="todo-due" :class="{ overdue: isOverdue(todo.dueDate) && !todo.completed }">
                <span class="meta-icon">📅</span>
                {{ formatDueDate(todo.dueDate) }}
              </span>
            </div>
          </div>
          
          <div class="todo-priority" :class="todo.priority">
            {{ priorityLabels[todo.priority] }}
          </div>
          
          <button class="edit-btn" @click="openEditModal(todo)" title="编辑">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          
          <button class="delete-btn" @click="todoStore.deleteTodo(todo.id)" title="删除">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4.5 3V1.5C4.5 1.22 4.72 1 5 1H11C11.28 1 11.5 1.22 11.5 1.5V3M2.5 4H13.5M12.5 4V14C12.5 14.28 12.28 14.5 12 14.5H4C3.72 14.5 3.5 14.28 3.5 14V4M6.5 7V11.5M9.5 7V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </TransitionGroup>

      <!-- Empty State -->
      <div v-if="filteredTodos.length === 0" class="empty-state">
        <div class="empty-icon">✓</div>
        <div class="empty-text">
          {{ filter === 'completed' ? '还没有完成任何待办' : '暂无待办事项' }}
        </div>
        <button v-if="filter !== 'completed'" class="fluent-button" @click="openAddModal">
          创建第一个待办
        </button>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="add-modal elegant-modal-card" @keydown.escape="closeModal">
          <div class="modal-header">
            <h3>{{ isEditing ? '编辑待办' : '新建待办' }}</h3>
            <button class="close-btn" @click="closeModal" type="button">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          
          <form @submit.prevent="handleSubmit" class="modal-body">
            <!-- Title - Zero-border Title Input -->
            <div class="form-group title-form-group">
              <div class="zero-border-input-wrapper">
                <input
                  v-model="formData.title"
                  type="text"
                  class="zero-border-title-input"
                  placeholder="想做点什么..."
                  required
                  ref="titleInput"
                />
                <span class="focus-underline"></span>
              </div>
            </div>

            <!-- Metadata Grid for neat layout -->
            <div class="metadata-input-grid">
              <!-- Priority Section -->
              <div class="meta-form-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>
                  </svg>
                  <span>优先级</span>
                </span>
                <div class="meta-row-content">
                  <div class="priority-capsule-track">
                    <button
                      v-for="p in priorities"
                      :key="p.value"
                      type="button"
                      :class="['priority-capsule-pill', p.value, { active: formData.priority === p.value }]"
                      @click="formData.priority = p.value"
                    >
                      <span class="priority-dot"></span>
                      <span>{{ p.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Due Date Section -->
              <div class="meta-form-row">
                <span class="meta-row-label">
                  <svg class="meta-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>截止日期</span>
                </span>
                <div class="meta-row-content">
                  <div class="fluent-date-input-wrapper">
                    <input
                      v-model="formData.dueDate"
                      type="date"
                      class="fluent-date-picker-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="modal-actions">
              <button type="button" class="fluent-button cancel-text-btn" @click="closeModal">
                取消
              </button>
              <button type="submit" class="fluent-button primary action-submit-btn" :disabled="!formData.title.trim()">
                {{ isEditing ? '保存修改' : '确认添加' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>

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
    message="确定删除这个待办吗？"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useTodoStore } from '../stores/todo'
import { useCalendarStore } from '../stores/calendar'
import { formatDate } from '../utils/date'
import ContextMenu from '../components/common/ContextMenu.vue'
import ConfirmPopover from '../components/common/ConfirmPopover.vue'
import TodoDetailModal from '../components/common/TodoDetailModal.vue'
import type { Todo } from '../types'
import type { MenuItem } from '../types'

const todoStore = useTodoStore()
const calendarStore = useCalendarStore()
const titleInput = ref<HTMLInputElement | null>(null)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuItems = ref<MenuItem[]>([])
const selectedTodo = ref<Todo | null>(null)

// 确认弹窗状态
const confirmPopoverVisible = ref(false)
const confirmTargetRect = ref<DOMRect | null>(null)

// 详情弹窗状态
const todoDetailVisible = ref(false)

onMounted(() => {
  todoStore.initialize()
})

const filter = ref<'all' | 'pending' | 'completed'>('all')
const showModal = ref(false)
const isEditing = ref(false)
const editingTodoId = ref<string | null>(null)

// 获取第一个可写日历的 ID
function getFirstWritableCalendarId(): string {
  const writableCal = calendarStore.calendars.find(cal => !cal.readOnly)
  return writableCal?.id || 'default'
}

const formData = ref({
  title: '',
  priority: 'medium' as 'low' | 'medium' | 'high',
  dueDate: '',
  calendarId: getFirstWritableCalendarId()
})

const priorityLabels = {
  low: '低优先级',
  medium: '中优先级',
  high: '高优先级'
}

const priorities: { value: 'low' | 'medium' | 'high'; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' }
]

const filterTabs = computed(() => [
  { value: 'all' as const, label: '全部', count: todoStore.todos.length },
  { value: 'pending' as const, label: '待完成', count: todoStore.pendingTodos.length },
  { value: 'completed' as const, label: '已完成', count: todoStore.completedTodos.length }
])

const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'pending':
      return todoStore.pendingTodos
    case 'completed':
      return todoStore.completedTodos
    default:
      return todoStore.todos
  }
})

// 自动聚焦标题输入框
watch(showModal, (show) => {
  if (show) {
    nextTick(() => {
      titleInput.value?.focus()
    })
  }
})

function openAddModal() {
  isEditing.value = false
  editingTodoId.value = null
  formData.value = { title: '', priority: 'medium', dueDate: '', calendarId: getFirstWritableCalendarId() }
  showModal.value = true
}

function openEditModal(todo: Todo) {
  isEditing.value = true
  editingTodoId.value = todo.id
  // 格式化为本地时间的日期字符串
  let dueDateStr = ''
  if (todo.dueDate) {
    const date = new Date(todo.dueDate)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    dueDateStr = `${year}-${month}-${day}`
  }
  formData.value = {
    title: todo.title,
    priority: todo.priority,
    dueDate: dueDateStr,
    calendarId: todo.calendarId || getFirstWritableCalendarId()
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  isEditing.value = false
  editingTodoId.value = null
  formData.value = { title: '', priority: 'medium', dueDate: '', calendarId: getFirstWritableCalendarId() }
}

async function handleSubmit() {
  const title = formData.value.title.trim()
  if (!title) return

  // 解析日期字符串为本地时间（避免UTC偏移）
  function parseLocalDate(dateStr: string): number | undefined {
    if (!dateStr) return undefined
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  }

  if (isEditing.value && editingTodoId.value) {
    // 编辑模式
    await todoStore.updateTodo(editingTodoId.value, {
      title,
      priority: formData.value.priority,
      dueDate: parseLocalDate(formData.value.dueDate)
    })
  } else {
    // 新建模式
    await todoStore.addTodo({
      title,
      priority: formData.value.priority,
      dueDate: parseLocalDate(formData.value.dueDate),
      completed: false,
      calendarId: formData.value.calendarId || getFirstWritableCalendarId()
    })
  }

  closeModal()
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
  } else {
    return formatDate(date)
  }
}

function isOverdue(timestamp: number): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return timestamp < today.getTime()
}

// 待办右键菜单
function handleTodoContextMenu(e: MouseEvent, todo: Todo) {
  e.preventDefault()
  selectedTodo.value = todo
  contextMenuItems.value = [
    { label: '编辑', icon: '✏️', action: () => { openEditModal(todo); contextMenuVisible.value = false } },
    { label: '删除', icon: '🗑️', separator: true, action: () => showDeleteConfirm(e) },
    { label: todo.completed ? '标记未完成' : '标记完成', icon: '✅', action: () => handleToggleTodo() },
    { label: '详情', icon: '📋', action: () => { todoDetailVisible.value = true; contextMenuVisible.value = false } }
  ]
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

function showDeleteConfirm(e: MouseEvent) {
  confirmTargetRect.value = (e.target as HTMLElement).getBoundingClientRect()
  confirmPopoverVisible.value = true
  contextMenuVisible.value = false
}

function handleConfirmDelete() {
  if (selectedTodo.value) {
    todoStore.deleteTodo(selectedTodo.value.id)
  }
  confirmPopoverVisible.value = false
  selectedTodo.value = null
}

function handleCancelDelete() {
  confirmPopoverVisible.value = false
}

function handleToggleTodo() {
  if (selectedTodo.value) {
    todoStore.toggleTodo(selectedTodo.value.id)
  }
  contextMenuVisible.value = false
}
</script>

<style scoped>
.todos-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

/* Header */
.todos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.5px;
}

.todo-count {
  font-size: 14px;
  color: var(--text-secondary);
}

.add-btn {
  gap: 8px;
}

.btn-icon {
  font-size: 18px;
  font-weight: 300;
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding: 4px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.tab.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.tab-count {
  font-size: 12px;
  padding: 2px 8px;
  background: var(--bg-hover);
  border-radius: 10px;
  color: var(--text-tertiary);
}

.tab.active .tab-count {
  background: var(--accent-light);
  color: var(--accent-color);
}

/* Todos List */
.todos-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Todo Item */
.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  transition: all var(--transition-fast);
}

.todo-item:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-md);
}

.todo-item.completed {
  opacity: 0.7;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
  color: var(--text-secondary);
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
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-strong);
  border-radius: 6px;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-custom::after {
  content: '';
  width: 6px;
  height: 10px;
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

/* Todo Content - Clickable for edit */
.todo-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
  padding: 4px 8px;
  margin: -4px -8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.todo-content:hover {
  background: var(--bg-hover);
}

.todo-title {
  font-weight: 500;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.todo-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.todo-due {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}

.todo-due.overdue {
  color: #dc2626;
}

.meta-icon {
  font-size: 12px;
}

/* Priority Badge */
.todo-priority {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
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

/* Edit & Delete Buttons */
.edit-btn,
.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
}

.todo-item:hover .edit-btn,
.todo-item:hover .delete-btn {
  opacity: 1;
}

.edit-btn:hover {
  background: var(--accent-light);
  color: var(--accent-color);
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border-radius: 50%;
  font-size: 24px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.elegant-modal-card {
  width: 440px;
  max-width: 90vw;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  overflow: hidden;
  animation: scaleIn var(--transition-smooth);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 10px 24px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px 24px 24px 24px;
}

.form-group {
  margin-bottom: 24px;
}

/* Zero-border Title Input */
.title-form-group {
  margin-bottom: 28px;
}

.zero-border-input-wrapper {
  position: relative;
  width: 100%;
}

.zero-border-title-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  padding: 8px 0;
  outline: none;
  letter-spacing: -0.5px;
}

.zero-border-title-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.8;
}

.focus-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1.5px;
  background: var(--border-color);
  transition: background var(--transition-normal);
}

.zero-border-title-input:focus ~ .focus-underline {
  background: var(--accent-color);
}

/* Metadata Input Grid (Notion & Todoist style) */
.metadata-input-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
  background: var(--bg-tertiary);
  padding: 16px;
  border-radius: var(--radius-lg);
  border: 1px solid rgba(0, 0, 0, 0.02);
}

.meta-form-row {
  display: flex;
  align-items: center;
}

.meta-row-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: 100px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.meta-svg-icon {
  color: var(--text-tertiary);
}

.meta-row-content {
  flex: 1;
  min-width: 0;
}

/* Priority Capsule Track */
.priority-capsule-track {
  display: flex;
  background: var(--bg-secondary);
  padding: 3px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  width: fit-content;
}

.priority-capsule-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-md) - 2px);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.priority-capsule-pill:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.priority-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: transform var(--transition-fast);
}

/* Active status color adjustments - subtle design */
.priority-capsule-pill.active {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.priority-capsule-pill.active.low {
  background: rgba(52, 199, 89, 0.08);
  color: #34C759;
}
.priority-capsule-pill.active.low .priority-dot {
  background: #34C759;
  transform: scale(1.2);
}

.priority-capsule-pill.active.medium {
  background: rgba(255, 149, 0, 0.08);
  color: #FF9500;
}
.priority-capsule-pill.active.medium .priority-dot {
  background: #FF9500;
  transform: scale(1.2);
}

.priority-capsule-pill.active.high {
  background: rgba(255, 59, 48, 0.08);
  color: #FF3B30;
}
.priority-capsule-pill.active.high .priority-dot {
  background: #FF3B30;
  transform: scale(1.2);
}

/* Fluent Date Picker Input */
.fluent-date-input-wrapper {
  position: relative;
  width: 100%;
}

.fluent-date-picker-input {
  border: none;
  background: var(--bg-secondary);
  padding: 6px 12px;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  outline: none;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-date-picker-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-secondary);
  box-shadow: 0 0 0 2px var(--accent-light);
}

/* Modal Actions */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.cancel-text-btn {
  background: transparent !important;
  border-color: transparent !important;
  color: var(--text-secondary);
}

.cancel-text-btn:hover {
  background: var(--bg-hover) !important;
  color: var(--text-primary);
}

.action-submit-btn {
  padding: 8px 24px !important;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-md);
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .add-modal,
.modal-leave-active .add-modal {
  transition: transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease;
}

.modal-enter-from .add-modal {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .add-modal {
  opacity: 0;
  transform: scale(0.95);
}

/* Todo List Transitions */
.todo-enter-active,
.todo-leave-active {
  transition: all 0.3s ease;
}

.todo-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.todo-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.todo-move {
  transition: transform 0.3s ease;
}

/* Fluent Button */
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-button:hover {
  background: var(--bg-hover);
}

.fluent-button:active {
  transform: scale(0.98);
}

.fluent-button.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.fluent-button.primary:hover {
  background: var(--accent-hover);
}

.fluent-button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Fluent Card */
.fluent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* Fluent Input */
.fluent-input {
  padding: 12px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.fluent-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.fluent-input::placeholder {
  color: var(--text-tertiary);
}
</style>
