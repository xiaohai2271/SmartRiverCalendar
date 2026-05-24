# 日历账户身份切换设计

> 日期：2026-05-24
> 状态：待审阅
> 范围：Windows / Android / iOS / Web

## 1. 背景与动机

### 当前问题

桌面端接入在线日历账户后，界面展示两个日历账户：`type: 'local'` 的"我的日历" + `type: 'online'` 的在线日历。用户需要在两个日历之间手动切换，事件归属不直观，体验割裂。

### 目标

将双账户模式改为**单账户身份切换**：

- 未登录 → 展示本地日历（"我的日历"），数据存本地 SQLite
- 登录后 → 本地数据同步到远端，日历切换为在线模式，界面显示同步状态标识
- 退出登录 → 远端数据同步到本地，日历回退为本地模式

### 核心原则

**本地数据优先**——无论登录态如何变化，本地 SQLite 始终保有完整数据。

## 2. 设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 数据归属策略 | 同一条记录，切换 type | 事件的 calendarId 不变，无需迁移，最简单 |
| 登录同步策略 | 双向同步（上传+下拉） | 保证两端数据完整，多次登录/退出不重复 |
| 退出同步策略 | 退出前同步到本地 | 保证本地数据完整性 |
| 外部日历关系 | 保持独立，不受影响 | Exchange/CalDAV 有独立账号体系 |
| 界面展示 | 保持"我的日历"，加在线标识 | 不改变用户认知，仅增加状态提示 |
| 同步驱动方式 | 前端 Store 编排，Repository 执行 | 改动最小，复用现有机制，前端逻辑透明 |
| 冲突解决策略 | Last Write Wins（基于 updated_at） | 首期简洁可靠，后续可扩展用户选择 |
| 移动端支持 | 纳入本次设计，预留扩展点 | Android/iOS 复用 Tauri 平台代码，架构需通用 |

## 3. 数据模型

### 3.1 Calendar.type 语义明确化

`Calendar.type` 保持 `'local' | 'online' | 'exchange' | 'caldav'` 不变，但语义明确：

| type | 语义 | 何时出现 |
|------|------|---------|
| `local` | 未登录的本地日历 | 未登录时，默认日历的 type |
| `online` | 已登录的在线日历 | 登录后，同一日历记录 type 从 local 切换为 online |
| `exchange` | Exchange 外部日历 | 独立，不受登录态影响 |
| `caldav` | CalDAV 外部日历 | 独立，不受登录态影响 |

**关键约束**：`local` 和 `online` 是同一条日历记录的两种状态，不是两条记录。`exchange`/`caldav` 是独立的外部日历。

### 3.2 数据库 Schema

无需结构性变更：

- `calendars.type` 已是 `TEXT NOT NULL DEFAULT 'local'`，通过 `UPDATE` 切换
- `events.external_id` 已存在，用于去重匹配
- `sync_log` 表已存在（`synced` 字段标记待推送变更）

### 3.3 新增 PlatformCapabilities 能力

```typescript
export interface PlatformCapabilities {
  // ─── 已有能力保持不变 ───

  // ─── 新增：同步策略能力 ───

  /**
   * 是否支持后台同步
   * - 桌面端：true（应用可在后台持续运行同步）
   * - 移动端：false（OS 限制后台活动，如 Doze 模式，同步仅在活跃期执行）
   * - Web端：false（标签页不可靠）
   */
  hasBackgroundSync: boolean

  /**
   * 是否需要增量同步
   * - 桌面端：false（首期全量同步，网络稳定可接受）
   * - 移动端：true（减少流量消耗，缩短同步窗口）
   * - Web端：false（数据天然在线，不适用）
   */
  hasIncrementalSync: boolean

  /**
   * 是否需要客户端冲突解决
   * - 桌面端/移动端：true（本地数据可能与服务端冲突）
   * - Web端：false（服务端处理冲突）
   */
  hasClientConflictResolution: boolean
}
```

**各端能力值**：

| 能力 | Windows | Android/iOS | Web |
|------|---------|-------------|-----|
| `hasBackgroundSync` | true | false | false |
| `hasIncrementalSync` | false（首期） | true | false |
| `hasClientConflictResolution` | true | true | false |

## 4. 核心流程

### 4.1 登录流程

