## Why

当前项目 web 端的认证状态（`localStorage` 中的 Bearer Token）与 RiverCalenderWeb web 端完全隔离——RiverCalenderWeb 登录后，当前项目仍处于未登录态，需重新输入密码；反之亦然。这与《跨域登录态对接指南 v1.0》"优先级 2 HttpOnly Cookie（仅同主域场景）" 的最佳实践相违背。

RiverCalenderWeb 后端已支持 HttpOnly Cookie 认证（`CookieAuthUtil` 已在登录/注册/刷新时下发 `access_token` / `refresh_token`，`JwtAuthenticationFilter` 已支持从 Cookie 读取 Token），但当前项目 web 端未启用 Cookie 通道（`fetch` 未带 `credentials: 'include'`）。本次变更打通这条通道，实现"同根域跨子域"的单点登录与登出同步。

## What Changes

- **新增 `credentials: 'include'` 透传**：`WebApiClient` 所有 `fetch` 调用携带 Cookie，后端 `access_token` / `refresh_token` Cookie 自动随请求发送，实现同根域跨子域 Token 共享
- **新增 `detectSsoSession()` 方法**：`IAuthRepository` 接口新增静默检测方法，`WebAuthRepository` 通过 `GET /user/profile` + Cookie 检测 RiverCalenderWeb 是否已登录，避免用户重复登录
- **新增 `hasSsoLogin` 能力声明**：`PlatformCapabilities` 新增语义化字段，Web 端 `true`，桌面端 `false`，组件按能力判断是否启用 SSO 检测
- **新增 AuthStore 跨应用登录态同步**：
  - `initialize()` 时静默调用 `detectSsoSession()`，若有效则直接进入已登录态
  - 监听 `document.visibilitychange` 事件，标签页切回前台时重新校验
  - 定时轮询（30 秒）作为兜底，跨子域场景下保证登出检测延迟可控
- **新增 BroadcastChannel 跨标签页同步**：同源标签页间实时同步登出事件（关掉一个标签页的登录态不影响其他标签页）
- **新增 `notifySsoLogout()` / `subscribeSsoEvents()` 工具函数**：`platform/web/sso-coordinator.ts` 封装跨标签页通信，跨子域场景降级为 cookie 检测
- **新增登出联动**：`authStore.logout()` 调用 `authRepo.logout()` 后端清除 Cookie + `BroadcastChannel.postMessage` 通知同源标签页 + 本地状态清理
- **新增错误码**：`RepoErrorCodes.SSO_SESSION_EXPIRED`，区分"未登录"与"会话已失效"
- **新增 Web 端导航栏登录态门控**：仅 Web 端在 `authStore.isAuthenticated === false` 时隐藏侧边栏"我的"路由链接（`/profile`），桌面端 Tauri 始终显示。直接 URL 访问 `/profile` 仍允许（ProfileView 未登录态已显示登录表单）
- **BREAKING 调整 `WebApiClient.setTokens` 行为**：登录成功仍写 localStorage（保持现有 Authorization 头回退路径），但 token 刷新成功后同步刷新 Cookie（已由后端处理，前端无需操作）
- **BREAKING 调整 `WebAuthRepository.checkAuthStatus`**：改为优先使用 Cookie 检测（`credentials: 'include'`），回退到 localStorage Bearer

## Capabilities

### New Capabilities
- `web-sso-integration`: Web 端同根域 SSO 集成（Cookie 通道、跨应用登录态检测、登出同步、可见性恢复校验）
- `web-navigation-gating`: Web 端导航栏登录态门控（未登录隐藏"我的"路由链接，桌面端不受影响）

### Modified Capabilities
- `auth-repository`: IAuthRepository 新增 `detectSsoSession()` 方法
- `auth-store`: AuthStore 新增 `initialize()` 中的 SSO 检测、`logout()` 后的跨标签页广播、visibilitychange 监听
- `platform-capabilities`: 新增 `hasSsoLogin` 能力声明字段

## Impact

- **前端 API 客户端**：修改 `src/platform/web/api-client.ts`（`credentials: 'include'` + token refresh 行为调整）
- **前端 Repository**：
  - 修改 `src/platform/types/auth.repository.ts`（接口新增 `detectSsoSession()`）
  - 修改 `src/platform/web/auth.repo.ts`（实现 `detectSsoSession()`，调整 `checkAuthStatus` 优先级）
  - 桌面端 `src/platform/tauri/auth.repo.ts` 保持 `hasSsoLogin: false`，无需实现
- **前端 Store**：修改 `src/stores/auth.ts`（`initialize()` 增加 SSO 检测路径、`logout()` 触发 BroadcastChannel、监听 visibilitychange）
- **前端能力声明**：
  - 修改 `src/platform/capabilities.ts`（新增 `hasSsoLogin`）
  - 修改 `src/platform/web/capabilities.ts`（`hasSsoLogin: true`）
- **新增前端模块**：
  - `src/platform/web/sso-coordinator.ts`（跨标签页通信 + 可见性监听 + 轮询调度）
  - `src/platform/web/__tests__/sso-coordinator.test.ts`
  - `src/platform/web/__tests__/auth.repo.test.ts`（含 detectSsoSession 测试）
  - `src/__tests__/auth-store-sso.test.ts`（含 SSO 检测路径测试）
- **前端导航栏**：修改 `src/App.vue` 侧边栏（line 71-79），为 `/profile` 路由链接添加 `v-if="!capabilities.hasSsoLogin || authStore.isAuthenticated"` 条件渲染
- **前端导航栏测试**：新增 `src/__tests__/app-navigation.test.ts`（mock 登录态 + 平台能力，验证导航项显隐）
- **前端错误码**：修改 `src/platform/errors.ts`（新增 `SSO_SESSION_EXPIRED`）
- **配置**：新增可选环境变量 `VITE_SSO_POLL_INTERVAL_MS`（默认 30000）
- **依赖**：无新增（`BroadcastChannel`、`document.visibilitychange` 为浏览器原生 API）
- **桌面端**：无影响（`hasSsoLogin: false` 走原有流程）
- **后端 API**：无改动（Cookie 通道后端已实现，详见 `RiverCalenderWeb/security/CookieAuthUtil.java`）
- **Tauri 端**：无影响（不影响桌面端 OAuth 流程）

## Non-Goals

- **不修改现有 OAuth 登录流程**：GitHub OAuth 已通过 Cookie 接收 token，无需变动
- **不实现跨子域 BroadcastChannel**：跨子域浏览器原生不支持 BroadcastChannel/storage 事件，本期降级为 cookie 检测 + visibilitychange + 轮询
- **不实现 WebSocket 登出推送**：避免后端改造，本期完全前端侧实现
- **不替换 localStorage Token 存储**：localStorage 仍作为非 Cookie 场景的回退（如隐私模式禁用 Cookie），完全迁移是独立后续任务
- **不实现 Tauri 桌面端 SSO**：桌面端有自己的 OAuth Session 轮询流程（`desktop-oauth-login` 变更已实现），与本变更是平行能力
- **不修改 RiverCalenderWeb 端**：本期仅修改当前项目 SmartRiverCalender 端
- **不实现 PKCE 跨域**：Cookie 方案下后端已完成 PKCE（OAuth 流程内部），前端不涉及
- **不实现多账号切换**：本期仅解决"已登录 / 未登录"二态同步，不解决多账号切换场景
- **不实现 `VITE_SSO_AUTO_DETECT` 开关**：本期默认启用静默检测，若需关闭通过环境变量 `VITE_SSO_DISABLED=true` 即可（实现成本极低）
