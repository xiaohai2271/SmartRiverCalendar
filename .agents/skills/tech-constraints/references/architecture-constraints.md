# 架构约束：数据与视图分离

## 目录
1. [核心原则](#核心原则)
2. [分层架构](#分层架构)
3. [数据流规范](#数据流规范)
4. [违规示例与正确做法](#违规示例与正确做法)

## 核心原则

**展示层不直接操作数据库。** 所有数据操作必须通过 Rust 后端（当前）或 HTTP 后端服务（未来）提供的接口进行。

### 为什么要分离？

1. **跨平台一致性**: Rust 后端统一数据逻辑，多端行为一致
2. **类型安全**: Rust 强类型系统确保数据完整性
3. **安全性**: 敏感操作在 Rust 层控制，前端不可越权
4. **可测试性**: 各层独立测试，降低耦合
5. **可扩展性**: 未来切换到 HTTP 后端服务时，仅需替换 invoke 调用层

## 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                    展示层 (Vue 3)                         │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐     │
│  │  Vue     │───▶│  Pinia   │───▶│   Service     │     │
│  │ 组件     │◀───│  Store   │◀───│   服务层       │     │
│  └──────────┘    └──────────┘    └───────────────┘     │
│                                        │                │
│                                        ▼                │
│                              ┌───────────────┐          │
│                              │  Tauri API    │          │
│                              │  invoke()     │          │
│                              └───────────────┘          │
└─────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────┐
│                    Tauri 后端 (Rust)                       │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐     │
│  │ Commands │───▶│ Repository│───▶│   SQLite      │     │
│  │ (API层)  │    │ (数据访问) │    │   数据库       │     │
│  └──────────┘    └──────────┘    └───────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 各层职责

| 层级 | 技术 | 职责 | 禁止 |
|------|------|------|------|
| 展示层 | Vue 3 + Pinia | UI 渲染、用户交互、状态管理 | 直接操作数据库、直接调用 SQL |
| 服务层 | TypeScript Services | 业务逻辑封装、数据转换、invoke 调用 | 绕过 invoke 访问后端 |
| API 层 | Tauri invoke() | 前后端通信桥梁、参数序列化 | 包含业务逻辑 |
| 数据层 | Rust + SQLite | 数据持久化、CRUD 操作、事务管理 | 包含 UI 逻辑 |

## 数据流规范

### 前端 → 后端 (写操作)

```typescript
// ✅ 正确：通过 Service → invoke 操作数据
// src/services/eventService.ts
import { invoke } from '@tauri-apps/api/core'
import type { CalendarEvent } from '@/types'

export async function createEvent(event: CalendarEvent): Promise<void> {
  await invoke('create_event', { event })
}

// ❌ 错误：前端直接操作数据库
// 绝对禁止在前端代码中出现以下模式:
// - 直接 import SQL 操作库
// - 直接拼接 SQL 语句
// - 直接调用数据库连接
```

### 后端 → 前端 (读操作)

```typescript
// ✅ 正确：通过 invoke 获取数据，Service 层转换
export async function getEvents(dateRange: DateRange): Promise<CalendarEvent[]> {
  const rawEvents = await invoke<RawEvent[]>('get_events', { dateRange })
  // Service 层负责数据格式转换
  return rawEvents.map(toCalendarEvent)
}
```

### Rust 后端 Command 规范

```rust
// src-tauri/src/commands/event.rs
#[tauri::command]
pub async fn create_event(
    state: tauri::State<'_, AppState>,
    event: CalendarEvent,
) -> Result<(), String> {
    // Command 层仅做参数验证和调用 Repository
    let repo = state.event_repo();
    repo.create(event).await.map_err(|e| e.to_string())
}
```

## 违规示例与正确做法

### 场景 1：前端直接查询数据库

```typescript
// ❌ 违规：前端直接使用 SQL
import Database from '@tauri-apps/plugin-sql'
const db = await Database.load('sqlite:calendar.db')
const events = await db.select('SELECT * FROM events')

// ✅ 正确：通过 invoke 获取
const events = await invoke<CalendarEvent[]>('get_events')
```

### 场景 2：前端直接写数据库

```typescript
// ❌ 违规
await db.execute('INSERT INTO events (title, start_time) VALUES (?, ?)', [title, start])

// ✅ 正确
await invoke('create_event', { title, startTime: start })
```

### 场景 3：绕过 Service 层

```typescript
// ❌ 违规：组件中直接调用 invoke
// src/components/calendar/DayView.vue
async function handleCreateEvent() {
  await invoke('create_event', { event })  // 组件直接调用 invoke
}

// ✅ 正确：通过 Service 层
// src/components/calendar/DayView.vue
import { useEventService } from '@/services/eventService'
const eventService = useEventService()
async function handleCreateEvent() {
  await eventService.createEvent(event)
}
```
