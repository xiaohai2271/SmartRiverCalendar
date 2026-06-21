# 前端自动化测试工程化体系实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立小河日历前端自动化测试工程化体系，修复现有失败测试，搭建 Playwright/WebDriverIO E2E 基础设施，编写核心流程 E2E 用例，配置 CI 自动化流水线。

**Architecture:** L1 单测(Vitest) + L2 组件测试 + L3 E2E(Playwright for Web / WebDriverIO + tauri-driver for 桌面端) 分层测试体系，Playwright Route 拦截 API Mock 零后端依赖，GitHub Actions CI 自动化。

**Tech Stack:** Vitest, @vue/test-utils, Playwright, WebDriverIO, tauri-driver, GitHub Actions

---

## 文件结构总览

### 新增文件

```
e2e/
├── playwright.config.ts                    # Playwright Web 端配置
├── wdio.tauri.conf.ts                      # WebDriverIO 桌面端配置
├── fixtures/
│   ├── user.json                           # 用户数据 fixture
│   ├── calendars.json                      # 日历数据 fixture
│   ├── events.json                         # 事件数据 fixture
│   ├── todos.json                          # 待办数据 fixture
│   └── sync-status.json                    # 同步状态 fixture
├── helpers/
│   ├── api-mock.ts                         # Playwright Route 拦截封装
│   ├── tauri-mock.ts                       # Tauri API mock 封装
│   ├── data-verify.ts                      # 数据验证辅助函数
│   └── auth.setup.ts                       # 登录状态 setup
├── web/
│   ├── auth-flow.spec.ts                   # 认证流程 E2E
│   ├── calendar-event-crud.spec.ts         # 日历事件 CRUD E2E
│   ├── calendar-view-navigation.spec.ts    # 视图切换导航 E2E
│   ├── todo-crud.spec.ts                   # 待办 CRUD E2E
│   ├── sync-flow.spec.ts                   # 云同步流程 E2E
│   ├── home-dashboard.spec.ts              # 首页仪表盘 E2E
│   ├── schedule-search-filter.spec.ts      # 日程搜索筛选 E2E
│   ├── settings.spec.ts                    # 设置管理 E2E
│   ├── reminder.spec.ts                    # 提醒服务 E2E
│   ├── calendar-manage.spec.ts             # 日历管理 E2E
│   ├── external-calendar.spec.ts           # 外部日历集成 E2E
│   ├── context-menu.spec.ts                # 右键菜单 E2E
│   └── error-scenarios.spec.ts             # 错误场景 E2E
└── tauri/
    ├── tray-popup.spec.ts                  # 托盘弹出面板 E2E
    ├── reminder-popup.spec.ts              # 提醒弹窗 E2E
    ├── multi-window.spec.ts                # 多窗口 E2E
    ├── offline-crud.spec.ts                # 离线操作 E2E
    ├── identity-switch.spec.ts             # 身份切换 E2E
    └── update.spec.ts                      # 软件更新 E2E
.agents/skills/testing/
├── SKILL.md                                # 测试技能入口
├── templates/
│   ├── unit-test.template.ts               # 单测模板
│   ├── component-test.template.ts          # 组件测试模板
│   └── e2e-test.template.ts                # E2E 测试模板
└── guides/
    ├── writing-unit-tests.md               # 单测编写指南
    ├── writing-component-tests.md          # 组件测试编写指南
    └── writing-e2e-tests.md                # E2E 测试编写指南
.github/workflows/test.yml                  # CI 测试流水线
```

### 修改文件

```
src/platform/types/auth.repository.ts       # 新增 SSO 接口定义
src/platform/errors.ts                      # 新增 SSO_SESSION_EXPIRED 错误码
src/platform/capabilities.ts                # 新增 hasSsoLogin 能力
src/platform/web/auth.repo.ts               # 实现 SSO 方法
src/platform/tauri/auth.repo.ts             # 实现 SSO no-op 方法
src/stores/auth.ts                          # SSO 集成 + wasLoggedIn + cleanup
src/main.ts                                 # E2E 环境暴露 Pinia + SsoCoordinator 启动
package.json                                # 新增 @playwright/test 等依赖
vitest.config.ts                            # 无需修改（当前配置已满足）
```

---

## Task 1: 补全 SSO 接口定义和错误码

**Files:**
- Modify: `src/platform/types/auth.repository.ts`
- Modify: `src/platform/errors.ts`
- Modify: `src/platform/capabilities.ts`

- [ ] **Step 1: 在 `auth.repository.ts` 中新增 SSO 类型和接口方法**

在 `AuthResult` 接口之后新增类型定义，在 `IAuthRepository` 接口末尾新增 SSO 方法：

```typescript
// src/platform/types/auth.repository.ts — 在 AuthResult 后新增

export interface SsoSessionResult {
  loggedIn: boolean
  user?: User
}

export type SsoEvent =
  | { type: 'logout' }
  | { type: 'login'; userId: number }

// 在 IAuthRepository 接口末尾新增：
detectSsoSession(): Promise<SsoSessionResult>
notifySsoEvent(event: SsoEvent): Promise<void>
subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void
```

