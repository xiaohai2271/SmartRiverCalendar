# 数据层迁移专题

## 概述

本文档记录小河日历从 **前端本地存储** 到 **Rust 后端 SQLite 数据库** 的数据层迁移过程。该迁移实现了真正的跨平台数据一致性，所有数据操作统一通过 Rust 后端处理。

## 迁移背景

### 迁移前架构
- **日历/事件**：存储在 localStorage 中
- **待办事项**：存储在 localStorage 中
- **外部账号**：通过 EWS/CalDAV 服务获取，但数据不同步到本地

### 迁移后架构
```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Pinia      │    │  tauri.ts   │    │  invoke()   │     │
│  │  Store      │───▶│  数据转换    │───▶│  (Tauri)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri 后端 (Rust)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Commands   │───▶│ Repository  │───▶│   SQLite    │     │
│  │  (API层)    │    │  (数据访问)  │    │   数据库     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 迁移范围

### 已迁移的数据

| 数据类型 | 操作 | Rust 命令 | Repository |
|---------|------|----------|------------|
| 日历 (Calendar) | CRUD | `get_calendars`, `create_calendar`, `update_calendar`, `delete_calendar` | `CalendarRepository` |
| 事件 (Event) | CRUD | `get_events`, `get_events_by_calendar`, `get_events_by_time_range`, `create_event`, `update_event`, `delete_event` | `EventRepository` |
| 待办 (Todo) | CRUD | `get_todos`, `get_todos_by_calendar`, `create_todo`, `update_todo`, `delete_todo` | `TodoRepository` |
| 账号 (Account) | CRUD | `get_all_db_accounts`, `get_account_by_id`, `create_account`, `update_account`, `delete_db_account` | `AccountRepository` |
| 同步状态 (SyncState) | CRUD | `get_sync_state`, `upsert_sync_state`, `delete_sync_state` | `SyncStateRepository` |

### 关键文件

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端 Store | `src/stores/calendar.ts` | 日历状态管理 |
| 前端 Store | `src/stores/todo.ts` | 待办状态管理 |
| 数据转换 | `src/utils/tauri.ts` | invoke 封装、camelCase ↔ snake_case 转换 |
| Rust 命令 | `src-tauri/src/commands.rs` | Tauri 命令定义（本地数据） |
| 数据仓库 | `src-tauri/src/db/repositories/` | 数据访问层 |
| 数据库结构 | `src-tauri/src/db/schema.rs` | 表结构定义 |

## Tauri 参数映射机制

### camelCase vs snake_case

Tauri 2.x 在前端 `invoke()` 调用时使用 **camelCase** 参数名，Rust 后端函数参数使用 **snake_case**。Tauri 框架会自动进行参数名映射：

```typescript
// 前端调用（使用 camelCase）
invoke('create_todo', {
  title: '待办标题',
  calendarId: 1,        // camelCase
  dueDate: 1699999999,  // camelCase
})
```

```rust
// Rust 后端接收（使用 snake_case）
#[tauri::command]
pub fn create_todo(
    title: String,
    calendar_id: i64,    // 自动映射到前端的 calendarId
    due_date: Option<i64>, // 自动映射到前端的 dueDate
) -> Result<DbTodo, DatabaseError> {
    // ...
}
```

### src/utils/tauri.ts 中的转换

```typescript
// 创建待办 - 使用 camelCase 调用 Tauri
export async function invokeCreateTodo(params: {
  title: string
  description?: string
  dueDate?: number      // 前端 camelCase
  completed?: boolean
  priority?: string
  calendarId: number    // 前端 camelCase
}): Promise<Todo | null> {
  const result = await safeInvoke<RawTodo>('create_todo', {
    title: params.title,
    description: params.description ?? null,
    dueDate: params.dueDate ?? null,      // camelCase - Tauri 自动转 due_date
    completed: params.completed ?? null,
    priority: params.priority ?? null,
    calendarId: params.calendarId,       // camelCase - Tauri 自动转 calendar_id
  })
  return result ? transformTodo(result) : null
}
```

## Bug 修复记录

### Issue: 待办创建失败

**问题描述**：通过 UI 创建待办时，控制台报错 `invalid args calendarId for command create_todo: command create_todo missing required key calendarId`

**根因分析**：
1. `TodosView.vue` 传入 `calendarId: 'default'`（字符串）
2. `todoStore.addTodo()` 中 `parseInt('default')` 返回 `NaN`
3. `NaN` 无法被 Tauri 序列化为 `i64` 类型
4. Rust 后端收不到有效的 `calendar_id` 参数

**修复方案**：
```typescript
// 修复前
const calendarId = todo.calendarId ? parseInt(todo.calendarId) : 1

// 修复后
const parsedId = todo.calendarId ? parseInt(todo.calendarId) : NaN
const calendarId = isNaN(parsedId) ? 1 : parsedId
```

**涉及文件**：
- `src/stores/todo.ts` - addTodo、updateTodo 函数

## 测试验证

### Rust 后端测试
```bash
cargo test --lib
# 150 tests passed
```

### 前端测试
```bash
pnpm test:run
# 98 tests passed
```

### 功能测试
通过 Tauri MCP 进行 UI 自动化测试：
1. 打开待办页面
2. 点击"新建待办"
3. 输入标题
4. 点击"添加待办"
5. 验证待办出现在列表中

## 相关提交记录

| 提交 | 描述 |
|------|------|
| `4d0d4ce` | feat(db): add database module with repositories |
| `b3a5bcb` | feat(commands): add Tauri commands for local data CRUD |
| `14f3b62` | refactor(frontend): migrate stores to use Rust backend for data operations |
| `b3d0d4b` | docs: update business flow documentation for data layer migration |
| `d76ea41` | fix: 修复设置页面路由导航错误，补充缺失的 database 模块 |
| `4384ca8` | chore: 清理未使用的 import，补充 tsconfig 路径别名配置 |
| `40c54f3` | fix: 修复待办事项创建失败的问题 |
| `90e268f` | merge: 解决与 main 分支的冲突，合并数据层迁移命令和时钟点击 Hook 命令 |
