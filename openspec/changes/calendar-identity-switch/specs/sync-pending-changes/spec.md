## ADDED Requirements

### Requirement: 记录待同步的本地变更
系统 SHALL 在日历 `type === 'online'` 但网络不可用时，将事件操作记录到 `sync_log` 表（`synced = 0`），包含 `action`（create/update/delete）、`entityType`（event/todo/calendar）、`entityId`、`payload`（JSON 快照）。

#### Scenario: 离线创建事件记录同步日志
- **WHEN** 用户在离线状态下为在线日历创建事件
- **THEN** 系统将事件写入本地 SQLite，同时调用 `syncRepo.recordPendingChange()` 记录 `{ action: 'create', entityType: 'event', entityId, payload }`

#### Scenario: Web 端不支持离线同步日志
- **WHEN** Web 端调用 `recordPendingChange()`
- **THEN** 系统抛出 `RepositoryError`（`UNSUPPORTED_OPERATION`）

### Requirement: 推送待同步变更到远端
系统 SHALL 在网络恢复时、应用回到前台时、或自动同步定时器触发时，调用 `syncRepo.pushPendingChanges()` 读取 `sync_log` 中 `synced = 0` 的记录，逐条推送到远端 API，推送成功后标记 `synced = 1` 并回填 `externalId`。

#### Scenario: 网络恢复后自动推送
- **WHEN** 网络从离线恢复为在线，且 `sync_log` 中存在 `synced = 0` 的记录
- **THEN** 系统调用 `pushPendingChanges()`，逐条推送，返回 `{ pushed: N, failed: M }`

#### Scenario: 推送成功后回填 externalId
- **WHEN** 待推送事件成功上传到远端
- **THEN** 系统将远端返回的 `externalId` 回填到本地事件记录，并将 sync_log 条目标记为 `synced = 1`

#### Scenario: 推送失败保留待推送状态
- **WHEN** 待推送事件上传失败
- **THEN** 系统保留 `synced = 0` 状态，下次推送时重试

### Requirement: ICalendarRepository.updateType 方法
系统 SHALL 在 `ICalendarRepository` 接口中新增 `updateType()` 方法，用于更新日历的 `type` 和 `syncEnabled` 字段。

#### Scenario: Tauri 端调用 updateType
- **WHEN** Tauri 端调用 `calendarRepo.updateType({ id, type: 'online', syncEnabled: true })`
- **THEN** 系统通过 `invoke('update_calendar_type', ...)` 调用 Rust 后端更新数据库

#### Scenario: Web 端调用 updateType
- **WHEN** Web 端调用 `calendarRepo.updateType({ id, type: 'online', syncEnabled: true })`
- **THEN** 系统通过 `PUT /calendars/:id` 更新远端数据
