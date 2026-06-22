# 前端自动化测试工程化体系实施计划（v2 — 评审修订版）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立小河日历前端自动化测试工程化体系，修复 SSO 代码中的架构问题，补全 data-testid 标注，增强现有 E2E 基础设施和测试覆盖率，完善 CI 自动化流水线。

**Architecture:** L1 单测(Vitest) + L2 组件测试 + L3 E2E(Playwright for Web / WebDriverIO + @crabnebula/tauri-driver for 桌面端) 分层测试体系，Playwright Route 拦截 API Mock 零后端依赖，GitHub Actions CI 自动化。

**Tech Stack:** Vitest, @vue/test-utils, Playwright, WebDriverIO, @crabnebula/tauri-driver, GitHub Actions

**评审修订说明：** 本计划经过三方评审（计划完整性 + SSO 架构 + E2E 技术可行性），修正了 4 个严重问题、9 个中等问题和 5 个轻微问题。原 Task 1-5 代码已全部实现，改为验证+修复任务；E2E 基础设施已存在，改为验证+增强任务。

---

## 现有代码库状态

> 以下内容已在评审中验证，agent 执行时无需重新探查。

| 模块 | 状态 | 文件 |
|------|------|------|
| SSO 接口定义 | ✅ 已实现 | `src/platform/types/auth.repository.ts`（含 SsoSessionResult/SsoEvent/detectSsoSession 等） |
| SSO 错误码 | ✅ 已实现 | `src/platform/errors.ts`（含 SSO_SESSION_EXPIRED） |
| SSO 能力声明 | ✅ 已实现 | `src/platform/capabilities.ts`（含 hasSsoLogin） |
| Web Auth Repo SSO | ✅ 已实现 | `src/platform/web/auth.repo.ts`（202 行，原生 fetch + BroadcastChannel） |
| Tauri Auth Repo SSO | ✅ 已实现 | `src/platform/tauri/auth.repo.ts`（no-op 实现） |
| Auth Store SSO | ✅ 已实现 | `src/stores/auth.ts`（391 行，含 wasLoggedIn/SSO 检测/cleanup） |
| main.ts Pinia 暴露 | ✅ 已实现 | `src/main.ts` 第 58-61 行 |
| Playwright 配置 | ✅ 已存在 | `e2e/playwright.config.ts`（33 行，含 projects/timeout/screenshot） |
| API Mock 工具 | ✅ 已存在 | `e2e/helpers/api-mock.ts`（219 行，模块化 mockAllApi/mockAuthApi 等） |
| WebDriverIO 配置 | ✅ 已存在 | `e2e/wdio.tauri.conf.ts`（37 行，含 tauri:options） |
| Web E2E 测试 | ✅ 已存在 | `e2e/web/`（6 个 spec 文件） |
| Tauri E2E 测试 | ✅ 已存在 | `e2e/tauri/`（3 个 spec 文件，骨架代码） |
| CI 配置 | ✅ 已存在 | `.github/workflows/test.yml`（84 行，pnpm v11 + Node 22 + concurrency） |
| 测试技能模板 | ✅ 已存在 | `.agents/skills/testing/`（7 个文件） |
| data-testid | ⚠️ 部分完成 | 50 处标注覆盖 12 个文件（需扩展 E2E 涉及的组件） |

---

## 文件结构总览

### 新增文件

```
src/composables/usePersistentFlag.ts           # 持久化标志 composable（替代 localStorage 直接操作）
```

### 修改文件

```
src/platform/types/auth.repository.ts         # detectSsoSession 增加 wasLoggedIn 参数
src/platform/capabilities.ts                  # hasSsoLogin → hasSsoSessionDetection
src/platform/errors.ts                        # 无修改（SSO_SESSION_EXPIRED 已存在）
src/platform/web/auth.repo.ts                 # SSO 代码修复：参数传入/错误抛出/常量提取/dispose
src/platform/tauri/auth.repo.ts               # detectSsoSession 签名更新
src/stores/auth.ts                            # SSO 集成修复：composable/能力重命名/网络错误处理
src/platform/web/index.ts                     # hasSsoLogin → hasSsoSessionDetection
src/platform/tauri/index.ts                   # hasSsoLogin → hasSsoSessionDetection
src/__tests__/auth-store-sso.test.ts          # 更新能力名和方法签名引用
e2e/web/*.spec.ts                             # 选择器改用 getByTestId()
e2e/tauri/*.spec.ts                           # 增强测试内容
e2e/helpers/api-mock.ts                       # API_BASE 路径修正（如需要）
.agents/skills/testing/templates/unit-test.template.ts   # 补全动态导入模式
.github/workflows/test.yml                    # E2E 和单测并行 + 桌面端 E2E 占位
```

