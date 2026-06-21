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
├── playwright.config.ts          # Web 端配置（Playwright）
├── wdio.tauri.conf.ts            # 桌面端配置（WebDriverIO + tauri-driver）
├── fixtures/                     # API mock 数据
│   ├── calendars.json
│   ├── events.json
│   ├── todos.json
│   ├── user.json
│   └── sync-status.json
├── helpers/                      # 测试辅助工具
│   ├── api-mock.ts              # Playwright Route 拦截封装
│   ├── tauri-mock.ts            # Tauri IPC mock 封装
│   ├── auth.setup.ts            # 登录状态 setup
│   └── data-verify.ts           # 数据验证辅助函数
├── web/                          # Web 端 E2E 测试
│   ├── auth-flow.spec.ts
│   ├── calendar-event-crud.spec.ts
│   ├── calendar-view-navigation.spec.ts
│   ├── todo-crud.spec.ts
│   ├── sync-flow.spec.ts
│   ├── home-dashboard.spec.ts
│   ├── schedule-search-filter.spec.ts
│   ├── settings.spec.ts
│   └── reminder.spec.ts
└── tauri/                        # 桌面端 E2E 测试
    ├── tray-popup.spec.ts
    ├── reminder-popup.spec.ts
    ├── multi-window.spec.ts
    ├── offline-crud.spec.ts
    ├── identity-switch.spec.ts
    └── update.spec.ts
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

桌面端 Tauri API 调用的前端行为模拟（主要用于 L2 组件测试或 Playwright 环境下的纯前端降级 E2E），可通过 `page.addInitScript()` 拦截 `window.__TAURI__`。
> **注意**：在使用 `tauri-driver` 的真实桌面端 E2E 测试中，将拉起真实的 Rust 后端，无需（也无法简单）拦截 `__TAURI__`，此时应直接操作真实的本地 SQLite 测试数据库。

需覆盖 invoke + event + plugin：

```typescript
// e2e/helpers/tauri-mock.ts
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
```

> **Tauri 2.x 兼容性注意**：Tauri 2.x 的底层 IPC 依赖 `window.__TAURI_INTERNALS__`。若前端代码使用的是 Tauri 2.x 推荐的 ESM 导入（`@tauri-apps/api/core`），在 Playwright 纯前端 mock 环境下，直接 mock `window.__TAURI__` 可能失效。建议额外 mock `window.__TAURI_INTERNALS__ = { ipc: ... }`，或在构建阶段使用别名将 Tauri API 指向 mock 实现。

## 数据验证辅助工具

E2E 测试不仅验证 UI 交互，还需验证数据在 Store 层和 API 层的一致性：

```typescript
// e2e/helpers/data-verify.ts

// 通过 Pinia $id 访问 Store 状态（需在应用入口暴露 pinia 实例到 window）
// 实现方式：在 e2e 环境下，main.ts 中添加 window.__pinia__ = pinia
export async function verifyStoreState(page: Page, storeName: string, path: string, expected: unknown) {
  const actual = await page.evaluate(({ store, key }) => {
    const pinia = (window as any).__pinia__
    return pinia?.state?.value?.[store]?.[key]
  }, { store: storeName, key: path })
  expect(actual).toEqual(expected)
}

// 验证 API 请求被正确发出
// 提示：推荐使用 Playwright 的 page.waitForRequest() 或监听 page.on('request') 事件，
// 这样可以避免在 mock 路由内部手动维护共享的状态数组，实现更干净的声明式断言。
export async function verifyApiCalled(page: Page, urlPattern: string, method: string, times: number = 1) {
  // 实现示例：
  // const reqPromise = page.waitForRequest(req => req.url().includes(urlPattern) && req.method() === method)
  // await reqPromise
}

// 验证页面刷新后数据持久化
export async function verifyDataPersistsAfterReload(page: Page, selector: string, expectedText: string) {
  await page.reload()
  await expect(page.locator(selector)).toContainText(expectedText)
}

// 验证同步状态流转
export async function verifySyncTransition(page: Page, fromStatus: string, toStatus: string) {
  // 监听 Store 的 syncStatus 变化
}
```

## 桌面端 Tauri E2E

> **技术选型说明**：`tauri-driver` 使用 WebDriver 协议，与 Playwright 的 CDP 协议不兼容。
> 桌面端 E2E 采用 **WebDriverIO + tauri-driver** 方案（Tauri 官方推荐），与 Web 端 Playwright 分属独立工具链。

