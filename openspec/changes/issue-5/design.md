# 技术设计：关闭所有页面的默认右键菜单，并根据模块功能开启对应的右键菜单

## Context

此设计文档从 GitHub 迁移而来。

**实现概述：**

- 创建可复用的 `ContextMenu.vue` 右键菜单组件
- 创建 `ConfirmPopover.vue` 气泡确认组件
- 创建 `TodoDetailModal.vue` 和 `EventDetailModal.vue` 详情弹窗组件
- 在 HomeView、TodosView、ScheduleView 中集成右键菜单功能
- 全局禁用默认右键菜单（保留输入框的复制/粘贴功能）
- 添加单元测试覆盖

## Goals

- 完成功能需求
- 保证代码质量
- 更新文档

## Non-Goals

- 不引入不相关变更
- 不破坏现有功能

## Decisions

遵循项目规范实现。

## Risks / Trade-offs

- 需要充分测试验证
