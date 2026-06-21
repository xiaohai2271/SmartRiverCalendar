# 性能优化设计：按时间范围加载 + IPC 批量处理

> 来源：[#54 项目安全性、架构设计与性能优化综合审计报告](https://github.com/xiaohai2271/SmartRiverCalender/issues/54)
> 日期：2026-06-21

## 背景

当前性能问题：

1. **全量加载**：`events.value` 通过 `eventRepo.getAll()` 加载所有事件到内存，组件在前端自行 filter。1000 事件约影响 ~1.5MB 内存（含 Vue 响应式开销），10000 事件可达 ~15.5MB
2. **IPC 效率低下**：外部日历同步时逐条 IPC（子项目2阶段4已解决），但 `getAll` 全量返回仍是大流量 IPC

子项目2完成后，外部日历同步的 IPC 问题已由 Rust 后端接管。子项目3聚焦于**内存和前端数据加载策略优化**。

## 设计

### 1. 视图驱动加载（核心改造）

#### 当前数据流

```
eventRepo.getAll() → events.value[全量] → 各组件自行 filter
```

#### 目标数据流

```
eventRepo.getByTimeRange(range + buffer) → events.value[窗口内] → 组件直接使用
```

#### 1.1 加载窗口策略

| 视图 | 加载窗口 | 缓冲区 | 示例（2026-06-21 当前月视图） |
|------|---------|--------|------|
| day | 当天 ± 1 天 | 前后各 1 天 | 6/20 - 6/22 |
| week | 当前周 ± 3 天 | 前后各 3 天 | 6/15 - 6/28 |
| month | 当前月 ± 7 天 | 前后各 7 天 | 5/24 - 7/7 |
| year | 逐月并行加载 12 个月 | 每月 ± 7 天 | `Promise.all` 并行，单月失败不影响其他月，去重合并 |

缓冲区确保导航到前一天/后一天时数据已预加载。年视图切换时逐月加载（12 次 `getByTimeRange`，每次 1 个月 ± 7 天，使用 `Promise.all` 并行加载，单月失败不影响其他月），数据缓存到 `events.value` 中。

#### 1.1.1 computeLoadRange 实现

```typescript
// 使用 src/utils/date.ts 中已有的日期工具函数
import { startOfDay, startOfWeek, startOfMonth, endOfDay, endOfWeek, endOfMonth } from '@/utils/date'

function computeLoadRange(
  view: 'day' | 'week' | 'month' | 'year',
  date: Date
): { start: number; end: number } {
  const d = new Date(date)
  switch (view) {
    case 'day': {
      const start = startOfDay(d)
      const end = endOfDay(d)
      return {
        start: new Date(start.getTime() - DAY_MS).getTime(),
        end: new Date(end.getTime() + DAY_MS).getTime(),
      }
    }
    case 'week': {
      const weekStart = startOfWeek(d)
      const weekEnd = endOfWeek(d)
      return {
        start: new Date(weekStart.getTime() - 3 * DAY_MS).getTime(),
        end: new Date(weekEnd.getTime() + 3 * DAY_MS).getTime(),
      }
    }
    case 'month': {
      const monthStart = startOfMonth(d)
      const monthEnd = endOfMonth(d)
      return {
        start: new Date(monthStart.getTime() - 7 * DAY_MS).getTime(),
        end: new Date(monthEnd.getTime() + 7 * DAY_MS).getTime(),
      }
    }
    case 'year': {
      // 年视图：逐月加载，Promise.all 并行
      // computeLoadRange 返回首月范围，initialize 中特殊处理年视图
      // 逐月调用 getByTimeRangeAndCalendars 后合并结果
      const firstMonth = startOfMonth(new Date(d.getFullYear(), 0, 1))
      const firstMonthEnd = endOfMonth(firstMonth)
      return {
        start: new Date(firstMonth.getTime() - 7 * DAY_MS).getTime(),
        end: new Date(firstMonthEnd.getTime() + 7 * DAY_MS).getTime(),
      }
    }
  }
}

// 年视图专用：并行加载 12 个月
async function loadYearView(date: Date): Promise<void> {
  const { eventRepo } = usePlatform()
  const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
  if (visibleCalendarIds.length === 0) {
    events.value = []
    return
  }
  const year = date.getFullYear()
  const monthlyRanges = Array.from({ length: 12 }, (_, i) => {
    const monthStart = startOfMonth(new Date(year, i, 1))
    const monthEnd = endOfMonth(monthStart)
    return {
      start: new Date(monthStart.getTime() - 7 * DAY_MS).getTime(),
      end: new Date(monthEnd.getTime() + 7 * DAY_MS).getTime(),
    }
  })
  const results = await Promise.all(
    monthlyRanges.map(range =>
      eventRepo.getByTimeRangeAndCalendars(range.start, range.end, visibleCalendarIds)
        .catch(() => [] as CalendarEvent[])  // 单月失败不影响其他月
    )
  )
  // 去重合并（相邻月份缓冲区有重叠）
  const eventMap = new Map<number, CalendarEvent>()
  for (const monthEvents of results) {
    for (const event of monthEvents) {
      eventMap.set(event.id, event)
    }
  }
  events.value = Array.from(eventMap.values())
  loadedRange.value = {
    start: monthlyRanges[0].start,
    end: monthlyRanges[11].end,
  }
}

const DAY_MS = 86400000
```

#### 1.2 CalendarStore 状态变更

```typescript
// 新增状态
const loadedRange = ref<{ start: number; end: number } | null>(null)
const totalEventCount = ref<number>(0)

// 修改初始化
async function initialize() {
  // ...
  const { start, end } = computeLoadRange(currentView.value, currentDate.value)
  const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
  const loadedEvents = await eventRepo.getByTimeRangeAndCalendars(
    start, end, visibleCalendarIds
  )
  events.value = loadedEvents
  loadedRange.value = { start, end }
  totalEventCount.value = await eventRepo.getCount()
  // ...
}

// watch visibleCalendars 变化，300ms 防抖后重新加载
watch(visibleCalendars, debounce(async () => {
  if (loadedRange.value) {
    const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
    if (visibleCalendarIds.length === 0) {
      events.value = []
      return
    }
    events.value = await eventRepo.getByTimeRangeAndCalendars(
      loadedRange.value.start, loadedRange.value.end, visibleCalendarIds
    )
  }
}, 300))

// debounce 工具函数（不引入 @vueuse/core 依赖）
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as any
}
```

#### 1.3 视图切换/日期导航

当前代码中 `setView`、`navigateToDate`、`next`、`prev` 仅更新 `currentView`/`currentDate` ref，不触发范围加载。现有 `watch(currentDateRange)`（`calendar.ts:862`）仅触发 `loadExternalEvents`，需替换为 loadedRange 重载逻辑。

```typescript
// watch currentView + currentDate，触发范围加载
watch([currentView, currentDate], async () => {
  if (!isInitialized.value || !loadedRange.value) return
  const newRange = computeLoadRange(currentView.value, currentDate.value)

  // 如果新窗口在已加载范围内 → 不重新加载
  if (newRange.start >= loadedRange.value.start &&
      newRange.end <= loadedRange.value.end) {
    return
  }

  // 如果超出 → 重新加载
  const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
  const loadedEvents = await eventRepo.getByTimeRangeAndCalendars(
    newRange.start, newRange.end, visibleCalendarIds
  )
  events.value = loadedEvents
  loadedRange.value = newRange
})
```

#### 1.4 reloadFromDatabase 改造

```typescript
async function reloadFromDatabase(): Promise<void> {
  const { eventRepo } = usePlatform()
  if (loadedRange.value) {
    const visibleCalendarIds = visibleCalendars.value.map(c => c.id)
    events.value = await eventRepo.getByTimeRangeAndCalendars(
      loadedRange.value.start, loadedRange.value.end, visibleCalendarIds
    )
  } else {
    // loadedRange 为 null（异常场景），加载默认范围
    const defaultRange = computeLoadRange(currentView.value, currentDate.value)
    events.value = await eventRepo.getByTimeRangeAndCalendars(
      defaultRange.start, defaultRange.end,
      visibleCalendars.value.map(c => c.id)
    )
    loadedRange.value = defaultRange
  }
  totalEventCount.value = await eventRepo.getCount()
}
```

#### 1.5 CRUD 操作与 loadedRange 一致性

`addEvent`/`updateEvent`/`deleteEvent` 必须维护 `events.value` 与 `loadedRange` 的语义一致：

```typescript
async function addEvent(params: EventCreateParams): Promise<CalendarEvent> {
  const created = await eventRepo.createWithSync(params)
  // 仅当事件在 loadedRange 内 且 属于可见日历 时才加入内存
  const isVisible = visibleCalendars.value.some(c => c.id === created.calendarId)
  if (loadedRange.value && isEventInRange(created, loadedRange.value) && isVisible) {
    events.value.push(created)
  }
  totalEventCount.value++
  return created
}

async function updateEvent(params: EventUpdateParams): Promise<CalendarEvent> {
  const updated = await eventRepo.updateWithSync(params)
  const index = events.value.findIndex(e => e.id === updated.id)
  const isVisible = visibleCalendars.value.some(c => c.id === updated.calendarId)
  const isInRange = loadedRange.value && isEventInRange(updated, loadedRange.value)
  if (index === -1) {
    // 事件原来不在内存中，更新后如果在范围内且可见则加入
    if (isInRange && isVisible) {
      events.value.push(updated)
    }
  } else {
    // 事件在内存中，更新后如果移出范围或不可见则移除
    if (!isInRange || !isVisible) {
      events.value.splice(index, 1)
    } else {
      events.value[index] = updated
    }
  }
  return updated
}

async function deleteEvent(id: number, calendarId: number): Promise<void> {
  await eventRepo.deleteWithSync(id, calendarId)
  const index = events.value.findIndex(e => e.id === id)
  if (index !== -1) {
    events.value.splice(index, 1)
  }
  totalEventCount.value--
}

function isEventInRange(event: CalendarEvent, range: { start: number; end: number }): boolean {
  return event.startTime < range.end && event.endTime > range.start
}
```

#### 1.6 loadExternalCalendars / loadExternalEvents 与 loadedRange 一致性

当前 `loadExternalCalendars` 和 `loadExternalEvents`（`calendar.ts:91-298`）均直接操作 `events.value`（line 291-292 的 filter + push），绕过 loadedRange。改造为：

```typescript
async function loadExternalCalendars(): Promise<void> {
  // ... 外部日历同步逻辑（Rust 端写入 SQLite 或前端 applySyncResult 持久化到 DB）...
  // 同步完成后按 loadedRange 重新加载，而非直接操作 events.value
  await reloadFromDatabase()
}

async function loadExternalEvents(): Promise<void> {
  // ... 同上，同步完成后统一 reloadFromDatabase ...
  await reloadFromDatabase()
}
```

### 2. 新增 Repository 接口

```typescript
// src/platform/types/event.repository.ts 新增

export interface IEventRepository {
  // 已有
  getAll(): Promise<CalendarEvent[]>
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>
  create(params: EventCreateParams): Promise<CalendarEvent>
  update(params: EventUpdateParams): Promise<CalendarEvent>
  delete(id: number): Promise<void>

  // 新增（子项目3）
  getByTimeRangeAndCalendars(
    startTime: number, endTime: number, calendarIds: number[]
  ): Promise<CalendarEvent[]>
  getCount(): Promise<number>
  getUpcoming(limit: number, calendarIds: number[]): Promise<CalendarEvent[]>
  search(query: string, limit: number, calendarIds: number[]): Promise<CalendarEvent[]>
}
```

**`userId` 处理**：TypeScript 接口不暴露 `userId` 参数，由 Repository 实现层自动注入。Tauri 端通过 `safeInvoke` 传参时从当前认证状态获取 `userId`（`authStore.userId`）；Web 端通过 API 请求的认证 token 在服务端自动关联。Rust 端命令签名需 `user_id` 参数，由 `TauriEventRepository` 实现在调用 `safeInvoke` 时附加。

**`calendarIds` 为空数组处理**：当用户隐藏所有日历时，`calendarIds` 为 `[]`，SQL `IN ()` 在 SQLite 中是语法错误。调用方（Store）应在传入空数组时短路返回空结果，不发起 IPC 调用。Repository 实现层也应做防御性检查。
```

对应 Rust 端新增命令：

```rust
#[tauri::command]
pub fn get_events_by_time_range_and_calendars(
    start_time: i64, end_time: i64, calendar_ids: Vec<i64>, user_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError>

#[tauri::command]
pub fn get_event_count(
    user_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<i64, DatabaseError>

#[tauri::command]
pub fn get_upcoming_events(
    limit: i64, user_id: i64, calendar_ids: Vec<i64>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError>

#[tauri::command]
pub fn search_events(
    query: &str, limit: i64, user_id: i64, calendar_ids: Vec<i64>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError>
```

SQL 实现：

```sql
-- getByTimeRangeAndCalendars
SELECT ... FROM events
WHERE start_time < ?1 AND end_time > ?2
  AND calendar_id IN (?3, ?4, ...)
  AND user_id = ?N
  AND deleted_at IS NULL
ORDER BY start_time ASC

-- getCount
SELECT COUNT(*) FROM events WHERE deleted_at IS NULL AND user_id = ?1

-- getUpcoming（需过滤用户 + 可见日历）
SELECT ... FROM events WHERE start_time > ?1
  AND user_id = ?2
  AND calendar_id IN (?3, ?4, ...)
  AND deleted_at IS NULL
ORDER BY start_time ASC LIMIT ?N

-- search（需过滤用户 + 可见日历 + LIKE 通配符转义）
SELECT ... FROM events
WHERE (title LIKE '%' || ?1 || '%' ESCAPE '\' OR description LIKE '%' || ?1 || '%' ESCAPE '\')
  AND user_id = ?2
  AND calendar_id IN (?3, ?4, ...)
  AND deleted_at IS NULL
ORDER BY start_time DESC LIMIT ?N
```

**重要**：所有 SQL 查询必须包含 `user_id` 过滤，防止多用户场景下数据泄漏。`getUpcoming` 和 `search` 还需接受 `calendarIds` 参数，仅返回可见日历的事件。`search` 的 LIKE 通配符（`%`、`_`）需在 Rust 端转义后再传入查询。`user_id` 类型为 `i64`（对应 schema 中的 `INTEGER`），非 `&str`。

#### 2.1 数据库索引优化

新增复合索引以支持 `getByTimeRangeAndCalendars` 的高效范围扫描：

```sql
-- 当前索引（单列，无法高效支持复合查询）
-- idx_events_calendar_id ON events(calendar_id)
-- idx_events_start_time ON events(start_time)

-- 新增复合索引
CREATE INDEX IF NOT EXISTS idx_events_cal_start ON events(calendar_id, start_time);
```

复合索引允许 SQLite 先用 `calendar_id` 定位，再在 `start_time` 上做范围扫描，避免全表扫描。

### 3. 边缘场景处理

#### 3.1 ScheduleView（搜索 + 日期范围场景）

ScheduleView 支持搜索和任意日期范围筛选，两者都独立于日历视图的 loadedRange。搜索走 SQL 层查询，日期范围也走独立查询：

```typescript
// ScheduleView 内部
const searchResults = ref<CalendarEvent[]>([])
const { eventRepo } = usePlatform()
const visibleCalendarIds = calendarStore.visibleCalendars.map(c => c.id)

async function searchEvents(query: string) {
  if (!query) {
    // 无搜索词时，如果有日期范围则走独立查询，否则用 Store 数据
    if (dateRange.value) {
      searchResults.value = await eventRepo.getByTimeRangeAndCalendars(
        dateRange.value.start, dateRange.value.end, visibleCalendarIds
      )
    } else {
      searchResults.value = calendarStore.eventsForCurrentView
    }
    return
  }
  // SQL 层 LIKE 搜索，不绕过加载窗口
  searchResults.value = await eventRepo.search(query, 100, visibleCalendarIds)
}
```

#### 3.2 UserProfile 事件计数

```typescript
// 替换 calendarStore.events.length
const totalEventCount = computed(() => calendarStore.totalEventCount)
```

#### 3.3 Reminder 服务独立查询

**必须与性能优化同步改造**：当前 `reminder.ts:887` 遍历 `calendarStore.visibleEvents`，改造后 `events.value` 只含窗口内数据，Reminder 会漏掉窗口外的提醒事件——这是功能回归。改造后 Reminder 走独立查询：

```typescript
// reminder-core.ts 中
async function checkAndSendReminders() {
  const now = Date.now()
  // 独立查询近未来事件，不依赖 Store 的 loadedRange
  const upcomingEvents = await eventRepo.getByTimeRange(now - 3600000, now + 172800000)
  // ...
}
```

#### 3.4 HomeView

HomeView 需要 today/week/month/upcoming 四种范围。**HomeView 不能依赖 `eventsForCurrentView`**，因为 `eventsForCurrentView` 绑定的是日历视图的 `currentView`/`currentDate`，而非 HomeView 的需要。例如用户在日历视图导航到3个月后，再回 HomeView，`loadedRange` 不覆盖今天，today 事件会丢失。

HomeView 应全部走独立 Repository 查询：

```typescript
// HomeView 内部
const { eventRepo } = usePlatform()
const visibleCalendarIds = calendarStore.visibleCalendars.map(c => c.id)

const todayEvents = await eventRepo.getByTimeRangeAndCalendars(
  todayStart, tomorrowStart, visibleCalendarIds
)
const weekEvents = await eventRepo.getByTimeRangeAndCalendars(
  weekStart, weekEnd, visibleCalendarIds
)
const monthEvents = await eventRepo.getByTimeRangeAndCalendars(
  monthStart, monthEnd, visibleCalendarIds
)
const upcomingEvents = await eventRepo.getUpcoming(5, visibleCalendarIds)
```

### 4. 组件适配

**关键发现**：当前所有组件直接使用 `calendarStore.events.filter(...)`，而非 Store 中已有的 `eventsForCurrentView` computed。改造必须包含组件迁移。

**前置修复**：当前 `eventsForCurrentView`（`calendar.ts:330-335`）的重叠检查逻辑有误，使用 `startTime >= start && startTime <= end`，会遗漏跨范围的多日事件（如事件从范围前开始、在范围内结束）。必须修正为与 SQL 一致的重叠逻辑：

```typescript
// 修正前（错误）
return e.startTime >= start.getTime() && e.startTime <= end.getTime()

// 修正后（与 SQL overlap 一致）
return e.startTime < end.getTime() && e.endTime > start.getTime()
```

| 组件 | 当前访问方式 | 改造后 | 说明 |
|------|------------|--------|------|
| MonthView | `calendarStore.events` → `computeEventLanes` + `.filter(getEventsForDay)` | `calendarStore.eventsForCurrentView` | 需确保泳道计算数据充足（月 ± 7天缓冲区覆盖） |
| WeekView | `calendarStore.events.filter(isSameDay)` | `calendarStore.eventsForCurrentView` | 直接使用 |
| DayView | `calendarStore.events.filter(isSameDay)` | `calendarStore.eventsForCurrentView` | 直接使用 |
| HomeView | `calendarStore.events.filter(today/week/month/upcoming)` | 全部走独立 Repository 查询 | 不依赖 Store 的 loadedRange，避免日历视图导航后 HomeView 数据丢失 |
| PopupCalendarGrid | `calendarStore.events.filter(getEventsForDay)` | `calendarStore.eventsForCurrentView` | 直接使用 |
| CalendarPopupView | `calendarStore.events.some(...)` | 独立 `eventRepo.getByTimeRange` | 独立窗口，有自己的月份导航，不依赖 Store 的 loadedRange |
| UserProfile | `calendarStore.events.length` | `calendarStore.totalEventCount` | 新增轻量计数 |
| Reminder | `calendarStore.visibleEvents` | 独立 `eventRepo.getByTimeRange` | 不依赖 Store |

#### 4.1 HomeView upcomingEvents 独立查询

`upcomingEvents`（未来所有事件，取前5）无法被任何加载窗口覆盖，需走独立查询：

```typescript
// IEventRepository 新增
getUpcoming(limit: number): Promise<CalendarEvent[]>
```

对应 Rust 端：
```sql
SELECT ... FROM events WHERE start_time > ?1 AND deleted_at IS NULL
ORDER BY start_time ASC LIMIT ?2
```

#### 4.2 ScheduleView 搜索方案

设计文档 §3.1 建议 ScheduleView 搜索时调用 `eventRepo.getAll()`，但这**绕过了性能优化目的**。改为 SQL 层搜索：

```typescript
// IEventRepository 新增
search(query: string, limit: number): Promise<CalendarEvent[]>
```

对应 Rust 端：
```sql
SELECT ... FROM events WHERE (title LIKE ?1 OR description LIKE ?1) AND deleted_at IS NULL
ORDER BY start_time DESC LIMIT ?2
```

### 5. 内存优化效果预估

| 事件总量 | 当前内存影响 | 优化后（月视图） | 降幅 |
|----------|------------|----------------|------|
| 1,000 | ~1.5 MB | ~0.15 MB | 90% |
| 5,000 | ~7.8 MB | ~0.3 MB | 96% |
| 10,000 | ~15.5 MB | ~0.5 MB | 97% |

假设月视图加载约 50-100 个事件（月 ± 7天范围内的典型量级）。

## 测试改动计划

### 受影响测试文件（~10 个用例会断裂）

| 测试文件 | 断裂原因 | 改动类型 | 优先级 |
|---------|---------|---------|--------|
| `calendar-event-routing.test.ts` | `mockEventGetAll` → `mockEventGetByTimeRangeAndCalendars` | 修改 mock 和断言 | Must-fix |
| `calendar-sync.test.ts` | `mockEventGetAll` → `mockEventGetByTimeRangeAndCalendars` | 修改 mock | Must-fix |
| `calendar-identity-switch.test.ts` | `mockEventGetAll` → `mockEventGetByTimeRangeAndCalendars` | 修改 mock | Must-fix |
| `provider.test.ts` | `eventRepo` mock 需补充新方法 | 补充 mock | Must-fix |

### 需新增测试

| 测试文件 | 测试内容 | 优先级 |
|---------|---------|--------|
| `calendar-loadedRange.test.ts` | loadedRange 初始化、视图切换扩展、reloadFromDatabase 重置、null fallback、CRUD 守卫（addEvent 范围外不 push、updateEvent 移出范围则移除、deleteEvent 正常） | Must-fix |
| `calendar-visibleCalendars-watch.test.ts` | watch visibleCalendars 触发重新加载 | Must-fix |
| `event-repo-getByTimeRangeAndCalendars.test.ts` (Tauri) | 参数传递、返回值转换、null 返回抛 RepositoryError | Must-fix |
| `event-repo-getByTimeRangeAndCalendars.test.ts` (Web) | API 调用、参数格式、错误处理 | Must-fix |
| `event-repo-getCount.test.ts` | 计数查询、user_id 过滤、返回值类型 | Must-fix |
| `event-repo-getUpcoming.test.ts` | limit 参数传递、结果排序 | Must-fix |
| `event-repo-search.test.ts` | LIKE 查询、limit、空结果 | Must-fix |
| `security/capabilities-permissions.test.ts` | 权限最小化回归 | Must-fix |

### 跨子项目测试改动总览

以下汇总所有子项目的测试影响，确保实施时有序推进：

| 子项目 | 阶段 | Must-fix 改动 | 新增测试文件 |
|--------|------|--------------|-------------|
| 1 安全加固 | - | `provider.test.ts` 补充 mock | `capabilities-permissions.test.ts` |
| 2 架构重构 | S1 | `calendar-event-routing.test.ts` 3处断言、`calendar-identity-switch.test.ts` 补 mock、`provider.test.ts` 补 mock | `event-repo-withsync.test.ts` ×2 |
| 2 架构重构 | S2 | `calendar-sync.test.ts` 调整 | `externalCalendarSync.test.ts` |
| 2 架构重构 | S3 | `reminder.test.ts` 全部25个用例迁移、`ReminderPopup.test.ts` import 路径 | `reminder-core.test.ts`、`reminder-ui.test.ts`、`reminder-repo.test.ts` ×2 |
| 2 架构重构 | S4 | `sync-flow.test.ts` mock 更新、`cloudSync.test.ts` 断言更新 | `sync-repo-simplified.test.ts` |
| 3 性能优化 | - | `calendar-event-routing.test.ts` mock 改为 getByTimeRangeAndCalendars、`calendar-sync.test.ts` 同上、`calendar-identity-switch.test.ts` 同上、`provider.test.ts` 补 mock | `calendar-loadedRange.test.ts`、`event-repo-getByTimeRangeAndCalendars.test.ts` ×2、`event-repo-getCount.test.ts` |

### 实施顺序建议

测试改动应与代码改动同步，每个阶段完成后立即运行 `pnpm test:run` 确保：

1. **阶段1完成后**：运行 calendar-event-routing、calendar-identity-switch、provider 相关测试
2. **阶段2完成后**：运行 calendar-sync 相关测试
3. **阶段3完成后**：运行 reminder 全套测试 + 新增测试
4. **阶段4完成后**：运行 sync-flow、cloudSync 相关测试
5. **性能优化完成后**：运行 calendar-loadedRange + 所有受影响测试

## 验证方案

### 功能验证

1. **日/周/月/年视图切换**：事件正确显示，无遗漏
2. **日期导航**：前一天/后一天切换流畅，数据预加载
3. **ScheduleView 搜索**：全量搜索正常
4. **UserProfile 计数**：显示正确的事件总数
5. **Reminder 提醒**：独立查询路径正常触发

### 性能基准测试

| 场景 | 测试方法 | 指标 |
|------|---------|------|
| 1000 事件月视图加载 | `performance.now()` 计时 | IPC 传输时间 + 渲染时间 |
| 视图切换响应时间 | 月→周→日连续切换 | 总耗时 |
| 内存占用 | `performance.memory.usedJSHeapSize` | 峰值内存 |
| IPC 调用次数 | DevTools Network 计数 | 视图切换时 IPC 数量 |

### 回归测试

1. `pnpm test:run` 全量通过
2. 覆盖率 > 50%
3. 所有新增测试文件通过

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/platform/types/event.repository.ts` | 修改 | 新增 `getByTimeRangeAndCalendars`、`getCount`、`getUpcoming`、`search` |
| `src/platform/tauri/event.repo.ts` | 修改 | 实现新方法 |
| `src/platform/web/event.repo.ts` | 修改 | 实现新方法 |
| `src/stores/calendar.ts` | 修改 | 引入 loadedRange、totalEventCount，改造加载策略，CRUD loadedRange 守卫，watch visibleCalendars |
| `src/views/MonthView.vue` | 修改 | `calendarStore.events` → `calendarStore.eventsForCurrentView` |
| `src/views/WeekView.vue` | 修改 | 同上 |
| `src/views/DayView.vue` | 修改 | 同上 |
| `src/views/HomeView.vue` | 修改 | upcoming 改用 `eventRepo.getUpcoming(5)` |
| `src/views/ScheduleView.vue` | 修改 | 搜索改用 `eventRepo.search()` |
| `src/components/calendar/PopupCalendarGrid.vue` | 修改 | `calendarStore.events` → `calendarStore.eventsForCurrentView` |
| `src/views/CalendarPopupView.vue` | 修改 | 改为独立 `eventRepo.getByTimeRange`（独立窗口有自己的月份导航） |
| `src/views/UserProfile.vue` | 修改 | `calendarStore.events.length` → `calendarStore.totalEventCount` |
| `src-tauri/src/commands.rs` | 修改 | 新增 `get_events_by_time_range_and_calendars`、`get_event_count`、`get_upcoming_events`、`search_events` |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令 |
| `src-tauri/src/db/repositories/event.rs` | 修改 | 新增查询函数 |
| `src-tauri/src/db/schema.rs` | 修改 | 新增 `idx_events_cal_start` 复合索引 |

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 加载窗口未覆盖用户需要的数据 | 缓冲区设计确保前后数天预加载；ScheduleView 走 SQL 层搜索 |
| loadedRange 与实际数据不一致 | CRUD 操作添加 loadedRange 守卫；loadExternalEvents 同步后调 reloadFromDatabase |
| Reminder 服务独立查询增加 IPC | 未来 48 小时范围查询数据量极小（<50事件），影响可忽略 |
| 组件从 `events.filter` 改为 `eventsForCurrentView` 可能遗漏边缘情况 | 逐组件迁移，每个组件独立验证 |
| visibleCalendars 切换后数据未更新 | watch visibleCalendars 触发重新加载 |
| getCount 未过滤 user_id | SQL 添加 `user_id` 条件（类型为 `i64`） |
| getByTimeRangeAndCalendars 缺 user_id 过滤 | SQL 添加 `user_id = ?N` |
| getUpcoming/search 缺 user_id + calendarIds 过滤 | 添加 `user_id` + `calendarIds` 参数 |
| 非英文 Windows 的 fs scope 路径解析 | 安全加固文档使用 `$DESKTOP`/`$DOCUMENT`/`$DOWNLOAD` 语义化变量，Tauri 2.x 自动解析本地化路径 |
