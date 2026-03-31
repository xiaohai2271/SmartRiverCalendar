# 待办事项管理流程

## 目录
1. [概述](#概述)
2. [架构设计](#架构设计)
3. [数据模型](#数据模型)
4. [状态管理](#状态管理)
5. [CRUD操作](#crud操作)
6. [计算属性](#计算属性)

## 概述

小河日历的待办事项系统采用 **前端 → Tauri invoke → Rust 后端 → SQLite** 的分层架构，支持创建、编辑、完成、删除待办事项。数据通过 SQLite 持久化存储，支持 Windows、Android、iOS 三端。

## 架构设计

### 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  TodoStore  │    │  数据转换    │    │  Tauri API  │     │
│  │  (Pinia)    │───▶│  (tauri.ts) │───▶│  invoke()   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri 后端 (Rust)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Commands   │───▶│ TodoRepo    │───▶│   SQLite    │     │
│  │  (API层)    │    │  (数据访问)  │    │   数据库     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 架构优势

1. **跨平台一致性**：Rust 后端统一数据操作，三端行为一致
2. **类型安全**：Rust 强类型系统确保数据完整性
3. **离线支持**：本地 SQLite 存储，断网可用
4. **与日历关联**：待办事项关联日历，支持按日历分类

### 关键文件

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端 Store | `src/stores/todo.ts` | 待办状态管理、业务逻辑 |
| 数据转换 | `src/utils/tauri.ts` | snake_case ↔ camelCase 转换 |
| Rust 命令 | `src-tauri/src/commands.rs` | Tauri 命令定义 |
| 数据仓库 | `src-tauri/src/db/repositories/todo.rs` | 待办数据访问 |
| 数据库结构 | `src-tauri/src/db/schema.rs` | 表结构定义 |

## 数据模型

### ID 策略

待办事项使用 **自增整数 ID**，由 SQLite 的 `INTEGER PRIMARY KEY AUTOINCREMENT` 生成：

- **数据库层**：`id INTEGER PRIMARY KEY AUTOINCREMENT`
- **Rust 层**：`id: i64`
- **前端层**：`id: string`（通过 `String(raw.id)` 转换）

### Todo 接口
```typescript
interface Todo {
  id: string                    // 自增整数转字符串，如 "1", "2"
  title: string                 // 待办标题
  description?: string          // 描述（可选）
  completed: boolean            // 完成状态
  priority?: 'low' | 'medium' | 'high'  // 优先级（可选）
  dueDate?: number              // 截止日期时间戳（可选）
  calendarId: string            // 关联日历 ID
  createdAt: number             // 创建时间
  updatedAt: number             // 更新时间
}
```

## 状态管理

### Store 结构
```typescript
export const useTodoStore = defineStore('todo', () => {
  // State
  const todos = ref<Todo[]>([])
  const isInitialized = ref(false)

  // Computed
  const pendingTodos = computed(() => todos.value.filter(t => !t.completed))
  const completedTodos = computed(() => todos.value.filter(t => t.completed))

  // Actions - 通过 Tauri invoke 调用 Rust 后端
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

### 数据操作流程

所有数据操作遵循统一流程：

```
前端调用 → tauri.ts 数据转换 → Tauri invoke → Rust Command → TodoRepository → SQLite
```

### 1. 创建待办 (Create)
```typescript
async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
  // 获取默认日历 ID
  const calendarId = todo.calendarId ? parseInt(todo.calendarId) : 1
  
  // 调用 Rust 后端创建待办，返回带有自增 ID 的完整对象
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
    console.log('Todo created:', created.id)  // ID 由数据库生成
  } else {
    console.error('Failed to create todo')
  }
}
```

### 2. 更新待办 (Update)
```typescript
async function updateTodo(id: string, updates: Partial<Todo>) {
  const index = todos.value.findIndex(t => t.id === id)
  if (index !== -1) {
    const todoId = parseInt(id)
    
    if (!isNaN(todoId)) {
      // 调用 Rust 后端更新待办
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
      }
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
  const todoId = parseInt(id)
  
  if (!isNaN(todoId)) {
    // 调用 Rust 后端删除待办
    await invokeDeleteTodo(todoId)
  }
  
  // 更新前端状态
  todos.value = todos.value.filter(t => t.id !== id)
  console.log('Todo deleted:', id)
}
```

### 初始化流程
```typescript
async function initialize() {
  if (isInitialized.value) return

  try {
    // 通过 Tauri 命令加载待办事项
    const loadedTodos = await invokeGetTodos()
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
// 按优先级排序
const todosByPriority = computed(() => {
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  return [...todos.value].sort((a, b) => {
    const aPriority = priorityOrder[a.priority || 'medium']
    const bPriority = priorityOrder[b.priority || 'medium']
    return aPriority - bPriority
  })
})

// 逾期待办
const overdueTodos = computed(() => {
  const now = Date.now()
  return todos.value.filter(t => 
    !t.completed && t.dueDate && t.dueDate < now
  )
})

// 今日到期
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

## Rust 后端 API

### Tauri 命令概览

| 命令 | 功能 | 参数 |
|------|------|------|
| `get_todos` | 获取所有待办 | 无 |
| `get_todos_by_calendar` | 按日历获取待办 | calendar_id |
| `create_todo` | 创建待办 | title, description?, due_date?, completed?, priority?, calendar_id |
| `update_todo` | 更新待办 | id, title?, description?, due_date?, completed?, priority?, calendar_id? |
| `delete_todo` | 删除待办 | id |

### 数据转换

前端 `src/utils/tauri.ts` 负责数据格式转换：

```typescript
// Rust 后端返回 snake_case 字段
interface RawTodo {
  id: number
  title: string
  description: string | null
  due_date: number | null
  completed: boolean
  priority: string
  calendar_id: number
  created_at: number
  updated_at: number
}

// 转换为前端 camelCase 格式
export function transformTodo(raw: RawTodo): Todo {
  return {
    id: String(raw.id),  // 数字转字符串
    title: raw.title,
    description: raw.description ?? undefined,
    dueDate: raw.due_date ?? undefined,
    completed: raw.completed,
    priority: raw.priority as 'low' | 'medium' | 'high',
    calendarId: String(raw.calendar_id),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
```

### 数据库表结构

```sql
-- 待办事项表
CREATE TABLE todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date INTEGER,
    completed INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'medium',
    calendar_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_todos_calendar_id ON todos(calendar_id);
```

## 相关文件

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端状态 | `src/stores/todo.ts` | 待办状态管理、业务逻辑 |
| 数据转换 | `src/utils/tauri.ts` | invoke 封装、数据格式转换 |
| 类型定义 | `src/types/index.ts` | TypeScript 接口定义 |
| 待办页面 | `src/views/TodosView.vue` | 待办列表页面 |
| 待办组件 | `src/components/todo/` | UI 组件 |
| Rust 命令 | `src-tauri/src/commands.rs` | Tauri 命令定义 |
| 数据仓库 | `src-tauri/src/db/repositories/todo.rs` | 待办数据访问 |
| 数据库结构 | `src-tauri/src/db/schema.rs` | 表结构定义 |