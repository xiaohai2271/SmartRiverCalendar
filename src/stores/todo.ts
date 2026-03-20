import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import {
  getAllTodos,
  saveTodo,
  deleteTodo as dbDeleteTodo
} from '../utils/database'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const isInitialized = ref(false)

  async function initialize() {
    if (isInitialized.value) return

    try {
      const loadedTodos = await getAllTodos()
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
    const now = Date.now()
    const newTodo: Todo = {
      ...todo,
      id: `todo_${now}`,
      createdAt: now,
      updatedAt: now
    }
    todos.value.push(newTodo)

    try {
      await saveTodo(newTodo)
    } catch (error) {
      console.error('Failed to save todo:', error)
    }
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      todos.value[index] = {
        ...todos.value[index],
        ...updates,
        updatedAt: Date.now()
      }

      try {
        await saveTodo(todos.value[index])
      } catch (error) {
        console.error('Failed to update todo:', error)
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
    todos.value = todos.value.filter(t => t.id !== id)

    try {
      await dbDeleteTodo(id)
    } catch (error) {
      console.error('Failed to delete todo:', error)
    }
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