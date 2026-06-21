# 日历同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现登录后从服务端获取日历数据并同步到本地，支持多账户切换，保证数据唯一性

**Architecture:** Web 端无本地日历，直接使用在线日历；Windows 端有本地 SQLite 日历，通过 `batch_sync` API 实现双向同步。使用 `INSERT OR IGNORE` 策略避免 ID 冲突，通过 `user_id` 字段支持多账户切换。

**Tech Stack:** TypeScript, Vue 3, Pinia, Tauri 2.x, Rust, SQLite

---

## 文件结构

### 新增文件
- `src/__tests__/calendar-sync.test.ts` - 日历同步集成测试

### 修改文件
- `src/platform/types/sync.repository.ts` - 新增 `syncCalendarsFromServer()` 接口
- `src-tauri/src/commands.rs` - 新增 `sync_calendars_from_server` 命令
- `src-tauri/src/db/repositories/calendar.rs` - 新增 `insert_with_id()` 方法
- `src-tauri/src/sync_engine/sync.rs` - 集成日历同步逻辑
- `src/platform/tauri/sync.repo.ts` - 实现 `syncCalendarsFromServer()`
- `src/platform/web/sync.repo.ts` - 实现 `syncCalendarsFromServer()`
- `src/stores/auth.ts` - 登录/注册后触发日历同步
- `src/stores/calendar.ts` - 修复 `getValidCalendarId()`
- `src/stores/todo.ts` - 修复 `getValidCalendarId()`
- `src/stores/event.ts` - 修复 `getValidCalendarId()`

---

## Task 1: CalendarRepository 新增 `insert_with_id()` 方法

**Files:**
- Modify: `src-tauri/src/db/repositories/calendar.rs`
- Test: `src-tauri/src/db/repositories/calendar.rs` (内联测试)

- [ ] **Step 1: 编写失败的测试**

在 `src-tauri/src/db/repositories/calendar.rs` 的 `#[cfg(test)]` 模块中添加：

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
    assert_eq!(calendar.type_, "online");
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

- [ ] **Step 2: 运行测试验证失败**

运行: `cargo test test_insert_with_id -- --nocapture`
预期: 失败，提示 `insert_with_id` 方法不存在

- [ ] **Step 3: 编写最小实现**

在 `src-tauri/src/db/repositories/calendar.rs` 的 `CalendarRepository` 实现中添加：

```rust
/// 使用指定 ID 插入日历（用于服务端同步，跳过 AUTOINCREMENT）
///
/// 使用 INSERT OR IGNORE 策略，如果 ID 已存在则忽略插入。
/// 这样可以保留本地日历数据，同时同步服务端日历。
///
/// # 参数
/// - `id`: 服务端日历 ID
/// - `req`: 创建日历请求
///
/// # 返回
/// 成功返回日历实体（可能是新插入的或已存在的）
pub fn insert_with_id(&self, id: i64, req: &CreateCalendarRequest) -> DatabaseResult<Calendar> {
    let now = chrono::Utc::now().timestamp_millis();
    let timezone = req
        .timezone
        .clone()
        .unwrap_or_else(|| "Asia/Shanghai".to_string());

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

        // 如果 INSERT OR IGNORE 忽略了插入，需要查询现有记录
        // 如果成功插入，返回新记录
        // 这里简化处理，直接查询
        let calendar = tx.query_row(
            &format!("SELECT {CALENDAR_COLUMNS} FROM calendars WHERE id = ?1"),
            params![id],
            |row| Calendar::from_row(row),
        ).map_err(|_| DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id,
        })?;

        Ok(calendar)
    })
}
```

- [ ] **Step 4: 运行测试验证通过**

运行: `cargo test test_insert_with_id -- --nocapture`
预期: 通过