### 需补全 data-testid 的组件

```
src/components/reminder/ReminderPopup.vue      # 提醒弹窗
src/components/popup/PopupCalendarGrid.vue     # 精简日历网格
src/components/popup/PopupDateInfo.vue         # 精简日期信息
src/views/CalendarPopupView.vue               # 精简面板视图
src/views/ReminderPopupView.vue               # 提醒弹窗视图
src/views/ScheduleView.vue                    # 日程视图
src/views/AboutView.vue                       # 关于页面
src/components/home/                          # 首页组件（按需）
```

---

## Task 0: 补全核心组件 data-testid 标注

**前置条件：** 无。本 Task 是后续 E2E 测试的必要前提。

**Files:**
- Modify: 多个组件/视图文件（见上方"需补全 data-testid 的组件"列表）

- [ ] **Step 1: 读取 data-testid 规范**

读取 `.agents/skills/data-testid-guide/SKILL.md`，理解命名规范（`btn-动作`、`xxx-input`、`xxx-modal` 等）和标注清单。

- [ ] **Step 2: 扫描 E2E 测试涉及的所有组件，列出缺失的 data-testid**

对比现有 E2E 测试中的选择器和组件模板，识别以下组件缺失的 data-testid：
1. `src/views/CalendarPopupView.vue` — 精简面板主视图
2. `src/views/ReminderPopupView.vue` — 提醒弹窗主视图
3. `src/views/ScheduleView.vue` — 日程视图
4. `src/views/AboutView.vue` — 关于页面
5. `src/components/reminder/ReminderPopup.vue` — 提醒弹窗组件
6. `src/components/popup/PopupCalendarGrid.vue` — 日历网格
7. `src/components/popup/PopupDateInfo.vue` — 日期信息
8. 其他 E2E 测试交互所需的组件

- [ ] **Step 3: 为缺失组件添加 data-testid 标注**

按 data-testid-guide 规范，为交互元素添加 `data-testid` 属性：
- 按钮：`data-testid="btn-xxx"`
- 输入框：`data-testid="xxx-input"`
- 模态框：`data-testid="xxx-modal"`
- 列表项：`data-testid="xxx-item"`
- 视图容器：`data-testid="xxx-view"`

**注意**：Fluent UI Web Components 使用 Shadow DOM，`data-testid` 必须标注在 Light DOM 的顶层元素上（如组件标签本身或 slot 容器），确保 Playwright `getByTestId()` 能穿透。

- [ ] **Step 4: 运行现有测试确认无回归**

Run: `pnpm test:run`
Expected: 744 个用例全部通过，无新增失败

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/views/
git commit -m "test: 补全核心组件 data-testid 标注（E2E 测试前置）"
```

---

## Task 1: ✅ 已完成 — SSO 接口定义和错误码（验证）

> **状态：已实现。** 以下接口/类型/错误码已存在于代码库中，本 Task 仅做验证。

**Files:**
- `src/platform/types/auth.repository.ts`
- `src/platform/errors.ts`
- `src/platform/capabilities.ts`

- [ ] **Step 1: 验证接口定义**

确认 `auth.repository.ts` 包含：
- `SsoSessionResult` 接口（loggedIn, user?）
- `SsoEvent` 联合类型（logout | login）
- `IAuthRepository.detectSsoSession()` 方法
- `IAuthRepository.notifySsoEvent()` 方法
- `IAuthRepository.subscribeSsoEvents()` 方法

- [ ] **Step 2: 验证错误码**

确认 `errors.ts` 包含 `SSO_SESSION_EXPIRED` 错误码。

- [ ] **Step 3: 验证能力声明**

确认 `capabilities.ts` 包含 `hasSsoLogin: boolean` 能力字段（将在 Task 2 中重命名为 `hasSsoSessionDetection`）。

---

## Task 2: 修复 Web Auth Repo SSO 代码

> **状态：已实现，需修复 4 个问题。** `src/platform/web/auth.repo.ts` 已包含完整 SSO 实现（202 行），但存在架构问题需修正。

**Files:**
- Modify: `src/platform/web/auth.repo.ts`
- Modify: `src/platform/types/auth.repository.ts`（接口签名变更）

### 修复 1: detectSsoSession 增加 wasLoggedIn 参数（替代 setter 注入）

- [ ] **修改 IAuthRepository 接口签名**

```typescript
// src/platform/types/auth.repository.ts
// 原：detectSsoSession(): Promise<SsoSessionResult>
// 改为：
detectSsoSession(wasLoggedIn?: boolean): Promise<SsoSessionResult>
```

- [ ] **修改 WebAuthRepository.detectSsoSession 实现**

```typescript
// src/platform/web/auth.repo.ts