### 方案 A：WebDriverIO + tauri-driver（推荐，Tauri 官方方案）

```typescript
// e2e/tauri/tray-popup.spec.ts (WebDriverIO)
describe('系统托盘', () => {
  it('点击系统托盘图标应显示主窗口', async () => {
    // tauri-driver 已启动桌面应用，browser 对象连接 webview
    await browser.execute(() => window.__TAURI__.event.emit('tray-click'))
    const homeView = await browser.$('.home-view')
    await expect(homeView).toBeDisplayed()
  })
})
```

桌面端配置需要：
1. 先构建 Tauri 应用：`pnpm tauri build`
2. 安装 tauri-driver：`cargo install tauri-driver`
3. 启动 tauri-driver 作为 WebDriver 代理
4. WebDriverIO 通过 WebDriver 协议连接 tauri-driver

### 方案 B：Tauri MCP Bridge（备选，已有基础设施）

本项目已安装 `tauri-mcp-server`，可通过 MCP Bridge 工具操作桌面应用：
- `webview_dom_snapshot` / `webview_interact` / `webview_execute_js` 操作 webview
- `ipc_execute_command` 执行 Tauri IPC 命令
- `manage_window` 管理窗口

此方案适合 Agent 驱动的探索式测试，但不适合 CI 流水线中的回归测试。

### 最终选择

**日常 CI 使用方案 A（WebDriverIO + tauri-driver）**，Agent 探索式测试可选用方案 B。

## 平台差异适配矩阵

E2E 测试需覆盖两端差异逻辑，下表标注每个流程在两端的适配点：

### 核心业务流程平台差异

| 流程 | 桌面端行为 | Web 端行为 | E2E 差异用例 |
|------|-----------|-----------|-------------|
| **认证登录** | 用户名+密码(RSA)+GitHub OAuth | 用户名+密码(RSA)+SSO 会话检测 | Web 端需验证 SSO 跨标签页同步；桌面端验证 OAuth 回调 |
| **Token 刷新** | Rust 端内部刷新，前端无感 | `apiFetch` 拦截 401 → `doRefreshToken()` → 重试原请求 | Web 端验证并发请求时不会重复刷新（refreshWaiters 队列） |
| **Token 过期** | Tauri 事件 `auth-token-expired` → 自动登出 | API 401 → 刷新失败 → 无法操作 | 两端登出后的清理范围不同 |
| **创建事件(在线日历)** | 写 SQLite + sync_log → `triggerSync()` | 直接 `POST /events` → 远端创建 | Web 端需验证 API 请求体格式正确 |
| **创建事件(离线)** | 写 SQLite + sync_log(synced=0) → 等待联网推送 | 抛出 `RepositoryError(NETWORK_ERROR)` | 桌面端需验证离线创建→联网后自动同步 |
| **登录后日历切换** | `loginTransition()`: local→online，双向同步+type变更+reload | 直接返回（日历天然在线） | 桌面端需验证身份切换后日历列表正确 |
| **登出后日历切换** | `logoutTransition()`: 最终同步+online→local+reload | 直接返回（无本地数据需保留） | 桌面端需验证登出后本地日历仍可用 |
| **创建待办** | 写 SQLite + sync_log | `POST /todos` → 远端创建 | Web 端需验证 API 返回数据写入 Store |
| **云同步** | `safeInvoke('cloud_sync_trigger')` → Rust 双向同步 | `POST /sync/now` → 服务端外部日历同步 | 桌面端验证 sync_log 推送，Web 端验证触发外部日历同步 |
| **自动同步** | 5分钟 interval + 网络恢复自动触发 | 不启用 | 桌面端需验证 `window.online` 触发同步 |
| **提醒弹窗** | Tauri 多窗口(standard/strong模式) | 浏览器 Notification API | 桌面端验证弹窗+稍后提醒，Web 端验证 Notification 权限 |
| **设置存储** | SQLite 键值对 | 远端 API 逐字段 PUT | Web 端验证每个设置项的 API 请求格式 |
| **数据迁移** | localStorage → SQLite（首次启动） | 不需要 | 桌面端验证迁移后数据完整 |

### 数据验证链路差异

