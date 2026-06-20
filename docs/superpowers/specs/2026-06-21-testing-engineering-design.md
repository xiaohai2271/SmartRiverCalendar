# 小河日历前端自动化测试工程化体系设计

## 概述

建立分层自动化测试体系，覆盖从单元测试到 E2E 测试的全链路，结合 Agent 自动生成测试 + CI 自动化运行，解决功能回归靠人肉、跨模块集成无保障、缺 E2E 的三大痛点。

## 范围

- **前端**：Vue 3 + TypeScript 全部源码
- **平台**：Web 端优先，桌面端（Tauri）同步建设
- **Rust 后端**：本次不纳入，后续单独规划
- **CI**：GitHub Actions

## 分层测试策略

| 层级 | 工具 | 覆盖范围 | 运行时间 | 触发方式 |
|------|------|----------|----------|---------|
| **L1 单测** | Vitest | utils、transforms、services、stores（mock repo） | ~2min | 每次 push |
| **L2 组件测试** | Vitest + @vue/test-utils | 组件交互、弹窗逻辑、视图渲染 | ~3min | 每次 push |
| **L3 E2E Web** | Playwright (Chromium) | 关键业务流程，真实浏览器 | ~5min | PR / main |
| **L3 E2E 桌面** | Playwright + tauri-driver | 桌面端独有功能（托盘、弹窗、多窗口） | ~8min | PR / main |

## Playwright 项目结构

```
e2e/
├── playwright.config.ts          # Web 端配置
├── playwright.tauri.config.ts    # 桌面端配置
├── fixtures/                     # API mock 数据
│   ├── calendars.json
│   ├── events.json
│   ├── todos.json
│   └── user.json
├── helpers/                      # 测试辅助工具
│   ├── api-mock.ts              # Playwright Route 拦截封装
│   ├── auth.setup.ts            # 登录状态 setup
│   └── tauri-helpers.ts         # 桌面端辅助函数
├── web/                          # Web 端 E2E 测试
│   ├── auth.spec.ts
│   ├── calendar.spec.ts
│   ├── todo.spec.ts
│   ├── sync.spec.ts
│   └── settings.spec.ts
└── tauri/                        # 桌面端 E2E 测试
    ├── tray.spec.ts
    ├── popup.spec.ts
    ├── reminder.spec.ts
    └── multi-window.spec.ts
```

## API Mock 策略

所有 API 请求通过 Playwright `page.route()` 拦截，返回 `fixtures/` 目录的 JSON 数据。不依赖任何真实后端。

```typescript
// e2e/helpers/api-mock.ts
export async function mockApiRoutes(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes('/auth/login') && method === 'POST') {
      return route.fulfill({ json: loginResponse, status: 200 })
    }
    if (url.includes('/calendars') && method === 'GET') {
      return route.fulfill({ json: calendarsFixture, status: 200 })
    }
  })
}
```

对于桌面端 Tauri IPC 调用，通过 `page.evaluate()` 拦截 `window.__TAURI__` 的 invoke 方法：

```typescript
// e2e/helpers/tauri-mock.ts
export async function mockTauriInvoke(page: Page, mocks: Record<string, unknown>) {
  await page.addInitScript((mockData) => {
    window.__TAURI__ = {
      invoke: (cmd: string) => Promise.resolve(mockData[cmd] ?? null),
    }
  }, mocks)
}
```

## 桌面端 Tauri E2E

使用 `tauri-driver`（WebDriverIO 协议）连接桌面应用 webview：

```typescript
// e2e/tauri/tray.spec.ts
test('点击系统托盘图标应显示主窗口', async ({ page }) => {
  await page.evaluate(() => window.__TAURI__.event.emit('tray-click'))
  await expect(page.locator('.home-view')).toBeVisible()
})
```

桌面端配置需要：
1. 先构建 Tauri 应用：`pnpm tauri build`
2. 安装 tauri-driver：`cargo install tauri-driver`
3. 启动 tauri-driver 作为 WebDriver 代理
4. Playwright 通过 WebDriver 协议连接

## CI 流水线

新增 `.github/workflows/test.yml`：

```yaml
name: Test

on:
  push:
    branches: [main, feature/*, bugfix/*]
  pull_request:
    branches: [main]

jobs:
  unit-and-component:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm test:run
      - run: pnpm test:coverage
      - uses: actions/upload-artifact@v4
        with: { name: coverage, path: coverage/ }

  e2e-web:
    needs: unit-and-component
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm exec playwright install chromium
      - run: pnpm exec playwright test --config=e2e/playwright.config.ts
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: e2e/playwright-report/ }

  e2e-tauri:
    needs: unit-and-component
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pnpm tauri build
      - run: cargo install tauri-driver
      - run: pnpm exec playwright test --config=e2e/playwright.tauri.config.ts
```

## Agent 自动化测试生成

### 测试技能

```
.agents/skills/testing/
├── SKILL.md                    # 测试技能入口
├── templates/
│   ├── unit-test.template.ts   # 单测模板
│   ├── component-test.template.ts  # 组件测试模板
│   └── e2e-test.template.ts    # E2E 测试模板
└── guides/
    ├── writing-unit-tests.md
    ├── writing-component-tests.md
    └── writing-e2e-tests.md
```

### 生成规范

- 新增 Store → 必须生成 L1 单测（mock Repository）
- 新增组件 → 必须生成 L2 组件测试（交互场景）
- 新增业务流程 → 必须生成 L3 E2E 测试（Playwright spec）

### Agent 工作流

1. **开发新功能时**：Agent 根据开发流程，自动在对应层级生成测试
2. **定期扫描**：运行覆盖率报告，识别未覆盖模块，生成测试补充建议
3. **修复失败测试**：自动检测 CI 中的失败测试，尝试修复

## 渐进式建设路径

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| **P0** | 修复 21 个失败单测 + CI test job | 1-2天 |
| **P1** | Playwright 基础设施 + Web 端核心 E2E（登录/日历/待办） | 3-5天 |
| **P2** | 组件测试增强（弹窗/设置/视图切换） | 2-3天 |
| **P3** | Tauri 桌面端 E2E（tauri-driver + 托盘/弹窗） | 3-5天 |
| **P4** | Agent 测试生成技能 + 模板 | 2-3天 |

## 现有问题修复

当前 21 个失败测试集中在 SSO 相关 auth repo，根因：
- `auth-store-sso.test.ts`（7 失败）：`wasLoggedIn` 属性不存在、`cleanup` 方法不存在
- `platform/tauri/__tests__/auth.repo.test.ts`（4 失败）：`detectSsoSession`、`notifySsoEvent`、`subscribeSsoEvents` 方法不存在
- `platform/web/__tests__/auth.repo.test.ts`（10 失败）：同上 + `setWasLoggedInGetter` 方法不存在

这些都是测试与实现不同步导致的，P0 阶段需要修复或删除过时测试。