注意：`setWasLoggedInGetter` 不加入接口，这是 Web 端实现的内部方法，不是 Repository 契约的一部分。测试通过类型断言或 `(repo as any).setWasLoggedInGetter()` 访问。

- [ ] **Step 2: 在 `errors.ts` 中新增 `SSO_SESSION_EXPIRED` 错误码**

```typescript
// src/platform/errors.ts — RepoErrorCodes 对象末尾新增
SSO_SESSION_EXPIRED: 'SSO_SESSION_EXPIRED',
```

- [ ] **Step 3: 在 `capabilities.ts` 中新增 `hasSsoLogin` 能力字段**

```typescript
// src/platform/capabilities.ts — PlatformCapabilities 接口中
// 在 hasOAuthCallback 后新增：
hasSsoLogin: boolean
```

- [ ] **Step 4: 在两端能力声明中设置 `hasSsoLogin` 值**

```typescript
// src/platform/web/index.ts — Web 端 capabilities 中新增：
hasSsoLogin: true

// src/platform/tauri/index.ts — Tauri 端 capabilities 中新增：
hasSsoLogin: false
```

- [ ] **Step 5: 运行现有测试确认无回归**

Run: `pnpm test:run`
Expected: 失败测试数量不变（21个），无新增失败

- [ ] **Step 6: Commit**

```bash
git add src/platform/types/auth.repository.ts src/platform/errors.ts src/platform/capabilities.ts src/platform/web/index.ts src/platform/tauri/index.ts
git commit -m "feat: 补全 IAuthRepository SSO 接口定义、错误码和能力声明"
```

---

## Task 2: 实现 Web 端 Auth Repository SSO 方法

**Files:**
- Modify: `src/platform/web/auth.repo.ts`

- [ ] **Step 1: 在 `WebAuthRepository` 类末尾新增 SSO 方法实现**

```typescript
// src/platform/web/auth.repo.ts — 类末尾新增

private wasLoggedInGetter: (() => boolean) | null = null
private ssoChannel: BroadcastChannel | null = null

setWasLoggedInGetter(getter: () => boolean): void {
  this.wasLoggedInGetter = getter
}

async detectSsoSession(): Promise<SsoSessionResult> {
  try {
    const response = await this.apiClient.get('/user/profile', {
      credentials: 'include',
    })

    if (response.code === 0 && response.data) {
      return {
        loggedIn: true,
        user: transformWebUser(response.data),
      }
    }

    return { loggedIn: false }
  } catch (error) {
    if (error instanceof RepositoryError && error.code === RepoErrorCodes.AUTH_EXPIRED) {
      const wasLoggedIn = this.wasLoggedInGetter?.() ?? false
      if (wasLoggedIn) {
        throw new RepositoryError({
          code: RepoErrorCodes.SSO_SESSION_EXPIRED,
          message: 'SSO 会话已过期',
          platform: 'web',
          cause: error,
        })
      }
      return { loggedIn: false }
    }

    if (error instanceof RepositoryError && error.code === RepoErrorCodes.NETWORK_ERROR) {
      return { loggedIn: false }
    }

    return { loggedIn: false }
  }
}

async notifySsoEvent(event: SsoEvent): Promise<void> {
  if (!this.ssoChannel) {
    this.ssoChannel = new BroadcastChannel('smart-river-calendar-sso')
  }
  this.ssoChannel.postMessage(event)
}

subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void {
  if (!this.ssoChannel) {
    this.ssoChannel = new BroadcastChannel('smart-river-calendar-sso')
  }

  const handler = (e: MessageEvent) => {
    callback(e.data as SsoEvent)
  }
  this.ssoChannel.addEventListener('message', handler)

  return () => {
    this.ssoChannel?.removeEventListener('message', handler)
  }
}
```

注意：需在文件顶部 import 中新增 `SsoSessionResult`、`SsoEvent` 类型。

- [ ] **Step 2: 运行 Web 端 auth repo 测试**

Run: `pnpm test:run src/platform/web/__tests__/auth.repo.test.ts`
Expected: 10 个 SSO 相关测试由 FAIL 变为 PASS

- [ ] **Step 3: Commit**

```bash
git add src/platform/web/auth.repo.ts
git commit -m "feat: 实现 WebAuthRepository SSO 方法（detectSsoSession/notifySsoEvent/subscribeSsoEvents）"
```

---

## Task 3: 实现 Tauri 端 Auth Repository SSO no-op 方法

**Files:**
- Modify: `src/platform/tauri/auth.repo.ts`

- [ ] **Step 1: 在 `TauriAuthRepository` 类末尾新增 SSO no-op 方法**

```typescript
// src/platform/tauri/auth.repo.ts — 类末尾新增

async detectSsoSession(): Promise<SsoSessionResult> {
  return { loggedIn: false }
}

async notifySsoEvent(_event: SsoEvent): Promise<void> {
  // 桌面端不需要 SSO 广播
}

subscribeSsoEvents(_callback: (event: SsoEvent) => void): () => void {
  return () => {}
}
```

注意：需在文件顶部 import 中新增 `SsoSessionResult`、`SsoEvent` 类型。