// 删除以下成员：
// private wasLoggedInGetter: (() => boolean) | null = null
// setWasLoggedInGetter(getter: () => boolean): void { this.wasLoggedInGetter = getter }

// 修改 detectSsoSession 方法签名和实现：
async detectSsoSession(wasLoggedIn?: boolean): Promise<SsoSessionResult> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1188/v1'
  try {
    const resp = await fetch(`${baseUrl}/user/profile`, {
      credentials: 'include',
    })
    const data = await resp.json()

    if (resp.ok && data.code === 0 && data.data) {
      return {
        loggedIn: true,
        user: transformWebUser(data.data),
      }
    }

    if (resp.status === 401) {
      // 使用参数替代 getter 回调
      if (wasLoggedIn) {
        throw new RepositoryError({
          code: RepoErrorCodes.SSO_SESSION_EXPIRED,
          message: 'SSO 会话已过期',
          platform: this.platform,
        })
      }
      return { loggedIn: false }
    }

    return { loggedIn: false }
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error
    }
    // 修复：网络错误应重新抛出，让调用方决定是否忽略（而非静默吞掉）
    throw new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: 'SSO 会话检测网络错误',
      platform: this.platform,
      cause: error,
    })
  }
}
```

### 修复 2: 网络错误重新抛出（已包含在修复 1 中）

原代码第 168-169 行静默返回 `{ loggedIn: false }`，现已改为抛出 `NETWORK_ERROR`。

### 修复 3: BroadcastChannel 名称提取为类常量

- [ ] **提取常量并增加 dispose 方法**

```typescript
// src/platform/web/auth.repo.ts — 类内部新增

private static readonly SSO_CHANNEL_NAME = 'smart-river-calendar-sso'
private ssoChannel: BroadcastChannel | null = null

// 修改 notifySsoEvent 和 subscribeSsoEvents 中的硬编码：
// new BroadcastChannel('smart-river-calendar-sso')
// → new BroadcastChannel(WebAuthRepository.SSO_CHANNEL_NAME)

// 新增 dispose 方法：
dispose(): void {
  this.ssoChannel?.close()
  this.ssoChannel = null
}
```

### 修复 4: Tauri Auth Repo 签名同步

- [ ] **同步 Tauri 端签名**

```typescript
// src/platform/tauri/auth.repo.ts
// 原：async detectSsoSession(): Promise<SsoSessionResult>
// 改为：
async detectSsoSession(_wasLoggedIn?: boolean): Promise<SsoSessionResult> {
  return { loggedIn: false }
}
```

- [ ] **运行现有测试确认无回归**

Run: `pnpm test:run`
Expected: 744 通过

- [ ] **Commit**

```bash
git add src/platform/types/auth.repository.ts src/platform/web/auth.repo.ts src/platform/tauri/auth.repo.ts
git commit -m "fix: 修复 WebAuthRepository SSO 代码（参数传入替代 setter/网络错误抛出/常量提取/dispose）"
```

---

## Task 3: ✅ 已完成 — Tauri Auth Repo SSO no-op（验证）

> **状态：已实现。** Task 2 中已同步签名更新，本 Task 仅做验证。

**Files:**
- `src/platform/tauri/auth.repo.ts`

- [ ] **Step 1: 验证 no-op 实现**

确认 Tauri 端 `detectSsoSession`、`notifySsoEvent`、`subscribeSsoEvents` 均为 no-op 实现，且签名已同步。

---

## Task 4: 修复 Auth Store SSO 集成代码

> **状态：已实现，需修复 3 个问题。** `src/stores/auth.ts` 已包含完整 SSO 集成（391 行），但存在架构问题需修正。

**Files:**
- Create: `src/composables/usePersistentFlag.ts`
- Modify: `src/stores/auth.ts`
- Modify: `src/platform/capabilities.ts`
- Modify: `src/platform/web/index.ts`
- Modify: `src/platform/tauri/index.ts`

### 修复 1: localStorage 封装到 composable

- [ ] **创建 usePersistentFlag composable**

```typescript
// src/composables/usePersistentFlag.ts

