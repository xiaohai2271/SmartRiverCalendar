# 任务清单：数据层迁移

> **Issue**: #11 - 检查数据存储，数据和视图进行分离
> **PR**: #14 - refactor: 数据层迁移 - 实现数据和视图分离
> **状态**: 全部完成

---

## 任务概览

| 分组 | 任务数 | 完成数 | 状态 |
|------|--------|--------|------|
| Wave 1: Rust 基础设施 | 4 | 4 | 完成 |
| Wave 2: Repository 实现 | 5 | 5 | 完成 |
| Wave 3: Tauri 命令 | 5 | 5 | 完成 |
| Wave 4: 前端重构 | 4 | 4 | 完成 |
| Wave 5: 验证和文档 | 3 | 3 | 完成 |
| **总计** | **21** | **21** | **完成** |

---

## Wave 1: Rust 基础设施

### 1.1 添加 Rust 依赖

- [x] 添加 rusqlite 依赖
- [x] 添加 thiserror 依赖
- [x] 添加 tempfile 依赖（测试用）
- [x] 更新 Cargo.toml

**提交**: 4d0d4cee - feat(db): add database module with repositories

### 1.2 创建数据库模块结构

- [x] 创建 src-tauri/src/db/mod.rs
- [x] 创建 src-tauri/src/db/errors.rs
- [x] 创建 src-tauri/src/db/connection.rs
- [x] 创建 src-tauri/src/db/schema.rs

**提交**: 4d0d4cee - feat(db): add database module with repositories

---

## Wave 2: Repository 实现 (TDD)

### 2.1 Calendar Repository

- [x] 实现日历仓库 repositories/calendar.rs
- [x] 编写 14 个单元测试
- [x] 实现方法: get_all, get_by_id, create, update, delete

**测试**: 14 通过

### 2.2 Event Repository

- [x] 实现事件仓库 repositories/event.rs
- [x] 编写 12 个单元测试
- [x] 实现方法: get_all, get_by_calendar, get_by_id, create, update, delete

**测试**: 12 通过

### 2.3 Todo Repository

- [x] 实现待办仓库 repositories/todo.rs
- [x] 编写 13 个单元测试
- [x] 实现方法: get_all, get_by_id, create, update, delete

**测试**: 13 通过

### 2.4 Account Repository

- [x] 实现账号仓库 repositories/account.rs
- [x] 编写 15 个单元测试
- [x] 实现方法: get_all, get_by_server_url, get_by_id, create, update, delete, cleanup_duplicates

**测试**: 15 通过

### 2.5 SyncState Repository

- [x] 实现同步状态仓库 repositories/sync_state.rs
- [x] 编写 10 个单元测试
- [x] 实现方法: get, upsert, delete

**测试**: 10 通过

---

## Wave 3: Tauri 命令

### 3.1 日历命令

- [x] get_calendars - 获取所有日历
- [x] create_calendar - 创建日历
- [x] update_calendar - 更新日历
- [x] delete_calendar - 删除日历

**提交**: b3a5bcb4 - feat(commands): add Tauri commands for local data CRUD

### 3.2 事件命令

- [x] get_events - 获取所有事件
- [x] get_events_by_calendar - 按日历获取事件
- [x] create_event - 创建事件
- [x] update_event - 更新事件
- [x] delete_event - 删除事件

**提交**: b3a5bcb4 - feat(commands): add Tauri commands for local data CRUD

### 3.3 待办命令

- [x] get_todos - 获取所有待办
- [x] create_todo - 创建待办
- [x] update_todo - 更新待办
- [x] delete_todo - 删除待办

**提交**: b3a5bcb4 - feat(commands): add Tauri commands for local data CRUD

### 3.4 账号命令

- [x] get_accounts - 获取所有账号
- [x] create_account - 创建账号
- [x] update_account - 更新账号
- [x] delete_account - 删除账号

**提交**: b3a5bcb4 - feat(commands): add Tauri commands for local data CRUD

### 3.5 同步状态命令

- [x] get_sync_state - 获取同步状态
- [x] upsert_sync_state - 创建或更新同步状态
- [x] delete_sync_state - 删除同步状态

**提交**: b3a5bcb4 - feat(commands): add Tauri commands for local data CRUD

---

## Wave 4: 前端重构

### 4.1 重构 Calendar Store

- [x] 修改 src/stores/calendar.ts
- [x] 移除数据库直接调用
- [x] 改用 invoke() 调用 Rust 后端

**提交**: 14f3b622 - refactor(frontend): migrate stores to use Rust backend

### 4.2 重构 Todo Store

- [x] 修改 src/stores/todo.ts
- [x] 移除数据库直接调用
- [x] 改用 invoke() 调用 Rust 后端

**提交**: 14f3b622 - refactor(frontend): migrate stores to use Rust backend

### 4.3 更新 Tauri 工具函数

- [x] 更新 src/utils/tauri.ts
- [x] 实现 safeInvoke() 封装
- [x] 添加 NaN 值处理

**提交**: 14f3b622 - refactor(frontend): migrate stores to use Rust backend

### 4.4 删除前端数据库模块

- [x] 删除 src/utils/database.ts（本地数据操作部分）
- [x] 保留外部账号缓存功能

**提交**: 14f3b622 - refactor(frontend): migrate stores to use Rust backend

---

## Wave 5: 验证和文档

### 5.1 运行测试套件

- [x] Rust 测试: 150 通过
- [x] 前端测试: 171 通过
- [x] TypeScript 编译: 通过

### 5.2 更新业务流程文档

- [x] 更新 calendar-data-management.md
- [x] 更新 todo-management.md
- [x] 新增 data-layer-migration.md

**提交**: b3d0d4b5 - docs: update business flow documentation

### 5.3 修复后续问题

- [x] 修复设置页面路由导航错误
- [x] 修复待办事项创建失败问题（calendarId NaN 处理）
- [x] 清理未使用的导入

---

## 提交记录

| SHA | 描述 | 日期 |
|-----|------|------|
| 4d0d4cee | feat(db): add database module with repositories | 2026-03-31 |
| b3a5bcb4 | feat(commands): add Tauri commands for local data CRUD | 2026-03-31 |
| 14f3b622 | refactor(frontend): migrate stores to use Rust backend | 2026-03-31 |
| b3d0d4b5 | docs: update business flow documentation | 2026-03-31 |
| d76ea419 | fix: 修复设置页面路由导航错误 | 2026-04-10 |
| 40c54f33 | fix: 修复待办事项创建失败的问题 | 2026-04-10 |
| 4384ca88 | chore: 清理未使用的 import | 2026-04-10 |

---

## 验证检查清单

- [x] Issue #11 所有检查项通过
  - [x] 前端是否直接操作数据库 - 已移除
  - [x] 是否做到了视图和数据进行分离 - 已完成
  - [x] 后端的数据操作是否已实现了自动化测试 - 150 个测试通过

- [x] 所有测试通过
  - [x] Rust 单元测试: 150 通过
  - [x] 前端单元测试: 171 通过
  - [x] TypeScript 编译: 通过

- [x] 文档已更新
  - [x] 业务流程文档
  - [x] 数据层迁移专题文档

- [x] PR 已合并
  - [x] PR #14 状态: MERGED
  - [x] 合并时间: 2026-04-10

---

## 结论

所有 21 个任务已完成，Issue #11 的三个检查项全部通过验证。数据层迁移成功实现了数据和视图分离的核心原则。