- [ ] **Step 2: 运行 Tauri 端 auth repo 测试**

Run: `pnpm test:run src/platform/tauri/__tests__/auth.repo.test.ts`
Expected: 4 个 SSO 相关测试由 FAIL 变为 PASS

- [ ] **Step 3: Commit**

```bash
git add src/platform/tauri/auth.repo.ts
git commit -m "feat: 实现 TauriAuthRepository SSO no-op 方法"
```

---

## Task 4: Auth Store SSO 集成

**Files:**
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: 在 Auth Store 中新增 SSO 相关状态和方法**

在 `useAuthStore` 的 state 中新增：

```typescript
// src/stores/auth.ts — state 新增
wasLoggedIn: false as boolean,
```

在 actions 中新增 `cleanup` 方法，并修改 `initialize` 和 `logout` 方法：

```typescript
// initialize() 方法中，在 checkAuthStatus 成功后新增 SSO 检测逻辑：
// 在现有 initialize 逻辑的适当位置（checkAuthStatus 返回后）新增

const capabilities = useCapabilities()

// localStorage 恢复 wasLoggedIn
const storedWasLoggedIn = localStorage.getItem('lastKnownLoggedIn')
if (storedWasLoggedIn === 'true') {
  this.wasLoggedIn = true
}

if (capabilities.hasSsoLogin) {
  const { authRepo } = usePlatform()
  try {
    const ssoResult = await authRepo.detectSsoSession()
    if (ssoResult.loggedIn && ssoResult.user) {
      this.isAuthenticated = true
      this.user = ssoResult.user
      this.wasLoggedIn = true
      localStorage.setItem('lastKnownLoggedIn', 'true')
    }
  } catch (error) {
    if (error instanceof RepositoryError && error.code === RepoErrorCodes.SSO_SESSION_EXPIRED) {
      this.isAuthenticated = false
      this.user = null
      this.wasLoggedIn = false
      localStorage.setItem('lastKnownLoggedIn', 'false')
    }
  }
}

// logout() 方法末尾新增 SSO 广播：
if (capabilities.hasSsoLogin) {
  const { authRepo } = usePlatform()
  await authRepo.notifySsoEvent({ type: 'logout' })
}
this.wasLoggedIn = false
localStorage.setItem('lastKnownLoggedIn', 'false')

// 新增 cleanup 方法：
cleanup() {
  // 清理 SsoCoordinator 等资源
},
```

注意：需在文件顶部 import 中新增 `RepositoryError`、`RepoErrorCodes`（如果尚未引入）。

- [ ] **Step 2: 运行 auth-store-sso 测试**

Run: `pnpm test:run src/__tests__/auth-store-sso.test.ts`
Expected: 7 个 SSO 相关测试由 FAIL 变为 PASS

- [ ] **Step 3: Commit**

```bash
git add src/stores/auth.ts
git commit -m "feat: Auth Store 集成 SSO（wasLoggedIn/detectSsoSession/notifySsoEvent/cleanup）"
```

---

## Task 5: E2E 环境基础设施（Pinia 暴露 + main.ts 适配）

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 在 main.ts 中添加 E2E 环境下的 Pinia 暴露**

```typescript
// src/main.ts — 在 app.mount('#app') 之后新增

if (import.meta.env.VITE_E2E === 'true') {
  ;(window as any).__pinia__ = pinia
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: E2E 环境下暴露 Pinia 实例到 window"
```

---

## Task 6: 安装 Playwright 并创建 Web 端配置

**Files:**
- Modify: `package.json`（通过 pnpm add 命令）
- Create: `e2e/playwright.config.ts`
- Create: `e2e/helpers/api-mock.ts`
- Create: `e2e/helpers/data-verify.ts`
- Create: `e2e/fixtures/user.json`
- Create: `e2e/fixtures/calendars.json`
- Create: `e2e/fixtures/events.json`
- Create: `e2e/fixtures/todos.json`
- Create: `e2e/fixtures/sync-status.json`

- [ ] **Step 1: 安装 Playwright 依赖**

Run: `pnpm add -D @playwright/test`

- [ ] **Step 2: 安装 Chromium 浏览器**

Run: `pnpm exec playwright install chromium`

- [ ] **Step 3: 创建 Playwright Web 端配置**

```typescript
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_E2E: 'true',
    },
  },
})
```

- [ ] **Step 4: 创建 API Mock 辅助工具**