/**
 * 持久化标志 composable
 * 封装 localStorage 操作，避免 Store 直接操作持久层
 */
export function usePersistentFlag(key: string) {
  const get = (): boolean => localStorage.getItem(key) === 'true'
  const set = (value: boolean): void => localStorage.setItem(key, String(value))
  const clear = (): void => localStorage.removeItem(key)
  return { get, set, clear }
}
```

- [ ] **修改 Auth Store 使用 composable**

```typescript
// src/stores/auth.ts

// 新增 import：
import { usePersistentFlag } from '@/composables/usePersistentFlag'

// 在 defineStore 内部新增：
const wasLoggedInFlag = usePersistentFlag('lastKnownLoggedIn')

// 替换所有 localStorage.getItem/setItem('lastKnownLoggedIn', ...) 调用：
// localStorage.getItem('lastKnownLoggedIn') → wasLoggedInFlag.get()
// localStorage.setItem('lastKnownLoggedIn', 'true') → wasLoggedInFlag.set(true)
// localStorage.setItem('lastKnownLoggedIn', 'false') → wasLoggedInFlag.set(false)
```

### 修复 2: hasSsoLogin → hasSsoSessionDetection

- [ ] **修改能力声明名称**

```typescript
// src/platform/capabilities.ts
// 原：hasSsoLogin: boolean
// 改为：
hasSsoSessionDetection: boolean
// 注释也同步修改：是否支持 SSO 会话检测（Web 端 cookie 跨标签页检测）

// src/platform/web/index.ts
// 原：hasSsoLogin: true
// 改为：hasSsoSessionDetection: true

// src/platform/tauri/index.ts
// 原：hasSsoLogin: false
// 改为：hasSsoSessionDetection: false

// src/stores/auth.ts
// 原：capabilities.hasSsoLogin
// 改为：capabilities.hasSsoSessionDetection
```

### 修复 3: detectSsoSession 调用参数 + 网络错误处理 + cleanup 增强

- [ ] **修改 initialize() 中的 SSO 调用**

```typescript
// src/stores/auth.ts — initialize() 方法中

