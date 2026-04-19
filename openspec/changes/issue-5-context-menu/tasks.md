# 右键菜单功能任务清单

## 任务概览

```
Wave 1: 基础组件开发 (5个任务)
Wave 2: 视图集成 (4个任务)
Wave 3: 问题修复 (4个任务)
Wave 4: 测试验证 (4个任务)
Wave 5: 文档更新 (2个任务)
```

---

## Wave 1: 基础组件开发

### 1.1 ContextMenu.vue - 右键菜单组件
- 状态: ✅ 已完成
- 文件: src/components/common/ContextMenu.vue
- 功能:
  - 右键菜单容器组件
  - 动态定位计算
  - 溢出避让处理
  - 点击外部关闭
  - 滚动锁定管理

### 1.2 ConfirmPopover.vue - 气泡确认组件
- 状态: ✅ 已完成
- 文件: src/components/common/ConfirmPopover.vue
- 功能:
  - 删除操作二次确认
  - 支持异步确认
  - Fluent Design 风格

### 1.3 TodoDetailModal.vue - 待办详情弹窗
- 状态: ✅ 已完成
- 文件: src/components/common/TodoDetailModal.vue
- 功能:
  - 展示待办完整信息
  - Teleport 渲染到 body
  - 关闭按钮

### 1.4 EventDetailModal.vue - 日程详情弹窗
- 状态: ✅ 已完成
- 文件: src/components/common/EventDetailModal.vue
- 功能:
  - 展示日程完整信息
  - Teleport 渲染到 body
  - 关闭按钮

### 1.5 全局禁用默认右键菜单
- 状态: ✅ 已完成
- 文件: src/App.vue
- 功能:
  - 全局拦截 contextmenu 事件
  - 保留输入框原生功能

---

## Wave 2: 视图集成

### 2.1 HomeView 待办项右键菜单
- 状态: ✅ 已完成
- 文件: src/views/HomeView.vue
- 菜单项: 编辑、删除(二次确认)、完成、详情

### 2.2 HomeView 日程项右键菜单
- 状态: ✅ 已完成
- 文件: src/views/HomeView.vue
- 菜单项: 编辑、删除(二次确认)、详情

### 2.3 TodosView 待办项右键菜单
- 状态: ✅ 已完成
- 文件: src/views/TodosView.vue
- 菜单项: 编辑、删除(二次确认)、完成、详情

### 2.4 ScheduleView 日程项右键菜单
- 状态: ✅ 已完成
- 文件: src/views/ScheduleView.vue
- 菜单项: 编辑、删除(二次确认)、详情

---

## Wave 3: 问题修复

### 3.1 修复页面白屏问题
- 状态: ✅ 已完成
- 提交: 282fe6a, 62abf37
- 问题: ContextMenu overflow:hidden 未正确清理
- 解决: 保存原始值，组件卸载时恢复

### 3.2 修复多页面 overflow 状态混乱
- 状态: ✅ 已完成
- 提交: e7a611e
- 问题: 多个 ContextMenu 实例导致状态冲突
- 解决: 引用计数器机制

### 3.3 修复待办页面切换白屏
- 状态: ✅ 已完成
- 提交: c210282
- 问题: 多根元素与 Vue transition 冲突
- 解决: 移入容器，组件使用 Teleport

### 3.4 修复功能实现问题
- 状态: ✅ 已完成
- 提交: 1dc6112
- 问题: 编辑功能空实现、删除无确认等
- 解决: 完善功能实现，添加确认组件

---

## Wave 4: 测试验证

### 4.1 ContextMenu 组件单元测试
- 状态: ✅ 已完成
- 文件: src/components/common/__tests__/ContextMenu.test.ts
- 覆盖: 渲染、定位、关闭、溢出处理

### 4.2 ConfirmPopover 组件单元测试
- 状态: ✅ 已完成
- 文件: src/components/common/__tests__/ConfirmPopover.test.ts
- 覆盖: 渲染、确认、取消、异步操作

### 4.3 TodoDetailModal 组件单元测试
- 状态: ✅ 已完成
- 文件: src/components/common/__tests__/TodoDetailModal.test.ts
- 覆盖: 渲染、数据展示、关闭

### 4.4 EventDetailModal 组件单元测试
- 状态: ✅ 已完成
- 文件: src/components/common/__tests__/EventDetailModal.test.ts
- 覆盖: 渲染、数据展示、关闭

---

## Wave 5: 文档更新

### 5.1 更新日历数据管理文档
- 状态: ✅ 已完成
- 文件: .agents/skills/calendar-business-flows/references/calendar-data-management.md
- 更新: 数据流架构变更说明

### 5.2 更新待办管理文档
- 状态: ✅ 已完成
- 文件: .agents/skills/calendar-business-flows/references/todo-management.md
- 更新: 数据流架构变更说明

---

## 伴生任务: 数据层迁移

### D.1 Rust 数据库模块
- 状态: ✅ 已完成
- 文件: src-tauri/src/db/
- 内容: errors, connection, schema, repositories

### D.2 Tauri 命令
- 状态: ✅ 已完成
- 文件: src-tauri/src/commands.rs
- 内容: calendar, event, todo, account, sync_state CRUD

### D.3 前端 Store 重构
- 状态: ✅ 已完成
- 文件: src/stores/calendar.ts, src/stores/todo.ts
- 变更: 使用 invoke 调用 Rust 后端

---

## 统计

- 总任务数: 19
- 已完成: 19
- 测试通过: 171/171
- 构建状态: 成功