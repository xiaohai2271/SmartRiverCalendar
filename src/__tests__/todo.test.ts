import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTodoStore } from '@/stores/todo'
import type { Todo } from '@/types'

const mockTodoRepo = {
  getAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    todoRepo: mockTodoRepo,
  }),
  useCapabilities: () => ({
    dataPriority: 'local-first',
    hasLocalDatabase: true,
  }),
}))

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: vi.fn(() => ({
    calendars: [{ id: '1', type: 'local', name: '我的日历', color: '#4A90D9', visible: true, syncEnabled: false }],
  })),
}))

function createMockTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: '1',
    title: '测试待办',
    completed: false,
    priority: 'medium',
    calendarId: '1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

describe('Todo Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('应加载待办数据并标记为已初始化', async () => {
      const todo = createMockTodo({ id: '1', title: '买牛奶' })
      mockTodoRepo.getAll.mockResolvedValue([todo])

      const store = useTodoStore()
      await store.initialize()

      expect(mockTodoRepo.getAll).toHaveBeenCalled()
      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].title).toBe('买牛奶')
      expect(store.isInitialized).toBe(true)
    })

    it('不应重复初始化', async () => {
      mockTodoRepo.getAll.mockResolvedValue([])

      const store = useTodoStore()
      await store.initialize()
      await store.initialize()

      expect(mockTodoRepo.getAll).toHaveBeenCalledTimes(1)
    })

    it('初始化失败时应捕获错误', async () => {
      mockTodoRepo.getAll.mockRejectedValue(new Error('数据库错误'))

      const store = useTodoStore()
      await store.initialize()

      expect(store.isInitialized).toBe(false)
      expect(store.todos).toHaveLength(0)
    })

    it('应加载空列表', async () => {
      mockTodoRepo.getAll.mockResolvedValue([])

      const store = useTodoStore()
      await store.initialize()

      expect(store.todos).toHaveLength(0)
      expect(store.isInitialized).toBe(true)
    })
  })

  describe('addTodo', () => {
    it('应创建新待办并加入列表', async () => {
      const createdTodo = createMockTodo({ id: '5', title: '写代码' })
      mockTodoRepo.getAll.mockResolvedValue([])
      mockTodoRepo.create.mockResolvedValue(createdTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.addTodo({
        title: '写代码',
        completed: false,
        priority: 'high',
        calendarId: '1',
      })

      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '写代码',
          completed: false,
          priority: 'high',
        })
      )
      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].title).toBe('写代码')
    })

    it('应处理带描述和截止日期的待办', async () => {
      const createdTodo = createMockTodo({
        id: '6',
        title: '提交报告',
        description: '季度报告',
        dueDate: 1700000000000,
      })
      mockTodoRepo.getAll.mockResolvedValue([])
      mockTodoRepo.create.mockResolvedValue(createdTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.addTodo({
        title: '提交报告',
        description: '季度报告',
        dueDate: 1700000000000,
        completed: false,
        priority: 'medium',
        calendarId: '1',
      })

      expect(mockTodoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '提交报告',
          description: '季度报告',
          dueDate: 1700000000000,
        })
      )
    })
  })

  describe('updateTodo', () => {
    it('应更新数字 ID 的待办', async () => {
      const todo = createMockTodo({ id: '1', title: '原始标题' })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      const updatedTodo = { ...todo, title: '更新标题', updatedAt: Date.now() }
      mockTodoRepo.update.mockResolvedValue(updatedTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.updateTodo('1', { title: '更新标题' })

      expect(mockTodoRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, title: '更新标题' })
      )
      expect(store.todos[0].title).toBe('更新标题')
    })

    it('应更新非数字 ID 待办的本地状态', async () => {
      const todo = createMockTodo({ id: 'temp_abc', title: '临时待办' })
      mockTodoRepo.getAll.mockResolvedValue([todo])

      const store = useTodoStore()
      await store.initialize()

      await store.updateTodo('temp_abc', { title: '本地更新' })

      expect(mockTodoRepo.update).not.toHaveBeenCalled()
      expect(store.todos[0].title).toBe('本地更新')
      expect(store.todos[0].updatedAt).toBeGreaterThan(0)
    })

    it('待办不存在时不应执行更新', async () => {
      mockTodoRepo.getAll.mockResolvedValue([])

      const store = useTodoStore()
      await store.initialize()

      await store.updateTodo('999', { title: '不存在' })

      expect(mockTodoRepo.update).not.toHaveBeenCalled()
    })

    it('应更新完成状态', async () => {
      const todo = createMockTodo({ id: '1', completed: false })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      const updatedTodo = { ...todo, completed: true }
      mockTodoRepo.update.mockResolvedValue(updatedTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.updateTodo('1', { completed: true })

      expect(mockTodoRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, completed: true })
      )
    })

    it('应更新优先级', async () => {
      const todo = createMockTodo({ id: '1', priority: 'low' })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      const updatedTodo = { ...todo, priority: 'high' }
      mockTodoRepo.update.mockResolvedValue(updatedTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.updateTodo('1', { priority: 'high' })

      expect(store.todos[0].priority).toBe('high')
    })
  })

  describe('toggleTodo', () => {
    it('应切换待办完成状态', async () => {
      const todo = createMockTodo({ id: '1', completed: false })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      const updatedTodo = { ...todo, completed: true }
      mockTodoRepo.update.mockResolvedValue(updatedTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.toggleTodo('1')

      expect(mockTodoRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, completed: true })
      )
    })

    it('应将已完成待办切换为未完成', async () => {
      const todo = createMockTodo({ id: '1', completed: true })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      const updatedTodo = { ...todo, completed: false }
      mockTodoRepo.update.mockResolvedValue(updatedTodo)

      const store = useTodoStore()
      await store.initialize()

      await store.toggleTodo('1')

      expect(mockTodoRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, completed: false })
      )
    })

    it('待办不存在时不应执行操作', async () => {
      mockTodoRepo.getAll.mockResolvedValue([])

      const store = useTodoStore()
      await store.initialize()

      await store.toggleTodo('999')

      expect(mockTodoRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('deleteTodo', () => {
    it('应删除数字 ID 的待办并从列表移除', async () => {
      const todo = createMockTodo({ id: '1' })
      mockTodoRepo.getAll.mockResolvedValue([todo])
      mockTodoRepo.delete.mockResolvedValue(undefined)

      const store = useTodoStore()
      await store.initialize()

      await store.deleteTodo('1')

      expect(mockTodoRepo.delete).toHaveBeenCalledWith(1)
      expect(store.todos).toHaveLength(0)
    })

    it('应删除非数字 ID 的待办（仅移除本地状态）', async () => {
      const todo = createMockTodo({ id: 'temp_xyz' })
      mockTodoRepo.getAll.mockResolvedValue([todo])

      const store = useTodoStore()
      await store.initialize()

      await store.deleteTodo('temp_xyz')

      expect(mockTodoRepo.delete).not.toHaveBeenCalled()
      expect(store.todos).toHaveLength(0)
    })

    it('应只删除指定待办，保留其他', async () => {
      const todo1 = createMockTodo({ id: '1', title: '待办1' })
      const todo2 = createMockTodo({ id: '2', title: '待办2' })
      mockTodoRepo.getAll.mockResolvedValue([todo1, todo2])
      mockTodoRepo.delete.mockResolvedValue(undefined)

      const store = useTodoStore()
      await store.initialize()

      await store.deleteTodo('1')

      expect(store.todos).toHaveLength(1)
      expect(store.todos[0].id).toBe('2')
    })
  })

  describe('pendingTodos / completedTodos', () => {
    it('应正确过滤待办和已完成待办', async () => {
      const pending = createMockTodo({ id: '1', title: '待办', completed: false })
      const completed = createMockTodo({ id: '2', title: '已完成', completed: true })
      mockTodoRepo.getAll.mockResolvedValue([pending, completed])

      const store = useTodoStore()
      await store.initialize()

      expect(store.pendingTodos).toHaveLength(1)
      expect(store.pendingTodos[0].title).toBe('待办')
      expect(store.completedTodos).toHaveLength(1)
      expect(store.completedTodos[0].title).toBe('已完成')
    })
  })

  describe('reloadFromDatabase', () => {
    it('应重新加载待办数据', async () => {
      mockTodoRepo.getAll.mockResolvedValue([createMockTodo({ id: '1' })])

      const store = useTodoStore()
      await store.initialize()

      const newTodos = [
        createMockTodo({ id: '1', title: '待办1' }),
        createMockTodo({ id: '2', title: '待办2' }),
      ]
      mockTodoRepo.getAll.mockResolvedValue(newTodos)

      await store.reloadFromDatabase()

      expect(store.todos).toHaveLength(2)
    })
  })
})