// 原：const ssoResult = await authRepo.detectSsoSession()
// 改为：传入 wasLoggedIn 参数
const ssoResult = await authRepo.detectSsoSession(wasLoggedIn.value)
```

- [ ] **增加网络错误处理**

```typescript
// initialize() 中 SSO 检测的 catch 块，增加 NETWORK_ERROR 处理：
} catch (ssoError) {
  if (ssoError instanceof RepositoryError && ssoError.code === RepoErrorCodes.SSO_SESSION_EXPIRED) {
    isAuthenticated.value = false
    user.value = null
    wasLoggedIn.value = false
    wasLoggedInFlag.set(false)
  } else if (ssoError instanceof RepositoryError && ssoError.code === RepoErrorCodes.NETWORK_ERROR) {
    // 网络错误，静默忽略（SSO 检测不应阻断应用启动）
    console.warn('[AuthStore] SSO 会话检测网络错误，跳过:', ssoError.message)
  }
}
```

- [ ] **增强 cleanup() 方法**

```typescript
// src/stores/auth.ts
function cleanup(): void {
  // 清理 SSO 资源
  const capabilities = useCapabilities()
  if (capabilities.hasSsoSessionDetection) {
    try {
      const { authRepo } = usePlatform()
      if ('dispose' in authRepo) {
        ;(authRepo as { dispose: () => void }).dispose()
      }
    } catch {
      // 清理失败非致命
    }
  }
}
```

- [ ] **更新相关测试文件**

更新 `src/__tests__/auth-store-sso.test.ts` 中：
- `hasSsoLogin` → `hasSsoSessionDetection`
- `detectSsoSession()` → `detectSsoSession(wasLoggedIn)`
- 删除 `setWasLoggedInGetter` 相关测试（如存在）
- 新增网络错误处理测试

- [ ] **运行全部测试**

Run: `pnpm test:run`
Expected: 全部通过

- [ ] **Commit**

```bash
git add src/composables/usePersistentFlag.ts src/stores/auth.ts src/platform/capabilities.ts src/platform/web/index.ts src/platform/tauri/index.ts src/__tests__/
git commit -m "fix: 修复 Auth Store SSO 集成（composable 封装/能力重命名/网络错误处理/cleanup 增强）"
```

---

## Task 5: ✅ 已完成 — E2E 环境基础设施（验证）

> **状态：已实现。** `src/main.ts` 第 58-61 行已包含 VITE_E2E Pinia 暴露逻辑。

- [ ] **验证 main.ts 中的 Pinia 暴露代码**

```typescript
// 确认以下代码存在于 src/main.ts
if (import.meta.env.VITE_E2E === 'true') {
  ;(window as any).__pinia__ = pinia
}
```

---

## Task 6: 验证/增强现有 Playwright Web 端 E2E 基础设施

> **状态：已存在。** `e2e/` 目录下已有 14 个文件，Playwright 配置、API Mock、fixtures、数据验证工具均已完善。本 Task 做验证和必要增强。

**Files:**
- Verify: `e2e/playwright.config.ts`
- Verify: `e2e/helpers/api-mock.ts`
- Verify: `e2e/helpers/data-verify.ts`
- Verify: `e2e/fixtures/index.ts`

- [ ] **Step 1: 验证 Playwright 配置**

确认 `e2e/playwright.config.ts` 包含：
- `testDir: './web'`
- `baseURL: 'http://localhost:5173'`（与 `vite.config.ts` 的 `server.port: 5173, strictPort: true` 匹配）
- `webServer.command: 'pnpm dev'` + `VITE_E2E: 'true'`
- `projects` 仅 chromium
- `timeout: 60000` + `expect: { timeout: 10000 }`
- `screenshot: 'only-on-failure'`

- [ ] **Step 2: 验证 API Mock 工具**

确认 `e2e/helpers/api-mock.ts` 的模块化设计：
- `mockAllApi()` — 一键 Mock 全部 API
- `mockAuthApi()` / `mockCalendarApi()` / `mockEventApi()` / `mockTodoApi()` / `mockSyncApi()` — 按模块 Mock
- `mockUnauthorized()` / `mockNetworkError()` / `mockServerError()` — 错误场景 Mock
- API_BASE 为 `**/v1`（需验证是否与实际 API 路径匹配）

- [ ] **Step 3: 检查 API_BASE 路径是否需要修正**

当前 `api-mock.ts` 使用 `API_BASE = '**/v1'`，需确认：
- 如果 Vite dev 代理路径是 `/api/v1` → 当前匹配正确，无需修改
- 如果实际 Web API 路径不含 `/v1/` → 需修改为 `**/api`
- 检查 `vite.config.ts` 的 `server.proxy` 配置和 `src/platform/web/api-client.ts` 的 `getApiUrl()` 确认

- [ ] **Step 4: 验证数据验证工具**

确认 `e2e/helpers/data-verify.ts` 可通过 `window.__pinia__` 访问 Store state。

- [ ] **Step 5: 验证 fixtures**

确认 `e2e/fixtures/index.ts` 导出 user/calendar/events/todos/syncStatus 固件。

---

## Task 7: 增强现有 Web 端认证流程 E2E 测试

> **状态：已存在。** `e2e/web/auth-flow.spec.ts`（6,693 bytes）已包含认证流程测试，需将选择器改用 `getByTestId()`。

**Files:**
- Modify: `e2e/web/auth-flow.spec.ts`

- [ ] **Step 1: 读取现有测试，识别需替换的选择器**

将以下类型的选择器替换为 `page.getByTestId()`：
- `page.locator('text=登录')` → `page.getByTestId('btn-login')`（需确认 LoginForm 中的 data-testid）
- `page.fill('input[type="email"]', ...)` → `page.getByTestId('email-input').fill(...)`
- `page.fill('input[type="password"]', ...)` → `page.getByTestId('password-input').fill(...)`
- `page.click('button:has-text("登录")')` → `page.getByTestId('btn-login').click()`

**选择器优先级**：`getByTestId()` > `getByRole()` > `getByText()` > **禁止纯 CSS 选择器**

- [ ] **Step 2: 验证 LoginForm 组件已有对应 data-testid**

确认 `src/components/profile/LoginForm.vue` 中的 data-testid 标注覆盖：登录按钮、邮箱输入框、密码输入框、注册链接等。如缺失，回到 Task 0 补全。

- [ ] **Step 3: 运行 E2E 测试验证**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/auth-flow.spec.ts`
Expected: 测试通过