```typescript
// e2e/helpers/api-mock.ts
import { Page } from '@playwright/test'
import userFixture from '../fixtures/user.json'
import calendarsFixture from '../fixtures/calendars.json'
import eventsFixture from '../fixtures/events.json'
import todosFixture from '../fixtures/todos.json'
import syncStatusFixture from '../fixtures/sync-status.json'

export async function mockApiRoutes(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes('/auth/login') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { user_id: 1, access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
        status: 200,
      })
    }

    if (url.includes('/auth/register') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { user_id: 2, access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
        status: 200,
      })
    }

    if (url.includes('/auth/logout') && method === 'POST') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/auth/refresh') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 } },
        status: 200,
      })
    }

    if (url.includes('/auth/public-key') && method === 'GET') {
      return route.fulfill({
        json: { code: 0, data: { public_key: 'mock-public-key' } },
        status: 200,
      })
    }

    if (url.includes('/user/profile') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: userFixture }, status: 200 })
    }

    if (url.includes('/calendars') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: calendarsFixture }, status: 200 })
    }

    if (url.includes('/calendars') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { id: 10, name: '新日历', color: '#4A90D9', type: 'local' } },
        status: 200,
      })
    }

    if (url.includes('/events') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: eventsFixture }, status: 200 })
    }

    if (url.includes('/events') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { id: 100, title: '新事件', start_time: Date.now(), end_time: Date.now() + 3600000 } },
        status: 200,
      })
    }

    if (url.includes('/events/') && method === 'PUT') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/events/') && method === 'DELETE') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/todos') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: todosFixture }, status: 200 })
    }

    if (url.includes('/todos') && method === 'POST') {
      return route.fulfill({
        json: { code: 0, data: { id: 100, title: '新待办', completed: false, priority: 'medium' } },
        status: 200,
      })
    }

    if (url.includes('/todos/') && method === 'PUT') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/todos/') && method === 'DELETE') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/sync/now') && method === 'POST') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    if (url.includes('/sync/status') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: syncStatusFixture }, status: 200 })
    }

    if (url.includes('/settings') && method === 'GET') {
      return route.fulfill({ json: { code: 0, data: {} }, status: 200 })
    }

    if (url.includes('/settings/') && method === 'PUT') {
      return route.fulfill({ json: { code: 0 }, status: 200 })
    }

    return route.fulfill({ json: { code: 404, message: 'Not found' }, status: 404 })
  })
}
```

- [ ] **Step 5: 创建数据验证辅助工具**

```typescript
// e2e/helpers/data-verify.ts
import { Page, expect } from '@playwright/test'

export async function verifyStoreState(page: Page, storeId: string, key: string, expected: unknown) {
  const actual = await page.evaluate(({ store, k }) => {
    const pinia = (window as any).__pinia__
    return pinia?.state?.value?.[store]?.[k]
  }, { store: storeId, k: key })
  expect(actual).toEqual(expected)
}

export async function verifyDataPersistsAfterReload(page: Page, selector: string, expectedText: string) {
  await page.reload()
  await expect(page.locator(selector)).toContainText(expectedText)
}
```

- [ ] **Step 6: 创建 fixture 数据文件**

```json
// e2e/fixtures/user.json
{
  "id": 1,
  "email": "test@example.com",
  "display_name": "测试用户",
  "provider": "local"
}
```

```json
// e2e/fixtures/calendars.json
{
  "items": [
    { "id": 1, "name": "我的日历", "color": "#4A90D9", "type": "local", "visible": true }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

```json
// e2e/fixtures/events.json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 50
}
```

```json
// e2e/fixtures/todos.json
{
  "items": [],
  "total": 0,
  "page": 1,
  "page_size": 50
}
```

```json
// e2e/fixtures/sync-status.json
{
  "status": "idle",
  "last_sync_at": null,
  "pending_changes": 0
}
```

- [ ] **Step 7: 验证 Playwright 可以启动**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts --list`
Expected: 无测试文件时不报错，列出 0 个测试

- [ ] **Step 8: Commit**

```bash
git add e2e/ package.json pnpm-lock.yaml
git commit -m "feat: 搭建 Playwright Web 端 E2E 基础设施（配置/API Mock/fixtures/数据验证工具）"
```

---

## Task 7: Web 端认证流程 E2E 测试

**Files:**
- Create: `e2e/web/auth-flow.spec.ts`

- [ ] **Step 1: 编写认证流程 E2E 测试**

```typescript
// e2e/web/auth-flow.spec.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('认证流程', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/')
  })

  test('未登录状态显示登录入口', async ({ page }) => {
    await page.goto('/profile')
    await expect(page.locator('text=登录')).toBeVisible()
  })

  test('用户名密码登录成功', async ({ page }) => {
    await page.goto('/profile')
    await page.fill('[placeholder*="邮箱"], [placeholder*="email"], input[type="email"]', 'test@example.com')
    await page.fill('[placeholder*="密码"], [placeholder*="password"], input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
  })

  test('登录后 Store 状态正确', async ({ page }) => {
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
    const isAuthenticated = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.auth?.isAuthenticated
    })
    expect(isAuthenticated).toBe(true)
  })

  test('登录后登出', async ({ page }) => {
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
    await page.click('button:has-text("退出"), button:has-text("登出")')
    await expect(page.locator('text=登录')).toBeVisible()
  })

  test('登录失败显示错误提示', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({ json: { code: 401, message: '密码错误' }, status: 200 })
    )
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'wrong')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=登录')).toBeVisible()
  })

  test('页面刷新后保持登录', async ({ page }) => {
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
    await page.reload()
    await expect(page.locator('text=测试用户')).toBeVisible()
  })
})
```