| 验证环节 | 桌面端 | Web 端 |
|----------|--------|--------|
| **创建后 Store 状态** | `events.value` 包含新事件 | `events.value` 包含新事件 |
| **创建后 UI 渲染** | 日历视图中显示新事件 | 日历视图中显示新事件 |
| **创建后持久化** | 页面刷新后从 SQLite 恢复 | 页面刷新后从 API 重新加载 |
| **创建后同步** | sync_log 推送到远端 → `syncStatus='success'` | 已直接写远端，`triggerSync()` 触发外部日历同步 |
| **同步后数据一致性** | `reloadFromDatabase()` 后数据与预期一致 | `reloadFromDatabase()`（实际重新调 API）后数据一致 |

## E2E 测试用例清单

### P0 — 核心流程

#### 1. 用户认证完整流程 (`web/auth-flow.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 用户名密码登录成功 | 输入邮箱+密码 → 点击登录 | Store `isAuthenticated=true`；UI 显示用户信息和同步面板；API 请求包含 RSA 加密密码 |
| 用户名密码登录失败 | 输入错误密码 → 点击登录 | Store 保持 `isAuthenticated=false`；UI 显示错误提示；不触发同步 |
| 登录后登出 | 登录成功 → 点击退出 | Store `isAuthenticated=false, user=null`；UI 回到登录表单；同步状态清空 |
| Token 过期自动刷新 | 登录成功 → 模拟 API 返回 401 → 验证自动刷新 | 原请求自动重试；用户无感知；不出现登出；通过观察 API 请求次数验证（1次刷新请求 + 1次原请求重试 = 2次后续请求） |
| Token 过期刷新失败 | 登录成功 → 模拟刷新接口也返回 401 | Store 被清空；UI 回到登录表单 |
| 注册新账号 | 点击注册 → 填写信息 → 提交 | 注册成功后自动登录；Store 状态正确 |
| 页面刷新后保持登录 | 登录成功 → 刷新页面 | 从 API 恢复认证状态；UI 保持登录态 |
| SSO 会话检测 | 已在另一标签页登录 → 打开当前页面 | `SsoCoordinator` 检测到已登录状态；自动进入已登录态 |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| GitHub OAuth 登录 | 点击 GitHub 登录按钮 → 完成 OAuth 回调 | 本地 HTTP 服务器接收回调；认证成功；Store 状态更新 |
| Keyring 故障容错 | 模拟 `TOKEN_LOAD_ERROR` | 不清除认证状态（区别于 Web 端）；UI 提示系统错误 |
| Tauri 事件驱动的 Token 过期 | 触发 `auth-token-expired` 事件 | 自动登出；UI 回到登录表单 |

**数据验证：**
- 登录成功：验证 `authStore.user` 非空 + `authStore.isAuthenticated === true`
- 登录成功：验证 API 收到 `POST /auth/login` 请求
- 登出成功：验证 `authStore.syncStatus === 'idle'` + `authStore.lastSyncAt === null`
- 刷新后：验证 `GET /user/profile` 被调用 + Store 状态恢复

---

#### 2. 日历事件完整生命周期 (`web/calendar-event-crud.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 创建全天事件 | 点击"+" → 填写标题 → 选择全天 → 选择日期 → 创建 | 事件出现在日历格子中；Store `events` 包含新事件；API `POST /events` 请求体包含 `all_day: true` |
| 创建定时事件 | 点击"+" → 填写标题 → 选择时间 → 创建 | 事件出现在日历对应时段；Store 状态正确；API 请求体包含 `start_time`/`end_time` |
| 编辑事件标题 | 点击事件 → 修改标题 → 保存 | 日历中标题更新；Store `events` 对应事件标题更新；API `PUT /events/:id` 被调用 |
| 删除事件 | 点击事件 → 点击删除 → 确认 | 事件从日历消失；Store `events` 不再包含该事件；API `DELETE /events/:id` 被调用 |
| 只读日历拒绝创建 | 选择外部只读日历 → 尝试创建事件 | 创建按钮禁用或提示只读；不发送 API 请求 |
| 页面刷新后事件持久化 | 创建事件 → 刷新页面 | 事件仍在日历中；`GET /events` API 被调用返回该事件 |
| 创建事件后触发同步 | 创建在线日历事件 | `POST /sync/now` 被触发；同步状态经历 `idle → syncing → success` |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 本地日历创建事件 | 选择本地日历 → 创建事件 | 写入 SQLite（不触发 sync_log）；不调用 `triggerSync()` |
| 在线日历在线创建 | 选择在线日历 + 在线状态 → 创建事件 | 写入 SQLite + sync_log(synced=0) → `triggerSync()` → sync_log 更新为 synced=1 |
| 在线日历离线创建 | 选择在线日历 + 离线状态 → 创建事件 | 写入 SQLite + sync_log(synced=0)；事件可见；同步状态为 offline |
| 离线创建→联网同步 | 离线创建 → 恢复网络 | `window.online` 触发 → `triggerSync()` → sync_log 推送成功 → `syncStatus='success'` |

