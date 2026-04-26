# AGENTS.md - 智能体工作指南

本文件为在小河日历 (SmartRiverCalendar) 项目中工作的智能体提供核心指导。

## 沟通规范

- **所有与用户的沟通交流必须使用中文**
- **代码中的注释必须使用中文**
- **文档和说明使用中文撰写**

## 项目概述

小河日历 — 跨平台桌面日历应用，Tauri 2.x + Vue 3 + TypeScript 构建。核心功能：多日历管理、日/周/月/年视图、系统托盘集成、待办管理。

**目标平台**: Windows / Android

## 常用命令

```bash
# 开发
pnpm dev                  # Vite 开发服务器 (仅前端)
pnpm tauri:dev            # Tauri 应用开发模式

# 构建
pnpm build                # 构建前端
pnpm tauri:build          # 构建桌面应用

# 测试
pnpm test                 # 测试 (监听模式)
pnpm test:run             # 测试 (单次)
pnpm test:coverage        # 测试覆盖率报告

# Rust 测试 (src-tauri/)
cargo test                # 所有 Rust 测试
cargo test --lib          # 库单元测试
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x (Rust) |
| 前端框架 | Vue 3 + TypeScript + Vite |
| 状态管理 | Pinia (Composition API 风格) |
| 数据库 | SQLite (tauri-plugin-sql) |
| UI 组件 | Fluent UI Web Components |
| 包管理 | pnpm |

## 目录结构

```
├── src/                    # Vue 3 前端源码
│   ├── __tests__/          # 单元测试 (Vitest)
│   ├── components/         # 通用组件 (calendar/, settings/, todo/)
│   ├── views/              # 页面视图
│   ├── stores/             # Pinia 状态管理
│   ├── services/           # 业务逻辑服务
│   ├── composables/        # 组合式函数
│   ├── router/             # 路由配置
│   ├── types/              # TypeScript 类型定义
│   ├── utils/              # 工具函数 (date, lunar, database)
│   └── styles/             # 样式文件
├── src-tauri/              # Rust 后端
│   ├── src/                # Rust 源码
│   └── tauri.conf.json     # Tauri 配置
└── .agents/skills/         # 技能文档 (按需加载)
```

## 技能导航

详细的技术规范和开发指南已提取为技能，按需加载：

| 技能 | 用途 | 加载时机 |
|------|------|----------|
| [tech-constraints](.agents/skills/tech-constraints/SKILL.md) | 架构约束、数据库规范、日志排查 | 技术方案设计、架构决策 |
| [coding-style](.agents/skills/coding-style/SKILL.md) | TypeScript/Vue 规范、测试规范、Git 规范 | 编写代码、代码审查 |
| [fluent-design](.agents/skills/fluent-design/SKILL.md) | Fluent Design 设计令牌、组件、动画 | UI 开发、样式调整 |
| [calendar-business-flows](.agents/skills/calendar-business-flows/SKILL.md) | 核心业务流程、关键节点 | 修改业务逻辑、扩展功能 |

## 核心开发约束

以下约束所有开发者（包括 AI 智能体）必须遵守：

1. **架构约束**: 展示层不直接操作数据库。数据流：`Vue → Service → Tauri invoke() → Rust → SQLite`
2. **测试要求**: 提交前必须通过 `pnpm test:run`，覆盖率 > 50%
3. **分支管理**: main 受保护，从 develop 创建 `feature/` 或 `bugfix/` 分支，通过 PR 合并
4. **提交规范**: 遵循 [Angular Commit 规范](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines)，内容单一
5. **文档同步**: 业务流程变更需更新 `.agents/skills/calendar-business-flows/`
6. **日志规范**: 关键业务节点必须输出日志，控制日志量级

## 关键依赖

- **@fluentui/web-components**: UI 组件库
- **tyme4ts**: 农历/节假日处理
- **tauri-plugin-***: Tauri 系统集成插件
