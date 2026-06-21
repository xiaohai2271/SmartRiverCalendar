# 日历同步设计文档

> **日期**: 2026-05-16
> **状态**: 已批准
> **范围**: 登录后从服务端获取日历数据并同步到本地

---

## 1. 问题陈述

### 当前问题

| 问题 | 现状 |
|------|------|
| 登录后获取日历？ | ❌ 没有（`authStore.login()` 只做认证） |
| 云同步拉取日历？ | ❌ 没有（`batch_sync` 只同步 `sync_log` 中的变更） |
| 默认日历 ID=1 | 本地 SQLite 自增创建，硬编码 `getValidCalendarId()` 返回 1 |
| 多次登录唯一性 | ❌ 没有保证（每次启动都可能创建新的默认日历） |

### 目标

1. 登录后从服务端获取日历数据并同步到本地
2. 保证多次登录的日历数据唯一性
3. 支持多账户切换（隐藏非当前账户的日历）
4. 保持本地日历和事件不丢失

---

## 2. 设计决策

### 2.1 本地日历处理

**决策**：保留本地日历，合并服务端日历

**理由**：
- 不会丢失本地数据（未登录时创建的事件）
- 保持向后兼容
- 允许用户在未登录时继续使用

**实现**：
- 本地默认日历（ID=1）保留
- 服务端日历作为新日历插入（如果不存在）
- 使用 `INSERT OR IGNORE` 避免覆盖本地日历

### 2.2 日历 ID 映射

**决策**：直接使用服务端 ID 作为本地 ID

**理由**：
- 简单直接，无需映射表
- 服务端 ID 从 2 开始，本地 ID 从 1 开始，不会冲突
- 多租户模式保证不同用户的日历 ID 不会冲突

**ID 分配规则**：
- 本地日历 ID = 1（程序保留）
- 服务端日历 ID >= 2
- 外部账户 ID >= 2

### 2.3 同步时机

**决策**：所有四个时机都触发同步

| 时机 | 触发方式 | 说明 |
|------|----------|------|
| 登录后 | `batch_sync` | 首次同步，获取所有日历 |
| 应用启动时 | `batch_sync` | 增量同步，获取最新变更 |
| 手动刷新时 | `sync_now` | 即时同步，用户主动触发 |
| 定期自动同步 | `batch_sync` | 增量同步，保持数据最新 |

### 2.4 错误处理

**决策**：显示错误提示，不自动重试

**理由**：
- 给用户反馈，但不阻塞操作
- 用户可以手动触发重试
- 避免自动重试导致的网络风暴

**实现**：
- 网络失败：显示错误提示，用户可手动重试
- 部分成功：记录已同步的数据，下次继续
- 冲突处理：使用 `updated_at` 解决，服务端优先

### 2.5 多账户切换

**决策**：隐藏旧账户日历

**理由**：
- 数据不丢失，但需要标记
- 简单实现，避免复杂度
- 用户可以手动切换账户

**实现**：
- 切换账户时，调用 `batch_sync` 获取新账户的日历
- 旧账户的日历保留，但标记为非当前账户
- 使用 `user_id` 字段区分不同账户

### 2.6 平台差异

**核心区别**：Web 端和 Windows 端的日历数据源和同步策略完全不同。

| 维度 | Web 端 | Windows 端 |
|------|--------|-----------|
| **本地日历** | ❌ 无本地日历 | ✅ 有本地 SQLite 日历 |
| **日历数据源** | 直接使用在线日历（API） | 本地 SQLite + 在线日历 |
| **待办写入目标** | 在线日历（直接写入） | 本地日历（后续同步到在线） |
| **同步方向** | 单向（在线 → 前端） | 双向（本地 ↔ 在线） |
| **离线能力** | ❌ 无离线能力 | ✅ 有离线能力 |
| **数据持久化** | 服务端数据库 | 本地 SQLite + 服务端数据库 |