> **E2E 离线状态模拟提示**：在 CI 环境下，建议在 WebDriverIO/Playwright 中使用 `browser.execute` 动态修改 `navigator.onLine` 并手动派发 `offline` / `online` 事件来模拟网络切换，无需在 OS 层面断网：
> `Object.defineProperty(navigator, 'onLine', { value: false, writable: true }); window.dispatchEvent(new Event('offline'));`
| 联网后数据一致性 | 离线创建→联网同步→刷新 | 事件数据与远端一致；无重复；`reloadFromDatabase()` 后数据正确 |
| 登录身份切换（local→online） | 登录 → 触发 `loginTransition()` | 日历 type 从 local 变为 online；双向同步执行；`reloadFromDatabase()` 后日历列表正确 |
| 登出身份切换（online→local） | 登出 → 触发 `logoutTransition()` | 最终同步执行；日历 type 从 online 变为 local；本地日历仍可用 |
| 刷新后从 SQLite 恢复 | 创建事件 → 关闭应用 → 重新打开 | 事件从 SQLite 恢复；Store 状态正确 |

**数据验证：**
- 创建：验证 Store `events` 数组长度 +1 + 新事件 `title` 匹配
- 创建：验证 API 请求体 `snake_case` 格式正确（`start_time` 非 `startTime`）
- 创建：验证同步状态流转 `idle → syncing → success`
- 删除：验证 Store `events` 数组长度 -1
- 编辑：验证 Store 中对应事件的 `updatedAt` 已更新
- 桌面端离线：验证 `safeInvoke('create_event')` 被调用 + `syncRepo.triggerCloudSync()` 未被调用
- 桌面端联网：验证 `syncRepo.triggerCloudSync()` 被调用

---

#### 3. 视图切换与日期导航 (`web/calendar-view-navigation.spec.ts`)

**Web/桌面端共用用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 月视图默认加载 | 打开日历页 | 默认显示月视图；当前日期高亮；导航栏显示当前月份 |
| 月→周切换 | 点击周视图按钮 | 切换到周视图；显示当前周的7天；事件按时间排列 |
| 周→日切换 | 点击日视图按钮 | 切换到日视图；显示当天24小时时间线；事件正确定位 |
| 日→年切换 | 点击年视图按钮 | 切换到年视图；显示12个月缩略图 |
| "今天"按钮 | 导航到其他日期 → 点击"今天" | 回到当前日期；视图更新 |
| 前后导航 | 点击前/后导航按钮 | 日期前进/后退一个周期（月/周/日）；标题更新 |
| 月视图双击跳转日程 | 双击某日期格子 | 跳转到 `/schedules?date=YYYY-MM-DD`；日程页显示该日事件 |
| 视图状态持久化 | 切换到周视图 → 刷新页面 | 仍为周视图（localStorage 持久化） |

**数据验证：**
- 视图切换：验证 Store `calendarStore.view` 值正确
- 导航：验证 Store `calendarStore.currentDate` 对应更新
- 跳转：验证 URL query 参数 `date` 正确传递

---

#### 4. 待办事项完整生命周期 (`web/todo-crud.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 创建待办 | 点击新建 → 填写标题+优先级+截止日期 → 确认 | 待办出现在列表中；Store `todos` 包含新待办；API `POST /todos` 请求正确 |
| 编辑待办 | 点击待办 → 修改标题/优先级 → 保存 | 列表中显示更新后的值；Store 状态更新；API `PUT /todos/:id` 被调用 |
| 标记完成 | 点击复选框 | 待办加删除线；移至"已完成"标签；Store `completed=true`；API `PUT /todos/:id` 包含 `completed: true` |
| 删除待办 | 右键 → 删除 → 确认 | 待办从列表消失；Store `todos` 不再包含；API `DELETE /todos/:id` 被调用 |
| 筛选待办 | 切换"全部/待完成/已完成"标签 | 列表仅显示对应状态的待办 |
| 过期待办红色提示 | 创建一个截止日期为昨天的待办 | 截止日期显示为红色 |
| 无截止日期待办 | 创建不设截止日期的待办 | 正常显示，无日期区域 |
| 页面刷新后待办持久化 | 创建待办 → 刷新页面 | 待办仍在列表中；`GET /todos` API 被调用返回该待办 |
| 创建待办后触发同步 | 创建在线日历关联的待办 | `POST /sync/now` 被触发 |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 离线创建待办 | 断网 → 创建待办 | 写入 SQLite + sync_log；待办可见；不报错 |
| 离线创建→联网同步 | 离线创建 → 恢复网络 | `window.online` 触发同步 → sync_log 推送 → 待办同步到远端 |
| 刷新后从 SQLite 恢复 | 创建待办 → 重启应用 | 待办从 SQLite 恢复；Store 状态正确 |

