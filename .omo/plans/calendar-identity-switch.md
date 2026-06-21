# 日历账户身份切换 — 实施计划

> 基于设计文档：`docs/superpowers/specs/2026-05-24-calendar-account-identity-switch-design.md`

## 任务依赖图

```
Phase 1: 基础设施（无依赖，可并行）
├── Task 1: PlatformCapabilities 扩展
├── Task 2: ICalendarRepository.updateType 接口 + 实现
└── Task 3: ISyncRepository 新增方法接口 + 实现

Phase 2: Store 层核心逻辑（依赖 Phase 1）
├── Task 4: Calendar Store — loginTransition/logoutTransition
└── Task 5: Calendar Store — 事件操作分流改造

Phase 3: 认证流程集成（依赖 Phase 2）
└── Task 6: Auth Store — login/logout 集成日历切换

Phase 4: Rust 后端命令（依赖 Phase 1 接口定义）
├── Task 7: Rust — update_calendar_type 命令
└── Task 8: Rust — sync_push_pending 命令

Phase 5: 界面改动（依赖 Phase 2）
├── Task 9: CalendarMgmtTab — 在线标识替代类型标签
└── Task 10: 日历视图 — 同步状态图标

Phase 6: 测试与验证（依赖全部）
└── Task 11: 端到端测试 + 手动验证
```

---

## Phase 1: 基础设施

### Task 1: PlatformCapabilities 扩展

**文件**：
- `src/platform/capabilities.ts` — 新增 3 个能力字段
- `src/platform/tauri/capabilities.ts` — 填充桌面端值
- `src/platform/web/capabilities.ts` — 填充 Web 端值

**改动**：
```typescript
// capabilities.ts 新增
hasBackgroundSync: boolean
hasIncrementalSync: boolean
hasClientConflictResolution: boolean

// tauri/capabilities.ts
hasBackgroundSync: true,
hasIncrementalSync: false,  // 首期全量同步
hasClientConflictResolution: true,

// web/capabilities.ts
hasBackgroundSync: false,
hasIncrementalSync: false,
hasClientConflictResolution: false,
```

**验证**：TypeScript 编译通过，无类型错误。

---

### Task 2: ICalendarRepository.updateType 接口 + 实现

**文件**：
- `src/platform/types/calendar.repository.ts` — 新增 updateType 方法签名
- `src/platform/tauri/calendar.repo.ts` — Tauri 实现
- `src/platform/web/calendar.repo.ts` — Web 实现

**改动**：
```typescript
// calendar.repository.ts 新增
updateType(params: {
  id: number
  type: 'local' | 'online'
  syncEnabled: boolean
}): Promise<Calendar>

// tauri/calendar.repo.ts 实现
async updateType(params) {
  return safeInvoke('update_calendar_type', params)
}

// web/calendar.repo.ts 实现
async updateType(params) {
  const response = await this.apiClient.put(`/calendars/${params.id}`, {
    type: params.type,
    sync_enabled: params.syncEnabled,
  })
  return transformWebCalendar(response.data)
}
```

**验证**：TypeScript 编译通过。

---

### Task 3: ISyncRepository 新增方法接口 + 实现

**文件**：
- `src/platform/types/sync.repository.ts` — 新增 recordPendingChange + pushPendingChanges
- `src/platform/tauri/sync.repo.ts` — Tauri 实现
- `src/platform/web/sync.repo.ts` — Web 空实现

**改动**：
```typescript
// sync.repository.ts 新增
recordPendingChange(params: {
  action: 'create' | 'update' | 'delete'
  entityType: 'event' | 'todo' | 'calendar'
  entityId: string
  payload: string
}): Promise<void>

pushPendingChanges(): Promise<{ pushed: number; failed: number }>

// tauri/sync.repo.ts 实现
async recordPendingChange(params) {
  return safeInvoke('sync_record_pending', params)
}
async pushPendingChanges() {
  return safeInvoke('sync_push_pending')
}

// web/sync.repo.ts 空实现
async recordPendingChange() {
  throw new RepositoryError({
    code: RepoErrorCodes.UNSUPPORTED_OPERATION,
    message: 'Web 端不支持离线同步日志',
    platform: 'web',
  })
}
async pushPendingChanges() {
  return { pushed: 0, failed: 0 }
}
```

**验证**：TypeScript 编译通过。

---

## Phase 2: Store 层核心逻辑

### Task 4: Calendar Store — loginTransition/logoutTransition

**文件**：`src/stores/calendar.ts`

**改动**：
1. 新增 `loginTransition()` 方法
2. 新增 `logoutTransition()` 方法
3. 导出这两个方法

**关键逻辑**：
- loginTransition：仅 `dataPriority === 'local-first'` 时执行
  - triggerCloudSync → updateType → reloadFromDatabase
- logoutTransition：仅 `dataPriority === 'local-first'` 时执行
  - triggerCloudSync（失败不阻塞）→ updateType → reloadFromDatabase

**代码注释要求**：
- 每个方法必须有 JSDoc 注释，说明流程、多端通用性说明、抛出错误
- 关键决策点加行内注释

**验证**：`pnpm test:run` 通过（现有测试不受影响）。

---

### Task 5: Calendar Store — 事件操作分流改造

**文件**：`src/stores/calendar.ts`

**改动**：
1. 改造 `addEvent()` — 按决策树三级分流
2. 改造 `updateEvent()` — 同上
3. 改造 `deleteEvent()` — 同上

