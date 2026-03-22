# 待办事项管理流程

## 目录
1. [概述](#概述)
2. [数据模型](#数据模型)
3. [状态管理](#状态管理)
4. [CRUD操作](#crud操作)
5. [数据库集成](#数据库集成)
6. [计算属性](#计算属性)

## 概述

小河日历的待办事项系统提供任务管理功能，支持创建、编辑、完成、删除待办事项。数据通过SQLite持久化存储。

## 数据模型

### Todo 接口
```typescript
interface Todo {
  id: string              // 唯一标识符
  title: string           // 待办标题
  description?: string    // 描述（可选）
  completed: boolean      // 完成状态
  priority?: 'low' | 'medium' | 'high'  // 优先级（可选）
  dueDate?: number        // 截止日期时间戳（可选）
  calendarEventId?: string // 关联日历事件（可选）
  createdAt: number       // 创建时间
  updatedAt: number       // 更新时间
}
```

## 状态管理

### Store结构
```typescript
export const useTodoStore = defineStore('todo', () => {
  // State
  const todos = ref<Todo[]>([])
  const isInitialized = ref(false)

  // Computed
  const pendingTodos = computed(() => todos.value.filter(t => !t.completed))
  const completedTodos = computed(() => todos.value.filter(t => t.completed))

  // Actions
  async function initialize() {...}
  async function addTodo(todo) {...}
  async function updateTodo(id, updates) {...}
  async function toggleTodo(id) {...}
  async function deleteTodo(id) {...}

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
```

## CRUD操作

### 1. 创建待办 (Create)
```typescript
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
```

### 2. 更新待办 (Update)
```typescript
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
```

### 3. 切换完成状态
```typescript
async function toggleTodo(id: string) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) {
    await updateTodo(id, { completed: !todo.completed })
  }
}
```

### 4. 删除待办 (Delete)
```typescript
async function deleteTodo(id: string) {
  todos.value = todos.value.filter(t => t.id !== id)

  try {
    await dbDeleteTodo(id)
  } catch (error) {
    console.error('Failed to delete todo:', error)
  }
}
```

## 数据库集成

### 数据库操作函数
```typescript
import {
  getAllTodos,
  saveTodo,
  deleteTodo as dbDeleteTodo
} from '../utils/database'
```

### 初始化流程
```typescript
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
```

## 计算属性

### 待办统计
```typescript
// 未完成待办
const pendingTodos = computed(() => todos.value.filter(t => !t.completed))

// 已完成待办
const completedTodos = computed(() => todos.value.filter(t => t.completed))
```

### 可扩展计算属性
```typescript
// 按优先级排序（可扩展）
const todosByPriority = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return [...todos.value].sort((a, b) => {
    const aPriority = priorityOrder[a.priority || 'medium']
    const bPriority = priorityOrder[b.priority || 'medium']
    return aPriority - bPriority
  })
})

// 逾期待办（可扩展）
const overdueTodos = computed(() => {
  const now = Date.now()
  return todos.value.filter(t => 
    !t.completed && t.dueDate && t.dueDate < now
  )
})

// 今日到期（可扩展）
const dueTodayTodos = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return todos.value.filter(t => 
    !t.completed && 
    t.dueDate && 
    t.dueDate >= today.getTime() && 
    t.dueDate < tomorrow.getTime()
  )
})
```

## 相关文件

- 状态管理: `src/stores/todo.ts`
- 数据库操作: `src/utils/database.ts`
- 类型定义: `src/types/index.ts`
- 待办页面: `src/views/TodosView.vue`
- 待办组件: `src/components/todo/`