**数据验证：**
- 创建：验证 Store `todos` 数组长度 +1 + 新待办 `title` 匹配
- 创建：验证 API 请求体 `snake_case` 格式（`due_date` 非 `dueDate`）
- 完成：验证 Store 中对应待办 `completed === true`
- 桌面端离线：验证 `safeInvoke('create_todo')` 被调用
- 桌面端同步：验证 `safeInvoke('cloud_sync_trigger')` 被调用 + `syncStatus='success'`
- Web 端持久化：验证刷新后 `GET /todos` 返回数据与创建的一致

---

### P1 — 重要流程

#### 5. 首页仪表盘数据展示 (`web/home-dashboard.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 统计卡片数据正确 | 创建2个今日事件+3个待办 → 打开首页 | 今日日程=2；待办事项=3；本周/本月统计正确 |
| 近期待办联动 | 创建高优先级待办 → 打开首页 | "近期待办"区域显示该待办 |
| 即将到来事件联动 | 创建明天的事件 → 打开首页 | "即将到来"区域显示该事件 |
| 待办快捷完成 | 在首页勾选待办 | 待办标记完成；统计数字更新；列表刷新 |
| 跳转到全部待办 | 点击"查看全部→" | 跳转到 `/todos` 页面 |
| 跳转到日历 | 点击日程"查看全部→" | 跳转到 `/calendar` 页面 |

**数据验证：**
- 统计数字：通过 `page.evaluate()` 读取 Store 中的 `events` 和 `todos` 计算验证
- 联动：创建数据后，首页 computed 属性自动更新

---

#### 6. 日程管理搜索筛选 (`web/schedule-search-filter.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 从月视图跳转带入日期 | 月视图双击某日 → 日程页 | URL 含 `?date=YYYY-MM-DD`；日期筛选器自动填入；列表仅显示该日事件 |
| 关键词搜索 | 创建"会议A"和"报告B" → 搜索"会议" | 仅显示"会议A"；"报告B"被过滤 |
| 日期范围筛选 | 设置起止日期 | 仅显示与日期范围有交集的事件 |
| 按日历筛选 | 创建2个不同日历的事件 → 点击某日历彩点 | 仅显示该日历下的事件 |
| 组合筛选 | 搜索关键词 + 设置日期范围 + 选择日历 | 三重过滤同时生效 |
| 编辑日程事件 | 点击事件卡片 → 修改 → 保存 | 事件更新；列表刷新 |
| 删除日程事件 | 右键 → 删除 → 确认 | 事件从列表消失 |

**数据验证：**
- 搜索：验证 Store `events` 过滤逻辑与 UI 显示一致
- 筛选：验证 URL query 参数正确
- 组合：验证多个 computed 条件叠加结果正确

---

#### 7. 设置管理 (`web/settings.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 切换日历显示选项 | 取消勾选"显示农历" → 保存 | 日历页面不再显示农历；API `PUT /settings/show_lunar` 被调用 |
| 切换主题 | 亮色 → 暗色 | 页面主题切换；`document.documentElement` 添加 dark class |
| 设置默认视图 | 选择"周视图" → 保存 | 下次打开日历默认周视图 |
| 设置提醒强度 | 切换"标准/强提醒/静默" | 设置保存成功；API 请求正确 |
| 节假日管理 | 添加自定义节假日 → 保存 | 日历页面显示自定义节假日；API `POST /holidays` 被调用 |
| 页面刷新后设置保持 | 修改设置 → 刷新 | 设置从 API 恢复；UI 状态一致 |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 系统集成设置 | 开启开机自启/最小化到托盘/时钟点击 | `safeInvoke` 被调用；SQLite 写入 |
| 代理设置 | 配置代理地址 → 保存 | 设置持久化到 SQLite |
| localStorage 迁移 | 首次启动 + localStorage 有旧数据 | 数据迁移到 SQLite；迁移后 localStorage 仍保留（降级） |
| 设置广播跨窗口 | 修改主题 → 弹出窗口 | 弹出窗口主题同步更新 |