- [ ] **Step 4: Commit**

```bash
git add e2e/web/auth-flow.spec.ts
git commit -m "test: 增强认证流程 E2E 测试（选择器改用 data-testid）"
```

---

## Task 8: 增强现有 Web 端日历事件 CRUD E2E 测试

> **状态：已存在。** `e2e/web/calendar-event-crud.spec.ts`（4,583 bytes），需改用 data-testid 选择器。

**Files:**
- Modify: `e2e/web/calendar-event-crud.spec.ts`

- [ ] **Step 1: 替换选择器为 getByTestId()**

将 CSS/文本选择器替换为 `page.getByTestId()`。需确认 `CalendarView.vue`（13 个 data-testid）和事件创建组件的标注覆盖。

- [ ] **Step 2: 运行测试验证**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/calendar-event-crud.spec.ts`

- [ ] **Step 3: Commit**

```bash
git add e2e/web/calendar-event-crud.spec.ts
git commit -m "test: 增强日历事件 CRUD E2E 测试（选择器改用 data-testid）"
```

---

## Task 9: 增强现有 Web 端待办 CRUD E2E 测试

> **状态：已存在。** `e2e/web/todo-crud.spec.ts`（4,410 bytes），需改用 data-testid 选择器。

**Files:**
- Modify: `e2e/web/todo-crud.spec.ts`

- [ ] **Step 1: 替换选择器为 getByTestId()**

需确认 `TodosView.vue`（11 个 data-testid）的标注覆盖。

- [ ] **Step 2: 运行测试验证**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/todo-crud.spec.ts`

- [ ] **Step 3: Commit**

```bash
git add e2e/web/todo-crud.spec.ts
git commit -m "test: 增强待办 CRUD E2E 测试（选择器改用 data-testid）"
```

---

## Task 10: 增强现有视图切换与云同步 E2E 测试

> **状态：已存在。** `e2e/web/calendar-view-navigation.spec.ts`（2,416 bytes）+ `e2e/web/sync-flow.spec.ts`（1,966 bytes），需改用 data-testid 选择器。

**Files:**
- Modify: `e2e/web/calendar-view-navigation.spec.ts`
- Modify: `e2e/web/sync-flow.spec.ts`

- [ ] **Step 1: 替换视图切换测试中的选择器**

视图切换按钮应使用 `getByTestId('btn-week-view')` / `getByTestId('btn-day-view')` 等。

- [ ] **Step 2: 替换同步流程测试中的选择器**

- [ ] **Step 3: 运行测试验证**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts e2e/web/calendar-view-navigation.spec.ts e2e/web/sync-flow.spec.ts`

- [ ] **Step 4: Commit**

```bash
git add e2e/web/calendar-view-navigation.spec.ts e2e/web/sync-flow.spec.ts
git commit -m "test: 增强视图切换和云同步 E2E 测试（选择器改用 data-testid）"
```

---

## Task 11: 验证/增强 CI 测试流水线

> **状态：已存在。** `.github/workflows/test.yml`（84 行）已包含完善的单测 + Web E2E 配置。本 Task 做验证和增强。

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: 验证现有 CI 配置**

确认包含：
- `pnpm/action-setup@v4` + `version: 11`
- `actions/setup-node@v4` + `node-version: 22`
- `concurrency` 控制
- `pnpm install --frozen-lockfile`
- 单测 job + Web E2E job
- artifact 上传（coverage + playwright-report）

- [ ] **Step 2: 增强 — E2E 和单测改为并行运行**

```yaml
# 移除 e2e-web-tests job 的 needs: unit-tests
# 原因：E2E 反馈周期不应被单测阻塞，两者独立运行独立报告
jobs:
  e2e-web-tests:
    name: Web 端 E2E (Playwright)
    runs-on: windows-latest
    # 删除：needs: unit-tests
