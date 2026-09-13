## MODIFIED Requirements

### Requirement: AuthStore 初始化集成 SSO 检测

AuthStore.initialize() SHALL 在现有 `getCurrentUser()` 失败后调用 `authRepo.detectSsoSession()` 作为兜底检测，确保 RiverCalenderWeb 已登录场景下当前项目自动进入已登录态。

#### Scenario: RiverCalenderWeb 已登录时自动登录
- **WHEN** AuthStore.initialize() 执行，`getCurrentUser()` 失败（无 Bearer Token）
- **AND** `authRepo.detectSsoSession()` 返回 `{ loggedIn: true, user }`
- **THEN** AuthStore 设置 `user = user`，`isAuthenticated = true`，`wasLoggedIn = true`，UI 直接进入已登录态

#### Scenario: 两者都未登录
- **WHEN** `getCurrentUser()` 失败且 `detectSsoSession()` 返回 `{ loggedIn: false }`
- **THEN** AuthStore 保持 `user = null`，`isAuthenticated = false`，UI 显示登录表单

#### Scenario: SSO 会话过期处理
- **WHEN** `authRepo.detectSsoSession()` 抛出 `RepositoryError(code='SSO_SESSION_EXPIRED')`
- **THEN** AuthStore catch 后清空 `localStorage` token + `user = null`，UI 显示 "会话已过期" 提示并引导重新登录

### Requirement: AuthStore 登出联动跨标签页

AuthStore.logout() SHALL 在完成后端 logout 请求 + 本地状态清理后，通过 `authRepo.notifySsoEvent({ type: 'logout' })` 通知同源标签页（仅 Web 端），确保其他标签页同步登出态。

#### Scenario: 登出完整流程
- **WHEN** 用户调 `authStore.logout()`
- **THEN** 顺序执行：1) `authRepo.logout()` 清除 Cookie，2) 清 `localStorage` token，3) `user = null`，4) `authRepo.notifySsoEvent({ type: 'logout' })`，5) 重定向到登录页

#### Scenario: 桌面端登出不广播
- **WHEN** 桌面端 Tauri 调 `authStore.logout()`
- **THEN** `authRepo.notifySsoEvent()` 为 no-op，跳过广播步骤

### Requirement: AuthStore 订阅 Sso 事件

AuthStore SHALL 在 Web 端 `initialize()` 时通过 `authRepo.subscribeSsoEvents(callback)` 订阅同源标签页 SSO 事件，收到 `logout` 事件时清空本地态不重复调后端，收到 `login` 事件时重新调 `getCurrentUser()` 同步用户信息。

#### Scenario: 收到 logout 事件
- **WHEN** 同源另一标签页发送 `{ type: 'logout' }` 广播
- **THEN** AuthStore callback 清空 `user = null`、`localStorage` token，**不**调 `authRepo.logout()` 避免重复

#### Scenario: 收到 login 事件
- **WHEN** 同源另一标签页发送 `{ type: 'login', userId: 123 }` 广播
- **THEN** AuthStore callback 调 `authRepo.getCurrentUser()` 拉取最新用户信息并更新 `user`

#### Scenario: 桌面端不订阅
- **WHEN** Tauri 端 `authRepo.subscribeSsoEvents()` 为 no-op
- **THEN** AuthStore 不注册回调，桌面端无跨标签页同步需求

### Requirement: AuthStore wasLoggedIn 状态跟踪

AuthStore SHALL 新增 `wasLoggedIn: boolean` 响应式状态，用于 `WebAuthRepository` 区分"首次未登录"与"曾经登录但 SSO 会话已过期"两种 401 场景。AuthStore 在用户成功登录后设置 `wasLoggedIn = true`，应用启动时从 `localStorage` 的 `lastKnownLoggedIn` 字段恢复。

#### Scenario: 用户登录后状态
- **WHEN** 用户在当前项目登录成功
- **THEN** `wasLoggedIn = true`，`localStorage.lastKnownLoggedIn = 'true'`

#### Scenario: 应用启动恢复状态
- **WHEN** AuthStore.initialize() 启动
- **THEN** 读取 `localStorage.lastKnownLoggedIn`，若为 `'true'` 则初始化 `wasLoggedIn = true`

#### Scenario: SSO 会话过期错误判断
- **WHEN** `authRepo.detectSsoSession()` 收到 401
- **AND** `wasLoggedIn === true`
- **THEN** 抛 `SSO_SESSION_EXPIRED` 错误

## ADDED Requirements

### Requirement: AuthStore SsoCoordinator 生命周期管理

AuthStore SHALL 在 Web 端 `initialize()` 时启动 `SsoCoordinator`，在应用销毁时（`unmounted` 或路由离开）停止。SsoCoordinator 负责协调 visibilitychange、定时轮询、跨标签页订阅三者。

#### Scenario: 启动 SsoCoordinator
- **WHEN** Web 端 `AuthStore.initialize()` 完成
- **THEN** 调 `ssoCoordinator.start({ onSessionChange: handleSessionChange })`
- **AND** SsoCoordinator 注册 visibilitychange 监听、启动定时轮询、订阅 BroadcastChannel

#### Scenario: 停止 SsoCoordinator
- **WHEN** AuthStore 在应用 unmount 时清理
- **THEN** 调 `ssoCoordinator.stop()`，移除所有监听器、清除定时器、关闭 BroadcastChannel

#### Scenario: 桌面端无 SsoCoordinator
- **WHEN** 桌面端 `AuthStore.initialize()` 执行
- **THEN** 跳过 SsoCoordinator 启动，桌面端无 visibilitychange 和 BroadcastChannel
