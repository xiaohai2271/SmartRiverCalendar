# 技术设计

## 概述

此设计文档从 GitHub PR #20 迁移而来。

## 实现概述

实现了 Issue #19 的精简日历弹出窗口功能，点击系统时钟区域即可快速查看日历。

## 设计细节

- 新增弹出窗口组件 (src/components/popup/)
- 实现窗口控制逻辑 (src/composables/useCalendarPopup.ts)
- 手动定位实现，紧贴任务栏上方显示
- 配置 Tauri 权限
- 更新系统托盘集成文档

---