```
用户点击登录
    │
    ▼
authRepo.login() → 认证成功
    │
    ▼
触发双向同步（syncRepo.triggerCloudSync）
    │
    ├── 本地有但远端没有的事件 → 上传（通过 externalId 去重）
    ├── 远端有但本地没有的事件 → 下拉保存到 SQLite
    ├── 两端都有的事件 → 比较 updated_at，保留较新的版本
    │
    ▼
calendarRepo.updateType({ type: 'online', syncEnabled: true })
    │
    ▼
reloadFromDatabase() → 刷新 Store
    │
    ▼
启动自动同步（cloudSyncService.startAutoSync）
    │
    ▼
界面：日历名称保持"我的日历"，显示同步状态图标 + 用户名
```

### 4.2 退出登录流程

```
用户点击退出
    │
    ▼
触发最终同步（syncRepo.triggerCloudSync）
    │  ← 确保远端最新数据已保存到本地
    │
    ▼
calendarRepo.updateType({ type: 'local', syncEnabled: false })
    │
    ▼
authRepo.logout() → 清除 token
    │
    ▼
停止自动同步（cloudSyncService.stopAutoSync）
    │
    ▼
reloadFromDatabase() → 刷新 Store
    │
    ▼
界面：日历名称保持"我的日历"，移除同步状态图标
```

### 4.3 去重规则

防止多次登录/退出、多设备登录产生重复数据：

| 场景 | 判断依据 | 处理方式 |
|------|---------|---------|
| 本地事件在远端已存在 | `externalId` 匹配 | 跳过上传，比较 `updated_at` 决定是否更新 |
| 本地事件无 externalId | 首次上传 | 上传后回填远端返回的 `externalId` |
| 远端事件本地已存在 | `externalId` 匹配 | 跳过创建，比较 `updated_at` 决定是否更新 |
| 远端事件本地不存在 | 无匹配 | 创建到本地 SQLite，回填 `externalId` |

**多设备不重复的关键**：每个事件首次上传到远端后，远端返回唯一的 `externalId`，后续同步通过 `externalId` 匹配而非内容匹配。同一事件不会在远端创建两次。

### 4.4 冲突解决策略（Last Write Wins）

```
设备 A 离线修改事件 X（updated_at: T1）
设备 B 在线修改事件 X（updated_at: T2, T2 > T1）
设备 A 联网同步
    │
    ▼
比较 updated_at：
    ├── 本地 T1 < 远端 T2 → 采用远端版本（远端更新）
    ├── 本地 T1 > 远端 T2 → 采用本地版本（本地更新）
    └── 本地 T1 = 远端 T2 → 采用远端版本（保守策略）
```

首期实现 LWW，简洁可靠。后续可扩展为用户选择保留哪个版本。

## 5. 事件操作分流

核心运行时逻辑——根据**日历类型 + 网络状态 + 平台能力**三级判断：

### 5.1 决策树

```
事件写操作
    │
    ├─ type='local'              → 写本地 SQLite（所有端一致）
    │
    ├─ type='online' + 在线       → 写本地 SQLite + 记录 sync_log + 触发即时推送
    │
    ├─ type='online' + 离线
    │   ├─ hasOfflineMode=true   → 写本地 SQLite + 记录 sync_log
    │   └─ hasOfflineMode=false  → 提示网络不可用（Web 端）
    │
    └─ type='exchange/caldav'    → 走 syncRepo 外部 API（保持现有逻辑不变）
```

### 5.2 条件组合表

| 条件组合 | 操作 | 适用端 |
|----------|------|--------|
| type='local' | 写本地 SQLite | 所有端 |
| type='online' + 在线 | 写本地 SQLite + 记录 sync_log + 触发即时推送 | 所有端 |
| type='online' + 离线 + hasOfflineMode | 写本地 + 记录 sync_log | Windows / 移动端 |
| type='online' + 离线 + !hasOfflineMode | 提示用户网络不可用 | Web 端 |
| type='exchange/caldav' | 走现有 syncRepo 逻辑 | 所有端 |

### 5.3 离线写降级流程（移动端关键场景）

```
用户离线创建事件（type='online' 但网络不可用）
    │
    ▼
eventRepo.create() → 写入本地 SQLite
    │
    ▼
syncRepo.recordPendingChange({ action: 'create', ... })
    │  ← 记录到 sync_log 表，synced = 0
    │
    ▼
网络恢复 / 应用回到前台
    │
    ▼
syncRepo.pushPendingChanges()
    │  ← 读取 sync_log 中 synced=0 的记录
    │     逐条推送到远端 API
    │     推送成功后 synced = 1
    │
    ▼
回填 externalId → 更新本地事件记录
```