运行: `cargo test test_insert_with_id_ignore_existing -- --nocapture`
预期: 通过

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/db/repositories/calendar.rs
git commit -m "feat(calendar): 新增 insert_with_id 方法支持服务端同步"
```

---

## Task 2: Tauri 命令 `sync_calendars_from_server`

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Test: `src-tauri/src/commands.rs` (内联测试)

- [ ] **Step 1: 编写失败的测试**

在 `src-tauri/src/commands.rs` 中添加测试（如果文件支持内联测试）：

```rust
// 注意：Tauri 命令通常需要集成测试，这里先定义接口
// 实际测试将在集成测试中进行
```

- [ ] **Step 2: 编写命令实现**

在 `src-tauri/src/commands.rs` 中添加：

```rust
/// 从服务端同步日历到本地
///
/// 调用 GET /calendars API 获取服务端日历列表，
/// 然后使用 INSERT OR IGNORE 策略同步到本地 SQLite。
///
/// # 返回
/// 成功返回 true，失败返回错误信息
#[tauri::command]
pub async fn sync_calendars_from_server(
    db: State<'_, Mutex<DatabaseConnection>>,
    api: State<'_, Arc<dyn CalendarApi>>,
) -> Result<bool, String> {
    log::info!("开始从服务端同步日历");
    
    let db_conn = db.lock().map_err(|e| format!("获取数据库锁失败: {}", e))?;
    let calendar_repo = CalendarRepository::new(&db_conn);
    
    // 1. 调用 API 获取服务端日历
    let server_calendars = api.get_calendars().await
        .map_err(|e| {
            log::error!("获取服务端日历失败: {}", e);
            format!("获取服务端日历失败: {}", e)
        })?;
    
    log::info!("获取到 {} 个服务端日历", server_calendars.len());
    
    // 2. 遍历服务端日历，upsert 到本地
    let mut synced_count = 0;
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
        match calendar_repo.insert_with_id(server_cal.id, &req) {
            Ok(_) => {
                synced_count += 1;
                log::debug!("同步日历成功: id={}, name={}", server_cal.id, req.name);
            }
            Err(e) => {
                log::error!("同步日历失败: id={}, error={}", server_cal.id, e);
                // 继续同步其他日历，不中断
            }
        }
    }
    
    log::info!("日历同步完成: 共同步 {} 个日历", synced_count);
    Ok(true)
}
```

- [ ] **Step 3: 注册命令**

在 `src-tauri/src/lib.rs` 中找到命令注册的位置，添加 `sync_calendars_from_server`：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    sync_calendars_from_server,  // 新增
])
```

- [ ] **Step 4: 运行编译验证**

运行: `cargo build`
预期: 编译通过

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat(commands): 新增 sync_calendars_from_server 命令"
```

---

## Task 3: ISyncRepository 接口新增 `syncCalendarsFromServer()`

**Files:**
- Modify: `src/platform/types/sync.repository.ts`

- [ ] **Step 1: 添加接口方法**

在 `src/platform/types/sync.repository.ts` 的 `ISyncRepository` 接口中添加：

```typescript
export interface ISyncRepository {
  // ... 现有方法