**数据验证：**
- Web 端：验证 `PUT /settings/:key` 请求体包含正确的 `snake_case` 键
- 桌面端：验证 `safeInvoke('set_setting')` 被调用 + 参数正确
- 刷新后：验证 `GET /settings?prefix=` 或 `safeInvoke('get_setting')` 返回值与设置一致

---

#### 8. 云同步流程 (`web/sync-flow.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 手动触发同步 | 点击"立即同步" | 同步状态 `idle → syncing → success`；`POST /sync/now` 被调用 |
| 同步成功后数据刷新 | 远端有新事件 → 触发同步 | `calendarStore.reloadFromDatabase()` 执行；新事件出现在日历中 |
| 同步失败 | 模拟 `POST /sync/now` 返回错误 | 同步状态变为 `error`；UI 显示同步失败提示 |
| 创建事件自动触发同步 | 创建在线日历事件 | 创建成功后 `POST /sync/now` 自动触发 |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 双向同步 | 本地有未推送事件 + 远端有新事件 → 触发同步 | 本地事件推送到远端；远端事件拉取到本地；数据一致 |
| 网络恢复自动同步 | 断网 → 创建事件 → 恢复网络 | `window.online` 事件触发 → `triggerSync()` → sync_log 推送成功 |
| 自动同步定时器 | 等待5分钟 | `triggerSync()` 自动执行 |
| Tauri 事件驱动同步 | 触发 `sync-complete` 事件 | `calendarStore.reloadFromDatabase()` 执行 |
| 冲突解决 | 本地和远端同时修改同一事件 → 同步 | 冲突被解决（客户端策略）；最终数据一致 |
| 同步状态查询 | 触发同步 → 查询状态 | `safeInvoke('cloud_sync_get_status')` 返回 `status='success', pendingChanges=0` |

**数据验证：**
- 同步成功：验证 `authStore.syncStatus === 'success'` + `authStore.lastSyncAt !== null`
- 数据刷新：验证 `calendarStore.events` 和 `todoStore.todos` 与同步后远端数据一致
- 桌面端：验证 `syncRepo.triggerCloudSync()` 被调用
- 桌面端：验证 `syncRepo.getSyncStatus()` 返回 `pendingChanges === 0`（所有变更已推送）

---

#### 9. 提醒服务 (`web/reminder.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 浏览器通知触发 | 创建一个即将开始的事件 → 等待提醒时间 | `Notification` API 被调用；通知内容包含事件标题 |
| 静默模式不通知 | 设置静默模式 → 创建即将开始的事件 | 不触发 `Notification` |
| 通知权限被拒绝 | 拒绝通知权限 → 事件到达提醒时间 | 不报错；优雅降级 |

**桌面端用例（`tauri/` 目录，增加以下用例）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 标准模式系统通知 | 事件到达提醒时间 | Tauri 通知 API 被调用 |
| 强提醒弹窗 | 设置强提醒模式 → 事件到达 | 独立 Tauri 窗口弹出；标题闪烁 |
| 稍后提醒 | 提醒弹窗 → 点击"稍后提醒" | 弹窗关闭；设定时间后再次触发 |
| 夜间模式抑制 | 暗色主题 + 事件到达 | 不弹出提醒窗口 |
| 查看防重复 | 点击"查看详情" → 1小时内同一事件 | 1小时内不重复提醒 |
| 队列持久化 | 有未处理提醒 → 关闭应用 → 重新打开 | 提醒队列从 localStorage 恢复 |

**数据验证：**
- 提醒触发：验证 localStorage `reminder_queue` 包含对应事件 ID
- 稍后提醒：验证队列中该事件的 `nextRemindAt` 被更新
- 查看防重复：验证队列中该事件的 `lastViewedAt` 被更新

---

### P2 — 辅助流程

#### 10. 系统托盘与弹出面板 (`tauri/tray-popup.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 托盘点击显示/隐藏 | 点击系统托盘图标 | 主窗口显示/隐藏切换 |
| 时钟点击唤出弹出窗口 | 点击系统时钟区域 | 精简日历弹出窗口显示 |
| 弹出窗口内容 | 打开弹出窗口 | 迷你日历+今日事件列表 |
| 弹出面板尺寸切换 | 切换小/中/大 | 窗口尺寸变化；设置持久化 |
| 托盘右键菜单 | 右键托盘图标 | 显示菜单（检查更新/显示/退出） |