## 6. Store 层与 Repository 层改动

### 6.1 Calendar Store 新增方法

**文件**：`src/stores/calendar.ts`

#### loginTransition()

```typescript
/**
 * 登录后日历身份切换
 *
 * 流程：触发双向同步 → 切换日历 type → 刷新数据 → 启动自动同步
 *
 * 多端通用性说明：
 * - 桌面端：全量双向同步后切换，网络稳定，耗时短
 * - 移动端：增量同步后切换，网络不稳定时可能较长，需显示进度
 * - Web端：不调用此方法（Web端日历天然在线，无需切换）
 *
 * @throws RepositoryError 同步或切换失败时抛出
 */
async function loginTransition(): Promise<void> {
  const { calendarRepo, syncRepo } = usePlatform()
  const capabilities = useCapabilities()

  // 仅 local-first 平台需要切换
  if (capabilities.dataPriority !== 'local-first') return

  // 1. 触发双向同步（Rust 后端执行：上传本地新数据 + 下拉远端新数据 + 去重）
  await syncRepo.triggerCloudSync()

  // 2. 将主日历的 type 从 'local' 切换为 'online'
  const mainCalendar = calendars.value.find(c => c.type === 'local')
  if (mainCalendar) {
    await calendarRepo.updateType({
      id: parseInt(mainCalendar.id),
      type: 'online',
      syncEnabled: true,
    })
  }

  // 3. 重新加载数据（同步后远端事件已写入 SQLite，type 已更新）
  await reloadFromDatabase()
}
```

#### logoutTransition()

```typescript
/**
 * 退出前日历身份切换
 *
 * 流程：最终同步 → 切换日历 type → 刷新数据 → 停止自动同步
 *
 * 多端通用性说明：
 * - 桌面端：完整同步后切换，确保本地数据完整
 * - 移动端：同桌面端，退出前必须同步以保证离线后数据可用
 * - Web端：不调用此方法（Web端无本地数据需保留）
 */
async function logoutTransition(): Promise<void> {
  const { calendarRepo, syncRepo } = usePlatform()
  const capabilities = useCapabilities()

  if (capabilities.dataPriority !== 'local-first') return

  // 1. 退出前最终同步（确保远端最新数据已保存到本地）
  try {
    await syncRepo.triggerCloudSync()
  } catch (error) {
    // 同步失败不阻塞退出，但记录警告
    console.warn('[CalendarStore] 退出前同步失败，本地数据可能不是最新:', error)
  }

  // 2. 将主日历的 type 从 'online' 切换回 'local'
  const mainCalendar = calendars.value.find(c => c.type === 'online')
  if (mainCalendar) {
    await calendarRepo.updateType({
      id: parseInt(mainCalendar.id),
      type: 'local',
      syncEnabled: false,
    })
  }

  // 3. 重新加载数据
  await reloadFromDatabase()
}
```

#### 事件操作分流改造

`addEvent()`、`updateEvent()`、`deleteEvent()` 均按第 5 节决策树改造。以 `addEvent()` 为例：

