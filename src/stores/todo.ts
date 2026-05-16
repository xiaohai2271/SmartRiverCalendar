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
   * 优先返回传入的 calendarId，其次返回本地日历，最后返回第一个可用日历
   */
  function getValidCalendarId(calendarId: string | undefined): number {
    if (calendarId) {
      const parsed = parseInt(calendarId)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    // 从 calendarStore 获取第一个本地日历
    const calendarStore = useCalendarStore()
    const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
    if (localCalendar) {
      const parsed = parseInt(localCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    // 兜底：返回第一个日历（不限类型）
    const firstCalendar = calendarStore.calendars[0]
    if (firstCalendar) {
      const parsed = parseInt(firstCalendar.id)
      if (!isNaN(parsed) && parsed > 0) {
        return parsed
      }
    }

    // 最终兜底（不应发生）
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
