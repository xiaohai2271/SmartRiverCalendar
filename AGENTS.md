# AGENTS.md - 智能体工作指南

本文件为在小河日历 (SmartRiverCalendar) 项目中工作的智能体提供核心指导。

## 语言规范

本项目严格遵守以下语言规范，所有开发者（包括 AI 智能体）必须遵守：

| 内容类型 | 语言要求 | 示例 |
|----------|----------|------|
| 对话沟通 | **中文** | 与用户交流、问题讨论、PR 描述 |
| 代码注释 | **中文** | `// 获取用户信息` |
| 文档撰写 | **中文** | README、AGENTS.md、技能文档 |
| Git 提交信息 | **中文** | `feat: 实现用户登录功能` |
| 变量名/函数名 | **英文** (符合开发规范) | `getUserInfo`, `userName` |
| 类名/类型名 | **英文** (PascalCase) | `UserService`, `UserInfo` |
| 常量名 | **英文** (UPPER_SNAKE_CASE) | `MAX_RETRY_COUNT` |
| 文件名 | **英文** (kebab-case 或 PascalCase) | `user-service.ts`, `UserModal.vue` |

### 具体说明

- **对话**：所有与用户的沟通交流必须使用中文
- **注释**：代码中的注释必须使用中文，清晰说明代码意图
- **文档**：README、CHANGELOG、技能文档等使用中文撰写
- **命名**：
  - 变量、函数、参数使用英文，遵循 camelCase
  - 类、接口、类型使用英文，遵循 PascalCase
  - 常量使用英文，遵循 UPPER_SNAKE_CASE
  - 私有变量/方法可使用 `_` 前缀，如 `_privateMethod`
- **提交信息**：Git commit message 使用中文，遵循 Angular Commit 规范

## 项目概述

小河日历 — 跨平台日历应用，Tauri 2.x + Vue 3 + TypeScript 构建。核心功能：多日历管理、日/周/月/年视图、系统托盘集成、待办管理。

**目标平台**: Windows / Android / Web

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
| 平台抽象 | Repository 接口 + PlatformCapabilities |
| 桌面端数据 | SQLite (tauri-plugin-sql)，离线优先 |
| Web 端数据 | 远端 REST API，远程优先 |
| UI 组件 | Fluent UI Web Components |
| 包管理 | pnpm |

## 目录结构

```
├── src/                    # Vue 3 前端源码
│   ├── platform/           # 平台抽象层（多端核心隔离）
│   │   ├── types/          # Repository 接口定义
│   │   ├── capabilities.ts # PlatformCapabilities 类型定义
│   │   ├── provider.ts     # PlatformProvider + 注入机制
│   │   ├── errors.ts       # RepositoryError 统一错误类型
│   │   ├── tauri/          # Tauri 平台实现（9 文件：auth/calendar/event/settings/sync/todo repo + transforms + index）
│   │   └── web/            # Web 平台实现（10 文件：同上 + api-client）
│   ├── __tests__/          # 单元测试 (Vitest)
│   ├── components/         # 组件 (calendar/ common/ home/ popup/ profile/ reminder/ settings/ update/)
│   ├── views/              # 页面视图（10 个：Calendar/Schedule/Todos/Settings/About/Profile/Home/Debug/CalendarPopup/ReminderPopup）
│   ├── stores/             # Pinia 状态管理（只依赖 Repository 接口）：auth/calendar/todo/settings/popupSettings
│   ├── services/           # 业务逻辑服务（通过能力判断降级）：auth/cloudSync/reminder/rsa/settings/sync/updater/webApi
│   ├── composables/        # 组合式函数
│   ├── router/             # 路由配置
│   ├── types/              # TypeScript 类型定义（共享，两端一致）
│   ├── utils/              # 纯工具函数 (date, lunar, helpers)
│   └── styles/             # 样式文件
├── src-tauri/              # Rust 后端（仅桌面端）
│   ├── src/                # Rust 源码（commands/caldav/exchange/clock_hook/updater 等）
│   └── tauri.conf.json     # Tauri 配置
└── .agents/skills/         # 技能文档 (7 个，按需加载)
```

## 技能导航

详细的技术规范和开发指南已提取为技能，按需加载：