```

- [ ] **Step 3: 增强 — 添加桌面端 E2E 占位 job**

```yaml
  # 桌面端 E2E 暂不可行（需要 tauri-driver + 构建桌面应用），添加占位 job
  e2e-tauri-tests:
    name: 桌面端 E2E (WebDriverIO) — 暂未启用
    runs-on: windows-latest
    if: false  # 手动启用
    steps:
      - run: echo "桌面端 E2E 测试需要 tauri-driver 和构建好的桌面应用，暂未配置"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: 增强 CI 流水线（E2E 和单测并行 + 桌面端 E2E 占位）"
```

---

## Task 12: 验证/增强 WebDriverIO 桌面端配置

> **状态：已存在。** `e2e/wdio.tauri.conf.ts`（37 行）已配置，但缺少 `@crabnebula/tauri-driver` 依赖。

**Files:**
- Verify: `e2e/wdio.tauri.conf.ts`
- Modify: `package.json`（通过 pnpm add）

- [ ] **Step 1: 安装正确的 tauri-driver 依赖**

```bash
# 注意：原计划中的 wdio-tauri-driver 在 npm 上不存在
# 正确的包是 @crabnebula/tauri-driver（由 CrabNebula 官方维护）
pnpm add -D @crabnebula/tauri-driver
```

- [ ] **Step 2: 验证 wdio.tauri.conf.ts 配置**

确认包含：
- `specs: ['./tauri/**/*.spec.ts']`
- `capabilities` 含 `tauri:options`
- `services: ['tauri']`
- `framework: 'mocha'`

- [ ] **Step 3: 更新 package.json 的 e2e:tauri 脚本（如需要）**

确保 `e2e:tauri` 脚本能正确启动 tauri-driver。

- [ ] **Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: 安装 @crabnebula/tauri-driver 替代不存在的 wdio-tauri-driver"
```

---

## Task 13: 增强桌面端 E2E 测试（v2 迭代）

> **状态：骨架代码。** `e2e/tauri/` 下已有 3 个 spec 文件，但内容较为简略。桌面端 E2E 依赖 tauri-driver + 构建好的桌面应用，CI 中暂不可行，标记为 v2 迭代。

**Files:**
- Verify: `e2e/tauri/offline-crud.spec.ts`
- Verify: `e2e/tauri/reminder-popup.spec.ts`
- Verify: `e2e/tauri/tray-popup.spec.ts`

- [ ] **Step 1: 验证现有桌面端 E2E 测试结构**

读取 3 个 spec 文件，确认测试结构基本正确。

- [ ] **Step 2: 确认本地运行前置条件**

桌面端 E2E 本地运行需要：
1. 构建桌面应用：`pnpm tauri:build`
2. 启动 tauri-driver
3. 运行测试：`pnpm e2e:tauri`

在 Task 步骤中记录此前置条件。

- [ ] **Step 3: 本 Task 标记为 v2 迭代，不阻塞主线**

如需增强测试内容（补充 `// ...` 占位的实际操作步骤），在后续迭代中完成。

---

## Task 14: 验证/增强测试技能模板

> **状态：已存在。** `.agents/skills/testing/` 下已有 7 个文件（SKILL.md + 3 guides + 3 templates），需验证并增强。

**Files:**
- Verify: `.agents/skills/testing/SKILL.md`
- Verify: `.agents/skills/testing/guides/`
- Modify: `.agents/skills/testing/templates/unit-test.template.ts`

- [ ] **Step 1: 验证测试技能文档结构**

确认 7 个文件存在且内容完整。

- [ ] **Step 2: 增强 unit-test.template.ts — 补全动态导入模式**