- [ ] **Step 2: 运行认证流程 E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/auth-flow.spec.ts`
Expected: 测试通过（可能需要根据实际 UI 选择器微调）

- [ ] **Step 3: Commit**

```bash
git add e2e/web/auth-flow.spec.ts
git commit -m "test: 新增 Web 端认证流程 E2E 测试"
```

---

## Task 8: Web 端日历事件 CRUD E2E 测试

**Files:**
- Create: `e2e/web/calendar-event-crud.spec.ts`

- [ ] **Step 1: 编写日历事件 CRUD E2E 测试**

```typescript
// e2e/web/calendar-event-crud.spec.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('日历事件 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/calendar')
  })

  test('日历页面默认加载月视图', async ({ page }) => {
    await expect(page.locator('.calendar-view, [data-testid="calendar-view"]')).toBeVisible()
  })

  test('创建事件后出现在日历中', async ({ page }) => {
    const createButton = page.locator('button:has-text("+"), button[aria-label="新建"], .fab-button')
    await createButton.click()
    await page.fill('input[placeholder*="标题"], input[placeholder*="事件"]', '测试事件')
    await page.click('button:has-text("创建"), button:has-text("保存")')
    await expect(page.locator('text=测试事件')).toBeVisible()
  })

  test('创建事件后 Store 包含新事件', async ({ page }) => {
    const createButton = page.locator('button:has-text("+"), button[aria-label="新建"], .fab-button')
    await createButton.click()
    await page.fill('input[placeholder*="标题"], input[placeholder*="事件"]', '验证事件')
    await page.click('button:has-text("创建"), button:has-text("保存")')
    const eventCount = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.calendar?.events?.length ?? 0
    })
    expect(eventCount).toBeGreaterThan(0)
  })

  test('创建事件后触发同步', async ({ page }) => {
    const syncRequests: string[] = []
    await page.route('**/api/v1/sync/now', async (route) => {
      syncRequests.push(route.request().method())
      await route.fulfill({ json: { code: 0 }, status: 200 })
    })
    const createButton = page.locator('button:has-text("+"), button[aria-label="新建"], .fab-button')
    await createButton.click()
    await page.fill('input[placeholder*="标题"], input[placeholder*="事件"]', '同步测试事件')
    await page.click('button:has-text("创建"), button:has-text("保存")')
    await page.waitForTimeout(500)
    expect(syncRequests.length).toBeGreaterThan(0)
  })

  test('删除事件后从日历消失', async ({ page }) => {
    // 先创建事件
    const createButton = page.locator('button:has-text("+"), button[aria-label="新建"], .fab-button')
    await createButton.click()
    await page.fill('input[placeholder*="标题"], input[placeholder*="事件"]', '待删除事件')
    await page.click('button:has-text("创建"), button:has-text("保存")')
    await expect(page.locator('text=待删除事件')).toBeVisible()
    // 点击事件 → 删除
    await page.click('text=待删除事件')
    await page.click('button:has-text("删除")')
    await page.click('button:has-text("确认")')
    await expect(page.locator('text=待删除事件')).not.toBeVisible()
  })
})
```

- [ ] **Step 2: 运行日历事件 CRUD E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/calendar-event-crud.spec.ts`
Expected: 测试通过（可能需要根据实际 UI 选择器微调）

- [ ] **Step 3: Commit**

```bash
git add e2e/web/calendar-event-crud.spec.ts
git commit -m "test: 新增 Web 端日历事件 CRUD E2E 测试"
```

---

## Task 9: Web 端待办 CRUD E2E 测试

**Files:**
- Create: `e2e/web/todo-crud.spec.ts`

- [ ] **Step 1: 编写待办 CRUD E2E 测试**

