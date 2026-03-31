import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import {
  invokeGetTodos,
  invokeCreateTodo,
  invokeUpdateTodo,
  invokeDeleteTodo
} from '../utils/tauri'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const isInitialized = ref(false)

  async function initialize() {
    if (isInitialized.value) return

    try {
      const loadedTodos = await invokeGetTodos()
      todos.value = loadedTodos
      isInitialized.value = true
      console.log('Todo store initialized:', todos.value.length)
    } catch (error) {
      console.error('Failed to initialize todo store:', error)
    }
  }

  const pendingTodos = computed(() => todos.value.filter(t => !t.completed))
  const completedTodos = computed(() => todos.value.filter(t => t.completed))

  async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
    // 获取默认日历 ID
    const calendarId = todo.calendarId ? parseInt(todo.calendarId) : 1
    
    const created = await invokeCreateTodo({
      title: todo.title,
      description: todo.description,
      dueDate: todo.dueDate,
      completed: todo.completed,
      priority: todo.priority,
      calendarId
    })
    
    if (created) {
      todos.value.push(created)
      console.log('Todo created:', created.id)
    } else {
      console.error('Failed to create todo')
    }
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      const todoId = parseInt(id)
      
      if (!isNaN(todoId)) {
        const updated = await invokeUpdateTodo({
          id: todoId,
          title: updates.title,
          description: updates.description,
          dueDate: updates.dueDate,
          completed: updates.completed,
          priority: updates.priority,
          calendarId: updates.calendarId ? parseInt(updates.calendarId) : undefined
        })
        
        if (updated) {
          todos.value[index] = updated
          console.log('Todo updated:', id)
        } else {
          console.error('Failed to update todo:', id)
        }
      } else {
        // 临时 ID，仅更新本地状态
        todos.value[index] = {
          ...todos.value[index],
          ...updates,
          updatedAt: Date.now()
        }
      }
    }
  }

  async function toggleTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      await updateTodo(id, { completed: !todo.completed })
    }
  }

  async function deleteTodo(id: string) {
    const todoId = parseInt(id)
    
    if (!isNaN(todoId)) {
      await invokeDeleteTodo(todoId)
    }
    
    todos.value = todos.value.filter(t => t.id !== id)
    console.log('Todo deleted:', id)
  }

  return {
    todos,
    isInitialized,
    pendingTodos,
    completedTodos,
    initialize,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo
  }
})
