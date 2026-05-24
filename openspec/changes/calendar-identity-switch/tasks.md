## 1. 基础设施 — 接口与能力声明

- [ ] 1.1 `src/platform/capabilities.ts` 新增 `hasBackgroundSync`、`hasIncrementalSync`、`hasClientConflictResolution` 三个字段及 JSDoc 注释
- [ ] 1.2 `src/platform/tauri/capabilities.ts` 填充桌面端能力值（true/false/true）
- [ ] 1.3 `src/platform/web/capabilities.ts` 填充 Web 端能力值（false/false/false）
- [ ] 1.4 `src/platform/types/calendar.repository.ts` 新增 `updateType()` 方法签名及 JSDoc 注释
- [ ] 1.5 `src/platform/types/sync.repository.ts` 新增 `recordPendingChange()` 和 `pushPendingChanges()` 方法签名及 JSDoc 注释
- [ ] 1.6 `src/platform/tauri/calendar.repo.ts` 实现 `updateType()`，调用 `invoke('update_calendar_type')`
- [ ] 1.7 `src/platform/web/calendar.repo.ts` 实现 `updateType()`，调用 `PUT /calendars/:id`
- [ ] 1.8 `src/platform/tauri/sync.repo.ts` 实现 `recordPendingChange()` 和 `pushPendingChanges()`，分别调用 `invoke('sync_record_pending')` 和 `invoke('sync_push_pending')`
- [ ] 1.9 `src/platform/web/sync.repo.ts` 空实现 `recordPendingChange()`（抛出 UNSUPPORTED_OPERATION）和 `pushPendingChanges()`（返回 { pushed: 0, failed: 0 }）
- [ ] 1.10 验证：`pnpm build` 编译通过，无类型错误

## 2. Rust 后端命令

- [ ] 2.1 `src-tauri/src/db/repositories/calendar.rs` 新增 `update_calendar_type()` 函数，执行 `UPDATE calendars SET type = ?, sync_enabled = ?, updated_at = ? WHERE id = ?`
- [ ] 2.2 `src-tauri/src/db/` 新增 sync_log 读写函数：`get_pending_sync_logs()`、`mark_sync_log_synced()`、`record_pending_change()`
- [ ] 2.3 `src-tauri/src/commands.rs` 注册 `update_calendar_type` 命令，调用 calendar.rs 中的函数
- [ ] 2.4 `src-tauri/src/commands.rs` 注册 `sync_record_pending` 命令，调用 sync_log 写入函数
- [ ] 2.5 `src-tauri/src/commands.rs` 注册 `sync_push_pending` 命令，读取 pending 记录 → 推送远端 → 标记 synced → 返回统计
- [ ] 2.6 验证：`cargo test --lib` 通过

## 3. Store 层核心逻辑

- [ ] 3.1 `src/stores/calendar.ts` 新增 `loginTransition()` 方法，包含完整 JSDoc（流程、多端通用性、抛出错误），实现：triggerCloudSync → updateType → reloadFromDatabase
- [ ] 3.2 `src/stores/calendar.ts` 新增 `logoutTransition()` 方法，包含完整 JSDoc，实现：triggerCloudSync（失败不阻塞）→ updateType → reloadFromDatabase
- [ ] 3.3 `src/stores/calendar.ts` 改造 `addEvent()` — 按三级分流（local/online+在线/online+离线/exchange-caldav），每个分支加中文注释说明适用场景和多端差异
- [ ] 3.4 `src/stores/calendar.ts` 改造 `updateEvent()` — 同上三级分流模式
- [ ] 3.5 `src/stores/calendar.ts` 改造 `deleteEvent()` — 同上三级分流模式
- [ ] 3.6 `src/stores/calendar.ts` 导出 `loginTransition` 和 `logoutTransition`
- [ ] 3.7 验证：`pnpm test:run` 通过（现有测试不受影响）

## 4. 认证流程集成

- [ ] 4.1 `src/stores/auth.ts` `login()` 中将 `syncCalendarsFromServer()` 替换为 `calendarStore.loginTransition()`，加【变更】注释
- [ ] 4.2 `src/stores/auth.ts` `register()` 中将 `syncCalendarsFromServer()` 替换为 `calendarStore.loginTransition()`，加【变更】注释
- [ ] 4.3 `src/stores/auth.ts` `logout()` 中在 `authRepo.logout()` 之前插入 `calendarStore.logoutTransition()`，加【新增】注释，同步失败不阻塞退出
- [ ] 4.4 验证：`pnpm test:run` 通过

## 5. 界面改动

- [ ] 5.1 `src/components/settings/CalendarMgmtTab.vue` 将 `type === 'local'` 的"本地"标签替换为日历名称，将 `type === 'online'` 的"在线"标签替换为日历名称 + 云同步图标，外部日历保持不变
- [ ] 5.2 日历视图组件中增加同步状态图标：idle→云图标、syncing→旋转图标、error→警告图标、离线→离线云图标
- [ ] 5.3 登录/退出 UX：登录中显示"正在同步数据..."，退出中显示"正在保存数据..."，同步失败弹窗确认
- [ ] 5.4 验证：`pnpm tauri:dev` 启动，检查日历管理页面和日历视图显示

## 6. 测试

- [ ] 6.1 `src/__tests__/` 新增 `calendar-identity-switch.test.ts`，测试 loginTransition/logoutTransition 流程（mock syncRepo 和 calendarRepo）
- [ ] 6.2 `src/__tests__/` 新增事件操作分流测试，覆盖 local/online+在线/online+离线+hasOfflineMode/online+离线+!hasOfflineMode/exchange 五种路径
- [ ] 6.3 `src/__tests__/` 新增 PlatformCapabilities 能力值测试，验证 Tauri/Web 端能力声明正确
- [ ] 6.4 验证：`pnpm test:run` 全部通过，覆盖率 > 50%