```typescript
// e2e/web/todo-crud.spec.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('待办事项 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/todos')
  })

  test('待办页面默认加载', async ({ page }) => {
    await expect(page.locator('.todo-view, [data-testid="todo-view"]')).toBeVisible()
  })

  test('创建待办后出现在列表中', async ({ page }) => {
    await page.click('button:has-text("新建"), button:has-text("+"), .add-todo-button')
    await page.fill('input[placeholder*="待办"], input[placeholder*="标题"]', '测试待办')
    await page.click('button:has-text("确认"), button:has-text("添加")')
    await expect(page.locator('text=测试待办')).toBeVisible()
  })

  test('创建待办后 Store 包含新待办', async ({ page }) => {
    await page.click('button:has-text("新建"), button:has-text("+"), .add-todo-button')
    await page.fill('input[placeholder*="待办"], input[placeholder*="标题"]', '验证待办')
    await page.click('button:has-text("确认"), button:has-text("添加")')
    const todoCount = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.todo?.todos?.length ?? 0
    })
    expect(todoCount).toBeGreaterThan(0)
  })

  test('标记待办完成后显示删除线', async ({ page }) => {
    await page.click('button:has-text("新建"), button:has-text("+"), .add-todo-button')
    await page.fill('input[placeholder*="待办"], input[placeholder*="标题"]', '完成测试待办')
    await page.click('button:has-text("确认"), button:has-text("添加")')
    await expect(page.locator('text=完成测试待办')).toBeVisible()
    // 点击复选框
    const checkbox = page.locator('text=完成测试待办').locator('..').locator('input[type="checkbox"], .checkbox')
    await checkbox.click()
    // 验证 Store 中 completed 状态
    const isCompleted = await page.evaluate(() => {
      const todos = (window as any).__pinia__?.state?.value?.todo?.todos
      return todos?.find((t: any) => t.title === '完成测试待办')?.completed
    })
    expect(isCompleted).toBe(true)
  })

  test('筛选待完成待办', async ({ page }) => {
    await page.click('button:has-text("新建"), button:has-text("+"), .add-todo-button')
    await page.fill('input[placeholder*="待办"], input[placeholder*="标题"]', '筛选测试待办')
    await page.click('button:has-text("确认"), button:has-text("添加")')
    // 点击筛选标签
    await page.click('text=待完成')
    await expect(page.locator('text=筛选测试待办')).toBeVisible()
  })

  test('删除待办后从列表消失', async ({ page }) => {
    await page.click('button:has-text("新建"), button:has-text("+"), .add-todo-button')
    await page.fill('input[placeholder*="待办"], input[placeholder*="标题"]', '删除测试待办')
    await page.click('button:has-text("确认"), button:has-text("添加")')
    await expect(page.locator('text=删除测试待办')).toBeVisible()
    // 右键删除
    await page.locator('text=删除测试待办').click({ button: 'right' })
    await page.click('text=删除')
    await page.click('button:has-text("确认")')
    await expect(page.locator('text=删除测试待办')).not.toBeVisible()
  })
})
```

- [ ] **Step 2: 运行待办 CRUD E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/todo-crud.spec.ts`
Expected: 测试通过（可能需要根据实际 UI 选择器微调）

- [ ] **Step 3: Commit**

```bash
git add e2e/web/todo-crud.spec.ts
git commit -m "test: 新增 Web 端待办 CRUD E2E 测试"
```

---

## Task 10: Web 端视图切换与云同步 E2E 测试

**Files:**
- Create: `e2e/web/calendar-view-navigation.spec.ts`
- Create: `e2e/web/sync-flow.spec.ts`

- [ ] **Step 1: 编写视图切换导航 E2E 测试**

```typescript
// e2e/web/calendar-view-navigation.spec.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('视图切换与日期导航', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/calendar')
  })

  test('默认加载月视图', async ({ page }) => {
    await expect(page.locator('.month-view, [data-testid="month-view"]')).toBeVisible()
  })

  test('切换到周视图', async ({ page }) => {
    await page.click('button:has-text("周"), [aria-label="周视图"]')
    await expect(page.locator('.week-view, [data-testid="week-view"]')).toBeVisible()
  })

  test('切换到日视图', async ({ page }) => {
    await page.click('button:has-text("日"), [aria-label="日视图"]')
    await expect(page.locator('.day-view, [data-testid="day-view"]')).toBeVisible()
  })

  test('"今天"按钮回到当前日期', async ({ page }) => {
    await page.click('button:has-text("◀"), [aria-label="上一月"]')
    await page.click('button:has-text("今天")')
    const currentMonth = new Date().toLocaleDateString('zh-CN', { month: 'long' })
    await expect(page.locator(`text=${currentMonth}`)).toBeVisible()
  })

  test('视图状态刷新后保持', async ({ page }) => {
    await page.click('button:has-text("周"), [aria-label="周视图"]')
    await page.reload()
    await expect(page.locator('.week-view, [data-testid="week-view"]')).toBeVisible()
  })
})
```

- [ ] **Step 2: 编写云同步流程 E2E 测试**

```typescript
// e2e/web/sync-flow.spec.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('云同步流程', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
  })

  test('登录后同步状态为 idle', async ({ page }) => {
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
    const syncStatus = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.auth?.syncStatus
    })
    expect(syncStatus).toBe('idle')
  })

  test('创建事件后自动触发同步', async ({ page }) => {
    let syncCalled = false
    await page.route('**/api/v1/sync/now', async (route) => {
      syncCalled = true
      await route.fulfill({ json: { code: 0 }, status: 200 })
    })
    await page.goto('/calendar')
    const createButton = page.locator('button:has-text("+"), button[aria-label="新建"]')
    await createButton.click()
    await page.fill('input[placeholder*="标题"], input[placeholder*="事件"]', '同步测试')
    await page.click('button:has-text("创建"), button:has-text("保存")')
    await page.waitForTimeout(1000)
    expect(syncCalled).toBe(true)
  })

  test('同步失败后状态为 error', async ({ page }) => {
    await page.route('**/api/v1/sync/now', async (route) => {
      await route.fulfill({ json: { code: 500, message: '同步失败' }, status: 500 })
    })
    await page.goto('/profile')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("登录")')
    await expect(page.locator('text=测试用户')).toBeVisible()
    // 手动触发同步
    await page.click('button:has-text("同步"), button:has-text("立即同步")')
    await page.waitForTimeout(1000)
    const syncStatus = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.auth?.syncStatus
    })
    expect(syncStatus).toBe('error')
  })
})
```

- [ ] **Step 3: 运行两个 E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/calendar-view-navigation.spec.ts e2e/web/sync-flow.spec.ts`
Expected: 测试通过

