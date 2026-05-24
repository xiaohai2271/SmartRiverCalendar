## Why

桌面端接入在线日历账户后，界面展示两个日历账户（`type: 'local'` + `type: 'online'`），用户需要在两者间手动切换，事件归属不直观，体验割裂。应改为单账户身份切换模式：未登录展示本地日历，登录后切换为在线模式，核心原则"本地数据优先"不变。

## What Changes

- 新增日历身份切换机制：登录时 `calendar.type` 从 `local` 切换为 `online`，退出时反向切换，SQLite 中始终只有一条主日历记录
- 新增登录时双向同步流程：上传本地新事件到远端 + 下拉远端新事件到本地，通过 `externalId` 去重防止重复
- 新增退出前最终同步流程：确保远端最新数据保存到本地后切换回 `local`
- 新增事件操作三级分流：根据日历类型 + 网络状态 + 平台能力决定写入路径
- 新增离线写降级机制：`type='online'` 但离线时，事件仍写本地 SQLite + 记录 sync_log，联网后自动推送
- 新增 `PlatformCapabilities` 同步策略能力：`hasBackgroundSync`、`hasIncrementalSync`、`hasClientConflictResolution`
- 新增 `ICalendarRepository.updateType()` 方法：更新日历类型和同步状态
- 新增 `ISyncRepository.recordPendingChange()` 和 `pushPendingChanges()` 方法：离线变更记录与推送
- 新增 Rust 后端命令：`update_calendar_type`、`sync_record_pending`、`sync_push_pending`
- 修改界面：日历列表用在线标识替代类型标签，日历视图增加同步状态图标
- 修改 Auth Store：login/logout 流程中集成日历身份切换调用
- 采用 Last Write Wins（基于 `updated_at`）冲突解决策略

## Capabilities

### New Capabilities

- `calendar-identity-switch`: 日历账户身份切换——登录时 local→online 切换 + 双向同步，退出时 online→local 切换 + 最终同步，事件操作三级分流，离线写降级
- `sync-pending-changes`: 离线变更记录与推送——sync_log 写入、网络恢复后自动推送、externalId 回填

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **前端 Store 层**：`src/stores/calendar.ts`（新增 loginTransition/logoutTransition，改造事件操作分流）、`src/stores/auth.ts`（login/logout 集成日历切换）
- **Repository 接口层**：`src/platform/types/calendar.repository.ts`（新增 updateType）、`src/platform/types/sync.repository.ts`（新增 recordPendingChange/pushPendingChanges）
- **Tauri 平台实现**：`src/platform/tauri/calendar.repo.ts`、`src/platform/tauri/sync.repo.ts`（实现新接口）
- **Web 平台实现**：`src/platform/web/calendar.repo.ts`（实现 updateType）、`src/platform/web/sync.repo.ts`（空实现新方法）
- **Rust 后端**：`src-tauri/src/commands.rs`（新增 3 个命令）、`src-tauri/src/db/repositories/calendar.rs`（新增 update_type）
- **平台能力**：`src/platform/capabilities.ts`（新增 3 个同步策略能力）、Tauri/Web capabilities 填充值
- **界面组件**：`src/components/settings/CalendarMgmtTab.vue`（在线标识替代类型标签）、日历视图组件（同步状态图标）
- **数据库**：无结构性变更（type 字段已是 TEXT，sync_log 表已存在）
- **Web 端影响**：几乎零改动——无本地数据库，数据天然在线，日历类型由服务端决定
- **移动端扩展**：架构通用，Android/iOS 复用 Tauri 平台代码，通过能力声明区分行为差异
