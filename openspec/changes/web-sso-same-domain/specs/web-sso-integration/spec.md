## ADDED Requirements

### Requirement: Web 端 HttpOnly Cookie 通道认证

Web 端 `WebApiClient.fetch` SHALL 在所有同源 / 跨域请求中携带 `credentials: 'include'`，使后端通过 HttpOnly Cookie 下发的 `access_token` / `refresh_token` 自动随请求发送，实现同根域跨子域的 Token 共享。桌面端 Tauri `TauriApiClient` SHALL 保持 `credentials: 'omit'`，因桌面端无浏览器 Cookie 机制。

#### Scenario: Web 端请求携带 Cookie
- **WHEN** WebApiClient 调用任意后端 API（如 `GET /v1/user/profile`）
- **THEN** 浏览器自动附加同根域下 `Domain=.menghuan.life` 的 `access_token`、`refresh_token` Cookie，请求头 `Cookie: access_token=...; refresh_token=...`

#### Scenario: 桌面端不发送 Cookie
- **WHEN** TauriApiClient 调用后端 API
- **THEN** 请求不含 Cookie 字段，桌面端认证仍走 SQLite 加密存储的 Token

#### Scenario: 跨域 POST 请求携带 Cookie
- **WHEN** WebApiClient 调用 `POST /v1/auth/login` 等写入 Cookie 的接口
- **THEN** 响应头 `Set-Cookie` 由浏览器接收并按 Domain/Path/SameSite 规则存储，下一次同源请求自动附加

### Requirement: 静默 SSO 会话检测

Web 端 `IAuthRepository.detectSsoSession()` SHALL 通过调用 `GET /v1/user/profile`（带 `credentials: 'include'`）静默检测 RiverCalenderWeb 是否已登录，避免用户重复输入凭据。方法 SHALL 返回 `{ loggedIn: true, user }` 或 `{ loggedIn: false }`，不抛出网络错误。

#### Scenario: RiverCalenderWeb 已登录
- **WHEN** RiverCalenderWeb 已通过 Cookie 登录，当前项目首次打开调用 `detectSsoSession()`
- **THEN** 返回 `{ loggedIn: true, user: <响应体> }`，AuthStore 直接进入已登录态

#### Scenario: RiverCalenderWeb 未登录
- **WHEN** RiverCalenderWeb 未登录，调用 `detectSsoSession()`
- **THEN** 后端返回 401，Repository 返回 `{ loggedIn: false }`，AuthStore 显示当前项目登录表单

#### Scenario: 网络错误不阻塞 UI
- **WHEN** 后端不可达或网络中断
- **THEN** Repository catch 网络异常并返回 `{ loggedIn: false }`，UI 显示登录表单，不显示错误弹窗

#### Scenario: 桌面端调用无副作用
- **WHEN** 桌面端 `TauriAuthRepository` 被注入 `detectSsoSession()` 调用
- **THEN** 直接返回 `{ loggedIn: false }`，桌面端走原有 SQLite Token 流程

### Requirement: visibilitychange 触发登录态重检

Web 端 `SsoCoordinator` SHALL 在 `document.visibilitychange` 事件触发且 `document.visibilityState === 'visible'` 时，调用 `detectSsoSession()` 重新检测登录态，确保标签页切回前台时立即反映 RiverCalenderWeb 端登录态变更。

#### Scenario: 标签页切回前台且后端仍有效
- **WHEN** 标签页从隐藏切到可见，Cookie 中的 `access_token` 仍有效
- **THEN** `detectSsoSession()` 返回 `{ loggedIn: true, user }`，本地态保持已登录

#### Scenario: 标签页切回前台且 Cookie 已失效
- **WHEN** RiverCalenderWeb 用户已登出，Cookie 被后端清除，标签页切回前台
- **THEN** `detectSsoSession()` 返回 `{ loggedIn: false }`，AuthStore 清空本地态，UI 切回登录表单

#### Scenario: visibilitychange 频繁触发
- **WHEN** 用户多次切换标签页，visibilitychange 在 200ms 内连续触发
- **THEN** Coordinator 通过 200ms debounce + AbortController 取消上一次未完成的请求，避免重复请求

### Requirement: 定时轮询跨子域登出检测

Web 端 `SsoCoordinator` SHALL 在标签页可见时按 `VITE_SSO_POLL_INTERVAL_MS`（默认 30000ms）定时调用 `detectSsoSession()`，作为跨子域 BroadcastChannel 不可用场景下的兜底机制。轮询 SHALL 在标签页隐藏时暂停以节省流量。

#### Scenario: 后台标签页定时检测
- **WHEN** 标签页处于可见状态，30 秒轮询到期
- **THEN** Coordinator 调用 `detectSsoSession()`，若返回 `{ loggedIn: false }` 则通知 AuthStore 登出