| 技能 | 用途 | 加载时机 |
|------|------|----------|
| [tech-constraints](.agents/skills/tech-constraints/SKILL.md) | 架构约束、数据库规范、日志排查 | 技术方案设计、架构决策 |
| [coding-style](.agents/skills/coding-style/SKILL.md) | TypeScript/Vue 规范、测试规范、Git 规范 | 编写代码、代码审查 |
| [fluent-design](.agents/skills/fluent-design/SKILL.md) | Fluent Design 设计令牌、组件、动画 | UI 开发、样式调整 |
| [calendar-business-flows](.agents/skills/calendar-business-flows/SKILL.md) | 核心业务流程、关键节点 | 修改业务逻辑、扩展功能 |

> **多端架构设计**：Repository + PlatformCapabilities 完整设计文档见 `docs/superpowers/specs/2026-05-16-multi-platform-data-architecture-design.md`，涉及平台抽象层修改时必读。

## 多端开发约定

本项目采用 **Repository + PlatformCapabilities** 架构实现多端隔离。所有开发者（包括 AI 智能体）必须严格遵守以下约定。

### 分层架构

```
┌──────────────────────────────────────┐
│         Vue 组件 / 视图层             │  ← 按能力判断渲染
├──────────────────────────────────────┤
│           Pinia Store                │  ← 只依赖 Repository 接口
├──────────────────────────────────────┤
│    Repository 接口 + PlatformCaps    │  ← 平台无关的契约
├──────────┬───────────────────────────┤
│ Tauri 实现│       Web 实现            │  ← 各自独立，互不影响
│ invoke()  │     fetch(API)           │
│ SQLite    │     远端 API              │
└──────────┴───────────────────────────┘
```

**核心原则**：Store 不感知平台，组件按能力判断功能可用性，数据转换封装在 Repository 实现内部。

### 平台差异对照

| 维度 | 桌面端 (Tauri) | Web 端 |
|------|---------------|--------|
| 数据策略 | 离线优先，本地 SQLite，适时同步远端 | 远程优先，无本地数据库 |
| 后端 API | 同一套远端 API | 同一套远端 API |
| 功能范围 | 全功能 | 核心日历/待办 + 认证 + 外部日历集成 |
| 提醒方式 | 应用内弹窗 + 系统通知 | 浏览器原生通知 |
| 系统集成 | 托盘、时钟钩子、自启、多窗口 | 无 |

### 禁止清单

| 禁止事项 | 原因 | 正确做法 |
|----------|------|----------|
| Store 中直接调用 `invoke`/`safeInvoke`/`invokeXxx` | 违反数据层隔离 | 通过 `usePlatform()` 获取 Repository |
| Store/组件中直接调用 `webApi.xxx` | 违反数据层隔离 | 通过 `usePlatform()` 获取 Repository |
| 组件/Store 中使用 `isTauri()` 做逻辑分支 | 违反能力声明机制 | 使用 `useCapabilities()` 的语义化能力名 |
| 在 `src/platform/` 之外 import `@tauri-apps/api` | 平台 API 应封装在平台层内 | 在 `src/platform/tauri/` 中封装 |
| Repository 接口返回后端原始格式（snake_case） | 接口契约统一为 camelCase | 转换封装在各平台 `transforms.ts` 中 |
| 一个 Repository 方法内部混合 Tauri 和 Web 逻辑 | 违反单一实现原则 | 每个平台独立实现 |
| Repository 方法静默返回 null 吞掉错误 | 错误应抛出 `RepositoryError` | 抛出带 code/message 的 RepositoryError |

### 新增功能开发流程

新增任何涉及数据的**功能**时，必须按以下顺序完成：

```
1. 在 src/platform/types/ 定义或扩展 Repository 接口
2. 在 src/platform/tauri/ 实现 Tauri 版本
3. 在 src/platform/web/ 实现 Web 版本
4. 在 src/stores/ 通过 usePlatform() 使用 Repository 接口
5. 在 src/views/components/ 使用能力判断控制渲染
6. 补充两端测试
```

### 数据格式约定

