## Context

小河日历桌面端（Tauri）接入在线账户后，SQLite 中存在 `type: 'local'` 和 `type: 'online'` 两条日历记录，用户需要在两者间手动切换，事件归属混乱。项目采用 Repository + PlatformCapabilities 架构，Store 不感知平台，数据操作通过 Repository 接口抽象。Android/iOS 复用同一套 Tauri 平台代码，Web 端为 remote-first 无本地数据库。

现有基础设施：
- `calendars` 表 `type` 字段为 TEXT，可直接 `UPDATE` 切换
- `events` 表 `external_id` 字段已存在，用于去重
- `sync_log` 表已存在（`synced` 字段标记待推送变更）
- `syncRepo.triggerCloudSync()` 已实现双向同步
- `calendarStore.reloadFromDatabase()` 已实现数据刷新

## Goals / Non-Goals

**Goals:**
- 实现单账户身份切换：登录时 local→online，退出时 online→local
- 登录时双向同步（上传本地 + 下拉远端），通过 externalId 去重
- 退出前最终同步，确保本地数据完整
- 事件操作按日历类型 + 网络状态 + 平台能力三级分流
- 离线写降级：在线日历 + 离线时写本地 + 记录 sync_log
- 架构通用于 Windows / Android / iOS / Web

**Non-Goals:**
- 待办（Todo）同步（首期不纳入，后续按同模式改造）
- 增量同步优化（首期全量同步，`hasIncrementalSync` 能力已预留）
- 用户选择的冲突解决 UI（首期采用 LWW 自动解决）
- 服务端 API 改动（假定服务端已支持必要接口）

## Decisions

### D1: 同一条日历记录切换 type（而非两条记录）

**选择**：SQLite 中始终只有一条主日历记录，`type` 字段随登录态变化。

**理由**：事件的 `calendarId` 不需要迁移，降低复杂度。去重逻辑简单——不存在两条记录的合并问题。

**替代方案**：两条记录 + 按登录态切换显示——事件需要迁移 calendarId，合并逻辑复杂，频繁登录/退出开销大。

### D2: 先写本地，再同步推送（local-first 写入策略）

**选择**：所有事件操作先写入本地 SQLite，然后记录到 sync_log 并触发推送。

**理由**：
1. 保持 local-first 原则——本地 SQLite 始终是权威数据源
2. 统一写入路径——在线/离线只在推送环节有差异
3. Rust 后端处理推送细节，前端不关心远端 API

**替代方案**：在线时直接调远端 API，离线时才写本地——两条写入路径增加复杂度，且 API 失败时需要回退逻辑。

### D3: 冲突解决采用 Last Write Wins（基于 updated_at）

**选择**：比较 `updated_at` 时间戳，保留较新的版本。

**理由**：首期简洁可靠，覆盖大多数场景。后续可扩展为用户选择。

**替代方案**：内容哈希比较——计算复杂，且日历事件内容可能合法变化。

### D4: 前端 Store 编排，Repository 执行

**选择**：同步流程由 Calendar Store 的 `loginTransition()`/`logoutTransition()` 编排，数据操作通过 Repository 接口执行。

**理由**：改动最小，复用现有 `triggerCloudSync()` + `reloadFromDatabase()` 流程，前端逻辑透明便于调试。

**替代方案**：Rust 后端全权负责（一次 invoke 完成同步+切换）——需新增多个 Rust 命令，调试困难，且 Web 端无法复用。

### D5: 通过 PlatformCapabilities 区分多端行为

**选择**：新增 `hasBackgroundSync`、`hasIncrementalSync`、`hasClientConflictResolution` 能力字段。

**理由**：遵循现有能力驱动架构，Store 通过 `useCapabilities()` 判断行为，不使用 `isTauri()` 分支。

### D6: Exchange/CalDAV 外部日历保持独立

**选择**：外部日历有独立账号体系，不受 local/online 切换影响。

**理由**：外部日历同步走 `syncRepo`，有独立的 credentials 和 calendarUrl，与主日历的身份切换无关。

## Risks / Trade-offs

- **[Risk] 同步期间应用关闭导致 type 未切换** → 缓解：Rust 后端同步是原子的，前端切换失败时下次启动仍能通过 auth 状态恢复正确 type
- **[Risk] 多设备频繁修改同一事件导致 LWW 丢失数据** → 缓解：首期可接受，后续增加冲突解决 UI 让用户选择
- **[Risk] 退出前同步失败导致本地数据不完整** → 缓解：同步失败不阻塞退出，但弹窗提示用户；本地 SQLite 始终保有上次同步以来的数据
- **[Trade-off] 先写本地再推送增加一次 sync_log 写入** → 可接受：额外写入开销极小，换取了统一的写入路径和离线降级能力