#### Web 端数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        Web 端                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  前端 Store  │───▶│  API 调用   │───▶│  服务端数据库 │     │
│  │  (内存)      │    │  (HTTP)     │    │  (持久化)   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  特点：                                                     │
│  - 无本地日历账户                                            │
│  - 待办直接写入在线日历                                       │
│  - 数据完全依赖服务端                                        │
│  - 无离线能力                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Windows 端数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      Windows 端                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  前端 Store  │───▶│  Tauri IPC  │───▶│  本地 SQLite │     │
│  │  (内存)      │    │  (调用)     │    │  (持久化)   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│                            │                                │
│                            ▼                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Sync       │───▶│  API 调用   │───▶│  服务端数据库 │     │
│  │  Executor   │    │  (HTTP)     │    │  (同步)     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  特点：                                                     │
│  - 有本地日历账户（ID=1）                                    │
│  - 待办先写入本地日历，再同步到在线                            │
│  - 数据双向同步                                             │
│  - 有离线能力                                               │
└─────────────────────────────────────────────────────────────┘
```

#### 同步策略对比

| 场景 | Web 端行为 | Windows 端行为 |
|------|-----------|---------------|
| **登录后** | 直接调用 `GET /calendars` 获取在线日历 | 调用 `batch_sync` 同步本地 ↔ 在线 |
| **创建日程事件** | 直接调用 `POST /events` 写入在线日历 | 写入本地 SQLite，记录 `sync_log` |
| **创建待办** | 直接调用 `POST /todos` 写入在线日历 | 写入本地 SQLite，记录 `sync_log` |
| **手动刷新** | 调用 `GET /calendars` 重新获取 | 调用 `sync_now` 触发即时同步 |
| **定期同步** | 无需定期同步（实时调用 API） | 调用 `batch_sync` 增量同步 |
| **离线状态** | ❌ 无法操作 | ✅ 可以操作本地数据 |

#### 数据写入逻辑

**Web 端和 Windows 端的日程事件、待办都遵循相同的写入模式：**

| 数据类型 | Web 端写入目标 | Windows 端写入目标 |
|---------|---------------|-------------------|
| **日程事件** | 在线日历（直接调用 API） | 本地日历（后续同步到在线） |
| **待办事项** | 在线日历（直接调用 API） | 本地日历（后续同步到在线） |
| **日历账户** | 在线日历（直接调用 API） | 本地日历（后续同步到在线） |

**Web 端**：
```typescript
// 日程事件/待办直接写入在线日历
async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  const { eventRepo } = usePlatform()
  // Web 端直接调用 API
  const created = await eventRepo.create({
    title: event.title,
    calendarId: getOnlineCalendarId(), // 使用在线日历 ID
    // ...
  })
}

async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
  const { todoRepo } = usePlatform()
  // Web 端直接调用 API
  const created = await todoRepo.create({
    title: todo.title,
    calendarId: getOnlineCalendarId(), // 使用在线日历 ID
    // ...
  })
}
```

**Windows 端**：
```typescript
// 日程事件/待办写入本地日历
async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  const { eventRepo } = usePlatform()
  // Windows 端写入本地 SQLite
  const created = await eventRepo.create({
    title: event.title,
    calendarId: getLocalCalendarId(), // 使用本地日历 ID（通常为 1）
    // ...
  })
  // 记录到 sync_log，后续同步到服务端
}

async function addTodo(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) {
  const { todoRepo } = usePlatform()
  // Windows 端写入本地 SQLite
  const created = await todoRepo.create({
    title: todo.title,
    calendarId: getLocalCalendarId(), // 使用本地日历 ID（通常为 1）
    // ...
  })
  // 记录到 sync_log，后续同步到服务端
}
```

---

## 3. 架构设计

### 3.1 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                        登录/启动                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              1. 调用 POST /v1/batch/sync                     │
│                 上传本地变更，下载服务端变更                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              2. SyncExecutor 处理响应                        │
│                 - 应用服务端日历变更到本地                     │
│                 - 应用服务端事件变更到本地                     │
│                 - 应用服务端待办变更到本地                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              3. 标记已同步的本地变更                          │
│                 - 更新 sync_log 表                          │
│                 - 保存 sync_token                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              4. 前端 calendarStore 重新加载                   │
│                 显示合并后的日历列表                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 组件交互

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 Store 层                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  authStore      │  │ calendarStore   │  │  todoStore   │ │
│  │  - login()      │  │ - initialize()  │  │ - initialize │ │
│  │  - logout()     │  │ - reload()      │  │ - reload()   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Platform Layer                        │ │
│  │  ┌─────────────────┐  ┌─────────────────┐               │ │
│  │  │  ISyncRepository │  │ ICalendarRepo   │               │ │
│  │  │  - triggerSync() │  │ - getAll()      │               │ │
│  │  │  - syncFromServer│  │ - create()     │               │ │
│  │  └────────┬────────┘  └────────┬────────┘               │ │
│  └───────────┼────────────────────┼────────────────────────┘ │
└──────────────┼────────────────────┼──────────────────────────┘
               │                    │
               ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Tauri/Rust 后端                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Commands       │  │ SyncExecutor    │  │ CalendarRepo │ │
│  │  - cloud_sync_* │  │ - batch_sync()  │  │ - upsert()   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │
│           │                    │                   │         │
│           ▼                    ▼                   ▼         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    API Client                           │ │
│  │  - POST /v1/batch/sync                                  │ │
│  │  - POST /v1/sync/now                                    │ │
│  │  - GET /v1/calendars                                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 数据库设计

#### calendars 表

```sql
CREATE TABLE IF NOT EXISTS calendars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'local',
    account_id INTEGER,
    visible INTEGER NOT NULL DEFAULT 1,
    sync_enabled INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER,
    deleted_at INTEGER,
    timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);