```typescript
/**
 * 事件操作分流 — 根据日历类型 + 网络状态 + 平台能力三级判断
 *
 * 决策树：
 * ├─ type='local'            → 写本地 SQLite
 * ├─ type='online' + 在线     → 写远端 API → 成功后缓存到本地
 * ├─ type='online' + 离线     → 写本地 + 记录 sync_log（需 hasOfflineMode）
 * ├─ type='online' + 离线     → 提示网络不可用（无 hasOfflineMode，即 Web）
 * └─ type='exchange/caldav'   → 走 syncRepo 外部 API（保持现有逻辑）
 */
async function addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) {
  const { eventRepo, syncRepo } = usePlatform()
  const capabilities = useCapabilities()
  const targetCalendar = calendars.value.find(c => c.id === event.calendarId)

  if (!targetCalendar) return

  // 外部日历：保持现有逻辑不变
  if (targetCalendar.type === 'exchange' || targetCalendar.type === 'caldav') {
    // ... 现有外部日历事件创建逻辑（不改动） ...
    return
  }

  // 本地日历：直接写本地
  if (targetCalendar.type === 'local') {
    const created = await eventRepo.create({
      ...event,
      calendarId: getValidCalendarId(event.calendarId),
    })
    events.value.push(created)
    return
  }

  // 在线日历 + 在线：写本地 SQLite + 触发即时同步推送到远端
  //
  // 写入策略说明：
  // 采用"先写本地，再同步推送"模式，而非"直接调远端 API"模式。
  // 原因：
  // 1. 保持 local-first 原则——本地 SQLite 始终是权威数据源
  // 2. 统一写入路径——无论在线/离线，事件都先写本地，降低分支复杂度
  // 3. 离线降级无缝——在线时写本地+推送，离线时写本地+记录 sync_log，
  //    两种路径的本地写入逻辑完全一致，仅在推送环节有差异
  // 4. Rust 后端处理推送——由 triggerImmediateSync() 触发 Rust 端读取
  //    sync_log 并推送，前端不需要关心远端 API 细节
  if (targetCalendar.type === 'online' && navigator.onLine) {
    const created = await eventRepo.create({
      ...event,
      calendarId: getValidCalendarId(event.calendarId),
    })
    events.value.push(created)

    // 记录到 sync_log 并触发即时推送（Rust 后端异步执行）
    await syncRepo.recordPendingChange({
      action: 'create',
      entityType: 'event',
      entityId: created.id,
      payload: JSON.stringify(created),
    })
    await syncRepo.pushPendingChanges()
    return
  }

  // 在线日历 + 离线 + 支持离线模式：写本地 + 记录同步日志
  if (targetCalendar.type === 'online' && !navigator.onLine && capabilities.hasOfflineMode) {
    const created = await eventRepo.create({
      ...event,
      calendarId: getValidCalendarId(event.calendarId),
    })
    events.value.push(created)
    // 记录到 sync_log，待联网后自动推送
    await syncRepo.recordPendingChange({
      action: 'create',
      entityType: 'event',
      entityId: created.id,
      payload: JSON.stringify(created),
    })
    return
  }

  // 在线日历 + 离线 + 不支持离线（Web端）：提示用户
  throw new RepositoryError({
    code: RepoErrorCodes.NETWORK_ERROR,
    message: '网络不可用，无法创建事件',
    platform: 'web',
  })
}
```

### 6.2 Auth Store 改动

**文件**：`src/stores/auth.ts`

#### login() 改动

```typescript
async function login(credentials: LoginRequest): Promise<boolean> {
  // ... 认证逻辑不变 ...

  if (result) {
    const currentUser = await authRepo.getCurrentUser()
    if (currentUser) {
      user.value = currentUser
      isAuthenticated.value = true

      // 【变更】登录成功后，日历身份切换（local → online）
      // 替代原有的 syncCalendarsFromServer()
      const { useCalendarStore } = await import('./calendar')
      const calendarStore = useCalendarStore()
      await calendarStore.loginTransition()

      return true
    }
  }
  return false
}
```

#### logout() 改动

```typescript
async function logout(): Promise<void> {
  // 【新增】退出前日历身份切换（online → local）
  try {
    const { useCalendarStore } = await import('./calendar')
    const calendarStore = useCalendarStore()
    await calendarStore.logoutTransition()
  } catch (error) {
    console.warn('[AuthStore] 退出前日历切换失败:', error)
  }

  // ... 原有 logout 逻辑不变 ...
  await authRepo.logout()
  clearCachedPublicKey()
  user.value = null
  isAuthenticated.value = false
  syncStatus.value = 'idle'
  lastSyncAt.value = null
}
```

### 6.3 Repository 接口扩展

#### ISyncRepository 新增方法

**文件**：`src/platform/types/sync.repository.ts`

```typescript
export interface ISyncRepository {
  // ─── 已有方法保持不变 ───

  /**
   * 记录待同步的本地变更
   *
   * 当日历 type='online' 但网络不可用时，事件仍写入本地 SQLite，
   * 同时通过此方法记录到 sync_log 表，待网络恢复后推送。
   *
   * 仅 local-first 平台需要实现（桌面端 + 移动端）。
   * Web 端无需实现（无本地数据库）。
   */
  recordPendingChange(params: {
    action: 'create' | 'update' | 'delete'
    entityType: 'event' | 'todo' | 'calendar'
    entityId: string
    payload: string
  }): Promise<void>

  /**
   * 推送所有待同步的本地变更到远端
   *
   * 读取 sync_log 表中 synced=0 的记录，逐条推送到远端 API。
   * 推送成功后标记 synced=1，并回填 externalId。
   *
   * 触发时机：
   * - 网络恢复时（cloudSyncService 监听 online 事件）
   * - 应用回到前台时（移动端 resume）
   * - 自动同步定时器触发时
   */
  pushPendingChanges(): Promise<{ pushed: number; failed: number }>
}
```