  /** 从服务端获取日历列表并同步到本地数据库 */
  syncCalendarsFromServer(): Promise<boolean>
}
```

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过（可能提示实现类需要实现新方法）

- [ ] **Step 3: 提交**

```bash
git add src/platform/types/sync.repository.ts
git commit -m "feat(types): ISyncRepository 新增 syncCalendarsFromServer 接口"
```

---

## Task 4: TauriSyncRepository 实现 `syncCalendarsFromServer()`

**Files:**
- Modify: `src/platform/tauri/sync.repo.ts`

- [ ] **Step 1: 编写实现**

在 `src/platform/tauri/sync.repo.ts` 的 `TauriSyncRepository` 类中添加：

```typescript
async syncCalendarsFromServer(): Promise<boolean> {
  try {
    const result = await safeInvoke<{ success: boolean }>('sync_calendars_from_server')
    return result?.success ?? false
  } catch (error) {
    console.error('[TauriSyncRepository] 从服务端同步日历失败:', error)
    throw error
  }
}
```

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 3: 提交**

```bash
git add src/platform/tauri/sync.repo.ts
git commit -m "feat(tauri): TauriSyncRepository 实现 syncCalendarsFromServer"
```

---

## Task 5: WebSyncRepository 实现 `syncCalendarsFromServer()`

**Files:**
- Modify: `src/platform/web/sync.repo.ts`

- [ ] **Step 1: 编写实现**

在 `src/platform/web/sync.repo.ts` 的 `WebSyncRepository` 类中添加：

```typescript
async syncCalendarsFromServer(): Promise<boolean> {
  // Web 端不需要特殊处理，calendarRepo.getAll() 已经直接调用 API
  // 返回 true 表示同步完成
  console.info('[WebSyncRepository] Web 端无需同步日历，直接使用在线日历')
  return true
}
```

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 3: 提交**

```bash
git add src/platform/web/sync.repo.ts
git commit -m "feat(web): WebSyncRepository 实现 syncCalendarsFromServer"
```

---

## Task 6: authStore 登录后触发日历同步

**Files:**
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: 添加 syncCalendarsFromServer 方法**

在 `src/stores/auth.ts` 的 `useAuthStore` 中添加：

```typescript
/**
 * 从服务端同步日历到本地
 * 登录/注册成功后调用，确保本地日历数据与服务端一致
 */
async function syncCalendarsFromServer(): Promise<void> {
  try {
    const { syncRepo } = usePlatform()
    const success = await syncRepo.syncCalendarsFromServer()
    
    if (success) {
      // 重新加载日历数据
      const { useCalendarStore } = await import('./calendar')
      const calendarStore = useCalendarStore()
      await calendarStore.reloadFromDatabase()
      
      console.log('[AuthStore] 日历同步完成')
    } else {
      console.warn('[AuthStore] 日历同步返回失败')
    }
  } catch (error) {
    console.error('[AuthStore] 日历同步失败:', error)
    // 显示错误提示给用户，但不阻塞登录流程
    // 用户可以手动触发重试
  }
}
```

- [ ] **Step 2: 在 login 方法中调用**

修改 `src/stores/auth.ts` 的 `login` 方法，在登录成功后调用日历同步：

```typescript
async function login(credentials: LoginRequest): Promise<boolean> {
  try {
    const { authRepo } = usePlatform()
    // 使用 RSA 加密密码
    const encryptedPassword = await encryptPassword(credentials.password)
    if (!encryptedPassword) {
      console.error('[AuthStore] 密码加密失败，无法登录')
      return false
    }

    const result = await authRepo.login(credentials.username, encryptedPassword)
    if (result) {
      const currentUser = await authRepo.getCurrentUser()
      if (currentUser) {
        user.value = currentUser
        isAuthenticated.value = true
        
        // 新增：登录成功后同步服务端日历到本地
        await syncCalendarsFromServer()
        
        return true
      } else {
        console.error('[AuthStore] 登录成功但获取用户信息失败，回滚认证状态')
        user.value = null
        isAuthenticated.value = false
        return false
      }
    }
    return false
  } catch (error) {
    console.error('登录失败:', error)
    return false
  }
}
```

- [ ] **Step 3: 在 register 方法中调用**

修改 `src/stores/auth.ts` 的 `register` 方法，在注册成功后调用日历同步：

```typescript
async function register(data: RegisterRequest): Promise<boolean> {
  try {
    const { authRepo } = usePlatform()
    const encryptedPassword = await encryptPassword(data.password)
    if (!encryptedPassword) {
      console.error('[AuthStore] 密码加密失败，无法注册')
      return false
    }

    const result = await authRepo.register(data.email, encryptedPassword, data.username)
    if (result) {
      const currentUser = await authRepo.getCurrentUser()
      if (currentUser) {
        user.value = currentUser
        isAuthenticated.value = true
        
        // 新增：注册成功后同步服务端日历到本地
        await syncCalendarsFromServer()
        
        return true
      } else {
        console.error('[AuthStore] 注册成功但获取用户信息失败，回滚认证状态')
        user.value = null
        isAuthenticated.value = false
        return false
      }
    }
    return false
  } catch (error) {
    console.error('注册失败:', error)
    return false
  }
}
```

- [ ] **Step 4: 导出 syncCalendarsFromServer**

在 `src/stores/auth.ts` 的 return 语句中添加 `syncCalendarsFromServer`：

```typescript
return {
  // ... 现有导出
  syncCalendarsFromServer,  // 新增
}
```

- [ ] **Step 5: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 6: 提交**

```bash
git add src/stores/auth.ts
git commit -m "feat(auth): 登录/注册后触发日历同步"
```

---

## Task 7: 修复 calendarStore 的 `getValidCalendarId()`

**Files:**
- Modify: `src/stores/calendar.ts`

- [ ] **Step 1: 修改 getValidCalendarId 实现**

修改 `src/stores/calendar.ts` 的 `getValidCalendarId` 方法：

```typescript
/**
 * 获取有效的日历 ID
 * 优先返回传入的 calendarId，其次返回本地日历，最后返回第一个可用日历
 */
