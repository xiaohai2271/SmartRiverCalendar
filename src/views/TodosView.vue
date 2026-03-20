<template>
  <div class="todos-view">
    <div class="todos-header">
      <h2>待办事项</h2>
      <button class="add-btn" @click="showAddModal = true">+ 新建待办</button>
    </div>

    <div class="filter-tabs">
      <button
        :class="['tab', { active: filter === 'all' }]"
        @click="filter = 'all'"
      >全部</button>
      <button
        :class="['tab', { active: filter === 'pending' }]"
        @click="filter = 'pending'"
      >待完成</button>
      <button
        :class="['tab', { active: filter === 'completed' }]"
        @click="filter = 'completed'"
      >已完成</button>
    </div>

    <div class="todos-list">
      <div
        v-for="todo in filteredTodos"
        :key="todo.id"
        class="todo-item"
        :class="{ completed: todo.completed }"
      >
        <input
          type="checkbox"
          :checked="todo.completed"
          @change="todoStore.toggleTodo(todo.id)"
        />
        <div class="todo-content">
          <div class="todo-title">{{ todo.title }}</div>
          <div v-if="todo.dueDate" class="todo-due">
            截止: {{ formatDueDate(todo.dueDate) }}
          </div>
        </div>
        <div class="todo-priority" :class="todo.priority">
          {{ priorityLabels[todo.priority] }}
        </div>
        <button class="delete-btn" @click="todoStore.deleteTodo(todo.id)">×</button>
      </div>

      <div v-if="filteredTodos.length === 0" class="empty-state">
        暂无待办事项
      </div>
    </div>

    <!-- Add Modal -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="add-modal">
        <h3>新建待办</h3>
        <form @submit.prevent="handleAddTodo">
          <div class="form-group">
            <label>标题</label>
            <input v-model="newTodo.title" type="text" placeholder="待办标题" required />
          </div>
          <div class="form-group">
            <label>优先级</label>
            <select v-model="newTodo.priority">
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
          </div>
          <div class="form-group">
            <label>截止日期</label>
            <input v-model="newTodo.dueDate" type="date" />
          </div>
          <div class="form-actions">
            <button type="button" @click="showAddModal = false">取消</button>
            <button type="submit" class="submit-btn">添加</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTodoStore } from '../stores/todo'
import { formatDate } from '../utils/date'

const todoStore = useTodoStore()

onMounted(() => {
  todoStore.initialize()
})

const filter = ref<'all' | 'pending' | 'completed'>('all')
const showAddModal = ref(false)

const newTodo = ref({
  title: '',
  priority: 'medium' as 'low' | 'medium' | 'high',
  dueDate: ''
})

const priorityLabels = {
  low: '低',
  medium: '中',
  high: '高'
}

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

async function handleAddTodo() {
  await todoStore.addTodo({
    title: newTodo.value.title,
    priority: newTodo.value.priority,
    dueDate: newTodo.value.dueDate ? new Date(newTodo.value.dueDate).getTime() : undefined,
    completed: false,
    calendarId: 'default'
  })

  showAddModal.value = false
  newTodo.value = { title: '', priority: 'medium', dueDate: '' }
}

function formatDueDate(timestamp: number): string {
  return formatDate(new Date(timestamp))
}
</script>

<style scoped>
.todos-view {
  max-width: 800px;
  margin: 0 auto;
}

.todos-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.add-btn {
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
}

.tab.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.todos-list {
  background: var(--bg-secondary);
  border-radius: 12px;
  overflow: hidden;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-item.completed .todo-title {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.todo-content {
  flex: 1;
}

.todo-title {
  font-weight: 500;
}

.todo-due {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.todo-priority {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.todo-priority.low {
  background: #E2E8F0;
  color: #718096;
}

.todo-priority.medium {
  background: #FEF3C7;
  color: #D97706;
}

.todo-priority.high {
  background: #FEE2E2;
  color: #DC2626;
}

.delete-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  color: var(--text-secondary);
}

.delete-btn:hover {
  color: #DC2626;
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--text-secondary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.add-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 400px;
}

.add-modal h3 {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.form-actions button {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
}

.submit-btn {
  background: var(--accent-color) !important;
  color: white;
  border: none !important;
}
</style>