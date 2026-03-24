# AGENTS.md - 智能体工作指南

本文件为在小河日历 (SmartRiverCalendar) 项目中工作的智能体提供指导。

## 沟通规范

- **所有与用户的沟通交流必须使用中文**
- **代码中的注释必须使用中文**
- **文档和说明使用中文撰写**

## 项目概述

小河日历是一款跨平台桌面日历应用，基于 Tauri 2.x + Vue 3 + TypeScript 构建。核心功能包括：多日历管理、多种视图模式（日/周/月/年）、系统托盘集成、待办事项管理。

**目标平台**: Windows / Android

## 常用命令

```bash
# 开发
pnpm dev                  # 启动 Vite 开发服务器 (仅前端)
pnpm tauri:dev            # 启动 Tauri 桌面应用开发模式

# 构建
pnpm build                # 构建 Vue 前端 (输出到 dist/)
pnpm tauri:build          # 构建 Tauri 桌面应用 (可执行文件)

# 测试
pnpm test                 # 运行测试 (监听模式)
pnpm test:run             # 运行测试 (单次运行)
pnpm test:coverage        # 运行测试并生成覆盖率报告

# 运行单个测试文件
pnpm vitest run src/__tests__/date.test.ts
# 运行单个测试用例
pnpm vitest run -t "test case name"

# Rust 测试 (在 src-tauri/ 目录下)
cargo test                # 运行所有 Rust 测试
cargo test --lib          # 仅运行库单元测试

# 其他
pnpm preview              # 预览已构建的前端
```

## 技术架构

### 技术栈
- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Tauri 2.x (Rust)
- **状态管理**: Pinia (Composition API 风格)
- **数据库**: SQLite (tauri-plugin-sql)
- **UI 组件**: Fluent UI Web Components
- **包管理**: pnpm

### 目录结构
```
SmartRiverCalender/
├── src/                      # Vue 3 前端源码
│   ├── __tests__/            # 单元测试 (Vitest)
│   ├── components/           # 通用组件
│   │   ├── calendar/         # 日历视图组件 (DayView, WeekView, MonthView, YearView)
│   │   ├── settings/         # 设置组件
│   │   └── todo/             # 待办组件
│   ├── views/                # 页面视图 (CalendarView, TodosView, SettingsView)
│   ├── stores/               # Pinia 状态管理
│   ├── types/                # TypeScript 类型定义
│   ├── utils/                # 工具函数 (date, database, lunar, holiday)
│   ├── router/               # 路由配置
│   ├── services/             # 业务逻辑服务
│   └── assets/               # 静态资源
├── src-tauri/                # Rust 后端 (Tauri)
│   ├── src/                  # Rust 源码
│   ├── tauri.conf.json       # Tauri 配置
│   └── Cargo.toml            # Rust 依赖
├── vitest.config.ts          # Vitest 测试配置
└── dist/                     # 构建产物
```

## 代码风格指南

### TypeScript / Vue 规范

1.  **组件风格**: 使用 Vue 3 Composition API (`<script setup lang="ts">`)。
    - 逻辑优先：`<script setup>` -> `<template>` -> `<style>`。
    - 示例：
      ```vue
      <script setup lang="ts">
      import { ref, computed } from 'vue'
      import type { CalendarEvent } from '@/types'

      const props = defineProps<{ event: CalendarEvent }>()
      const emit = defineEmits(['update'])

      const isActive = ref(false)
      </script>
      ```

2.  **类型定义**:
    - 所有复杂数据结构必须在 `src/types/index.ts` 中定义接口。
    - 导入类型时必须使用 `import type { ... }` 语法。
    - 避免使用 `any`，尽量使用具体类型或 `unknown`。

3.  **命名约定**:
    - **文件名**: 组件使用 PascalCase (e.g., `DayView.vue`)，工具/Store 使用 camelCase (e.g., `calendar.ts`, `date.ts`)。
    - **变量/函数**: 使用 camelCase。
    - **类型/接口**: 使用 PascalCase。
    - **CSS 类名**: 使用 kebab-case。

4.  **导入路径**:
    - 使用 `@` 别名指向 `src` 目录 (e.g., `import { useCalendarStore } from '@/stores/calendar'`)。
    - 相对路径仅限于当前目录内的引用。

5.  **状态管理**:
    - 使用 Pinia，且建议使用 Setup Store 风格 (类似 Composition API)。
    - Store 文件放在 `src/stores/` 下。
    - 示例：
      ```typescript
      export const useCalendarStore = defineStore('calendar', () => {
        const state = ref(...)
        const getter = computed(...)
        function action() { ... }
        return { state, getter, action }
      })
      ```

6.  **错误处理**:
    - 异步操作必须包含 try-catch 块。
    - 错误应记录到控制台 (`console.error`) 并向用户提供适当的 UI 反馈。

7.  **注释**:
    - 所有注释必须使用 **中文**。
    - 复杂的业务逻辑或算法必须添加注释说明。

### 测试规范

1.  **测试框架**: 使用 Vitest + Vue Test Utils。
2.  **测试文件位置**: `src/__tests__/` 目录下。
3.  **测试文件命名**: `*.test.ts` 格式 (e.g., `date.test.ts`)。
4.  **测试结构**: 使用 `describe` 和 `it` 组织测试，描述应使用中文。
5.  **测试原则**:
    - 工具函数必须包含单元测试。
    - 测试应覆盖边界条件和异常情况。
    - 避免测试实现细节，关注公共接口行为。

### Git 提交规范
- 建议使用 Conventional Commits 格式，但目前未强制。
- 示例：`feat: 添加周视图`，`fix: 修复日期计算错误`。

## 依赖注意事项
- **@fluentui/web-components**: UI 组件库。
- **tyme4ts**: 农历/节假日处理库。
- **tauri-plugin-***: 一系列 Tauri 插件用于系统集成功能。
