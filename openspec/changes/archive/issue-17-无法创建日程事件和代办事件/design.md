# 技术设计

## 概述

此设计文档从 GitHub PR #18 迁移而来。

## 实现概述

- 修复前端表单硬编码使用 'default' 作为日历 ID 的问题
- 添加 getFirstWritableCalendarId() 函数动态获取有效的日历 ID
- 在 store 层添加 getValidCalendarId() 函数确保 calendarId 有效
- **修复根本原因：注册缺失的 Rust 后端 Tauri 命令**