**Tauri 实现**：调用 `invoke('sync_push_pending')`，Rust 端读取 sync_log 并推送。
**Web 实现**：抛出 `RepositoryError`（`UNSUPPORTED_OPERATION`），Web 端不调用此方法。

#### ICalendarRepository 新增方法

**文件**：`src/platform/types/calendar.repository.ts`

```typescript
export interface ICalendarRepository {
  // ─── 已有方法保持不变 ───

  /**
   * 更新日历类型（登录/退出身份切换）
   *
   * 将日历 type 从 'local' 切换为 'online'，或反向切换。
   * 仅修改 type 和 sync_enabled 字段。
   *
   * 注意：此方法不处理数据同步，同步由 syncRepo 负责。
   * 调用顺序：先同步 → 再切换 type → 再 reloadFromDatabase()
   */
  updateType(params: {
    id: number
    type: 'local' | 'online'
    syncEnabled: boolean
  }): Promise<Calendar>
}
```

**Tauri 实现**：调用 `invoke('update_calendar_type', { id, type, syncEnabled })`。
**Web 实现**：调用 `PUT /calendars/:id`，传递 `type` 和 `sync_enabled`。

## 7. 界面改动

### 7.1 日历列表展示

**文件**：`src/components/settings/CalendarMgmtTab.vue`

```vue
<!-- 变更前 -->
<span v-if="cal.type === 'local'">本地</span>
<span v-else-if="cal.type === 'online'">在线</span>
<span v-else class="external-type">{{ cal.type }}</span>

<!-- 变更后 -->
<!-- 主日历：统一显示名称，根据登录态显示在线状态标识 -->
<template v-if="cal.type === 'local' || cal.type === 'online'">
  <span class="calendar-name">{{ cal.name }}</span>
  <!-- 在线标识：仅 type='online' 时显示 -->
  <span v-if="cal.type === 'online'" class="online-badge"
        :title="`已同步 · ${authStore.user?.displayName}`">
    <fluent-icon name="cloud-sync" size="12" />
  </span>
</template>
<!-- 外部日历：保持不变 -->
<template v-else>
  <span class="external-type">{{ cal.type }}</span>
</template>
```

### 7.2 同步状态图标

日历侧边栏/头部增加同步状态指示器：

| 状态 | 图标 | 说明 |
|------|------|------|
| type='local' | 无图标 | 纯本地状态 |
| type='online' + syncStatus='idle' | ☁️ 云图标 | 已同步 |
| type='online' + syncStatus='syncing' | 🔄 旋转图标 | 同步中 |
| type='online' + syncStatus='error' | ⚠️ 警告图标 | 同步失败 |
| type='online' + 离线 | ☁️⊘ 离线云图标 | 离线模式 |

### 7.3 登录/退出 UX 流程

| 操作 | UX 反馈 |
|------|---------|
| 登录中 | 显示"正在同步数据..."加载提示 |
| 同步完成 | Toast 通知"同步完成，已切换为在线模式" |
| 退出中 | 显示"正在保存数据..."加载提示 |
| 退出完成 | Toast 通知"已退出登录，数据已保存到本地" |
| 退出前同步失败 | 弹窗确认"同步失败，本地数据可能不是最新。是否仍要退出？" |

### 7.4 Web 端界面差异

Web 端没有 local↔online 切换：
- 日历名称始终显示服务端返回的名称
- 同步状态由服务端驱动
- 不需要在线/离线状态切换提示

## 8. 多端影响评估

### 8.1 端侧特征矩阵

| 特征 | Windows (Tauri) | Android/iOS (Tauri) | Web |
|------|----------------|---------------------|-----|
| 本地数据库 | ✅ SQLite | ✅ SQLite | ❌ |
| 离线能力 | ✅ 长期离线 | ✅ 间歇断网更频繁 | ❌ |
| 数据优先级 | local-first | local-first | remote-first |
| 应用生命周期 | 用户主动关闭 | OS 可随时杀进程 | 随标签页 |
| 后台同步 | 可持续运行 | 受限（Doze 模式） | 不可用 |
| Tauri 代码 | `src/platform/tauri/` | **复用同一套** | `src/platform/web/` |

