## Context

### 当前状态

- 当前项目 web 端认证：登录成功后将 `accessToken` / `refreshToken` 存入 `localStorage`，通过 `Authorization: Bearer <token>` 头发送
- RiverCalenderWeb 后端认证：登录/注册/刷新时同步下发 HttpOnly Cookie（`access_token` / `refresh_token`），`Domain` 可配置为父域（如 `.menghuan.life`）实现子域共享
- RiverCalenderWeb `JwtAuthenticationFilter`：优先从 `Authorization: Bearer` 读 token，回退到 `Cookie: access_token`（`CookieAuthUtil` 已实现）
- 前端 `WebApiClient.fetch`：当前**未设置** `credentials: 'include'`，导致 Cookie 不会随请求发送
- 前端无跨应用通信机制：登出一方后另一方需手动刷新

### 部署拓扑

经用户确认：同根域 + 子域名（如 `app.menghuan.life` 与 `web.menghuan.life` 共享 `menghuan.life`），Cookie 通过 `Domain=.menghuan.life` 共享，但 `BroadcastChannel` / `storage` 事件**不跨子域**。

### 约束

- 后端 API 契约已锁定（RiverCalenderWeb 端不动），`/v1/auth/*` 与 `/v1/user/profile` 公共路径已存在
- 桌面端 Tauri 不受影响（`hasSsoLogin: false`）
- 现有 `localStorage` Token 存储作为回退保留，删除是独立后续任务
- 测试覆盖率目标 60-70%

## Goals / Non-Goals

**Goals:**

1. RiverCalenderWeb 登录后，当前项目 web 端**自动**进入登录态（无需用户操作）
2. 当前项目 web 端登出后，下次访问 RiverCalenderWeb 时已被登出
3. 跨子域场景下，登出检测延迟 ≤ 30 秒
4. 同源标签页场景下，登出延迟 ≤ 100 毫秒
5. 标签页切回前台时立即重新校验登录态
6. 不破坏现有 OAuth 登录、密码登录流程
7. 桌面端 Tauri 完全不受影响
8. Web 端在未登录时隐藏侧边栏"我的"导航项（避免向未登录用户展示无意义的入口）

**Non-Goals:**

- 不修改后端（RiverCalenderWeb）
- 不实现 WebSocket 登出推送（避免后端改造）
- 不替换 localStorage Token 存储为完全 cookie 模式（分阶段迁移）
- 不实现 Tauri 桌面端 SSO（桌面端走 Session 轮询流程，平行能力）
- 不实现多账号切换场景
- 不实现跨子域 BroadcastChannel（浏览器原生不支持）

## Decisions

### D1: Cookie 通道为主 + Bearer Token 兜底

**选择**: 双通道并行，Cookie 优先，Bearer 作为回退

**理由**:
- 后端已支持双通道，零后端改动即可启用
- Cookie 通道解决"RiverCalenderWeb 已登录"场景
- Bearer 通道保留：隐私模式（Cookie 被禁用）、非同域环境（Vite 代理 dev）、服务端调用

**实现**:
- `WebApiClient.fetch()` 全局添加 `credentials: 'include'`
- `Authorization: Bearer <localStorage token>` 仍按现有逻辑发送（让后端优先匹配 Bearer）
- 后端 `JwtAuthenticationFilter` 改造由 RiverCalenderWeb 端负责：优先读 `Authorization` 头，缺失回退读 Cookie

**替代方案**:
- ❌ 完全切到 Cookie：破坏现有 OAuth 登录（OAuth 回跳时 localStorage 才有 token），需要复杂迁移
- ❌ 保持 Bearer 优先：当前已是此模式，但 Cookie 通道不通导致 SSO 无效

### D2: 静默 SSO 检测在 `AuthStore.initialize()`

**选择**: 静默调用 `GET /user/profile`（带 Cookie），根据 HTTP 状态码决定登录态

**理由**:
- 用户体验最佳：无需跳转、无需点击
- 单一 API 调用即可确定登录态（后端会从 Cookie 解出 user 信息）
- 与现有 `getCurrentUser()` 复用

**实现**:
- `IAuthRepository.detectSsoSession(): Promise<{ loggedIn: boolean; user?: User }>`
- `WebAuthRepository.detectSsoSession()`：调用 `/user/profile` + `credentials: 'include'`
  - 200 → `{ loggedIn: true, user: <响应> }`
  - 401 → `{ loggedIn: false }`
  - 网络错误 → `{ loggedIn: false }`（不阻塞 UI）