```

#### sync_log 表

```sql
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('event', 'todo', 'calendar')),
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
    payload TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES local_users(user_id) ON DELETE SET NULL
);
```

---

## 4. 实现细节

### 4.1 Rust 后端

#### CalendarRepository 新增方法

```rust
/// 使用指定 ID 插入日历（用于服务端同步，跳过 AUTOINCREMENT）
pub fn insert_with_id(&self, id: i64, req: &CreateCalendarRequest) -> DatabaseResult<Calendar> {
    let now = chrono::Utc::now().timestamp_millis();
    let timezone = req.timezone.clone().unwrap_or_else(|| "Asia/Shanghai".to_string());

    self.db.execute_in_transaction(|tx| {
        tx.execute(
            r#"
            INSERT OR IGNORE INTO calendars (id, name, color, type, account_id, visible, sync_enabled, user_id, timezone, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                id,
                req.name,
                req.color,
                req.type_,
                req.account_id,
                req.visible as i64,
                req.sync_enabled as i64,
                req.user_id,
                timezone,
                now,
                now,
            ],
        )?;

        Ok(Calendar {
            id,
            name: req.name.clone(),
            color: req.color.clone(),
            type_: req.type_.clone(),
            account_id: req.account_id,
            visible: req.visible,
            sync_enabled: req.sync_enabled,
            user_id: req.user_id,
            deleted_at: None,
            timezone,
            created_at: now,
            updated_at: now,
        })
    })
}
```

#### Tauri Command 新增

```rust
/// 从服务端同步日历到本地
#[tauri::command]
pub async fn sync_calendars_from_server(
    db: State<'_, Mutex<DatabaseConnection>>,
    api: State<'_, Arc<dyn CalendarApi>>,
) -> Result<bool, String> {
    let db_conn = db.lock().unwrap();
    let calendar_repo = CalendarRepository::new(&db_conn);
    
    // 1. 调用 API 获取服务端日历
    let server_calendars = api.get_calendars().await
        .map_err(|e| format!("获取服务端日历失败: {}", e))?;
    
    // 2. 遍历服务端日历，upsert 到本地
    for server_cal in server_calendars {
        let req = CreateCalendarRequest {
            name: server_cal.name,
            color: server_cal.color,
            type_: server_cal.r#type,
            account_id: server_cal.account_id,
            visible: server_cal.visible,
            sync_enabled: server_cal.sync_enabled,
            user_id: Some(server_cal.user_id),
            timezone: None,
        };
        
        // 使用 INSERT OR IGNORE 避免覆盖本地日历
        calendar_repo.insert_with_id(server_cal.id, &req)
            .map_err(|e| format!("插入日历失败: {}", e))?;
    }
    
    Ok(true)
}
```

### 4.2 前端 Store

#### getValidCalendarId() 修复

```typescript
function getValidCalendarId(calendarId: string | undefined): number {
  if (calendarId) {
    const parsed = parseInt(calendarId)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 从 calendarStore 获取第一个可用日历
  const localCalendar = calendars.value.find(c => c.type === 'local')
  if (localCalendar) {
    const parsed = parseInt(localCalendar.id)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 兜底：返回第一个日历（不限类型）
  const firstCalendar = calendars.value[0]
  if (firstCalendar) {
    const parsed = parseInt(firstCalendar.id)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 最终兜底（不应发生）
  console.warn('[Store] 无法获取有效的日历 ID')
  return 1
}
```

#### 登录后同步

```typescript
async function login(credentials: LoginRequest): Promise<boolean> {
  // ... 现有认证逻辑
  
  if (result) {
    // 新增：登录成功后同步服务端日历到本地
    await syncCalendarsFromServer()
    
    // ... 现有用户信息获取逻辑
  }
}

async function syncCalendarsFromServer(): Promise<void> {
  try {
    const { syncRepo } = usePlatform()
    await syncRepo.syncCalendarsFromServer()
    
    // 重新加载日历数据
    const calendarStore = useCalendarStore()
    await calendarStore.reloadFromDatabase()
    
    console.log('[AuthStore] 日历同步完成')
  } catch (error) {
    console.error('[AuthStore] 日历同步失败:', error)
    // 显示错误提示给用户
    throw error
  }
}
```

---

## 5. 测试策略

### 5.1 单元测试

#### CalendarRepository 测试

```rust
#[test]
fn test_insert_with_id() {
    let db = setup_test_db();
    let repo = CalendarRepository::new(&db);
    
    let req = CreateCalendarRequest {
        name: "服务端日历".to_string(),
        color: "#FF5733".to_string(),
        type_: "online".to_string(),
        account_id: Some(2),
        visible: true,
        sync_enabled: true,
        user_id: Some(1),
        timezone: None,
    };
    
    // 使用服务端 ID 插入
    let calendar = repo.insert_with_id(100, &req).expect("插入日历失败");
    assert_eq!(calendar.id, 100);
    assert_eq!(calendar.name, "服务端日历");
}

#[test]
fn test_insert_with_id_ignore_existing() {
    let db = setup_test_db();
    let repo = CalendarRepository::new(&db);
    
    // 先插入一个日历
    let req1 = CreateCalendarRequest {
        name: "本地日历".to_string(),
        color: "#000000".to_string(),
        type_: "local".to_string(),
        account_id: None,
        visible: true,
        sync_enabled: false,
        user_id: None,
        timezone: None,
    };
    repo.insert_with_id(100, &req1).expect("插入日历失败");
    
    // 尝试插入相同 ID 的日历（应该被忽略）
    let req2 = CreateCalendarRequest {
        name: "服务端日历".to_string(),
        color: "#FF5733".to_string(),
        type_: "online".to_string(),
        account_id: Some(2),
        visible: true,
        sync_enabled: true,
        user_id: Some(1),
        timezone: None,
    };
    repo.insert_with_id(100, &req2).expect("插入日历失败");
    
    // 验证日历名称仍然是"本地日历"
    let calendar = repo.get_by_id(100).expect("获取日历失败");
    assert_eq!(calendar.name, "本地日历");
}
```

#### SyncExecutor 测试

```rust
#[test]
fn test_apply_calendar_create_from_server() {
    let db = setup_test_db();
    let api = Arc::new(MockApiClient::new());
    let executor = SyncExecutor::new(&db, api.clone());
    
    let changes = BatchChanges {
        calendars: EntityChanges {
            created: vec![CalendarSyncItem {
                id: 100,
                name: "服务端日历".to_string(),
                color: "#FF5733".to_string(),
                r#type: "online".to_string(),
                account_id: Some(2),
                visible: true,
                sync_enabled: true,
                updated_at: 1700000000000,
            }],
            updated: vec![],
            deleted: vec![],
        },
        events: EntityChanges { created: vec![], updated: vec![], deleted: vec![] },
        todos: EntityChanges { created: vec![], updated: vec![], deleted: vec![] },
    };
    
    let result = executor.apply_server_changes(&changes);
    assert!(result.is_ok());
    
    let calendar = executor.db.execute(|conn| {
        conn.query_row("SELECT name FROM calendars WHERE id = 100", [], |row| {
            row.get(0)
        })
    }).unwrap();
    assert_eq!(calendar, "服务端日历");
}
```

### 5.2 集成测试

#### 登录后同步测试

```typescript
describe('Calendar Sync', () => {
  it('should sync calendars after login', async () => {
    // 模拟登录成功
    const authStore = useAuthStore()
    await authStore.login({ username: 'test@example.com', password: 'password' })
    
    // 验证日历同步触发
    const calendarStore = useCalendarStore()
    expect(calendarStore.calendars.length).toBeGreaterThan(1)
    
    // 验证本地日历保留
    const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
    expect(localCalendar).toBeDefined()
    
    // 验证服务端日历同步
    const serverCalendars = calendarStore.calendars.filter(c => c.type === 'online')
    expect(serverCalendars.length).toBeGreaterThan(0)
  })
})
```

#### 冲突解决测试

```typescript
describe('Conflict Resolution', () => {
  it('should resolve conflicts using updated_at', async () => {
    // 模拟本地和服务端同时修改同一日历
    const localCalendar = { id: 100, name: '本地名称', updated_at: 1700000000000 }
    const serverCalendar = { id: 100, name: '服务端名称', updated_at: 1700000001000 }
    
    // 触发同步
    const syncExecutor = new SyncExecutor()
    const result = await syncExecutor.batch_sync(userId, lastSyncAt)
    
    // 验证服务端数据优先（updated_at 较新）
    const calendar = await calendarRepo.get_by_id(100)
    expect(calendar.name).toBe('服务端名称')
  })
})
```

### 5.3 端到端测试

```typescript
describe('End-to-End Sync', () => {
  it('should complete full sync flow', async () => {
    // 1. 启动应用
    await app.start()
    
    // 2. 登录账户
    await authStore.login({ username: 'test@example.com', password: 'password' })
    
    // 3. 创建日历
    await calendarStore.addCalendar({ name: '工作日历', color: '#4A90D9', type: 'local' })
    
    // 4. 创建事件和待办
    await eventStore.addEvent({ title: '会议', calendarId: '1' })
    await todoStore.addTodo({ title: '任务', calendarId: '1' })
    
    // 5. 触发同步
    await syncStore.triggerCloudSync()
    
    // 6. 验证服务端数据
    const serverCalendars = await apiClient.get('/calendars')
    expect(serverCalendars.length).toBeGreaterThan(0)
    
    // 7. 重新启动应用
    await app.restart()
    
    // 8. 验证本地数据恢复
    const localCalendars = await calendarStore.calendars
    expect(localCalendars.length).toBeGreaterThan(0)
  })
})
```

---

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/platform/types/sync.repository.ts` | 修改 | 新增 `syncCalendarsFromServer()` 接口 |
| `src-tauri/src/commands.rs` | 修改 | 新增 `sync_calendars_from_server` 命令 |
| `src-tauri/src/db/repositories/calendar.rs` | 修改 | 新增 `insert_with_id()` 方法 |
| `src-tauri/src/sync_engine/sync.rs` | 修改 | 集成日历同步逻辑 |
| `src/platform/tauri/sync.repo.ts` | 修改 | 实现 `syncCalendarsFromServer()` |
| `src/platform/web/sync.repo.ts` | 修改 | 实现 `syncCalendarsFromServer()` |
| `src/stores/auth.ts` | 修改 | 登录/注册后触发日历同步 |
| `src/stores/calendar.ts` | 修改 | 修复 `getValidCalendarId()` |
| `src/stores/todo.ts` | 修改 | 修复 `getValidCalendarId()` |
| `src/__tests__/calendar-sync.test.ts` | 新增 | 日历同步单元测试 |
| `src/__tests__/sync-executor.test.ts` | 修改 | 增加日历同步测试用例 |

---

## 7. 注意事项

1. **ID 冲突处理**：服务端日历 ID 直接作为本地 SQLite ID，使用 INSERT OR IGNORE
2. **默认日历保留**：本地默认日历（ID=1）不会被删除
3. **离线场景**：Tauri 端先创建默认日历保证可用，登录后同步覆盖
4. **Web 端**：`calendarRepo.getAll()` 已经直接调用 API，无需额外处理
5. **错误处理**：网络失败不影响本地数据，使用 try-catch 包裹
6. **多账户切换**：使用 `user_id` 字段区分不同账户，隐藏非当前账户的日历

---

## 8. 待办事项

- [ ] 实现 `syncCalendarsFromServer()` 接口
- [ ] 实现 Tauri 命令 `sync_calendars_from_server`
- [ ] 实现 `CalendarRepository.insert_with_id()` 方法
- [ ] 集成日历同步逻辑到 `SyncExecutor`
- [ ] 修复 `getValidCalendarId()` 兜底逻辑
- [ ] 编写单元测试和集成测试
- [ ] 端到端测试验证完整流程
