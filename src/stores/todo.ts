import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Todo } from '../types'
import { usePlatform } from '@/platform/provider'
import { useCalendarStore } from './calendar'

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

  /**
   * 获取有效的日历 ID
   * 如果传入的 calendarId 无效（无法解析为数字），则从 calendarStore 获取第一个可用日历的 ID
   */
  function getValidCalendarId(calendarId: string | undefined): number {
    if (calendarId) {
      const parsed = parseInt(calendarId)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    
    // 从 calendarStore 获取第一个可用日历
    const calendarStore = useCalendarStore()
    const firstCalendar = calendarStore.calendars[0]
    if (firstCalendar) {
      const parsed = parseInt(firstCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }
    
    // 如果仍然无法获取，返回 1（但这可能导致外键约束失败）
    console.warn('[TodoStore] 无法获取有效的日历 ID，使用默认值 1')
    return 1
  }

  async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
    const { todoRepo } = usePlatform()
    // 获取有效的日历 ID
    const calendarId = getValidCalendarId(todo.calendarId)
    
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
