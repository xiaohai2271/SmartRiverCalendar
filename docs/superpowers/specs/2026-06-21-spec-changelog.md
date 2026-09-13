# Spec 变更日志

> 记录设计文档在评审过程中的关键变更，便于追溯决策背景。

## 2026-06-21 安全加固设计 (`2026-06-21-security-hardening-design.md`)

### 一评修正

| # | 级别 | 变更 |
|---|------|------|
| 1 | Critical | `connect-src` 添加 `https://tauri.localhost`（后证明无效，二评移除） |
| 2 | Critical | `$HOME/Desktop/**` 改为 `$DESKTOP`/`$DOCUMENT`/`$DOWNLOAD` + 中文目录双写（后证明多余，二评移除双写） |
| 3 | Important | 新增 `shell:default` → `shell:allow-open` 替换方案 |
| 4 | Important | 新增 `mcp-bridge:default` 移至 debug-only capability 方案 |
| 5 | Important | 新增 `style-src unsafe-inline` CSS 数据外泄风险说明 |
| 6 | Important | 新增 `VITE_API_BASE_URL` 与 CSP 一致性说明 |

### 二评修正

| # | 级别 | 变更 |
|---|------|------|
| 7 | Critical | 移除 `connect-src` 中的 `https://tauri.localhost`——Tauri IPC 走自定义协议，不受 CSP `connect-src` 管控；且 `useHttpsScheme` 默认 false |
| 8 | Important | 移除 `$HOME/桌面/**` 等 Chinese fallback——`$DESKTOP` 已自动解析本地化路径 |
| 9 | Important | 修正 `shell:default` 描述：仅含 `allow-open`，不含 `allow-spawn` |
| 10 | Important | `writeTextFile` scope 外失败从"静默"改为 `toast.error()` 用户提示 |

### 三评

无 Critical/Important 新问题，**通过**。

---

## 2026-06-21 架构重构设计 (`2026-06-21-architecture-refactoring-design.md`)

### 一评修正

| # | 级别 | 变更 |
|---|------|------|
| 1 | Critical | `createWithSync` 改为 Rust 统一命令（`create_event_with_sync` 等），前端只做参数转换 |
| 2 | Critical | `externalCalendarSyncService` 改为返回 `ExternalSyncResult` 纯数据，Store 通过 `applySyncResult` 更新状态 |
| 3 | Critical | `listen('external-sync-complete')` 封装到 `ISyncRepository.onExternalSyncComplete()` |
| 4 | Important | Web 端 `createWithSync` 添加 `navigator.onLine` 预检 |
| 5 | Important | Reminder localStorage → SQLite 一次性迁移方案 |
| 6 | Important | `IReminderRepository.cleanupExpiredRecords(now)` 替代 `shouldCleanup/recordCleanupTime/cleanupOldViewedRecords` |
| 7 | Important | 阶段1与阶段4解耦文档化：阶段1用 Rust 命令不依赖 syncRepo |
| 8 | Important | Service 返回 `calendarsToCreate`，Store 调 `calendarRepo` |
| 9 | Important | 阶段4拆分为 4a（基础同步 2-3 周）+ 4b（增量同步 1 周） |

### 二评修正

| # | 级别 | 变更 |
|---|------|------|
| 10 | Critical | `applySyncResult` 添加事件 DB 持久化（`deleteByCalendarAndTimeRange` + `eventRepo.create`），防止重启后外部事件丢失 |
| 11 | Critical | 阶段1前置条件：`calendars` 表新增 `read_only` 列（`ALTER TABLE ... DEFAULT 0`） |
| 12 | Critical | 所有 `applySyncResult` 调用改为 `await`，避免并发状态突变 |
| 13 | Important | `updateWithSync`/`deleteWithSync` 文档化 `external_id` 解析步骤 |
| 14 | Important | `cloudSync.ts` 的 3 个事件（`sync-complete`/`sync-error`/`auth-token-expired`）封装到 `ISyncRepository` |
| 15 | Important | `create_event_with_sync` 分步获取 DB 锁，不在持有 Mutex 期间调外部 API |
| 16 | Important | `loadQueue`/`saveQueue` 简化为 `ReminderQueueItem[]`，不再暴露队列内部结构 |

### 三评修正