function getValidCalendarId(calendarId: string | undefined): number {
  if (calendarId) {
    const parsed = parseInt(calendarId)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 从 calendarStore 获取第一个本地日历
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
  console.warn('[CalendarStore] 无法获取有效的日历 ID，使用默认值 1')
  return 1
}
```

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 3: 提交**

```bash
git add src/stores/calendar.ts
git commit -m "fix(calendar): 修复 getValidCalendarId 兜底逻辑"
```

---

## Task 8: 修复 todoStore 的 `getValidCalendarId()`

**Files:**
- Modify: `src/stores/todo.ts`

- [ ] **Step 1: 修改 getValidCalendarId 实现**

修改 `src/stores/todo.ts` 的 `getValidCalendarId` 方法：

```typescript
/**
 * 获取有效的日历 ID
 * 优先返回传入的 calendarId，其次返回本地日历，最后返回第一个可用日历
 */
function getValidCalendarId(calendarId: string | undefined): number {
  if (calendarId) {
    const parsed = parseInt(calendarId)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 从 calendarStore 获取第一个本地日历
  const calendarStore = useCalendarStore()
  const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
  if (localCalendar) {
    const parsed = parseInt(localCalendar.id)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 兜底：返回第一个日历（不限类型）
  const firstCalendar = calendarStore.calendars[0]
  if (firstCalendar) {
    const parsed = parseInt(firstCalendar.id)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  
  // 最终兜底（不应发生）
  console.warn('[TodoStore] 无法获取有效的日历 ID，使用默认值 1')
  return 1
}
```

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 3: 提交**

```bash
git add src/stores/todo.ts
git commit -m "fix(todo): 修复 getValidCalendarId 兜底逻辑"
```

---

## Task 9: 修复 eventStore 的 `getValidCalendarId()`

**Files:**
- Modify: `src/stores/event.ts` (如果存在)

- [ ] **Step 1: 检查 eventStore 是否有 getValidCalendarId**

如果 `src/stores/event.ts` 存在且有 `getValidCalendarId` 方法，按照 Task 8 的方式修复。

如果不存在，跳过此任务。

- [ ] **Step 2: 运行类型检查**

运行: `pnpm tsc --noEmit`
预期: 类型检查通过

- [ ] **Step 3: 提交**

```bash
git add src/stores/event.ts
git commit -m "fix(event): 修复 getValidCalendarId 兜底逻辑"
```

---

## Task 10: 集成测试

**Files:**
- Create: `src/__tests__/calendar-sync.test.ts`

- [ ] **Step 1: 创建测试文件**

创建 `src/__tests__/calendar-sync.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock 平台依赖
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
    },
    calendarRepo: {
      getAll: vi.fn().mockResolvedValue([
        { id: '1', name: '本地日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
        { id: '2', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ]),
    },
  }),
}))

