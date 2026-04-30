---
name: calendar-business-flows
description: SmartRiverCalendar项目核心业务流程文档。当需要了解小河日历的业务逻辑、工作流程、系统架构或需要修改/扩展核心功能时使用。包含软件更新流程、日历管理、事件处理、系统托盘集成等关键业务流程。
---

# SmartRiverCalendar 核心业务流程

## 概述

本skill记录小河日历（SmartRiverCalendar）项目的核心业务流程，帮助开发者快速理解系统架构和关键业务逻辑。

## 业务流程列表

### 1. 软件更新流程
- **触发条件**: 应用启动自动检查或用户通过系统托盘"检查更新"触发
- **涉及组件**: Tauri updater插件、Rust更新模块、前端更新服务、UpdateDialog组件
- **详细文档**: 参考 [references/software-update-flow.md](references/software-update-flow.md)
- **新特性**: 前端驱动更新弹窗，支持跳过版本管理、三种用户交互选项（现在升级/稍后/不再提示）

### 2. 系统托盘集成
- **功能**: 托盘图标、右键菜单、窗口显示/隐藏、**精简日历弹出窗口**
- **涉及组件**: Tauri tray模块、系统事件处理、弹出窗口组件
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

### 8. 首页时间显示
- **功能**: 实时时间显示、农历日期、节气、节假日标签，补休班提醒
- **涉及组件**: TimeDisplay 组件、lunar 工具函数、tyme4ts 库
- **详细文档**: 参考 [references/home-time-display.md](references/home-time-display.md)

### 9. 数据层迁移（专题）
- **功能**: 前端数据存储迁移到 Rust 后端 SQLite，统一数据操作接口
- **迁移范围**: 日历、事件、待办、账号、同步状态
- **详细文档**: 参考 [references/data-layer-migration.md](references/data-layer-migration.md)

### 10. 系统时钟点击唤醒
- **功能**: 点击 Windows 系统时钟区域唤出/隐藏主窗口，支持多屏、阻止系统弹窗
- **涉及组件**: WH_MOUSE_LL 钩子、UI Automation、时钟区域缓存更新器
- **详细文档**: 参考 [references/clock-hook-integration.md](references/clock-hook-integration.md)

### 11. 月视图事件显示模式
- **功能**: 月视图事件横条/圆点显示模式切换、跨天事件渲染、事件颜色选择
- **涉及组件**: MonthView组件、EventBar组件、EventTooltip组件、ColorPicker组件、设置存储
- **详细文档**: 参考 [references/month-view-event-display.md](references/month-view-event-display.md)

### 12. 日历界面优化
- **功能**: 日期单元格右键菜单、事件块右键菜单、休/补徽标、全天事件内联显示、事件颜色优先级修复
- **涉及组件**: DateCellContextMenu组件、EventBlockContextMenu组件、MonthView/DayView/WeekView组件、ContextMenu基础组件
- **详细文档**: 参考 [references/calendar-ui-optimization.md](references/calendar-ui-optimization.md)

## 快速参考

### 关键文件路径
- 更新配置: `src-tauri/tauri.conf.json` (plugins.updater)
- 更新逻辑: `src-tauri/src/updater.rs`
- 托盘逻辑: `src-tauri/src/lib.rs`
- **前端更新服务**: `src/services/updater.ts`
- **前端更新弹窗**: `src/components/update/UpdateDialog.vue`
- **前端更新测试**: `src/__tests__/updater.test.ts`
- **前端组件测试**: `src/__tests__/UpdateDialog.test.ts`
- 时钟点击模块: `src-tauri/src/clock_hook/`
- 前端状态: `src/stores/`
- 前端事件监听: `src/composables/useWindowToggle.ts`
- **弹出窗口控制**: `src/composables/useCalendarPopup.ts`
- **弹出窗口视图**: `src/views/CalendarPopupView.vue`
- **弹出窗口组件**: `src/components/popup/`
- **弹出窗口设置**: `src/stores/popupSettings.ts`
- **权限配置**: `src-tauri/capabilities/default.json`
- 月视图组件: `src/components/calendar/MonthView.vue`
- 事件横条: `src/components/calendar/EventBar.vue`
- 右键菜单组件: `src/components/calendar/DateCellContextMenu.vue`
- 事件块右键菜单: `src/components/calendar/EventBlockContextMenu.vue`
- 基础菜单组件: `src/components/common/ContextMenu.vue`
- 事件颜色工具: `src/types/index.ts` (REST_BADGE_CONFIG)
- 悬浮提示: `src/components/calendar/EventTooltip.vue`
- 颜色选择器: `src/components/calendar/ColorPicker.vue`
- 跨天工具函数: `src/utils/date.ts`
- 跨天测试: `src/__tests__/cross-day-event.test.ts`
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