**关键洞察**：Android/iOS 通过 Tauri 2.x 构建，**复用 `src/platform/tauri/` 代码**，不是新平台，而是 Tauri 平台的移动变体。

### 8.2 Web 端影响

| 改动项 | Web 端影响 |
|--------|-----------|
| Calendar.type 切换 | 无需改动——远端 API 直接返回 online 类型 |
| 登录时数据同步 | 无需改动——Web 端始终在线，数据天然同步 |
| 退出时数据同步 | 无需改动——Web 端没有本地数据需要保留 |
| 事件去重 | 无需改动——所有事件操作走 API，服务端负责去重 |
| Store 初始化 | 无需改动——已通过 `dataPriority` 判断 |
| 在线标识 UI | 小改动——添加同步状态图标（与桌面端统一） |

### 8.3 移动端扩展点

| 扩展点 | 预留方式 | 实现时机 |
|--------|---------|---------|
| 移动端能力声明 | 新增 `src/platform/tauri/capabilities.mobile.ts` | 移动端开发时 |
| 增量同步 | `hasIncrementalSync` 能力已声明；`sync_log` 表已存在 | 首期可预留接口 |
| 离线写降级 | 事件操作已有在线/离线判断 + sync_log 记录 | 本次设计已实现 |
| 冲突解决 | 基于 `updated_at` 的 LWW 策略 | 首期已实现 |
| OS 杀进程保护 | 数据实时落盘（SQLite 事务），不依赖内存状态 | Tauri 天然保证 |

## 9. 变更范围总结

### 9.1 需要改动的文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/platform/capabilities.ts` | 修改 | 新增 3 个同步策略能力 |
| `src/platform/tauri/capabilities.ts` | 修改 | 填充新能力值 |
| `src/platform/web/capabilities.ts` | 修改 | 填充新能力值 |
| `src/platform/types/sync.repository.ts` | 修改 | 新增 recordPendingChange、pushPendingChanges |
| `src/platform/types/calendar.repository.ts` | 修改 | 新增 updateType 方法 |
| `src/platform/tauri/sync.repo.ts` | 修改 | 实现两个新方法 |
| `src/platform/tauri/calendar.repo.ts` | 修改 | 实现 updateType |
| `src/platform/web/sync.repo.ts` | 修改 | 空实现新方法 |
| `src/platform/web/calendar.repo.ts` | 修改 | 实现 updateType（API 调用） |
| `src/stores/calendar.ts` | 修改 | 新增 loginTransition/logoutTransition，改造事件操作分流 |
| `src/stores/auth.ts` | 修改 | login/logout 中插入日历切换调用 |
| `src/components/settings/CalendarMgmtTab.vue` | 修改 | 日历类型标签改为在线标识 |
| 日历视图组件（侧边栏/头部） | 修改 | 增加同步状态图标 |
| `src-tauri/src/db/repositories/calendar.rs` | 修改 | Rust 端 updateType 命令 |
| `src-tauri/src/commands.rs` | 修改 | 新增 sync_push_pending、update_calendar_type 命令 |

### 9.2 不改动的文件

| 文件/模块 | 原因 |
|-----------|------|
| `src/types/index.ts` | Calendar.type 枚举不变 |
| `src-tauri/src/db/schema.rs` | 表结构不变，type 字段已是 TEXT |
| `src/platform/web/event.repo.ts` | Web 端事件操作不变 |
| `src/platform/web/auth.repo.ts` | Web 端认证不变 |
| Exchange/CalDAV 相关文件 | 外部日历逻辑不受影响 |
| `src/stores/todo.ts` | 待办首期不纳入，可后续按同模式改造 |

### 9.3 后续扩展预留

| 扩展项 | 预留方式 |
|--------|---------|
| 移动端能力声明 | `src/platform/tauri/capabilities.mobile.ts`，复用 Tauri 代码 |
| 待办同步 | 同样使用 loginTransition/logoutTransition 模式 |
| 增量同步 | `hasIncrementalSync` 能力已声明，可按此能力切换全量/增量 |
| 冲突解决 UI | 首期 LWW 自动解决，后续可增加用户选择弹窗 |