| 层级 | 命名风格 | 示例 |
|------|----------|------|
| Rust 后端返回 | snake_case | `{ start_time: 1234, all_day: true }` |
| Web API 请求/响应 | snake_case | `{ start_time: 1234 }` |
| Repository 接口输入/输出 | camelCase | `{ startTime: 1234, allDay: true }` |
| Pinia Store 状态 | camelCase | `event.startTime` |
| 组件 prop/event | camelCase | `:start-time`（Vue 模板自动转换） |

数据格式转换发生在 Repository 实现内部（`transforms.ts`），对外透明。

### 能力判断规范

组件和 Service 通过 `useCapabilities()` 判断功能可用性，**禁止使用 `isTauri()`**：

```typescript
// ✅ 正确：语义化能力判断
import { useCapabilities } from '@/platform/provider'
const capabilities = useCapabilities()
if (capabilities.hasSystemTray) { ... }
if (capabilities.hasReminderPopup) { ... }

// ❌ 错误：直接判断平台
import { isTauri } from '@/utils/tauri'
if (isTauri()) { ... }
```

**能力声明关键项**：

| 能力 | 桌面端 | Web 端 | 用途 |
|------|--------|--------|------|
| `hasLocalDatabase` | ✅ | ❌ | 是否有本地数据库 |
| `hasOfflineMode` | ✅ | ❌ | 是否支持离线 |
| `dataPriority` | `'local-first'` | `'remote-first'` | 数据优先级 |
| `hasReminderPopup` | ✅ | ❌ | 应用内提醒弹窗 |
| `hasSystemNotification` | ✅ | ✅ | 系统/浏览器通知 |
| `hasSnoozeReminder` | ✅ | ❌ | 稍后提醒 |
| `hasSystemTray` | ✅ | ❌ | 系统托盘 |
| `hasAutoStart` | ✅ | ❌ | 开机自启 |
| `hasClockHook` | ✅ | ❌ | 时钟点击检测 |
| `hasMultiWindow` | ✅ | ❌ | 多窗口 |
| `hasAutoUpdate` | ✅ | ❌ | 自动更新 |
| `hasMinimizeToTray` | ✅ | ❌ | 最小化到托盘 |
| `hasProxySettings` | ✅ | ❌ | 代理设置 |

### 错误处理约定

- Repository 方法统一抛出 `RepositoryError`（含 `code`、`message`、`platform`）
- Store 捕获 `RepositoryError`，统一处理（展示 toast、重试等）
- 不允许在 Repository 实现中静默吞掉错误（禁止返回 null 代替错误）
- `safeInvoke` 的 null 返回模式需改为抛出 `RepositoryError`

```typescript
// ✅ 正确：Repository 抛出错误
throw new RepositoryError({
  code: RepoErrorCodes.NOT_FOUND,
  message: '日历不存在',
  platform: 'tauri',
  cause: error,
})

// ❌ 错误：静默返回 null
return null
```

### 测试约定

- **Repository 接口**：编写 mock 实现，Store 测试不依赖真实平台
- **Tauri Repository**：mock `safeInvoke` 返回值，验证参数和转换逻辑
- **Web Repository**：mock `fetch` 返回值，验证请求格式和数据转换
- **能力声明**：组件测试中注入不同能力组合
- **Store**：通过 mock Repository 测试，不依赖平台环境

## 核心开发约束

以下约束所有开发者（包括 AI 智能体）必须遵守：

1. **架构约束**: 展示层不直接操作数据库，Store 不感知平台。数据流：`Vue → Store → Repository 接口 → 平台实现 → 数据源`
2. **测试要求**: 提交前必须通过 `pnpm test:run`，覆盖率 > 50%
3. **分支管理**: main 受保护，从 `origin/main` 拉取 `feature/` 或 `bugfix/` 分支，通过 PR 合并到 main
4. **提交规范**: 遵循 [Angular Commit 规范](https://github.com/angular/angular/blob/22b96b9/CONTRIBUTING.md#-commit-message-guidelines)，内容单一
5. **文档同步**: 业务流程变更需更新 `.agents/skills/calendar-business-flows/`
6. **日志规范**: 关键业务节点必须输出日志，控制日志量级

## 关键依赖

- **@fluentui/web-components**: UI 组件库
- **tyme4ts**: 农历/节假日处理
- **tauri-plugin-***: Tauri 系统集成插件
