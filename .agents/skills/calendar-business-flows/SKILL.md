---
name: calendar-business-flows
description: SmartRiverCalendar项目核心业务流程文档。当需要了解小河日历的业务逻辑、工作流程、系统架构或需要修改/扩展核心功能时使用。包含软件更新流程、日历管理、事件处理、系统托盘集成等关键业务流程。
---

# SmartRiverCalendar 核心业务流程

## 概述

本skill记录小河日历（SmartRiverCalendar）项目的核心业务流程，帮助开发者快速理解系统架构和关键业务逻辑。

## 业务流程列表

### 1. 软件更新流程
- **触发条件**: 用户点击"检查更新"或应用启动时自动检查
- **涉及组件**: Tauri updater插件、Rust更新模块、前端UI
- **详细文档**: 参考 [references/software-update-flow.md](references/software-update-flow.md)

### 2. 系统托盘集成
- **功能**: 托盘图标、右键菜单、窗口显示/隐藏
- **涉及组件**: Tauri tray模块、系统事件处理
- **详细文档**: 参考 [references/system-tray-integration.md](references/system-tray-integration.md)

### 3. 日历数据管理
- **功能**: 多日历支持、事件存储、数据同步
- **涉及组件**: SQLite数据库、Pinia状态管理
- **详细文档**: 参考 [references/calendar-data-management.md](references/calendar-data-management.md)

### 4. 视图切换与渲染
- **功能**: 日/周/月/年视图切换、视图状态管理
- **涉及组件**: Vue组件、路由管理
- **详细文档**: 参考 [references/view-rendering.md](references/view-rendering.md)

### 5. 设置管理
- **功能**: 应用配置、主题切换、用户偏好
- **涉及组件**: Pinia store、localStorage
- **详细文档**: 参考 [references/settings-management.md](references/settings-management.md)

### 6. 待办事项管理
- **功能**: 任务创建、编辑、完成、删除
- **涉及组件**: Pinia store、SQLite数据库
- **详细文档**: 参考 [references/todo-management.md](references/todo-management.md)

### 7. 外部日历集成
- **功能**: Exchange EWS + CalDAV 日历接入、双向同步、凭证加密
- **涉及组件**: EWS/CalDAV 客户端、同步引擎、加密模块、Tauri 命令、前端同步服务
- **详细文档**: 
  - 设计文档: [references/external-calendar-design.md](references/external-calendar-design.md)
  - 业务流程: [references/external-calendar-integration.md](references/external-calendar-integration.md)

## 快速参考

### 关键文件路径
- 更新配置: `src-tauri/tauri.conf.json` (plugins.updater)
- 更新逻辑: `src-tauri/src/updater.rs`
- 托盘逻辑: `src-tauri/src/lib.rs`
- 前端状态: `src/stores/`
- EWS 客户端: `src-tauri/src/ews.rs`
- CalDAV 客户端: `src-tauri/src/caldav.rs`
- 同步引擎: `src-tauri/src/sync.rs`
- 凭证加密: `src-tauri/src/crypto.rs`
- 前端同步服务: `src/services/sync.ts`

### 开发流程
1. 修改业务逻辑前，先阅读相关业务流程文档
2. 遵循现有代码模式和约定
3. 测试相关功能是否正常工作

## 资源说明

### references/
详细的业务流程文档，包含：
- 流程图和数据流说明
- 关键代码片段和解释
- 配置参数说明
- 常见问题和解决方案

### scripts/
辅助脚本（暂未包含，根据需要添加）

### assets/
业务流程相关的资源文件（暂未包含，根据需要添加）