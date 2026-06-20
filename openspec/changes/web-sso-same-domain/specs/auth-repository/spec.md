## MODIFIED Requirements

### Requirement: IAuthRepository 接口定义

IAuthRepository SHALL 在现有方法（login、register、logout、getCurrentUser、checkAuthStatus、refreshToken、getPublicKey、oauthLogin、cancelOAuthLogin）基础上新增 SSO 检测方法 `detectSsoSession(): Promise<SsoSessionResult>`。Web 端 SHALL 实现，桌面端 SHALL 返回 `{ loggedIn: false }`。

```typescript
// 新增类型定义
export type SsoSessionResult =
  | { loggedIn: true; user: User }
  | { loggedIn: false }
```

#### Scenario: Web 端 SSO 检测实现
- **WHEN** AuthStore.initialize() 调用 `authRepo.detectSsoSession()`
- **THEN** WebAuthRepository 调用 `GET /v1/user/profile`，带 `credentials: 'include'`
- **AND** 200 响应 → 返回 `{ loggedIn: true, user: <响应体> }`
- **AND** 401 响应 → 返回 `{ loggedIn: false }`
- **AND** 网络错误 → catch 后返回 `{ loggedIn: false }`，不抛错

#### Scenario: 桌面端 SSO 检测为 no-op
- **WHEN** TauriAuthRepository 被注入 `detectSsoSession()` 调用
- **THEN** 直接返回 `{ loggedIn: false }`，桌面端走 SQLite Token 流程

#### Scenario: SSO 会话过期抛新错误码
- **WHEN** WebAuthRepository 调用 `/v1/user/profile` 收到 401，且 `authStore.wasLoggedIn === true`
- **THEN** 抛出 `RepositoryError(code: 'SSO_SESSION_EXPIRED', platform: 'web')`
- **AND** AuthStore catch 后清空本地态并广播登出事件

### Requirement: WebApiClient credentials 行为

WebApiClient.fetch SHALL 全局设置 `credentials: 'include'`，与后端 HttpOnly Cookie 通道对接。Auth 头 `Authorization: Bearer <localStorage token>` 仍按现有逻辑发送，让后端 `JwtAuthenticationFilter` 优先匹配 Bearer，回退到 Cookie。

#### Scenario: Web 端 API 调用携带 Cookie
- **WHEN** WebApiClient.fetch 调用任意 API
- **THEN** 请求携带 `credentials: 'include'`，浏览器自动附加同根域 Cookie

#### Scenario: Bearer 头优先匹配
- **WHEN** localStorage 存在 `accessToken` 且 Cookie 存在 `access_token`
- **THEN** 请求同时发送 `Authorization: Bearer <localStorage token>` 和 `Cookie: access_token=<cookie value>`，后端 `JwtAuthenticationFilter` 优先读 `Authorization` 头

### Requirement: Repository 错误处理新增错误码

所有 Repository 方法 SHALL 在失败时抛出 RepositoryError。新增 `SSO_SESSION_EXPIRED: 'SSO_SESSION_EXPIRED'` 错误码，用于区分 SSO 会话过期与普通未登录。

#### Scenario: SSO 错误码语义
- **WHEN** `authRepo.detectSsoSession()` 检测到 401 + 之前已登录
- **THEN** 抛出 `RepositoryError({ code: 'SSO_SESSION_EXPIRED', message: 'SSO 会话已过期', platform: 'web' })`

## ADDED Requirements

### Requirement: 通知 SsoCoordinator 跨标签页事件

IAuthRepository SHALL 新增 `notifySsoEvent(event: SsoEvent): Promise<void>` 方法，AuthStore 在登录成功或登出后调用。Web 端实现为 `BroadcastChannel.postMessage`，桌面端为 no-op。

```typescript
export type SsoEvent =
  | { type: 'login'; userId: number }
  | { type: 'logout' }
```

#### Scenario: 当前项目登录通知同源标签页
- **WHEN** AuthStore 登录成功
- **THEN** 调用 `authRepo.notifySsoEvent({ type: 'login', userId })` → BroadcastChannel.postMessage

#### Scenario: 当前项目登出通知同源标签页
- **WHEN** AuthStore 登出完成
- **THEN** 调用 `authRepo.notifySsoEvent({ type: 'logout' })` → BroadcastChannel.postMessage

#### Scenario: 桌面端通知 no-op
- **WHEN** TauriAuthRepository 收到 notifySsoEvent 调用
- **THEN** 直接 resolve，不执行任何操作

### Requirement: 订阅 SsoCoordinator 事件流

IAuthRepository SHALL 新增 `subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void` 方法，返回取消订阅函数。Web 端实现为 BroadcastChannel.onmessage 监听，桌面端为 no-op。

#### Scenario: 订阅 Sso 事件
- **WHEN** SsoCoordinator.start() 调用 `authRepo.subscribeSsoEvents(callback)`
- **THEN** 返回取消订阅函数，BroadcastChannel.onmessage 触发时 callback 被调用

#### Scenario: 取消订阅清理
- **WHEN** SsoCoordinator.stop() 调用
- **THEN** 调取消订阅函数，移除 BroadcastChannel.onmessage 监听，关闭 channel