- `AuthStore.initialize()` 中：先调 `getCurrentUser()`（现有逻辑），失败时调 `detectSsoSession()`

**替代方案**:
- ❌ 跳转到 RiverCalenderWeb 登录页：体验差，破坏当前项目独立性
- ❌ 定时轮询检测：浪费流量，已有 visibilitychange 监听覆盖该场景

### D3: 跨子域登出检测 = visibilitychange + 定时轮询

**选择**: 标签页可见性切换 + 30 秒定时轮询

**理由**:
- `visibilitychange` 事件：标签页从隐藏切到可见时触发，跨子域天然支持
- 定时轮询：兜底隐藏状态的场景（如后台标签页挂起 30+ 秒，RiverCalenderWeb 用户登出）
- 30 秒间隔：流量开销可接受（每标签页 2 次/分 × 标签页数）
- 跨子域降级策略符合"无 BroadcastChannel 也能用"的优雅降级

**实现**:
- `sso-coordinator.ts` 封装 `VisibilityChangePoller`：
  - `document.addEventListener('visibilitychange', ...)` 触发立即检测
  - `setInterval(30000)` 兜底轮询
  - 标签页隐藏时暂停轮询（`Page Visibility API`），可见时恢复
  - 注销时清理所有监听器和定时器
- `AuthStore` 注入 `poller.onChange(callback)`，回调中重新调 `detectSsoSession()`

**替代方案**:
- ❌ BroadcastChannel：跨子域不支持
- ❌ storage 事件：跨子域不支持
- ❌ WebSocket 推送：需后端改造，违反"不动后端"约束
- ❌ 纯 visibilitychange（无轮询）：后台标签页无法感知登出，违反"延迟 ≤ 30 秒"目标

### D4: 同源标签页实时同步用 BroadcastChannel

**选择**: 同源标签页间用 `BroadcastChannel` 实时同步登出事件

**理由**:
- `BroadcastChannel` 是同源标签页间最直接的 API，< 5ms 延迟
- 跨子域标签页：降级为"下次 visibilitychange 时检测"，由 D3 覆盖
- 当前项目多标签页场景普遍（用户同时打开多个视图窗口）

**实现**:
- `BroadcastChannel('smart-river-calendar-sso')`
- 登出时 `postMessage({ type: 'logout', source: 'current-app' })`
- 登录时 `postMessage({ type: 'login', userId, source: 'current-app' })`
- 接收方根据 `type` 更新本地登录态，无需重新调 API

**替代方案**:
- ❌ `localStorage` 事件：仅 storage 事件触发，依赖写操作；BroadcastChannel 语义更明确
- ❌ SharedWorker：过度设计，跨标签页同步不需要
- ❌ 不做同源同步：用户体验差，关闭一个标签页的登录态不会同步到其他标签页

### D5: `hasSsoLogin` 作为能力声明

**选择**: 在 `PlatformCapabilities` 新增 `hasSsoLogin: boolean`，Web 端 `true`，桌面端 `false`

**理由**:
- 符合项目架构约定（"禁止使用 `isTauri()` 做逻辑分支"）
- 组件可按能力判断是否显示 SSO 提示 UI（如"已通过 RiverCalenderWeb 登录"）
- 未来扩展时（Android 端）只需修改对应平台的 `capabilities.ts`

**实现**:
- `src/platform/capabilities.ts`：`hasSsoLogin: false`（基类默认）
- `src/platform/web/capabilities.ts`：`hasSsoLogin: true`（Web 端启用）
- `src/platform/tauri/capabilities.ts`：`hasSsoLogin: false`（桌面端禁用）

### D6: 错误码 `SSO_SESSION_EXPIRED` 区分"未登录"与"会话失效"

**选择**: 新增 `RepoErrorCodes.SSO_SESSION_EXPIRED`，401 区分两种情况

**理由**:
- 现有 `RepoErrorCodes.UNAUTHORIZED` 通用含义包括"从未登录"和"会话已过期"
- UI 层需要区分两者做不同提示（"请登录" vs "会话已过期，正在跳转登录..."）
- 符合"Repository 错误不吞"原则

**实现**:
- `src/platform/errors.ts` 新增 `SSO_SESSION_EXPIRED = 'SSO_SESSION_EXPIRED'`
- `WebAuthRepository` 在检测到 401 + 之前已登录过 → 抛 `SSO_SESSION_EXPIRED`
- `AuthStore` catch 后清空本地态、广播登出事件

