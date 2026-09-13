## MODIFIED Requirements

### Requirement: IAuthRepository 接口定义

IAuthRepository SHALL 定义以下方法：
- login(email, encryptedPassword): Promise<AuthResult | null>
- register(email, encryptedPassword, displayName): Promise<AuthResult | null>
- logout(): Promise<void>
- getCurrentUser(): Promise<User | null>
- checkAuthStatus(): Promise<boolean>
- refreshToken(): Promise<boolean>
- getPublicKey(): Promise<string | null>
- oauthLogin(provider: OAuthProviderId): Promise<void> — 启动 OAuth 第三方登录
- cancelOAuthLogin(): Promise<void> — 取消正在进行的 OAuth 登录

OAuthProviderId SHALL 为编译期类型安全联合类型：`'github' | 'wechat' | 'qq'`

#### Scenario: 桌面端 OAuth 登录调用
- **WHEN** Store 调用 authRepo.oauthLogin('github')
- **THEN** TauriAuthRepository 调用 safeInvoke('auth_oauth_start', { provider: 'github' })，command 立即返回，后续状态通过 Tauri Event 推送

#### Scenario: Web 端 OAuth 登录调用
- **WHEN** Store 调用 authRepo.oauthLogin('github')
- **THEN** WebAuthRepository 获取授权 URL 并跳转，抛出 RepositoryError(code='OAUTH_REDIRECTING')

#### Scenario: 取消 OAuth 登录
- **WHEN** Store 调用 authRepo.cancelOAuthLogin()
- **THEN** 桌面端 Rust 设置 CancellationToken 退出轮询；Web 端无操作（页面已跳转）

### Requirement: Repository 错误处理

所有 Repository 方法 SHALL 在失败时抛出 RepositoryError（含 code、message、platform），禁止静默返回 null 吞掉错误。

新增错误码：
- OAUTH_REDIRECTING: OAuth 授权页面跳转中（非错误，Web 端专用控制流）
- OAUTH_REJECTED: OAuth 登录失败（用户拒绝授权）
- OAUTH_EXPIRED: OAuth 登录超时

#### Scenario: OAuth 登录启动失败
- **WHEN** safeInvoke('auth_oauth_start') 返回空结果
- **THEN** TauriAuthRepository 抛出 RepositoryError(code=PLATFORM_UNAVAILABLE)

## ADDED Requirements

### Requirement: OAuthProviderId 类型定义

系统 SHALL 定义 `OAuthProviderId` 为编译期类型安全联合类型 `'github' | 'wechat' | 'qq'`，确保 oauthLogin 方法参数在编译期约束合法值。

#### Scenario: 传入非法 provider
- **WHEN** 开发者尝试调用 oauthLogin('invalid_provider')
- **THEN** TypeScript 编译器报类型错误