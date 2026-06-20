# 测试工程技能

小河日历项目的测试工程化指南和模板。涵盖单元测试、组件测试、E2E 测试的编写规范和工具使用。

## 测试分层

| 层级 | 工具 | 位置 | 用途 |
|------|------|------|------|
| L1 单测 | Vitest | `src/__tests__/` | 业务逻辑、工具函数、Store |
| L2 组件测试 | Vitest + @vue/test-utils | `src/__tests__/` | 组件渲染和交互 |
| L3 E2E (Web) | Playwright | `e2e/web/` | 端到端用户流程 |
| L3 E2E (桌面) | WebDriverIO + tauri-driver | `e2e/tauri/` | 桌面端特有流程 |

## 快速开始

### 运行测试

```bash
# 单元测试
pnpm test:run              # 单次运行
pnpm test                  # 监听模式
pnpm test:coverage         # 覆盖率报告

# E2E 测试 (Web)
pnpm e2e                   # 运行所有 Web E2E
pnpm e2e:headed            # 有头模式
pnpm e2e:ui                # Playwright UI 模式

# E2E 测试 (桌面端)
pnpm e2e:tauri             # 运行桌面端 E2E
```

### 模板文件

- `templates/unit-test.template.ts` — 单元测试模板
- `templates/component-test.template.ts` — 组件测试模板
- `templates/e2e-test.template.ts` — E2E 测试模板

### 编写指南

- `guides/writing-unit-tests.md` — 单元测试编写指南
- `guides/writing-component-tests.md` — 组件测试编写指南
- `guides/writing-e2e-tests.md` — E2E 测试编写指南

## 核心约束

1. **Store 测试**：通过 mock Repository 接口，不依赖平台环境
2. **E2E API Mock**：使用 Playwright Route 拦截，零后端依赖
3. **平台差异**：通过 `useCapabilities()` 判断功能可用性
4. **错误处理**：Repository 方法统一抛出 `RepositoryError`
5. **数据格式**：Repository 接口输入/输出统一 camelCase
