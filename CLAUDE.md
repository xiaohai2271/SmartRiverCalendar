# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本项目中工作时提供指导。

## 项目概述

小河日历 (SmartRiverCalendar) 是一款跨平台桌面日历应用，基于 Tauri 2.x + Vue 3 + TypeScript 构建。核心功能包括：多日历管理、多种视图模式（日/周/月/年）、系统托盘集成、待办事项管理。

**目标平台**: Windows / Android

## 常用命令

```bash
# 开发
pnpm dev                  # 启动 Vite 开发服务器
pnpm tauri:dev            # 启动 Tauri 应用开发模式

# 构建
pnpm build                # 构建 Vue 前端
pnpm tauri:build          # 构建 Tauri 桌面应用

# 其他
pnpm preview              # 预览已构建的前端
```

## 技术架构

### 技术栈
- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Tauri 2.x (Rust)
- **状态管理**: Pinia
- **数据库**: SQLite (tauri-plugin-sql)
- **UI 组件**: Fluent UI Web Components

### 目录结构
- `src/` - Vue 3 前端代码
  - `components/calendar/` - 日历视图组件 (DayView, WeekView, MonthView, YearView, MiniCalendar)
  - `views/` - 页面视图 (CalendarView, TodosView, SettingsView, HomeView)
  - `stores/` - Pinia 状态管理
  - `types/` - TypeScript 类型定义
  - `utils/` - 工具函数 (日期处理、农历、节假日数据)
- `src-tauri/` - Rust 后端
  - `tauri.conf.json` - Tauri 配置（窗口、托盘、包设置）

### 核心类型定义 (src/types/index.ts)
- `CalendarEvent` - 日历事件
- `Calendar` - 日历账户
- `Todo` - 待办事项
- `TimeBlock` - 时间块
- `AppSettings` - 应用设置
- `CalendarView` - 视图类型 ('day' | 'week' | 'month' | 'year')

### 状态管理 (src/stores/calendar.ts)
`useCalendarStore` 管理：日历和事件、当前视图和日期导航、事件 CRUD 操作

### Tauri 插件
- `tauri-plugin-sql` - SQLite 数据库
- `tauri-plugin-notification` - 系统通知
- `tauri-plugin-shell` - Shell 命令
- `tauri-plugin-updater` - 自动更新
- `tauri-plugin-autostart` - 开机自启
- `tauri-plugin-global-shortcut` - 全局快捷键
- `tauri-plugin-tray-icon` - 系统托盘
- `tauri-plugin-single-instance` - 单实例运行

## 配色方案
- 主色: #4A90D9 (河流水蓝)
- 次色: #2D3748 (深灰)
- 强调色: #F5A623 (橙色，待办/提醒)
- 背景: #F7FAFC (浅色) / #1A202C (深色)