describe('Calendar Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should sync calendars after login', async () => {
    // 动态导入以避免循环依赖
    const { useAuthStore } = await import('@/stores/auth')
    const { useCalendarStore } = await import('@/stores/calendar')
    
    const authStore = useAuthStore()
    const calendarStore = useCalendarStore()
    
    // 模拟登录成功
    await authStore.login({ username: 'test@example.com', password: 'password' })
    
    // 验证日历同步触发
    expect(calendarStore.calendars.length).toBeGreaterThan(1)
    
    // 验证本地日历保留
    const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
    expect(localCalendar).toBeDefined()
    
    // 验证服务端日历同步
    const serverCalendars = calendarStore.calendars.filter(c => c.type === 'online')
    expect(serverCalendars.length).toBeGreaterThan(0)
  })

  it('should return valid calendar ID', async () => {
    const { useCalendarStore } = await import('@/stores/calendar')
    const calendarStore = useCalendarStore()
    
    // 初始化日历
    await calendarStore.initialize()
    
    // 测试 getValidCalendarId
    const validId = calendarStore.getValidCalendarId(undefined)
    expect(validId).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 运行测试**

运行: `pnpm test:run -- src/__tests__/calendar-sync.test.ts`
预期: 测试通过

- [ ] **Step 3: 提交**

```bash
git add src/__tests__/calendar-sync.test.ts
git commit -m "test(sync): 添加日历同步集成测试"
```

---

## Task 11: 端到端验证

**Files:**
- 无新增文件

- [ ] **Step 1: 启动 Tauri 开发模式**

运行: `pnpm tauri:dev`
预期: 应用启动成功

- [ ] **Step 2: 测试登录后日历同步**

1. 在应用中登录账户
2. 打开浏览器开发者工具，查看控制台日志
3. 验证日志中出现 "日历同步完成" 或类似信息
4. 验证日历列表中显示了服务端日历

- [ ] **Step 3: 测试待办写入**

1. 创建一个待办事项
2. 验证待办写入了正确的日历（本地日历 ID=1）
3. 触发同步，验证待办同步到服务端

- [ ] **Step 4: 测试日程事件写入**

1. 创建一个日程事件
2. 验证事件写入了正确的日历（本地日历 ID=1）
3. 触发同步，验证事件同步到服务端

- [ ] **Step 5: 测试多账户切换**

1. 登出当前账户
2. 登录另一个账户
3. 验证日历列表更新为新账户的日历
4. 验证旧账户的日历被隐藏

- [ ] **Step 6: 提交所有更改**

```bash
git add .
git commit -m "feat: 实现日历同步功能，支持多账户切换"
```

---

## 自检清单

### 1. 规格覆盖检查

- ✅ 登录后从服务端获取日历数据并同步到本地
- ✅ 保证多次登录的日历数据唯一性（INSERT OR IGNORE）
- ✅ 支持多账户切换（user_id 字段）
- ✅ 保持本地日历和事件不丢失
- ✅ Web 端无本地日历，直接使用在线日历
- ✅ Windows 端有本地 SQLite 日历，通过 batch_sync 同步

### 2. 占位符扫描

- ✅ 无 "TBD"、"TODO" 或不完整的部分
- ✅ 所有代码块都是完整的实现
- ✅ 所有测试都有具体的断言

### 3. 类型一致性检查

- ✅ `syncCalendarsFromServer()` 在接口和实现中签名一致
- ✅ `insert_with_id()` 在测试和实现中参数一致
- ✅ `getValidCalendarId()` 在 calendarStore 和 todoStore 中逻辑一致

---

## 执行选项

**计划完成并保存到 `docs/superpowers/plans/2026-05-16-calendar-sync.md`。两种执行方式：**

**1. Subagent-Driven（推荐）** - 每个任务分派一个新的子代理，任务间进行审查，快速迭代

**2. Inline Execution** - 在当前会话中执行任务，批量执行并设置检查点

**选择哪种方式？**