#### Scenario: 标签页隐藏暂停轮询
- **WHEN** 标签页切换到隐藏状态
- **THEN** Coordinator 暂停定时器，恢复可见时立即触发一次检测并恢复定时

#### Scenario: 轮询间隔可配置
- **WHEN** 开发者设置环境变量 `VITE_SSO_POLL_INTERVAL_MS=60000`
- **THEN** Coordinator 使用 60 秒间隔，编译期默认值可通过环境变量覆盖

### Requirement: 同源标签页登出事件广播

Web 端 `SsoCoordinator` SHALL 使用 `BroadcastChannel('smart-river-calendar-sso')` 在同源标签页间实时同步登录态变更事件。跨子域场景 SHALL 降级为 visibilitychange + 定时轮询，不依赖 BroadcastChannel。

#### Scenario: 当前项目登出广播
- **WHEN** 用户在当前项目标签页 A 中点击登出
- **THEN** AuthStore 调用 `logout()` 完成后，`BroadcastChannel.postMessage({ type: 'logout' })`；同源标签页 B 收到事件后清空本地态，不重复调用后端 logout

#### Scenario: 当前项目登录广播
- **WHEN** 用户在当前项目标签页 A 中登录成功
- **THEN** `BroadcastChannel.postMessage({ type: 'login', userId })`；同源标签页 B 收到后调 `getCurrentUser()` 同步用户信息

#### Scenario: 跨子域标签页无 BroadcastChannel
- **WHEN** 标签页位于 `app.menghuan.life`，另一标签页位于 `web.menghuan.life`
- **THEN** BroadcastChannel 不可用，两标签页登出同步依赖 visibilitychange + 30 秒轮询兜底

#### Scenario: 接收方不重复调后端
- **WHEN** 同源标签页 B 收到 `{ type: 'logout' }` 事件
- **THEN** Coordinator 清空本地态后**不**调 `authRepo.logout()`，避免重复请求后端

### Requirement: 登出联动清理

Web 端 `AuthStore.logout()` SHALL 按以下顺序清理：调 `authRepo.logout()` 让后端清除 Cookie → 清空 `localStorage` 中的 `accessToken` / `refreshToken` → 清空 Pinia 状态 → 通过 BroadcastChannel 通知同源标签页。失败 SHALL 抛出错误，不静默吞掉。

#### Scenario: 登出完整流程
- **WHEN** 用户在 Web 端调 `authStore.logout()`
- **THEN** 顺序执行：1) `DELETE /v1/auth/logout` 清除 Cookie，2) `localStorage.removeItem('accessToken'|'refreshToken')`，3) `authStore.user = null`，4) `BroadcastChannel.postMessage({ type: 'logout' })`

#### Scenario: 登出后端失败
- **WHEN** `authRepo.logout()` 抛出 RepositoryError
- **THEN** AuthStore catch 后仍执行本地清理（清 localStorage + Pinia 状态 + 广播），但向 UI 提示 "登出请求失败，本地状态已清理"

#### Scenario: 桌面端 logout 不触发 SSO 广播
- **WHEN** 桌面端调 `authStore.logout()`
- **THEN** Tauri 端无 BroadcastChannel，跳过广播步骤，仅清本地 SQLite Token + Pinia 状态

### Requirement: SSO 会话过期错误码

系统 SHALL 新增 `RepoErrorCodes.SSO_SESSION_EXPIRED` 错误码，用于区分"从未登录"（`UNAUTHORIZED`）与"会话已过期"（`SSO_SESSION_EXPIRED`）两种 401 场景。WebAuthRepository 在检测到 401 + 之前已登录过时抛出 `SSO_SESSION_EXPIRED`。

#### Scenario: SSO 会话过期检测
- **WHEN** WebAuthRepository 调用 `/v1/user/profile` 收到 401，且 Pinia store 中 `authStore.wasLoggedIn === true`
- **THEN** 抛出 `RepositoryError(code: SSO_SESSION_EXPIRED, message: 'SSO 会话已过期', platform: 'web')`

#### Scenario: 首次访问未登录
- **WHEN** WebAuthRepository 调用 `/v1/user/profile` 收到 401，且 `authStore.wasLoggedIn === false`
- **THEN** 不抛错误，返回 `{ loggedIn: false }`（不视为错误）

#### Scenario: UI 区分两种场景
- **WHEN** AuthStore 收到 `SSO_SESSION_EXPIRED` 错误
- **THEN** UI 显示 "会话已过期，正在跳转登录..."，3 秒后调 `authStore.logout()` 清空本地态

## MODIFIED Requirements

（无）
