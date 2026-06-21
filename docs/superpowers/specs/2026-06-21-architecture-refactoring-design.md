# 架构重构设计：CalendarStore 拆分 + Reminder 解耦 + 同步逻辑下沉

> 来源：[#54 项目安全性、架构设计与性能优化综合审计报告](https://github.com/xiaohai2271/SmartRiverCalender/issues/54)
> 日期：2026-06-21

## 背景

当前前端架构存在三个核心问题：

1. **CalendarStore 复杂度过载**（~1000行）：混合了核心状态管理、外部日历同步编排、4路分支 CRUD 等职责，Store 直接感知 `calendar.type`、`navigator.onLine`、`capabilities.hasOfflineMode`，违反项目架构约束
2. **前端驱动同步反模式**：`loadExternalEvents` 在前端循环发起 IPC，做 diff/merge/write，每次视图切换约 40 次 IPC；`loadExternalCalendars` 中存在结果被丢弃的冗余调用
3. **reminder.ts 混合逻辑**（~1077行）：UI 控制（Tauri 窗口管理、标题闪烁）与核心业务逻辑（提醒判断、队列管理）混合，无法独立测试

## 当前违规点

| 违规 | 位置 | 说明 |
|------|------|------|
| Store 感知平台细节 | `calendar.ts:427-488` | 直接检查 `calendar.type === 'exchange'`/`'caldav'` |
| Store 使用 `navigator.onLine` | `calendar.ts:522,545,660,687,771,787` | 未通过 `useCapabilities()` 判断 |
| Store 直接调用 syncRepo 外部方法 | `calendar.ts:434,584,731` | `syncRepo.createExternalEvent()` 等是协议级操作 |
| `@tauri-apps/*` 导入在 platform 层外 | `reminder.ts:342-343,700,1056` | 应封装在 `src/platform/tauri/` 内 |
| `@tauri-apps/*` 导入在 platform 层外 | `cloudSync.ts:144-168` | `listen('sync-complete'/'sync-error'/'auth-token-expired')` 应封装 |

**本次重构范围声明**：本设计仅覆盖 `calendar.ts` + `reminder.ts` + `cloudSync.ts` 的 `@tauri-apps/*` 违规修复。以下文件仍有违规，留作后续迭代：
- `App.vue`、`services/updater.ts`、`services/sync.ts`
- `composables/useWindowToggle.ts`、`composables/useReminderPopup.ts`、`composables/useCalendarPopup.ts`
- `utils/tauri.ts`、`views/CalendarPopupView.vue`、`views/ReminderPopupView.vue`
- `components/settings/SystemTab.vue`、`components/settings/ReminderTab.vue`

## 设计

### 阶段1：事件 CRUD 分支下沉到 Repository 层

#### 问题

每个 CRUD 操作（`addEvent`/`updateEvent`/`deleteEvent`）包含 4-5 个分支：

| 分支 | 条件 | 逻辑 |
|------|------|------|
| A | `calendar.type === 'exchange' \|\| 'caldav'` | 调用 `syncRepo.createExternalEvent()`，成功后 `eventRepo.create()` 写本地 |
| B | `calendar.type === 'local'` | 直接 `eventRepo.create()` |
| C | `calendar.type === 'online' && navigator.onLine` | `eventRepo.create()` + `cloudSyncService.triggerSync()` |
| D | `calendar.type === 'online' && !navigator.onLine && hasOfflineMode` | `eventRepo.create()`（Rust 自动记录 sync_log） |
| E | `calendar.type === 'online' && !navigator.onLine && !hasOfflineMode` | 抛出 `RepositoryError(NETWORK_ERROR)` |

Store 不应知道这些分支。分支逻辑应封装在 Repository 内部。

#### 方案：扩展 IEventRepository + Rust 端统一命令

新增带同步语义的方法。**核心决策：路由逻辑完全在 Rust 端完成**，前端 Repository 只需一次 `safeInvoke` 调用。原因：

1. 外部日历操作需要账户凭据（accountId、serverUrl、username、encryptedPassword、calendarUrl），这些信息存储在 SQLite 的 accounts 表和 calendars 表中，Rust 端可直接查询，前端 Repository 无法获取
2. 单次 IPC 替代多次 IPC（查 calendar type → 调外部 API → 写本地），减少通信开销
3. 与阶段4解耦：阶段1的 `createWithSync` 不依赖 `syncRepo` 的外部日历方法，阶段4可安全移除

```typescript
// src/platform/types/event.repository.ts 新增

export interface IEventRepository {
  // 现有方法不变
  getAll(): Promise<CalendarEvent[]>
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>
  create(params: EventCreateParams): Promise<CalendarEvent>
  update(params: EventUpdateParams): Promise<CalendarEvent>
  delete(id: number): Promise<void>

  // 新增：带同步语义的 CRUD
  // Tauri 端：调用 Rust 统一命令，Rust 内部完成 calendar type 查询 → 外部 API → 本地写入
  // Web 端：直接调远端 API
  createWithSync(params: EventCreateParams): Promise<CalendarEvent>
  updateWithSync(params: EventUpdateParams): Promise<CalendarEvent>
  deleteWithSync(id: number): Promise<void>
}
```

#### Rust 端统一命令

新增 3 个 Rust command，内部完成全流程路由：

**前置条件**：`calendars` 表需新增 `read_only` 列（`BOOLEAN NOT NULL DEFAULT 0`），`DbCalendar` struct 和 `CreateCalendarRequest` 需对应添加此字段。`loadExternalCalendars` 也需将 `readOnly` 传给 `calendarRepo.create()`。当前 `readOnly` 仅存在于内存对象，重启即丢失。

```sql
ALTER TABLE calendars ADD COLUMN read_only BOOLEAN NOT NULL DEFAULT 0;
```

```rust
#[tauri::command]
pub fn create_event_with_sync(
    params: EventCreateParams,  // 包含 calendar_id
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbEvent, String> {
    // 1. 获取锁 → 查询 calendar type + 关联 account 信息 → 释放锁
    // 2. type = exchange/caldav → 只读检查 → 调外部 API（无锁）
    // 3. 获取锁 → 写本地 DB + externalId → 释放锁
    // 4. type = local → 获取锁 → 直接写本地 → 释放锁
    // 5. type = online → 获取锁 → 写本地 + 记录 sync_log → 释放锁
    // 注意：外部 API 调用（可能耗时数秒）不能在持有 DB Mutex 期间执行，
    // 否则会阻塞所有其他 DB 操作。采用分步获取锁的策略。
}

#[tauri::command]
pub fn update_event_with_sync(params: EventUpdateParams, db: ...) -> Result<DbEvent, String> {
    // 1. 通过 event.id 查询 calendar type + external_id
    // 2. type = exchange/caldav → 只读检查 → 用 external_id 调外部 API 更新 → 写本地
    // 3. type = local → 直接写本地
    // 4. type = online → 写本地 + 记录 sync_log
}

#[tauri::command]
pub fn delete_event_with_sync(id: i64, db: ...) -> Result<(), String> {
    // 1. 通过 id 查询 calendar type + external_id
    // 2. type = exchange/caldav → 用 external_id 调外部 API 删除 → 删本地
    // 3. type = local → 直接删本地
    // 4. type = online → 删本地 + 记录 sync_log
}
```

#### Tauri 端 createWithSync 实现

```typescript
// src/platform/tauri/event.repo.ts

async createWithSync(params: EventCreateParams): Promise<CalendarEvent> {
  const result = await safeInvokeWithResult('create_event_with_sync', {
    title: params.title,
    description: params.description,
    start_time: params.startTime,
    end_time: params.endTime,
    all_day: params.allDay,
    calendar_id: params.calendarId,
    color: params.color,
    reminder: params.reminder,
    repeat_rule: params.repeatRule,
    location: params.location,
    external_id: params.externalId,
  })
  return transformEvent(result as RawEvent)
}
```

前端只做参数转换（camelCase → snake_case）和结果转换（snake_case → camelCase），不参与路由逻辑。

#### Web 端 createWithSync 实现

```typescript
// src/platform/web/event.repo.ts

async createWithSync(params: EventCreateParams): Promise<CalendarEvent> {
  // Web 端显式处理离线场景
  if (!navigator.onLine) {
    throw new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: '网络不可用，无法创建事件',
      platform: 'web',
    })
  }
  return this.create(params)
}
```

Web 端离线时直接抛出 `RepositoryError(NETWORK_ERROR)`，语义清晰，不依赖底层 API 超时。

#### Store 层精简效果

重构前 `addEvent`：~150 行（4路分支 + 重复参数构建）
重构后 `addEvent`：~15 行

```typescript
async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  const { eventRepo } = usePlatform()
  const created = await eventRepo.createWithSync({
    title: event.title,
    description: event.description,
    startTime: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
    calendarId: getValidCalendarId(event.calendarId),
    color: event.color,
    reminder: event.reminder,
    repeatRule: event.repeatRule ? JSON.stringify(event.repeatRule) : undefined,
    location: event.location,
    externalId: event.externalId,
  })
  events.value.push(created)
}
```

`updateEvent` 和 `deleteEvent` 同理精简。

### 阶段2：提取外部日历同步服务

#### 问题

- `loadExternalCalendars`（L91-208）和 `loadExternalEvents`（L211-298）占 CalendarStore ~215 行
- `watch(currentDateRange)` 直接触发 `loadExternalEvents`，无去抖，快速切换视图产生大量并发请求
- `loadExternalCalendars` 中 `syncRepo.getExternalEvents()` 调用结果被完全丢弃（bug）

#### 方案

提取 `src/services/externalCalendarSync.ts`（~200 行）。**Service 接收纯数据、返回同步结果，Store 自行更新状态**——Service 不直接修改 Store 的 ref，保持 Store 作为唯一状态管理者。

```typescript
// src/services/externalCalendarSync.ts

/** 同步结果 — 纯数据，由 Store 消费 */
export interface ExternalSyncResult {
  /** 需要新增或更新的日历 */
  calendarsToUpsert: Calendar[]
  /** 需要持久化到本地 DB 的新日历（仅 local-first 平台） */
  calendarsToCreate: Calendar[]
  /** 按日历分组的事件替换结果 */
  eventReplacements: Array<{
    calendarId: string
    startTime: number
    endTime: number
    events: CalendarEvent[]
  }>
}

export const externalCalendarSyncService = {
  /** 同步所有外部日历列表 + 事件，返回同步结果 */
  async syncAll(calendars: Calendar[]): Promise<ExternalSyncResult> { ... }

  /** 同步指定时间范围的外部事件，返回同步结果 */
  async syncEvents(calendars: Calendar[], startTime: number, endTime: number): Promise<ExternalSyncResult> { ... }
}
```

CalendarStore 修改：

```typescript
// 初始化中（顺序 await，避免并发状态突变）
setTimeout(async () => {
  const result = await externalCalendarSyncService.syncAll(calendars.value)
  await applySyncResult(result)
  const { start, end } = currentDateRange.value
  const eventResult = await externalCalendarSyncService.syncEvents(calendars.value, start.getTime(), end.getTime())
  await applySyncResult(eventResult)
}, 200)

// 统一的同步结果应用方法
async function applySyncResult(result: ExternalSyncResult) {
  const { calendarRepo, eventRepo } = usePlatform()
  const capabilities = useCapabilities()

  // 更新日历（upsert）
  for (const cal of result.calendarsToUpsert) {
    const idx = calendars.value.findIndex(c => c.id === cal.id)
    if (idx === -1) calendars.value.push(cal)
    else calendars.value[idx] = cal
  }
  // 持久化新日历到本地 DB
  if (capabilities.dataPriority === 'local-first') {
    for (const cal of result.calendarsToCreate) {
      const created = await calendarRepo.create({ ... })
      cal.id = String(created.id)
    }
  }
  // 替换事件（内存 + DB 持久化）
  for (const replacement of result.eventReplacements) {
    // 1. 从内存移除旧事件
    events.value = events.value.filter(e =>
      !(e.calendarId === replacement.calendarId && e.startTime >= replacement.startTime && e.startTime <= replacement.endTime)
    )
    // 2. 持久化到 DB（local-first 平台）
    if (capabilities.dataPriority === 'local-first') {
      // 先删除该时间范围内的旧外部事件
      await eventRepo.deleteByCalendarAndTimeRange(
        replacement.calendarId, replacement.startTime, replacement.endTime
      )
      // 再写入新事件（CalendarEvent → EventCreateParams 转换：剔除 id/createdAt/updatedAt，
      // calendarId 从 string 转为 number）
      for (const event of replacement.events) {
        const { id, createdAt, updatedAt, ...createParams } = event
        await eventRepo.create({
          ...createParams,
          calendarId: Number(event.calendarId),
        })
      }
    }
    // 3. 更新内存
    events.value.push(...replacement.events)
  }
}

// watch 中添加 500ms 去抖（手动 debounce，不引入 @vueuse/core）
watch(() => currentDateRange.value, debounce(async (newRange) => {
  if (isInitialized.value) {
    const result = await externalCalendarSyncService.syncEvents(
      calendars.value, newRange.start.getTime(), newRange.end.getTime()
    )
    await applySyncResult(result)
  }
}, 500), { deep: true })

// debounce 工具函数
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as any
}
```

#### Bug 修复

删除 `loadExternalCalendars` 中被丢弃的 `getExternalEvents` 调用（L98-109），该调用浪费 N 次 IPC 且结果未被使用。

### 阶段3：reminder.ts 三层拆分

#### 问题

reminder.ts（~1077行）混合了：
- 业务逻辑：`shouldRemindEvent`/`shouldRemindTodo`、`formatNotificationTitle`/`formatNotificationBody`、队列优先级排序
- UI 控制：Tauri 窗口管理（`showReminderInWindow`）、标题闪烁（`startBlinkTitle`）、本地弹窗回调总线
- 平台适配：`@tauri-apps/api/webviewWindow`、`@tauri-apps/plugin-notification`、`window.Notification`
- 数据持久化：localStorage 直接操作（队列、已发送、稍后提醒、查看记录）

#### 方案：三层 + Repository

```
┌──────────────────────────────────────────────────────┐
│ reminder-ui.ts — UI 控制 + 平台适配                    │
│   showStrongReminder() → Tauri 窗口 / 本地回调         │
│   showSystemNotification() → Tauri 通知 / 浏览器通知    │
│   startTitleBlink() / stopTitleBlink()                │
│   onReminderPopup() / offReminderPopup()              │
│   实现 ReminderActions 接口                            │
├──────────────────────────────────────────────────────┤
│ reminder-core.ts — 纯业务逻辑 + 编排                    │
│   shouldRemindEvent() / shouldRemindTodo()             │
│   formatNotificationTitle() / formatNotificationBody() │
│   enqueueReminder() / dequeueReminder()               │
│   checkAndSendReminders() — 通过 ReminderActions 触发   │
│   startReminderService() / stopReminderService()       │
│   零 Tauri 依赖，通过 IReminderRepository + ReminderActions │
├──────────────────────────────────────────────────────┤
│ IReminderRepository — 提醒状态持久化接口                │
│   loadQueue / saveQueue / isSent / markSent / ...     │
├──────────────┬───────────────────────────────────────┤
│ Tauri 实现    │ Web 实现                               │
│ SQLite       │ localStorage (Promise 包装)             │
└──────────────┴───────────────────────────────────────┘
```

#### 层1：IReminderRepository

```typescript
// src/platform/types/reminder.repository.ts

export interface IReminderRepository {
  loadQueue(): Promise<ReminderQueueItem[]>
  saveQueue(items: ReminderQueueItem[]): Promise<void>
  isReminderSent(key: string): Promise<boolean>
  markReminderSent(key: string): Promise<void>
  getSnoozeTime(id: string): Promise<number | null>
  setSnoozeTime(id: string, timestamp: number): Promise<void>
  clearSnoozeTime(id: string): Promise<void>
  isReminderViewed(id: string, validDurationMs: number): Promise<boolean>
  markReminderAsViewed(id: string): Promise<void>
  // 抽象清理接口，实现自行决定清理策略
  cleanupExpiredRecords(now: number): Promise<void>
}
```

接口全部异步（`Promise`），因为桌面端 SQLite 操作天然异步，Web 端 API 调用天然异步。

`cleanupExpiredRecords` 是抽象的清理接口，SQLite 实现使用 `WHERE created_at < now - ttl`，localStorage 实现使用时间戳比较 + key 遍历。

#### 层2：reminder-core.ts

纯业务逻辑 + 编排，零 `@tauri-apps/*` 依赖。通过注入的回调与 UI 层通信：

```typescript
// src/services/reminder-core.ts

export interface ReminderActions {
  showStrongReminder(item: ReminderQueueItem): Promise<void>
  showSystemNotification(title: string, body: string): Promise<void>
  startTitleBlink(title: string): void
  stopTitleBlink(): void
}

export function createReminderService(
  reminderRepo: IReminderRepository,
  actions: ReminderActions
): ReminderService { ... }
```

导出的纯函数（易测试）：`shouldRemindEvent`、`shouldRemindTodo`、`formatNotificationTitle`、`formatNotificationBody`、`comparePriority`。

#### 层3：reminder-ui.ts

UI 控制 + 平台适配，所有 `@tauri-apps/*` 导入在此。实现 `ReminderActions` 接口，通过 `useCapabilities()` 判断分支。

```typescript
// src/services/reminder-ui.ts

export function createReminderActions(): ReminderActions {
  const capabilities = useCapabilities()

  return {
    async showStrongReminder(item) {
      if (capabilities.hasReminderPopup) {
        // Tauri 多窗口弹窗
      } else {
        // Web 降级：触发本地回调
      }
    },
    async showSystemNotification(title, body) {
      if (capabilities.hasReminderPopup) {
        // Tauri 通知 API
      } else {
        // 浏览器 Notification API
      }
    },
    startTitleBlink(title) { /* document.title 操作 */ },
    stopTitleBlink() { /* 清除 interval */ },
  }
}
```

#### 兼容导出

保留 `src/services/reminder.ts` 作为 barrel 重导出，消费者无需改动：

```typescript
// src/services/reminder.ts（兼容过渡）
export { startReminderService, stopReminderService, ... } from './reminder-core'
export { onReminderPopup, offReminderPopup, ... } from './reminder-ui'
```

过渡期：下个大版本（v2.0）应删除 barrel，消费者直接 import `reminder-core` / `reminder-ui`。

#### 桌面端 ReminderRepository

新增 SQLite 表替代 localStorage：

| 表名 | 用途 | 替代 |
|------|------|------|
| `reminder_queue` | 提醒队列 | localStorage `reminder_queue` |
| `reminder_sent` | 已发送记录 | localStorage `reminder_sent_*` |
| `reminder_snooze` | 稍后提醒 | localStorage `reminder_snooze_*` |
| `reminder_viewed` | 查看记录 | localStorage `reminder_viewed_*` |

优势：原子性操作、更好的清理性能、与项目其他数据一致的模式。

#### 数据迁移：localStorage → SQLite

用户升级时，Tauri `ReminderRepository` 初始化需执行一次性迁移：

1. 检测 localStorage 中的 `reminder_queue`、`reminder_snooze_*`、`reminder_sent_*`、`reminder_viewed_*` 键
2. 如果存在旧数据，将它们写入对应的 SQLite 表
3. 迁移完成后，删除 localStorage 中的对应键
4. 记录迁移完成标记（`reminder_migrated: true`），避免重复迁移

迁移在 `TauriReminderRepository` 构造时自动执行，前端无感知。

#### Web 端 ReminderRepository

短期使用 localStorage 包装为 `Promise.resolve(...)`，与当前行为一致。中期可扩展为 API 调用。

#### 与 useReminderPopup.ts 的关系

`src/composables/useReminderPopup.ts`（~584行）已包含窗口定位逻辑，与 `showReminderInWindow` 有功能重叠。重构时 `reminder-ui.ts` 直接调用 `useReminderPopup` 的导出函数，不重新实现窗口定位。

两者的防抖 Map 也需合并：`reminder.ts` 的 `lastTriggerTimes` 和 `useReminderPopup.ts` 的 `lastTriggerTimes` 统一到 `reminder-ui.ts`（UI 层负责防抖），`reminder-core.ts` 不包含防抖逻辑。

### 阶段4：同步逻辑下沉 Rust 后端

#### 问题

当前同步完全由前端驱动：
1. 前端逐个日历调用 `syncRepo.getExternalEvents()` → IPC
2. 前端做 diff（本地有但服务器没有的删除，服务器有但本地没有的创建）
3. 前端逐个事件调用 `eventRepo.create/update/delete` → 大量 IPC
4. 每次视图切换都全量同步，无 sync-token 增量

#### 已有基础设施

Rust 端已存在完整但未被使用的外部日历同步引擎：

| 模块 | 文件 | 状态 |
|------|------|------|
| `SyncEngine` | `src-tauri/src/sync.rs` | **未被注册为 command**，实现了 CalDAV/Exchange 账号级同步 |
| `SyncExecutor` | `src-tauri/src/sync_engine/sync.rs` | 用于云同步（online 日历），不处理外部日历 |
| `ChangeTracker` | `src-tauri/src/sync_engine/tracker.rs` | 已在使用，记录 sync_log |
| `SyncScheduler` | `src-tauri/src/sync_engine/scheduler.rs` | **未被使用**，包含定时调度、网络恢复检测、同步锁 |

#### 方案

分两个子阶段实施，降低单次改动风险：

**子阶段 4a：基础同步（替代前端 diff/write）**

1. 新增 3 个 Tauri command：`external_sync_start`/`external_sync_trigger`/`external_sync_stop`
2. 重构 `SyncEngine` 构造函数接收 `DatabaseConnection`
3. `sync_account()` 增加：读本地事件 → diff → 写 SQLite → emit `external-sync-complete`
4. 处理外部日历 ID 映射（外部 ID vs 本地自增 ID）
5. 处理日历列表同步到 DB（当前 `sync_account` 只同步事件，不同步日历）
6. 前端监听 `syncRepo.onExternalSyncComplete()` → `await reloadFromDatabase()`
7. 删除 `externalCalendarSync.ts`，精简 `ISyncRepository`
8. 将 `cloudSync.ts` 中的 `@tauri-apps/api/event` 监听（`sync-complete`、`sync-error`、`auth-token-expired`）也封装到 `ISyncRepository`：
   - `syncRepo.onSyncComplete(callback)`
   - `syncRepo.onSyncError(callback)`
   - `syncRepo.onAuthTokenExpired(callback)`
   Tauri 端封装 `listen()`，Web 端返回空操作（`() => ()`）。满足 AGENTS.md 禁止在 `src/platform/` 外导入 `@tauri-apps/*` 的约束。

**子阶段 4b：增量同步（sync-token 优化）**

1. 在 `sync_account()` 中使用 CalDAV sync-token 增量拉取，替代全量拉取
2. 更新 `sync_state` 表的 `sync_token`
3. Exchange 使用 SyncState（如果支持）或时间范围增量查询
4. 前端无需改动，完全后端优化

**工作量预估**：

| 子阶段 | 估计工作量 | 说明 |
|--------|-----------|------|
| 4a | 2-3 周 | SyncEngine 重构 + diff 算法 + ID 映射 + 日历列表同步 |
| 4b | 1 周 | sync-token 增量逻辑，仅 Rust 端改动 |

**步骤3：前端改为事件驱动**

通过 `ISyncRepository` 封装事件监听，避免在 `src/platform/` 外导入 `@tauri-apps/api/event`：

```typescript
// src/platform/types/sync.repository.ts 新增
export interface ISyncRepository {
  // ... 现有方法

  /** 监听外部日历同步完成事件 */
  onExternalSyncComplete(callback: () => void): Promise<() => void> // 返回 unsubscribe 函数
}

// src/platform/tauri/sync.repo.ts 实现
async onExternalSyncComplete(callback: () => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen('external-sync-complete', callback)
  return unlisten
}

// src/platform/web/sync.repo.ts 实现
async onExternalSyncComplete(_callback: () => void): Promise<() => void> {
  // Web 端无需此后端事件
  return () => {}
}
```

CalendarStore 使用：

```typescript
// src/stores/calendar.ts — 平台无关
const { syncRepo } = usePlatform()
const unsubscribe = await syncRepo.onExternalSyncComplete(() => {
  reloadFromDatabase()
})
```

**步骤4：删除前端同步代码**

- 删除 `src/services/externalCalendarSync.ts`
- 删除 `watch(currentDateRange)` 中的 `loadExternalEvents` 调用
- 精简 `ISyncRepository` 接口：移除 `getExternalCalendars`、`getExternalEvents`（连接/认证方法保留）
- 初始化流程简化为：加载本地数据 → 启动后端同步 → 监听完成事件刷新

#### 前端 ISyncRepository 精简

保留的方法（连接/认证）：

| 方法 | 用途 |
|------|------|
| `connectExchange()` | 连接 Exchange 服务器 |
| `connectCalDAV()` | 连接 CalDAV 服务器 |
| `getAllAccounts()` | 获取已配置账号列表 |
| `deleteAccount()` | 删除账号 |
| `triggerCloudSync()` | 触发云同步（online 日历） |
| `getSyncStatus()` | 获取同步状态 |
| `startAutoSync()` / `stopAutoSync()` | 自动同步控制 |

移除的方法（同步操作由 Rust 后端接管）：

| 方法 | 原因 |
|------|------|
| `getExternalCalendars()` | 后端 SyncEngine 自动管理 |
| `getExternalEvents()` | 后端 SyncEngine 自动管理 |
| `createExternalEvent()` | 下沉到 `eventRepo.createWithSync` |
| `updateExternalEvent()` | 下沉到 `eventRepo.updateWithSync` |
| `deleteExternalEvent()` | 下沉到 `eventRepo.deleteWithSync` |

## 实施顺序与依赖关系

```
阶段1: CRUD 分支下沉 ──────────────────────────── 独立，可先做
    ↳ 使用 Rust 统一命令，不依赖 syncRepo 外部方法
阶段2: 提取外部日历同步服务 ────────────────────── 独立，可先做
    ↳ Service 返回纯数据，Store 自行更新
阶段3: reminder 三层拆分 ───────────────────────── 独立，可先做
阶段4: 同步逻辑下沉 Rust ──────────────────────── 依赖阶段2完成
    ↳ 分为 4a（基础同步）和 4b（增量同步）两个子阶段
```

阶段1-3 互不依赖，可并行实施。阶段4依赖阶段2（需要先提取同步服务，才能在后端替代它）。

**阶段1与阶段4的解耦保证**：阶段1的 `createWithSync` 通过 Rust 统一命令（`create_event_with_sync`）完成路由，内部不调用 `syncRepo` 的外部日历方法。因此阶段4从 `ISyncRepository` 移除 `createExternalEvent` 等方法时，不会影响阶段1的实现。

## 文件变更清单

### 阶段1

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/platform/types/event.repository.ts` | 修改 | 新增 `createWithSync`/`updateWithSync`/`deleteWithSync` |
| `src/platform/tauri/event.repo.ts` | 修改 | 实现 `createWithSync`（调用 Rust 统一命令） |
| `src/platform/web/event.repo.ts` | 修改 | 实现 `createWithSync`（离线检查 + 委托 `create`） |
| `src/stores/calendar.ts` | 修改 | CRUD 方法精简为调用 `eventRepo.createWithSync` 等 |
| `src-tauri/src/commands.rs` | 修改 | 新增 `create_event_with_sync`/`update_event_with_sync`/`delete_event_with_sync` |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令 |
| `src-tauri/src/db/schema.rs` | 修改 | `calendars` 表新增 `read_only` 列迁移 |
| `src-tauri/src/db/repositories/calendar.rs` | 修改 | `DbCalendar` struct + `CreateCalendarRequest` + `from_row()` + INSERT/UPDATE SQL 新增 `read_only` 字段 |

### 阶段2

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/services/externalCalendarSync.ts` | 新增 | 外部日历同步编排 |
| `src/stores/calendar.ts` | 修改 | 删除 `loadExternalCalendars`/`loadExternalEvents`，改用 service |
| `src/platform/types/event.repository.ts` | 修改 | 新增 `deleteByCalendarAndTimeRange` 方法 |
| `src/platform/tauri/event.repo.ts` | 修改 | 实现 `deleteByCalendarAndTimeRange` |
| `src/platform/web/event.repo.ts` | 修改 | 实现 `deleteByCalendarAndTimeRange` |
| `src-tauri/src/commands.rs` | 修改 | 新增 `delete_events_by_calendar_and_time_range` 命令 |
| `src-tauri/src/db/repositories/event.rs` | 修改 | 新增按日历+时间范围批量删除查询 |

### 阶段3

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/platform/types/reminder.repository.ts` | 新增 | 提醒状态持久化接口 |
| `src/platform/tauri/reminder.repo.ts` | 新增 | SQLite 实现 |
| `src/platform/web/reminder.repo.ts` | 新增 | localStorage 包装实现 |
| `src/services/reminder-core.ts` | 新增 | 纯业务逻辑 + 编排 |
| `src/services/reminder-ui.ts` | 新增 | UI 控制 + 平台适配 |
| `src/services/reminder.ts` | 修改 | 改为 barrel 重导出 |
| `src/platform/tauri/index.ts` | 修改 | 注册 reminderRepo |
| `src/platform/web/index.ts` | 修改 | 注册 reminderRepo |
| `src-tauri/src/db/schema.rs` | 修改 | 新增 reminder 相关表 |

### 阶段4

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/commands.rs` | 修改 | 新增 `external_sync_start`/`trigger`/`stop` |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令 |
| `src-tauri/src/sync.rs` | 修改 | `SyncEngine` 重构：接收 `DatabaseConnection`，增加 diff + 写 SQLite |
| `src/services/externalCalendarSync.ts` | 删除 | 前端同步服务不再需要 |
| `src/platform/types/sync.repository.ts` | 修改 | 移除同步方法，新增 `onExternalSyncComplete`/`onSyncComplete`/`onSyncError`/`onAuthTokenExpired` |
| `src/platform/tauri/sync.repo.ts` | 修改 | 移除同步方法，实现全部4个事件监听方法（封装 `@tauri-apps/api/event` 的 `listen`） |
| `src/platform/web/sync.repo.ts` | 修改 | 移除同步方法，实现全部4个事件监听方法（均返回空操作 `() => ()`） |
| `src/stores/calendar.ts` | 修改 | 调用 `syncRepo.onExternalSyncComplete()`，删除 watch 同步；`cloudSyncService` 的事件监听改用 `syncRepo.onSyncComplete/onSyncError/onAuthTokenExpired` |

## 验证方案

### 阶段1 验证

1. **功能回归**：创建/编辑/删除事件（本地/在线/外部日历），行为与重构前一致
2. **离线降级**：断网后创建在线日历事件，应写本地 + sync_log，联网后自动同步
3. **只读保护**：在只读外部日历上创建事件，应抛出 `RepositoryError(VALIDATION_ERROR)`
4. **跨平台一致**：Tauri 端和 Web 端对同一输入产生等价的外部可观测行为

### 阶段2 验证

1. **同步功能**：外部日历（CalDAV/Exchange）事件加载正常
2. **Bug 修复**：确认不再有冗余的 `getExternalEvents` 调用
3. **去抖效果**：快速切换视图时，同步请求不会并发执行
4. **Store 行数**：CalendarStore 降至 ~350 行以内

### 阶段3 验证

1. **提醒功能**：事件/待办提醒正常触发，强提醒/标准提醒/静默模式均正常
2. **稍后提醒**：设置稍后提醒后，到时间正常触发
3. **队列管理**：多个提醒排队显示，优先级正确
4. **纯逻辑测试**：`reminder-core.ts` 的纯函数可在无 Tauri mock 环境下测试
5. **零 Tauri 依赖**：`reminder-core.ts` 不包含任何 `@tauri-apps/*` 导入

### 阶段4 验证

1. **后端同步**：Rust `SyncEngine` 能正确同步外部日历事件到 SQLite
2. **增量同步**：使用 sync-token，避免全量拉取
3. **前端刷新**：`external-sync-complete` 事件触发后，前端 `reloadFromDatabase()` 正常工作
4. **IPC 调用审计**：视图切换时 IPC 调用次数大幅减少（从 ~40 降至 ~2-3）
5. **数据一致性**：后端同步后，前端展示的数据与 SQLite 中数据一致

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `createWithSync` 内部路由在 Tauri/Web 两端行为不一致 | 编写跨平台行为测试，确保等价外部可观测行为；Web 端显式处理离线抛出 RepositoryError |
| reminder localStorage → SQLite 异步化导致时序变化 | `shouldRemindEvent`/`shouldRemindTodo` 改为 async，`checkAndSendReminders` 已是 async |
| Reminder localStorage → SQLite 用户升级数据丢失 | Tauri `ReminderRepository` 初始化时自动执行一次性迁移，迁移后清除旧 localStorage 键 |
| 阶段4 中前端同步和后端同步并存冲突 | 子阶段4a 一次性切换，不同时运行两套同步逻辑 |
| `SyncEngine` diff 逻辑与前端不一致 | 子阶段4a 先复用前端现有 diff 算法，确保行为一致后再在4b优化增量同步 |
| 只读检查下沉后 Store 无法提前禁用 UI | 组件仍可通过 `calendar.readOnly` prop 禁用 UI，但不再在 Store 中做业务校验 |
| 阶段4a `SyncEngine` 重构工作量大 | 拆分为 4a（基础同步 2-3周）+ 4b（增量同步 1周），降低单次改动风险 |
| 阶段1 与阶段4 的 `syncRepo` 外部方法移除冲突 | 阶段1 的 `createWithSync` 使用 Rust 统一命令，不依赖 `syncRepo` 的外部方法，两阶段可安全并行 |
