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
6.  **覆盖率要求**: 优先实现自动化单元测试，保证整体 60%-70% 的有效覆盖率，覆盖所有核心业务和工具函数。

### Git 提交规范
- 建议使用 Conventional Commits 格式，但目前未强制。
- 示例：`feat: 添加周视图`，`fix: 修复日期计算错误`。
- **分支管理**: main 分支为受保护分支，进行编码前需要根据功能需求创建分支：
  - 功能开发：`feature/{英文简要描述}`（例如：`feature/add-week-view`）
  - 问题修复：`bugfix/{英文简要描述}`（例如：`bugfix/fix-date-calculation`）
- **提交前验证**: 提交代码之前必须先执行单元测试用例，保证功能的正确性。
- **提交记录**: 代码提交记录需要清晰明了且内容单一，不要多个不同类型的修改在一个分支上提交。

## 依赖注意事项
- **@fluentui/web-components**: UI 组件库。
- **tyme4ts**: 农历/节假日处理库。
- **tauri-plugin-***: 一系列 Tauri 插件用于系统集成功能。

## Fluent Design 规范

本项目严格遵循 **Microsoft Fluent Design System**，为用户提供现代化、一致且美观的界面体验。

### 核心原则
- **光影 (Light)**: 使用微妙的阴影和高光表达层次关系
- **深度 (Depth)**: 通过 z-index 和阴影创建视觉层次
- **动效 (Motion)**: 所有交互都有平滑的过渡动画
- **材质 (Material)**: 使用亚克力 (Acrylic) 和云母 (Mica) 效果
- **缩放 (Scale)**: 响应式设计，适配不同屏幕尺寸

### 关键实现
- **颜色系统**: 使用 CSS 变量定义浅色/深色主题颜色
- **阴影系统**: 多层级阴影表达元素深度
- **圆角规范**: 统一的圆角半径 (4px, 8px, 12px, 16px)
- **动画规范**: 快速 100ms，正常 200ms，平滑 250ms
- **亚克力效果**: `backdrop-filter: blur(20px) saturate(180%)`

### 组件规范
- **卡片**: `.fluent-card` - 轻微阴影，悬停时增强
- **按钮**: `.fluent-button` - 支持主要/次要/危险状态
- **输入框**: `.fluent-input` - 聚焦时显示强调色边框
- **滚动条**: 自定义 Fluent 风格滚动条

### 主题支持
- 浅色模式 (`.light`)
- 深色模式 (`.dark`)
- 自动模式 (跟随系统 `prefers-color-scheme`)

**详细规范请参考**: [SPEC.md - 4.4 Fluent Design 规范](SPEC.md#44-fluent-design-规范)

## 开发约束条件

以下是小河日历项目的核心开发约束条件，所有开发人员（包括AI智能体）必须严格遵守：

### 1. 测试覆盖率要求
- **优先实现自动化单元测试用例**，保证整体 60%-70% 的有效覆盖率（必须 > 50%）
- 覆盖范围必须包括所有核心业务逻辑和工具函数
- 新增功能必须同步编写对应的单元测试
- 测试覆盖率报告通过 `pnpm test:coverage` 生成

### 2. 代码提交前测试验证
- **提交代码之前必须先执行单元测试用例**，保证功能的正确性
- 运行 `pnpm test:run` 确保所有测试通过
- 如果测试失败，必须修复后才能提交代码
- 建议在开发过程中持续运行测试，及时发现和修复问题

### 3. Git 分支管理规范
- **main 分支为受保护分支**，不能直接提交代码
- 进行编码前需要根据功能需求创建分支，分支名称遵循以下格式：
  - 功能开发：`feature/{英文简要描述}`（例如：`feature/add-week-view`）
  - 问题修复：`bugfix/{英文简要描述}`（例如：`bugfix/fix-date-calculation`）
- 代码提交记录需要清晰明了且内容单一，不要多个不同类型的修改在一个分支上提交
- 在编码结束后发起 Pull Request 进行代码合并

### 4. 文档更新要求
- 功能开发或者代码修复时若涉及到流程上的变动、枚举值变动、方案变更等需要进行总结
- 将变更内容更新/新增到文档中去
- 文档位于 Skills 模块：`.agents/skills/calendar-business-flows/`
- 具体路径：`.agents/skills/calendar-business-flows/SKILL.md` 及其 `references/` 目录
- 文档更新方便后续智能体按需调用，保持知识库的完整性

### 5. 调试日志规范
- 适量补充调试日志，方便出问题时进行排查
- 日志应包含关键操作的状态信息
- 使用 `console.log`、`console.error` 等进行日志记录
- 避免过度日志影响性能，保持日志的实用性

### 6. GitHub 协作规范
当需求来源为 GitHub 时，需遵守以下协作流程：

#### 6.1 Issue 驱动开发流程
如果需求来源是 **GitHub Issue**：
1. **创建分支**: 基于 main 分支创建 `feature/{描述}` 或 `bugfix/{描述}` 分支
2. **开始开发**: 在新分支上进行代码开发
3. **提交代码**: 每个提交记录需清晰明了、内容单一
4. **创建 Pull Request**: 开发完成后创建 PR，PR 标题以 `Closes #{issue号}` 结尾
5. **同步结果文档**: 在 PR 描述中同步以下信息：
   - 功能实现情况
   - 单元测试执行结果
   - 测试覆盖率报告
   - 变更文件列表
   - 技术实现说明

#### 6.2 关键决策同步
- **过程文档同步**: 开发过程中的关键设计决策需同步到 GitHub Issue 评论中
- **结果文档同步**: 完成后需在 PR 描述或 Issue 评论中同步完整的测试报告和覆盖率数据
- **多提交多文档**: 如果有多个提交记录，每个提交对应一份文档，并在文档评论中指明对应的代码提交 SHA

#### 6.3 文档同步示例
```
Issue #X 评论格式：

## 设计方案
[设计决策内容]

---

## 实现完成
- 提交记录: abc1234
- 测试通过: 98/98
- 覆盖率: 79.84%
```

PR 描述格式参考本仓库已有 PR 模板。

#### 6.4 非 Issue 需求处理
如果需求来源不是 GitHub Issue（如用户直接提出）：
- 完成后如有必要，可由用户决定是否创建 Issue 和 PR 进行归档
- 关键决策和结果文档可通过其他方式同步给用户