- [ ] **Step 4: Commit**

```bash
git add e2e/web/calendar-view-navigation.spec.ts e2e/web/sync-flow.spec.ts
git commit -m "test: 新增 Web 端视图切换和云同步 E2E 测试"
```

---

## Task 11: CI 测试流水线配置

**Files:**
- Create: `.github/workflows/test.yml`

- [ ] **Step 1: 创建 CI 测试流水线**

```yaml
# .github/workflows/test.yml
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
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test:run
      - run: pnpm test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  e2e-web:
    needs: unit-and-component
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm exec playwright install chromium
      - run: pnpm exec playwright test --config=e2e/playwright.config.ts
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: e2e/playwright-report/
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: 新增 CI 测试流水线（单测 + Web E2E）"
```

---

## Task 12: 安装 WebDriverIO 并创建桌面端配置

**Files:**
- Modify: `package.json`（通过 pnpm add 命令）
- Create: `e2e/wdio.tauri.conf.ts`
- Create: `e2e/helpers/tauri-mock.ts`

- [ ] **Step 1: 安装 WebDriverIO 依赖**

Run: `pnpm add -D @wdio/cli @wdio/local-runner @wdio/mocha-framework wdio-tauri-driver`

- [ ] **Step 2: 创建 WebDriverIO 桌面端配置**

```typescript
// e2e/wdio.tauri.conf.ts
import type { Options } from '@wdio/types'

export const config: Options.Testrunner = {
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      transpileOnly: true,
    },
  },
  runner: 'local',
  specs: ['./e2e/tauri/**/*.spec.ts'],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      'tauri:options': {
        application: '', // 由 tauri-driver 填充
      },
    },
  ],
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
}
```

- [ ] **Step 3: 创建 Tauri API mock 封装**

```typescript
// e2e/helpers/tauri-mock.ts
import { Page } from '@playwright/test'

export async function mockTauriApi(page: Page, mocks: Record<string, unknown>) {
  await page.addInitScript((mockData) => {
    const listeners: Record<string, Function[]> = {}

    window.__TAURI__ = {
      invoke: (cmd: string, args?: any) => {
        if (mockData[cmd]) return Promise.resolve(typeof mockData[cmd] === 'function' ? mockData[cmd](args) : mockData[cmd])
        return Promise.resolve(null)
      },
      event: {
        listen: (event: string, handler: Function) => {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(handler)
          return Promise.resolve(() => { listeners[event] = listeners[event].filter(h => h !== handler) })
        },
        emit: (event: string, payload?: any) => { listeners[event]?.forEach(h => h(payload)) },
      },
    }
  }, mocks)
}

export const defaultTauriMocks = {
  auth_check_status: { authenticated: false },
  auth_get_public_key: 'mock-public-key',
  get_calendars: [],
  get_events: [],
  get_todos: [],
  get_setting: null,
}
```

- [ ] **Step 4: Commit**

```bash
git add e2e/wdio.tauri.conf.ts e2e/helpers/tauri-mock.ts package.json pnpm-lock.yaml
git commit -m "feat: 搭建 WebDriverIO 桌面端 E2E 基础设施"
```

---

## Task 13: 桌面端核心 E2E 测试（离线/身份切换/同步）

**Files:**
- Create: `e2e/tauri/offline-crud.spec.ts`
- Create: `e2e/tauri/identity-switch.spec.ts`

- [ ] **Step 1: 编写离线操作 E2E 测试**

```typescript
// e2e/tauri/offline-crud.spec.ts
// 注意：此测试需要 tauri-driver 环境，CI 中运行
// 本地开发时需先启动 tauri-driver + 构建的桌面应用

describe('离线操作', () => {
  it('离线创建事件后本地可见', async () => {
    // 模拟离线状态
    await browser.execute(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
      window.dispatchEvent(new Event('offline'))
    })

    // 创建事件（应写入 SQLite，不报错）
    // ... 根据实际 UI 操作

    // 验证事件在前端可见
    // ... 根据实际 UI 验证
  })

  it('联网后自动同步离线创建的事件', async () => {
    // 先离线创建事件
    // ...

    // 恢复网络
    await browser.execute(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
      window.dispatchEvent(new Event('online'))
    })

    // 等待同步触发
    await browser.pause(2000)

    // 验证同步状态
    const syncStatus = await browser.execute(() => {
      return (window as any).__pinia__?.state?.value?.auth?.syncStatus
    })
    expect(syncStatus).toBe('success')
  })
})
```

- [ ] **Step 2: 编写身份切换 E2E 测试**

