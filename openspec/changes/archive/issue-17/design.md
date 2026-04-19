# 技术设计：无法创建日程事件和代办事件

## Context

此设计文档从 GitHub 迁移而来。

**实现概述：**

- 修复前端表单硬编码使用 'default' 作为日历 ID 的问题
- 添加 getFirstWritableCalendarId() 函数动态获取有效的日历 ID
- 在 store 层添加 getValidCalendarId() 函数确保 calendarId 有效
- **修复根本原因：注册缺失的 Rust 后端 Tauri 命令**

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