---

#### 11. 软件更新 (`tauri/update.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 检测到新版本 | 应用启动 → 检测到更新 | 更新弹窗显示版本号和更新内容 |
| 现在升级 | 点击"现在升级" | 下载进度显示；安装完成提示重启 |
| 稍后提醒 | 点击"稍后" | 弹窗关闭；下次启动仍会检测 |
| 跳过版本 | 点击"不再提示" | localStorage 记录跳过版本；该版本不再提示 |

---

#### 12. 日历管理 (`web/calendar-manage.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 新增日历 | 创建日历（名称+颜色） | 日历出现在列表中；Store `calendars` 包含新日历；API `POST /calendars` 被调用 |
| 编辑日历 | 修改名称/颜色 | 更新生效；Store 状态更新；API `PUT /calendars/:id` 被调用 |
| 删除日历 | 删除日历 → 确认 | 日历从列表消失；关联事件一并删除；API `DELETE /calendars/:id` 被调用 |
| 切换日历可见性 | 点击日历勾选框 | 事件在视图中显示/隐藏 |

**桌面端用例（`tauri/` 目录）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 新增本地日历 | 创建日历（type=local） | 写入 SQLite；不触发 sync_log；不调用 `triggerSync()` |
| 新增在线日历 | 创建日历（type=online） | 写入 SQLite + sync_log；`triggerSync()` 被调用 |
| 登录身份切换后日历类型变更 | 登录 → `loginTransition()` | 本地日历 type 变为 online；双向同步执行 |
| 刷新后从 SQLite 恢复 | 创建日历 → 重启应用 | 日历从 SQLite 恢复；Store 状态正确 |

---

#### 13. 外部日历集成 (`web/external-calendar.spec.ts`)

**Web 端用例：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 添加 Exchange 账号 | 输入服务器+账号+密码 → 连接 | API 请求格式正确；外部日历出现在列表 |
| 添加 CalDAV 账号 | 输入服务器+账号+密码 → 连接 | 外部日历出现在列表 |
| 外部日历只读控制 | 在只读外部日历下尝试创建事件 | 创建被拒绝或禁用 |
| 双向同步事件 | 在外部日历创建事件 → 同步 | 事件推送到外部服务 |

**桌面端用例（`tauri/` 目录）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 添加外部账号 | 输入凭证 → 连接 | 凭证通过 `safeInvoke` 加密存储到 SQLite；外部日历出现在列表 |
| 外部日历事件本地缓存 | 同步外部日历 → 断网 | 事件从本地 SQLite 缓存可见（dataPriority=local-first） |
| 外部日历双向同步 | 在外部日历创建事件 → 同步 | 事件通过 Rust 后端直连推送到 Exchange/CalDAV |

---

#### 14. 右键菜单交互 (`web/context-menu.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| 首页待办右键菜单 | 右键待办 | 显示菜单（编辑/删除/标记完成/详情） |
| 日程页事件右键菜单 | 右键事件 | 显示菜单（编辑/删除/详情） |
| 日历页事件右键菜单 | 右键事件 | 显示菜单 |
| 删除确认气泡 | 右键删除 → 确认 | 确认后删除；取消不删除 |

---

#### 15. 错误场景 (`web/error-scenarios.spec.ts`)

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| Web 端断网创建事件 | 断网 → 创建事件 | 抛出错误；UI 显示失败提示；Store 不变 |
| Web 端断网加载 | 断网 → 打开页面 | 优雅降级；不白屏 |
| API 返回非标准错误 | 模拟 500 错误 | 不崩溃；显示错误提示 |
| 数据格式异常 | 模拟 API 返回非法 JSON | 不崩溃；Repository 抛出 `RepositoryError` |

**桌面端用例（`tauri/` 目录）：**

| 用例 | 步骤 | 验证点 |
|------|------|--------|
| Keyring 故障时认证检查 | 模拟 `TOKEN_LOAD_ERROR` | 不清除认证状态（区别于 Web 端网络错误） |
| 离线操作不报错 | 断网 → 创建事件/待办 | 操作成功（写入 SQLite）；sync_log 记录 |
| safeInvoke 返回 null | 模拟 Rust 端返回 null | 抛出 `RepositoryError(PLATFORM_UNAVAILABLE)` |

