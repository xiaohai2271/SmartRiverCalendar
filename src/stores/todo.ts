import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import { usePlatform } from '@/platform/provider'
import { useCalendarStore } from './calendar'
import { getValidCalendarId } from '@/utils/calendar-helpers'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([])
  const isInitialized = ref(false)

  async function initialize() {
    if (isInitialized.value) return

    try {
      const { todoRepo } = usePlatform()
      const loadedTodos = await todoRepo.getAll()
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
    const { todoRepo } = usePlatform()
    // 获取有效的日历 ID
    const calendarStore = useCalendarStore()
    const calendarId = getValidCalendarId(todo.calendarId, calendarStore.calendars)
    
    const created = await todoRepo.create({
      title: todo.title,
      description: todo.description,
      dueDate: todo.dueDate,
      completed: todo.completed,
      priority: todo.priority,
      calendarId
    })
    
    todos.value.push(created)
    console.log('Todo created:', created.id)
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    const index = todos.value.findIndex(t => t.id === id)
    if (index !== -1) {
      const todoId = parseInt(id)
      
      if (!isNaN(todoId)) {
        const { todoRepo } = usePlatform()
        const updated = await todoRepo.update({
          id: todoId,
          title: updates.title,
          description: updates.description,
          dueDate: updates.dueDate,
          completed: updates.completed,
          priority: updates.priority,
          calendarId: updates.calendarId ? (() => {
            const parsed = parseInt(updates.calendarId)
            return isNaN(parsed) ? undefined : parsed
          })() : undefined
        })
        
        todos.value[index] = updated
        console.log('Todo updated:', id)
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
      const { todoRepo } = usePlatform()
      await todoRepo.delete(todoId)
    }
    
    todos.value = todos.value.filter(t => t.id !== id)
    console.log('Todo deleted:', id)
  }

  /**
   * 从数据库重新加载数据
   * 同步完成后调用，将远端变更刷新到前端 Store
   */
  async function reloadFromDatabase(): Promise<void> {
    try {
      const { todoRepo } = usePlatform()
      const loadedTodos = await todoRepo.getAll()
      todos.value = loadedTodos
      console.log('[TodoStore] 数据已从数据库重新加载:', todos.value.length)
    } catch (error) {
      console.error('[TodoStore] 重新加载数据失败:', error)
    }
  }

  return {
    todos,
    isInitialized,
    pendingTodos,
    completedTodos,
    initialize,
    reloadFromDatabase,
    addTodo,
    updateTodo,
    toggleTodo,
    deleteTodo
  }
})