现有最佳实践：Store 测试需使用动态导入避免 mock 失效：

```typescript
// .agents/skills/testing/templates/unit-test.template.ts — 补充说明

// ⚠️ 重要：Store 模块必须使用动态导入，确保 mock 在 store 加载前生效
// 正确：
const { useXxxStore } = await import('../stores/xxx')
// 错误（mock 可能失效）：
import { useXxxStore } from '../stores/xxx'
```

- [ ] **Step 3: 增强 unit-test.template.ts — 补全完整 mock 骨架**

```typescript
// 模板中的 vi.mock('@/platform/provider') 应返回完整的 repo 和 capabilities 对象：
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    authRepo: { /* 完整 mock 方法 */ },
    calendarRepo: { /* 完整 mock 方法 */ },
    eventRepo: { /* 完整 mock 方法 */ },
    todoRepo: { /* 完整 mock 方法 */ },
    settingsRepo: { /* 完整 mock 方法 */ },
    syncRepo: { /* 完整 mock 方法 */ },
  }),
  useCapabilities: () => ({
    hasLocalDatabase: false,
    hasOfflineMode: false,
    hasSsoSessionDetection: false,
    // ... 其他能力
  }),
}))
```

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/testing/
git commit -m "docs: 增强测试技能模板（动态导入模式 + 完整 mock 骨架）"
```

---

## Task 15: 全量测试验证

- [ ] **Step 1: 运行全部单元测试**

Run: `pnpm test:run`
Expected: 全部通过

- [ ] **Step 2: 运行 Web 端 E2E 测试**

Run: `pnpm exec playwright test --config=e2e/playwright.config.ts`
Expected: 全部通过

- [ ] **Step 3: 运行测试覆盖率**

Run: `pnpm test:coverage`
Expected: 覆盖率 > 50%

- [ ] **Step 4: 验证 CI 配置语法**

确认 `.github/workflows/test.yml` 语法正确，E2E 和单测可并行运行。

---

## 评审问题追踪表

| 编号 | 严重度 | 问题 | 修复 Task | 状态 |
|------|--------|------|-----------|------|
| S1 | 🔴 | Task 1-5 代码已实现 | Task 1-5 改为验证 | ✅ 已修正 |
| S2 | 🔴 | E2E 选择器不可靠 | Task 0 + Task 7-10 | ✅ 已修正 |
| S3 | 🔴 | wdio-tauri-driver 不存在 | Task 12 | ✅ 已修正 |
| S4 | 🔴 | 覆盖已有更完善文件 | Task 6/11/12/14 改为验证/增强 | ✅ 已修正 |
| M1 | 🟡 | API Mock URL 路径 | Task 6 Step 3 | ✅ 已修正 |
| M2 | 🟡 | 网络错误静默返回 false | Task 2 修复 1 | ✅ 已修正 |
| M3 | 🟡 | localStorage 违反隔离 | Task 4 修复 1 | ✅ 已修正 |
| M4 | 🟡 | wasLoggedInGetter 回调模式 | Task 2 修复 1 | ✅ 已修正 |
| M5 | 🟡 | hasSsoLogin 命名不精确 | Task 4 修复 2 | ✅ 已修正 |
| M6 | 🟡 | 桌面端 E2E 空壳 | Task 13 标记 v2 | ✅ 已修正 |
| M7 | 🟡 | CI 配置覆盖降级 | Task 11 改为增强 | ✅ 已修正 |
| M8 | 🟡 | 模板缺动态导入 | Task 14 Step 2 | ✅ 已修正 |
| M9 | 🟡 | CI E2E 和单测串行 | Task 11 Step 2 | ✅ 已修正 |
| L1 | 🟢 | BroadcastChannel 常量 | Task 2 修复 3 | ✅ 已修正 |
| L2 | 🟢 | cleanup 未关闭 channel | Task 4 修复 3 | ✅ 已修正 |
| L3 | 🟢 | 选择器优先级 | Task 7-10 统一 | ✅ 已修正 |
| L4 | 🟢 | sso-coordinator 引用 | Task 4 修复 3 注释 | ✅ 已修正 |
| L5 | 🟢 | 模板引用现有文件 | Task 14 改为验证/增强 | ✅ 已修正 |