---

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
        # 建议在 vitest.config.ts 中配置 coverage.thresholds 确保覆盖率 > 50%，形成真正的 CI 卡点
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
      - uses: actions/cache@v4
        with:
          path: |
            src-tauri/target
            ~/.cargo/registry
            ~/.cargo/git
          key: tauri-${{ runner.os }}-${{ hashFiles('src-tauri/Cargo.lock') }}
          restore-keys: tauri-${{ runner.os }}-
      - run: pnpm install
      - run: pnpm tauri build
      # 建议：实际项目中可直接下载 Github Release 的预编译 tauri-driver 二进制文件，以大幅减少 cargo install 的编译耗时
      - name: Cache tauri-driver
        id: cache-td
        uses: actions/cache@v4
        with: { path: ~/.cargo/bin/tauri-driver.exe, key: tauri-driver-1 }
      - if: steps.cache-td.outputs.cache-hit != 'true'
        run: cargo install tauri-driver
      - run: pnpm exec wdio run e2e/wdio.tauri.conf.ts
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
- 新增数据操作 → 必须包含数据验证链路（Store → API/SQLite → 同步 → 刷新恢复）
- 新增功能涉及平台差异 → 必须标注 Web/桌面端差异用例

### Agent 工作流

1. **开发新功能时**：Agent 根据开发流程，自动在对应层级生成测试
2. **定期扫描**：运行覆盖率报告，识别未覆盖模块，生成测试补充建议
3. **修复失败测试**：自动检测 CI 中的失败测试，尝试修复

## 渐进式建设路径

| 阶段 | 内容 | 预计工作量 |
|------|------|-----------|
| **P0** | 修复 21 个失败单测 + CI test job | 1-2天 |
| **P1** | Playwright 基础设施 + Web 端 P0 核心流程 E2E（认证/事件CRUD/视图/待办） | 3-5天 |
| **P2** | 桌面端 P0 核心流程 E2E（离线/身份切换/同步） + P1 重要流程 | 3-5天 |
| **P3** | 组件测试增强 + P2 辅助流程 E2E | 2-3天 |
| **P4** | Agent 测试生成技能 + 模板 | 2-3天 |

## 现有问题修复

当前 21 个失败测试集中在 SSO 相关 auth repo，根因是 **`IAuthRepository` 接口定义缺失 SSO 方法**，而非仅测试过时：

- `auth-store-sso.test.ts`（7 失败）：`wasLoggedIn` 属性不存在、`cleanup` 方法不存在
- `platform/tauri/__tests__/auth.repo.test.ts`（4 失败）：`detectSsoSession`、`notifySsoEvent`、`subscribeSsoEvents` 方法不存在
- `platform/web/__tests__/auth.repo.test.ts`（10 失败）：同上 + `setWasLoggedInGetter` 方法不存在

`SsoCoordinator` 已通过 `authRepo.detectSsoSession()` 等方式调用这些方法，但 `IAuthRepository` 接口中没有定义。P0 阶段需要：

1. **统一接口抽象（推荐）**：将 SSO 方法统一加入 `IAuthRepository` 接口。对于不支持 SSO 的桌面端实现，可以直接返回空操作（No-op）或抛出/返回特定的 `NOT_SUPPORTED` 状态。这避免了 Store 层引入复杂的类型判断，维持了 Repository 分层的纯粹性。
2. 补全接口定义和类型（`SsoSessionResult`、`SsoEvent` 等）
3. 使两端 Repository 实现和测试与接口对齐

### 架构违规记录

`cloudSyncService`（`src/services/cloudSync.ts`）桌面端路径直接调用 `safeInvoke('cloud_sync_trigger')` 而非通过 `syncRepo.triggerCloudSync()`，违反 Repository 分层架构。E2E 测试断言应基于 Repository 接口（`syncRepo`）而非底层实现（`safeInvoke`）。此架构问题需在后续迭代中修复，测试设计不应固化此违规。

### 数据验证基础设施

`data-verify.ts` 通过 `window.__pinia__` 访问 Store 状态，Pinia 默认不暴露此属性。需在应用入口（`main.ts`）中添加条件暴露：

```typescript
// main.ts 中（仅 E2E 环境下暴露）
if (import.meta.env.MODE === 'test-e2e') {
  window.__pinia__ = pinia
}
```

并在启动命令中显式指定模式（例如在 Playwright 的 `webServer` 配置或启动脚本中指定 `pnpm dev --mode test-e2e`），以确保该环境变量生效。
