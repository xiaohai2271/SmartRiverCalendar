## ADDED Requirements

### Requirement: 日历身份随登录态切换
系统 SHALL 在用户登录成功后，将主日历的 `type` 从 `'local'` 切换为 `'online'`，`syncEnabled` 设为 `true`。在用户退出登录前，系统 SHALL 将 `type` 切回 `'local'`，`syncEnabled` 设为 `false'`。SQLite 中始终只有一条主日历记录。

#### Scenario: 登录后日历切换为在线模式
- **WHEN** 用户登录成功且 `dataPriority === 'local-first'`
- **THEN** 系统触发双向同步，完成后将主日历 `type` 更新为 `'online'`，`syncEnabled` 更新为 `true`，并刷新前端 Store

#### Scenario: 退出登录前日历切换回本地模式
- **WHEN** 用户点击退出且 `dataPriority === 'local-first'`
- **THEN** 系统先触发最终同步（失败不阻塞），完成后将主日历 `type` 更新为 `'local'`，`syncEnabled` 更新为 `false`，再清除认证状态

#### Scenario: Web 端不执行身份切换
- **WHEN** `dataPriority === 'remote-first'`（Web 端）
- **THEN** `loginTransition()` 和 `logoutTransition()` 直接返回，不执行任何切换操作

### Requirement: 登录时双向同步与去重
系统 SHALL 在登录后触发双向同步：上传本地独有事件到远端、下拉远端独有事件到本地，并通过 `externalId` 匹配去重，确保多次登录/退出不产生重复数据。

#### Scenario: 本地事件首次上传
- **WHEN** 本地事件无 `externalId` 且远端无匹配事件
- **THEN** 系统将事件上传到远端，远端返回 `externalId`，系统回填到本地 SQLite

#### Scenario: 远端事件本地已存在
- **WHEN** 远端事件的 `externalId` 与本地事件匹配
- **THEN** 系统跳过创建，比较 `updated_at` 决定是否更新本地记录

#### Scenario: 多设备登录同一账号
- **WHEN** 设备 A 和设备 B 同时登录同一账号
- **THEN** 每个事件在远端有唯一 `externalId`，通过 `externalId` 匹配去重，不会创建重复事件

### Requirement: 冲突解决采用 Last Write Wins
系统 SHALL 基于 `updated_at` 时间戳解决同步冲突：本地较新则保留本地版本，远端较新则采用远端版本，时间戳相同时采用远端版本。

#### Scenario: 本地修改晚于远端
- **WHEN** 本地事件 `updated_at` > 远端事件 `updated_at`
- **THEN** 系统保留本地版本，推送到远端覆盖

#### Scenario: 远端修改晚于本地
- **WHEN** 远端事件 `updated_at` > 本地事件 `updated_at`
- **THEN** 系统采用远端版本，更新本地记录

### Requirement: 事件操作三级分流
系统 SHALL 根据日历类型、网络状态、平台能力三级判断事件写入路径。

#### Scenario: 本地日历写入
- **WHEN** 日历 `type === 'local'`
- **THEN** 事件写入本地 SQLite（所有端一致）

#### Scenario: 在线日历 + 在线写入
- **WHEN** 日历 `type === 'online'` 且 `navigator.onLine === true`
- **THEN** 事件写入本地 SQLite + 记录 sync_log + 触发即时推送

#### Scenario: 在线日历 + 离线 + 支持离线模式
- **WHEN** 日历 `type === 'online'` 且 `navigator.onLine === false` 且 `hasOfflineMode === true`
- **THEN** 事件写入本地 SQLite + 记录 sync_log（不触发推送），待网络恢复后自动推送

#### Scenario: 在线日历 + 离线 + 不支持离线模式
- **WHEN** 日历 `type === 'online'` 且 `navigator.onLine === false` 且 `hasOfflineMode === false`
- **THEN** 系统抛出 `RepositoryError`（`NETWORK_ERROR`），提示用户网络不可用

#### Scenario: 外部日历写入
- **WHEN** 日历 `type === 'exchange'` 或 `type === 'caldav'`
- **THEN** 保持现有 syncRepo 外部 API 逻辑不变

### Requirement: 界面展示在线状态标识
系统 SHALL 在日历列表中将主日历的类型标签（"本地"/"在线"）替换为：日历名称 + 在线状态图标（仅 `type === 'online'` 时显示）。

#### Scenario: 未登录时日历展示
- **WHEN** 主日历 `type === 'local'`
- **THEN** 日历列表仅显示日历名称，无在线标识

#### Scenario: 已登录时日历展示
- **WHEN** 主日历 `type === 'online'`
- **THEN** 日历列表显示日历名称 + 云同步图标，tooltip 显示"已同步 · {用户名}"

### Requirement: 同步状态图标
系统 SHALL 在日历视图中根据同步状态显示对应图标。

#### Scenario: 同步空闲
- **WHEN** `syncStatus === 'idle'` 且 `type === 'online'`
- **THEN** 显示云图标，表示已同步

#### Scenario: 同步中
- **WHEN** `syncStatus === 'syncing'`
- **THEN** 显示旋转图标，表示同步进行中

#### Scenario: 同步失败
- **WHEN** `syncStatus === 'error'`
- **THEN** 显示警告图标，表示同步失败

### Requirement: 新增同步策略平台能力
系统 SHALL 在 `PlatformCapabilities` 中新增 `hasBackgroundSync`、`hasIncrementalSync`、`hasClientConflictResolution` 三个能力字段。

#### Scenario: 桌面端能力声明
- **WHEN** 运行在 Tauri 桌面端
- **THEN** `hasBackgroundSync === true`、`hasIncrementalSync === false`（首期）、`hasClientConflictResolution === true`

#### Scenario: Web 端能力声明
- **WHEN** 运行在 Web 端
- **THEN** `hasBackgroundSync === false`、`hasIncrementalSync === false`、`hasClientConflictResolution === false`
