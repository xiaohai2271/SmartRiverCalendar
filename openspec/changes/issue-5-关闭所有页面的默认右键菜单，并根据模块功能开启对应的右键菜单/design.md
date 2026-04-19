# 技术设计

## 概述

此设计文档从 GitHub PR #13 迁移而来。

## 实现概述

- 创建可复用的 `ContextMenu.vue` 右键菜单组件
- 创建 `ConfirmPopover.vue` 气泡确认组件
- 创建 `TodoDetailModal.vue` 和 `EventDetailModal.vue` 详情弹窗组件
- 在 HomeView、TodosView、ScheduleView 中集成右键菜单功能
- 全局禁用默认右键菜单（保留输入框的复制/粘贴功能）
- 添加单元测试覆盖

