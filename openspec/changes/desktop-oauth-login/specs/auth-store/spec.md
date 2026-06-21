## MODIFIED Requirements

### Requirement: AuthStore OAuth 登录方法

AuthStore SHALL 提供 `oauthLogin(provider: OAuthProviderId)` 方法，通过 authRepo.oauthLogin() 启动 OAuth 登录。方法 SHALL 在 oauthStatus 不为 idle 时拒绝调用（并发防护）。

AuthStore SHALL 提供 `cancelOAuthLogin()` 方法，通过 authRepo.cancelOAuthLogin() 取消登录。

AuthStore SHALL 删除 `loginWithGithub()` 方法（绕过 Repository 层的架构违规）。

#### Scenario: OAuth 登录成功
- **WHEN** 用户调用 authStore.oauthLogin('github') 且 oauthStatus 为 idle
- **THEN** oauthStatus 变为 'pending'，调用 authRepo.oauthLogin('github')，后续通过 Tauri Event 接收结果

#### Scenario: 并发调用拒绝
- **WHEN** 用户在 oauthStatus 不为 idle 时再次调用 oauthLogin
- **THEN** 方法忽略该调用，不创建新 session

#### Scenario: Web 端跳转处理
- **WHEN** authRepo.oauthLogin() 抛出 RepositoryError(code='OAUTH_REDIRECTING')
- **THEN** AuthStore catch 该错误，oauthStatus 变为 'authorizing'，不视为失败

#### Scenario: OAuth 登录完成
- **WHEN** AuthStore 收到 CONFIRMED 事件
- **THEN** oauthStatus 变为 'confirmed'，调用 authRepo.getCurrentUser() 获取用户信息，调用 calendarStore.loginTransition() 切换日历身份

## ADDED Requirements

### Requirement: AuthStore OAuth 状态管理

AuthStore SHALL 新增以下响应式状态：
- oauthStatus: `'idle' | 'pending' | 'authorizing' | 'confirmed' | 'failed' | 'expired' | 'cancelled' | 'timeout'`
- oauthSessionId: `string | null`

#### Scenario: 状态变更映射
- **WHEN** AuthStore 收到 Tauri Event "oauth-status-change" 
- **THEN** 根据事件 status 值更新 oauthStatus ref（PENDING→pending, AUTHORIZING→authorizing, CONFIRMED→confirmed, FAILED→failed, EXPIRED→expired, CANCELLED→idle, TIMEOUT→timeout）

### Requirement: AuthStore OAuth 事件监听

AuthStore SHALL 在 initialize() 时通过 authRepo 监听 OAuth 状态变更事件，封装 Tauri Event 监听细节（Store 不直接导入 @tauri-apps/api/event）。

#### Scenario: 初始化时设置监听
- **WHEN** AuthStore.initialize() 调用
- **THEN** 同时设置 OAuth 状态监听器，后续 oauthLogin 调用时无需重新设置