**分流逻辑**（三个方法统一模式）：
```
type='local' → 写本地
type='online' + 在线 → 写本地 + recordPendingChange + pushPendingChanges
type='online' + 离线 + hasOfflineMode → 写本地 + recordPendingChange
type='online' + 离线 + !hasOfflineMode → 抛出 RepositoryError
type='exchange/caldav' → 保持现有逻辑不变
```

**代码注释要求**：
- 每个分流分支前加注释说明适用场景和多端差异
- 决策树注释必须与设计文档第 5 节一致

**验证**：`pnpm test:run` 通过。

---

## Phase 3: 认证流程集成

### Task 6: Auth Store — login/logout 集成日历切换

**文件**：`src/stores/auth.ts`

**改动**：
1. `login()` 中：将 `syncCalendarsFromServer()` 替换为 `calendarStore.loginTransition()`
2. `logout()` 中：在 `authRepo.logout()` 之前插入 `calendarStore.logoutTransition()`
3. `register()` 中：同样将 `syncCalendarsFromServer()` 替换为 `calendarStore.loginTransition()`

**代码注释要求**：
- 标注【变更】位置，说明替换原因
- 退出前同步失败时的处理策略注释

**验证**：`pnpm test:run` 通过。

---

## Phase 4: Rust 后端命令

### Task 7: Rust — update_calendar_type 命令

**文件**：
- `src-tauri/src/db/repositories/calendar.rs` — 新增 update_type 方法
- `src-tauri/src/commands.rs` — 注册新命令

**改动**：
```rust
// calendar.rs
pub fn update_calendar_type(conn: &Connection, id: i64, cal_type: &str, sync_enabled: bool) -> Result<Calendar> {
    conn.execute(
        "UPDATE calendars SET type = ?1, sync_enabled = ?2, updated_at = ?3 WHERE id = ?4",
        params![cal_type, sync_enabled, now_millis(), id],
    )?;
    get_calendar_by_id(conn, id)
}

// commands.rs
#[tauri::command]
pub async fn update_calendar_type(id: i64, cal_type: String, sync_enabled: bool, state: State<'_, AppState>) -> Result<Calendar, String> {
    // ...
}
```

**验证**：`cargo test --lib` 通过。

---

### Task 8: Rust — sync_push_pending 命令

**文件**：
- `src-tauri/src/db/` — 新增 sync_log 读写方法
- `src-tauri/src/commands.rs` — 注册新命令

**改动**：
```rust
// 新增 sync_log 读取方法
pub fn get_pending_sync_logs(conn: &Connection, limit: i64) -> Result<Vec<SyncLog>> {
    // SELECT * FROM sync_log WHERE synced = 0 ORDER BY created_at ASC LIMIT ?
}

// 新增 sync_log 标记方法
pub fn mark_sync_log_synced(conn: &Connection, id: i64) -> Result<()> {
    // UPDATE sync_log SET synced = 1 WHERE id = ?
}

// 新增记录方法
pub fn record_pending_change(conn: &Connection, action: &str, entity_type: &str, entity_id: i64, payload: &str) -> Result<()> {
    // INSERT INTO sync_log (user_id, entity_type, entity_id, action, payload, synced, created_at)
}

// commands.rs
#[tauri::command]
pub async fn sync_record_pending(action: String, entity_type: String, entity_id: String, payload: String, state: State<'_, AppState>) -> Result<(), String> { ... }

#[tauri::command]
pub async fn sync_push_pending(state: State<'_, AppState>) -> Result<SyncPushResult, String> {
    // 读取 pending 记录 → 逐条推送远端 → 标记 synced → 返回统计
}
```

**验证**：`cargo test --lib` 通过。

---

## Phase 5: 界面改动

### Task 9: CalendarMgmtTab — 在线标识替代类型标签

**文件**：`src/components/settings/CalendarMgmtTab.vue`

**改动**：
- 将 `type === 'local'` 的"本地"标签替换为日历名称（无额外标识）
- 将 `type === 'online'` 的"在线"标签替换为日历名称 + 云同步图标
- 外部日历（exchange/caldav）保持不变

**验证**：启动 `pnpm tauri:dev`，检查日历管理页面显示。

---

### Task 10: 日历视图 — 同步状态图标

**文件**：日历视图中展示日历名称的组件

**改动**：
- 日历名称旁增加同步状态指示器（idle/syncing/error/offline）
- 根据 `calendar.syncStatus` 和 `navigator.onLine` 切换图标

**验证**：启动 `pnpm tauri:dev`，检查日历视图中的状态图标。

---

## Phase 6: 测试与验证

### Task 11: 端到端测试 + 手动验证

**测试场景**：

| # | 场景 | 预期 |
|---|------|------|
| 1 | 未登录时创建事件 | 事件写入本地 SQLite，type='local' |
| 2 | 登录后 | 日历 type 切换为 'online'，本地事件同步到远端，无重复 |
| 3 | 登录后创建事件 | 事件写入本地 + 推送到远端 |
| 4 | 登录后断网创建事件 | 事件写入本地 + 记录 sync_log |
| 5 | 网络恢复 | sync_log 中的待推送事件自动推送到远端 |
| 6 | 退出登录 | 日历 type 切回 'local'，远端数据同步到本地 |
| 7 | 多次登录/退出 | 事件不重复 |
| 8 | 多设备登录同一账号 | 事件不重复，冲突解决采用 LWW |
| 9 | Web 端登录/使用/退出 | 行为不变，无报错 |

**验证命令**：
```bash
pnpm test:run
cargo test --lib
pnpm tauri:dev  # 手动验证上述场景
```