**替代方案**:
- ❌ 复用 `UNAUTHORIZED`：UI 难以区分场景
- ❌ 静默登出：违反"Store 统一处理错误"原则

### D7: 登出联动采用"主动通知 + 检测兜底"双保险

**选择**: 当前项目登出时主动广播 + RiverCalenderWeb 登出由本项目通过 visibilitychange 检测

**理由**:
- 当前项目登出：能主动通知（同源 BroadcastChannel 一定可达；跨子域下次访问时 Cookie 已被后端清除）
- RiverCalenderWeb 登出：无法直接通知（异源甚至异子域），只能被动检测

**实现**:
- `authStore.logout()`：
  1. 调 `authRepo.logout()` 调用后端 `/v1/auth/logout`（后端已实现清除 Cookie）
  2. 清空 localStorage token
  3. 清空 Pinia store 状态
  4. `BroadcastChannel.postMessage({ type: 'logout' })` 通知同源标签页
  5. 跨子域标签页：下次访问时被后端 401，由 visibilitychange 检测流程接管
- `sso-coordinator` 收到 `logout` 事件：清空本地态、不调后端（避免重复）

### D8: Vite 代理环境 dev 模式 Cookie 行为

**选择**: dev 模式下接受 Cookie 在同源下工作

**理由**:
- `vite.config.ts` 配置 `/api/v1` 代理到 `http://10.0.100:1188`（开发后端）
- Cookie 默认不跨代理，需配置 `changeOrigin: true` + 浏览器接受第三方 Cookie
- 推荐在 dev 模式使用同一后端域名（如 `127.0.0.1:1188`）直接访问，避免代理 Cookie 问题

**实现**:
- `.env.development` 维持 `VITE_API_BASE_URL=/api/v1`（相对路径走代理）
- `vite.config.ts` server.proxy: `'/api': { target: 'http://10.0.100:1188', changeOrigin: true, secure: false }`
- 开发测试 Cookie 行为时使用 `127.0.0.1:5173` 访问，前后端都在同源
- 文档补充："生产环境 SSO 必须 HTTPS，dev 环境允许 HTTP 但仅限 `127.0.0.1`"

### D9: Web 端导航栏登录态门控策略

**选择**: 仅 Web 端在未登录时隐藏"我的"导航项，桌面端 Tauri 始终显示

**理由**:
- 经用户确认：仅 Web 端隐藏。Tauri 桌面端可走 local-first 离线模式，不需要强制登录
- 复用现有 `useCapabilities().hasSsoLogin` 能力声明 + `useAuthStore().isAuthenticated` 字段，无需新增状态
- 直接 URL 访问 `/profile` 仍允许（ProfileView 内部已有未登录态显示登录表单的逻辑，路由守卫为重复工作）
- 改动最小：仅修改 `src/App.vue` 侧边栏一行 v-if

**实现**:
- `src/App.vue` 在 `<script setup>` 中新增 `import { useCapabilities }` 与 `import { useAuthStore }`
- `/profile` 路由链接添加 `v-if="!capabilities.hasSsoLogin || authStore.isAuthenticated"`
  - Web 端 (`hasSsoLogin=true`)：未登录时 `!true || false === false` → 隐藏
  - Web 端已登录：`!true || true === true` → 显示
  - Tauri (`hasSsoLogin=false`)：`!false || ... === true` → 始终显示
- **不**修改 `src/router/index.ts`（不增加 `meta.requiresAuth`）
- **不**新增 `router.beforeEach` 守卫