| # | 级别 | 变更 |
|---|------|------|
| 17 | Important | 阶段1文件清单补充 `calendar.rs`（`DbCalendar` + `CreateCalendarRequest` + `from_row()` + SQL） |
| 18 | Important | 阶段2文件清单补充 `deleteByCalendarAndTimeRange` 相关文件（接口 + Tauri + Web + Rust + SQL） |
| 19 | Important | 阶段4 `ISyncRepository` 补充全部 4 个事件监听方法定义 |
| 20 | Important | `applySyncResult` 补充 `CalendarEvent → EventCreateParams` 转换逻辑（剔除 id/createdAt/updatedAt） |
| 21 | Minor | 新增本次重构范围声明：仅覆盖 calendar.ts + reminder.ts + cloudSync.ts 的 `@tauri-apps/*` 违规 |

### 四评修正

| # | 级别 | 变更 |
|---|------|------|
| 22 | Critical | `useDebounceFn`（`@vueuse/core` 依赖）替换为手动 `debounce` 工具函数 |

---

## 2026-06-21 性能优化设计 (`2026-06-21-performance-optimization-design.md`)

### 一评修正

| # | 级别 | 变更 |
|---|------|------|
| 1 | Critical | 补齐组件迁移方案：6 个组件从 `events.filter` 迁移到 `eventsForCurrentView` |
| 2 | Critical | 新增 `getUpcoming(limit)` Repository 方法 |
| 3 | Critical | 新增 CRUD loadedRange 守卫（addEvent 范围外不 push、updateEvent 移出则移除） |
| 4 | Critical | `loadExternalEvents` 改为同步后调 `reloadFromDatabase()` |
| 5 | Critical | 新增 `(calendar_id, start_time)` 复合索引 `idx_events_cal_start` |
| 6 | Important | watch `visibleCalendars` 触发重新加载 |
| 7 | Important | ScheduleView 搜索改为 `eventRepo.search()` SQL 层 LIKE |
| 8 | Important | `reloadFromDatabase` 添加 loadedRange=null fallback |
| 9 | Important | 年视图加载策略修正（12 个月逐月加载） |
| 10 | Important | `getCount` 添加 `user_id` 过滤 |

### 二评修正

| # | 级别 | 变更 |
|---|------|------|
| 11 | Critical | 所有 SQL 查询添加 `user_id` 过滤；`get_event_count` 参数类型改为 `i64`；`getUpcoming`/`search` 添加 `calendarIds` 参数 |
| 12 | Critical | HomeView 改为全部走独立 Repository 查询，不依赖 `eventsForCurrentView` |
| 13 | Critical | `eventsForCurrentView` 重叠检查修正为 `startTime < end && endTime > start` |
| 14 | Critical | 新增 `watch([currentView, currentDate])` 触发范围重新加载 |
| 15 | Important | CalendarPopupView 改为独立 `eventRepo.getByTimeRange`（独立窗口） |
| 16 | Important | ScheduleView 日期范围也走独立查询 |
| 17 | Important | `addEvent`/`updateEvent` 添加 visible-calendar 守卫（`isVisible` 检查） |
| 18 | Important | `watch(visibleCalendars)` 添加 300ms debounce |
| 19 | Important | `getUpcoming`/`search` 接受 `calendarIds` 参数 |
| 20 | Important | LIKE 通配符 `%/` 需在 Rust 端转义 |

### 三评修正

| # | 级别 | 变更 |
|---|------|------|
| 21 | Critical | `useDebounceFn` 替换为手动 `debounce` 工具函数（不引入 `@vueuse/core`） |
| 22 | Critical | `computeLoadRange` 补充完整实现 + `src/utils/date.ts` import 声明 |
| 23 | Critical | `userId` 由 Repository 实现层自动注入（Tauri 从 authStore 获取，Web 从 token 关联） |
| 24 | Important | Reminder 服务必须与性能优化同步改造（否则 `events.value` 只含窗口数据，漏掉提醒） |
| 25 | Important | `loadExternalEvents` 也改为 `reloadFromDatabase()` |
| 26 | Important | `calendarIds` 空数组时短路返回空结果，不发起 IPC |
| 27 | Important | 年视图专用 `loadYearView`：`Promise.all` 并行 12 个月 + 去重合并 |

### 四评修正

| # | 级别 | 变更 |
|---|------|------|
| 28 | Critical | 跨文档一致性：性能文档风险表"已双写中文目录名"改为"使用 `$DESKTOP`/`$DOCUMENT`/`$DOWNLOAD` 语义化变量" |
