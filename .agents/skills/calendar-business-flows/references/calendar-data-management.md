# 日历数据管理流程

## 目录
1. [概述](#概述)
2. [架构设计](#架构设计)
3. [数据模型](#数据模型)
4. [状态管理](#状态管理)
5. [数据操作](#数据操作)
6. [视图数据流](#视图数据流)

## 概述

小河日历采用 **前端 → Tauri invoke → Rust 后端 → SQLite** 的分层架构实现数据持久化。所有数据操作通过 Rust 后端统一处理，确保跨平台一致性，支持 Windows、Android、iOS 三端。

## 架构设计

### 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Pinia      │    │  数据转换    │    │  Tauri API  │     │
│  │  Store      │───▶│  (tauri.ts) │───▶│  invoke()   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri 后端 (Rust)                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Commands   │───▶│ Repositories│───▶│   SQLite    │     │
│  │  (API层)    │    │  (数据访问)  │    │   数据库     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 架构优势

1. **跨平台一致性**：Rust 后端统一数据操作逻辑，三端行为一致
2. **类型安全**：Rust 强类型系统确保数据完整性
3. **性能优化**：Rust 原生性能，SQLite 本地存储
4. **离线支持**：本地 SQLite 数据库，断网可用
5. **安全性**：敏感数据（如密码）在 Rust 层加密存储

### 关键文件

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端 Store | `src/stores/calendar.ts` | 状态管理、业务逻辑 |
| 数据转换 | `src/utils/tauri.ts` | snake_case ↔ camelCase 转换 |
| Rust 命令 | `src-tauri/src/commands.rs` | Tauri 命令定义 |
| 数据仓库 | `src-tauri/src/db/repositories/` | 数据访问层 |
| 数据库结构 | `src-tauri/src/db/schema.rs` | 表结构定义 |

## 数据模型

### ID 策略

所有实体使用 **自增整数 ID**，由 SQLite 的 `INTEGER PRIMARY KEY AUTOINCREMENT` 生成：

- **数据库层**：`id INTEGER PRIMARY KEY AUTOINCREMENT`
- **Rust 层**：`id: i64`
- **前端层**：`id: string`（通过 `String(raw.id)` 转换）

> ⚠️ **注意**：
> - 前端保持 `id: string` 类型是为了兼容外部日历（如 CalDAV）的字符串 ID 格式
> - `calendarId` 参数在传递前需要确保为有效数字，`parseInt` 失败时应回退到默认值 1

### 日历 (Calendar)
```typescript
interface Calendar {
  id: string                    // 自增整数转字符串，如 "1", "2"
  name: string
  color: string
  type: 'local' | 'exchange' | 'caldav'
  accountId?: string            // 关联的外部账号 ID
  visible: boolean
  syncEnabled: boolean
  // 外部日历额外字段
  accountType?: string          // 账号类型（exchange/caldav）
  serverUrl?: string            // 服务器地址
  username?: string             // 用户名
  encryptedPassword?: string    // 加密密码
  calendarUrl?: string          // 日历 URL
  readOnly?: boolean            // 是否只读
}
```

### 事件 (CalendarEvent)
```typescript
interface CalendarEvent {
  id: string                    // 自增整数转字符串
  calendarId: string            // 所属日历 ID
  title: string
  description?: string
  startTime: number             // Unix 时间戳（毫秒）
  endTime: number
  allDay: boolean
  location?: string
  color?: string                // 事件颜色
  reminder?: number             // 提前提醒分钟数
  repeatRule?: RepeatRule       // 重复规则
  externalId?: string           // 外部事件标识（用于同步）
  createdAt: number
  updatedAt: number
}
```

### 视图类型 (CalendarView)
```typescript
type CalendarView = 'day' | 'week' | 'month' | 'year'
```

## 状态管理

### Store 结构
```typescript
export const useCalendarStore = defineStore('calendar', () => {
  // State
  const calendars = ref<Calendar[]>([...])
  const events = ref<CalendarEvent[]>([])
  const currentView = ref<CalendarView>('month')
  const currentDate = ref(new Date())
  const selectedDate = ref<Date | null>(null)
  const isInitialized = ref(false)

  // Getters
  const visibleCalendars = computed(...)
  const visibleEvents = computed(...)
  const currentDateRange = computed(...)
  const eventsForCurrentView = computed(...)

  // Actions - 通过 Tauri invoke 调用 Rust 后端
  async function initialize() {...}
  async function addCalendar(calendar) {...}
  async function updateCalendar(id, updates) {...}
  async function deleteCalendar(id) {...}
  async function addEvent(event) {...}
  async function updateEvent(id, updates) {...}
  async function deleteEvent(id) {...}
  // 外部日历操作
  async function loadExternalCalendars() {...}
  async function loadExternalEvents(startTime, endTime) {...}

  return {...}
})
```

## 数据操作

### 数据操作流程

所有数据操作遵循统一流程：

```
前端调用 → tauri.ts 数据转换 → Tauri invoke → Rust Command → Repository → SQLite
```

### 日历操作

#### 1. 添加日历
```typescript
async function addCalendar(calendar: Omit<Calendar, 'id'>) {
  // 调用 Rust 后端创建日历，返回带有自增 ID 的完整对象
  const created = await invokeCreateCalendar({
    name: calendar.name,
    color: calendar.color,
    type: calendar.type || 'local',
    accountId: calendar.accountId ? parseInt(calendar.accountId) : undefined,
    visible: calendar.visible ?? true,
    syncEnabled: calendar.syncEnabled ?? false
  })
  
  if (created) {
    calendars.value.push(created)
    console.log('Calendar created:', created.id)  // ID 由数据库生成
  }
}
```

#### 2. 更新日历
```typescript
async function updateCalendar(id: string, updates: Partial<Calendar>) {
  const index = calendars.value.findIndex(c => c.id === id)
  if (index !== -1) {
    const calId = parseInt(id)
    if (!isNaN(calId)) {
      const updated = await invokeUpdateCalendar({
        id: calId,
        name: updates.name,
        color: updates.color,
        visible: updates.visible,
        syncEnabled: updates.syncEnabled
      })
      
      if (updated) {
        calendars.value[index] = { ...calendars.value[index], ...updates }
      }
    }
  }
}
```

#### 3. 删除日历
```typescript
async function deleteCalendar(id: string) {
  const calId = parseInt(id)
  if (!isNaN(calId)) {
    await invokeDeleteCalendar(calId)  // 调用 Rust 命令删除
  }
  
  // 更新前端状态
  calendars.value = calendars.value.filter(c => c.id !== id)
  events.value = events.value.filter(e => e.calendarId !== id)
}
```

### 事件操作

#### 1. 添加事件
```typescript
async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  const targetCalendar = calendars.value.find(c => c.id === event.calendarId)
  
  if (targetCalendar && targetCalendar.type !== 'local') {
    // 外部日历：先调用外部服务创建，再保存到本地
    const result = await safeInvoke<any>('create_external_event', {...})
    if (result && result.success) {
      // 创建成功后保存到本地数据库
      await invokeCreateEvent({...})
    }
  } else {
    // 本地日历：直接保存到数据库
    const created = await invokeCreateEvent({
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      allDay: event.allDay,
      calendarId: parseInt(event.calendarId) || 1,
      color: event.color,
      reminder: event.reminder,
      repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
      location: event.location,
      externalId: event.externalId
    })
    
    if (created) {
      events.value.push(created)
    }
  }
}
```

#### 2. 更新事件
```typescript
async function updateEvent(id: string, updates: Partial<CalendarEvent>) {
  const index = events.value.findIndex(e => e.id === id)
  if (index !== -1) {
    const event = events.value[index]
    const calendar = calendars.value.find(c => c.id === event.calendarId)

    if (calendar && calendar.type !== 'local') {
      // 外部日历事件：先更新服务器，再更新本地
      await safeInvoke<any>('update_external_event', {...})
    } else {
      // 本地日历事件：直接更新数据库
      const eventId = parseInt(id)
      if (!isNaN(eventId)) {
        const updated = await invokeUpdateEvent({
          id: eventId,
          title: updates.title ?? event.title,
          // ... 其他字段
        })
        if (updated) {
          events.value[index] = updated
        }
      }
    }
  }
}
```

#### 3. 删除事件
```typescript
async function deleteEvent(id: string) {
  const event = events.value.find(e => e.id === id)
  if (!event) return

  const calendar = calendars.value.find(c => c.id === event.calendarId)

  if (calendar && calendar.type !== 'local') {
    // 外部日历事件：先从服务器删除，再从本地删除
    await safeInvoke<any>('delete_external_event', {...})
  } else {
    // 本地日历事件：直接从数据库删除
    const eventId = parseInt(id)
    if (!isNaN(eventId)) {
      await invokeDeleteEvent(eventId)
    }
  }
  
  events.value = events.value.filter(e => e.id !== id)
}
```

### 初始化流程

```typescript
async function initialize() {
  if (isInitialized.value) return

  try {
    // 1. 从 localStorage 加载默认视图设置
    const storedSettings = localStorage.getItem('app-settings')
    if (storedSettings) {
      const settings = JSON.parse(storedSettings)
      if (settings.defaultView) {
        currentView.value = settings.defaultView
      }
    }

    // 2. 通过 Tauri 命令加载本地日历
    const loadedCalendars = await invokeGetCalendars()
    if (loadedCalendars.length > 0) {
      calendars.value = loadedCalendars
    } else {
      // 数据库为空，保存默认日历到数据库
      const defaultCal = calendars.value[0]
      const created = await invokeCreateCalendar({
        name: defaultCal.name,
        color: defaultCal.color,
        type: defaultCal.type,
        visible: defaultCal.visible,
        syncEnabled: defaultCal.syncEnabled
      })
      if (created) {
        calendars.value = [created]
      }
    }

    // 3. 加载外部账号和日历
    await loadExternalCalendars()

    // 4. 通过 Tauri 命令加载事件
    const loadedEvents = await invokeGetEvents()
    events.value = loadedEvents

    // 5. 加载外部事件
    const { start, end } = currentDateRange.value
    await loadExternalEvents(start.getTime(), end.getTime())

    isInitialized.value = true
  } catch (error) {
    console.error('Failed to initialize calendar store:', error)
  }
}
```

## 视图数据流

### 日期范围计算
```typescript
const currentDateRange = computed((): DateRange => {
  const date = currentDate.value
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (currentView.value) {
    case 'day':
      const startOfDay = new Date(year, month, date.getDate())
      return { start: startOfDay, end: new Date(startOfDay.getTime() + 86400000) }
    case 'week':
      const dayOfWeek = date.getDay()
      const startOfWeek = new Date(year, month, date.getDate() - dayOfWeek)
      return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 86400000) }
    case 'month':
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)
      return { start: startOfMonth, end: endOfMonth }
    case 'year':
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) }
  }
})
```

### 事件过滤
```typescript
const visibleEvents = computed(() => {
  const visibleIds = visibleCalendars.value.map(c => c.id)
  return events.value.filter(e => visibleIds.includes(e.calendarId))
})

const eventsForCurrentView = computed(() => {
  const { start, end } = currentDateRange.value
  return visibleEvents.value.filter(e => {
    return e.startTime >= start.getTime() && e.startTime <= end.getTime()
  })
})
```

## Rust 后端 API

### Tauri 命令概览

| 命令 | 功能 | 参数 |
|------|------|------|
| `get_calendars` | 获取所有日历 | 无 |
| `create_calendar` | 创建日历 | name, color, type, account_id, visible, sync_enabled |
| `update_calendar` | 更新日历 | id, name?, color?, visible?, sync_enabled? |
| `delete_calendar` | 删除日历 | id |
| `get_events` | 获取所有事件 | 无 |
| `get_events_by_calendar` | 按日历获取事件 | calendar_id |
| `get_events_by_time_range` | 按时间范围获取事件 | start_time, end_time |
| `create_event` | 创建事件 | title, description?, start_time, end_time, all_day, calendar_id, ... |
| `update_event` | 更新事件 | id, title, description?, ... |
| `delete_event` | 删除事件 | id |

### 数据转换

前端 `src/utils/tauri.ts` 负责数据格式转换：

```typescript
// Rust 后端返回 snake_case 字段
interface RawCalendar {
  id: number
  name: string
  color: string
  type: string
  account_id: number | null
  visible: boolean
  sync_enabled: boolean
  created_at: number
  updated_at: number
}

// 转换为前端 camelCase 格式
export function transformCalendar(raw: RawCalendar): Calendar {
  return {
    id: String(raw.id),  // 数字转字符串
    name: raw.name,
    color: raw.color,
    type: raw.type as 'local' | 'exchange' | 'caldav',
    accountId: raw.account_id != null ? String(raw.account_id) : undefined,
    visible: raw.visible,
    syncEnabled: raw.sync_enabled,
  }
}
```

### 数据库表结构

```sql
-- 日历表
CREATE TABLE calendars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'local',
    account_id INTEGER,
    visible INTEGER NOT NULL DEFAULT 1,
    sync_enabled INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 事件表
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    calendar_id INTEGER NOT NULL,
    color TEXT,
    reminder INTEGER,
    repeat_rule TEXT,
    location TEXT,
    external_id TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);
```

## 相关文件

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| 前端状态 | `src/stores/calendar.ts` | 日历状态管理、业务逻辑 |
| 数据转换 | `src/utils/tauri.ts` | invoke 封装、数据格式转换 |
| 类型定义 | `src/types/index.ts` | TypeScript 接口定义 |
| 日历组件 | `src/components/calendar/` | UI 组件 |
| Rust 命令 | `src-tauri/src/commands.rs` | Tauri 命令定义 |
| 数据仓库 | `src-tauri/src/db/repositories/calendar.rs` | 日历数据访问 |
| 数据仓库 | `src-tauri/src/db/repositories/event.rs` | 事件数据访问 |
| 数据库结构 | `src-tauri/src/db/schema.rs` | 表结构定义 |