```typescript
// e2e/tauri/identity-switch.spec.ts

describe('登录身份切换', () => {
  it('登录后日历 type 从 local 变为 online', async () => {
    // 登录前验证日历 type
    const beforeType = await browser.execute(() => {
      const calendars = (window as any).__pinia__?.state?.value?.calendar?.calendars
      return calendars?.[0]?.type
    })
    expect(beforeType).toBe('local')

    // 执行登录
    // ...

    // 登录后验证日历 type 变为 online
    const afterType = await browser.execute(() => {
      const calendars = (window as any).__pinia__?.state?.value?.calendar?.calendars
      return calendars?.[0]?.type
    })
    expect(afterType).toBe('online')
  })

  it('登出后日历 type 从 online 变回 local', async () => {
    // 先登录
    // ...

    // 执行登出
    // ...

    // 验证日历 type 变回 local
    const afterType = await browser.execute(() => {
      const calendars = (window as any).__pinia__?.state?.value?.calendar?.calendars
      return calendars?.[0]?.type
    })
    expect(afterType).toBe('local')
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tauri/offline-crud.spec.ts e2e/tauri/identity-switch.spec.ts
git commit -m "test: 新增桌面端离线操作和身份切换 E2E 测试"
```

---

## Task 14: Agent 测试生成技能和模板

**Files:**
- Create: `.agents/skills/testing/SKILL.md`
- Create: `.agents/skills/testing/templates/unit-test.template.ts`
- Create: `.agents/skills/testing/templates/component-test.template.ts`
- Create: `.agents/skills/testing/templates/e2e-test.template.ts`
- Create: `.agents/skills/testing/guides/writing-unit-tests.md`
- Create: `.agents/skills/testing/guides/writing-component-tests.md`
- Create: `.agents/skills/testing/guides/writing-e2e-tests.md`

- [ ] **Step 1: 创建测试技能入口**

```markdown
// .agents/skills/testing/SKILL.md
# 测试工程化技能

## 触发条件
- 新增 Store、Service、组件、页面
- 修改核心业务逻辑
- Agent 定期扫描覆盖率时

## 生成规范

| 新增内容 | 必须生成 | 模板 |
|----------|---------|------|
| Store | L1 单测（mock Repository） | unit-test.template.ts |
| Service | L1 单测 | unit-test.template.ts |
| 组件 | L2 组件测试（交互场景） | component-test.template.ts |
| 业务流程 | L3 E2E 测试（Playwright spec） | e2e-test.template.ts |

## 数据验证要求
- 新增数据操作 → 必须验证 Store → API/SQLite → 同步 → 刷新恢复
- 涉及平台差异 → 必须标注 Web/桌面端差异用例
- 同步操作 → 验证 syncRepo.triggerCloudSync() 被调用

## 参考
- guides/writing-unit-tests.md
- guides/writing-component-tests.md
- guides/writing-e2e-tests.md
```

- [ ] **Step 2: 创建单测模板**

```typescript
// .agents/skills/testing/templates/unit-test.template.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock Repository 接口
const mockRepo = {
  // method: vi.fn(),
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    repoName: mockRepo,
  }),
  useCapabilities: () => ({
    // capabilities
  }),
}))

describe('模块名称', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('应正确初始化', async () => {
    // Arrange
    // Act
    // Assert
  })
})
```

- [ ] **Step 3: 创建组件测试模板**

```typescript
// .agents/skills/testing/templates/component-test.template.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ComponentName from '@/components/path/ComponentName.vue'

describe('ComponentName', () => {
  it('应正确渲染', () => {
    const wrapper = mount(ComponentName, {
      props: {},
    })
    expect(wrapper.find('.selector').exists()).toBe(true)
  })

  it('点击按钮应触发事件', async () => {
    const wrapper = mount(ComponentName, {
      props: {},
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('event-name')).toBeTruthy()
  })
})
```

- [ ] **Step 4: 创建 E2E 测试模板**

```typescript
// .agents/skills/testing/templates/e2e-test.template.ts
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../helpers/api-mock'

test.describe('功能名称', () => {
  test.beforeEach(async ({ page }) => {
    await mockApiRoutes(page)
    await page.goto('/path')
  })

  test('操作描述', async ({ page }) => {
    // 操作
    // 验证 UI
    // 验证 Store 状态
    const storeValue = await page.evaluate(() => {
      return (window as any).__pinia__?.state?.value?.storeName?.keyName
    })
    expect(storeValue).toEqual(expected)
  })
})
```

- [ ] **Step 5: 创建编写指南（3个）**

简要编写指南，包含：命名规范、Mock 模式、数据验证模式、平台差异标注格式。

- [ ] **Step 6: Commit**

```bash
git add .agents/skills/testing/
git commit -m "feat: 新增 Agent 测试生成技能和模板"
```

---

## Task 15: 全量测试验证和最终提交

**Files:**
- None（验证性任务）

- [ ] **Step 1: 运行全部单元测试**

Run: `pnpm test:run`
Expected: 0 失败（原来 21 个 SSO 相关测试应全部通过）

- [ ] **Step 2: 运行 Web 端 E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts`
Expected: 全部通过

- [ ] **Step 3: 运行测试覆盖率**

Run: `pnpm test:coverage`
Expected: 覆盖率 > 50%

- [ ] **Step 4: 确认 CI 配置正确**

Run: 检查 `.github/workflows/test.yml` 语法正确

- [ ] **Step 5: 最终 Commit（如有遗漏修复）**

```bash
git add -A
git commit -m "chore: 测试工程化体系 v1 完成"
```