**替代方案**:
- ❌ 路由守卫 + 重定向：增加复杂度，ProfileView 内部已支持未登录态，重复
- ❌ Web 端 + 桌面端统一隐藏：Tauri 离线用户无法访问个人中心，与 local-first 理念冲突
- ❌ 增加 hasProfileNav 能力：能力粒度过细，复用 `hasSsoLogin` 已足够

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|------|------|------|
| Cookie 未设置 Domain 属性 | 仅同源共享，跨子域无效 | 文档强制要求后端配置 `Domain=.menghuan.life`，CI 增加配置校验（本期不做，列入技术债） |
| 浏览器禁用第三方 Cookie | 跨子域 SSO 失效 | 提供 `VITE_SSO_DISABLED=true` 环境变量降级到纯 Bearer 模式；UI 提示用户启用 Cookie |
| 隐私/无痕模式 | Cookie 临时存储，关浏览器即失效 | 接受为已知限制，UI 不专门处理 |
| 后端 401 与网络错误难以区分 | 误判为未登录 | `WebApiClient` 区分 fetch reject 类型（`TypeError` 为网络错），401 明确为鉴权错 |
| 30 秒轮询开销 | 流量增加 | 仅在标签页可见时轮询（隐藏暂停），实际多标签页用户数较少 |
| BroadcastChannel 名称冲突 | 与 RiverCalenderWeb 频道冲突 | 命名加项目前缀 `smart-river-calendar-sso`，降低冲突概率 |
| 同源标签页竞态：两个标签页同时登出 | 重复调用 `/logout` API | 后端 logout 幂等；前端 catch 401 视为成功 |
| 桌面端意外启用 SSO | 桌面端走 Cookie 通道无效 | `hasSsoLogin: false` + 单元测试覆盖（`TauriCapabilities.hasSsoLogin === false`） |
| Token 刷新竞态：并发请求都触发 refresh | 后端多次刷新 token | 现有 `WebApiClient` 已有 `tokenRefreshPromise` 复用机制，本期保留 |
| visibilitychange 频繁触发 | 多次重复检测 | 200ms debounce + AbortController 取消上一次请求 |
| 跨子域 BroadcastChannel 不可用导致用户疑惑 | 同根域跨子域的标签页无法实时同步 | 文档明确说明 + UI 在登出时提示"其他子域标签页将在 30 秒内自动登出" |
| localStorage token 泄露风险（XSS） | 不属于本次变更，但 Cookie+localStorage 共存放大影响 | 文档补充：未来需要完全切换到 Cookie 模式，并禁用 localStorage 存储 token |

## Migration Plan

### 部署步骤

1. **后端先行（已完成）**：RiverCalenderWeb 已支持 Cookie 通道，零改动
2. **前端 feature 分支**：`feature/web-sso-same-domain` 从 `main` 拉取
3. **环境配置**：dev 模式验证（用户手动测试）→ 预发环境测试（同时跑两套前端）→ 生产灰度
4. **配置项生效**：
   - `VITE_SSO_DISABLED`：默认 `false`（启用 SSO）
   - `VITE_SSO_POLL_INTERVAL_MS`：默认 `30000`（30 秒）
5. **监控指标**：
   - `/user/profile` 401 比例（应有 0 波动）
   - `authStore.initialize()` 失败率
   - 跨标签页登出事件触发次数

### 兼容性

- **API 向后兼容**：现有 Bearer Token 流程不变，OAuth 登录、密码登录无需修改
- **桌面端无影响**：`hasSsoLogin: false` 走原流程
- **回退方案**：环境变量 `VITE_SSO_DISABLED=true` 立即回退到纯 Bearer 模式

### 回滚策略

- **代码回滚**：通过 git revert 即可，无数据库变更、无后端变更
- **配置回滚**：删除 `.env.production` 中相关变量（无）
- **用户无感**：回滚后行为与变更前完全一致

### 数据迁移

- **无**。本变更不涉及数据存储层（无 SQLite 变更、无 localStorage 数据迁移）
- 现有 `localStorage` 中的 `accessToken` / `refreshToken` 保留，作为 Bearer 通道

## Open Questions

1. **Cookie Domain 配置验证**：用户需提供生产环境 Cookie Domain 配置（应配置为父域如 `.menghuan.life`）。当前项目 dev 模式如何在 `127.0.0.1:5173` 跑通 Cookie 行为？是否需在 dev 模式 `vite.config.ts` 中配置 `Domain=127.0.0.1`？
2. **HTTPS 强制**：SSO 指南要求强制 HTTPS。dev 模式是否允许 HTTP？建议接受 dev 模式 HTTP（仅 `127.0.0.1`），生产环境由部署平台保证 HTTPS
3. **RiverCalenderWeb 端是否同步变更**：本期仅改当前项目，RiverCalenderWeb 端 Cookie 行为已就绪，无需改动
4. **多账号切换场景**：本期不支持。如用户登录 A 账号后再登录 B 账号，BroadcastChannel 需广播 `{ type: 'login', userId: B }` 让其他标签页切换吗？**建议本期不处理，作为后续增强**
5. **Cookie SameSite 策略**：后端当前是 `SameSite=Strict`，是否需要改为 `Lax` 以支持 OAuth 回调？建议由 RiverCalenderWeb 端评估，本期假设后端已正确配置
6. **预发/灰度环境**：是否需要新增环境配置？建议复用现有 staging 环境
