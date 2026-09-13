## Why

桌面端当前 GitHub 登录是假的（`mockGithubLogin()`），且存在多处架构违规：`AuthStore.loginWithGithub()` 和 `AuthService.githubLogin()` 直接调用 `safeInvoke` 绕过 Repository 层。Web 端已实现真实 OAuth 登录（GitHub/微信/QQ），桌面端需要复用 Web 端 OAuth 流程实现真实第三方登录，同时修复架构违规。

## What Changes

- **新增 `oauthLogin(provider)` 和 `cancelOAuthLogin()` 方法**：`IAuthRepository` 接口新增 OAuth 登录方法，桌面端通过 Session 中转轮询模式复用 Web 端 OAuth 流程
- **新增 Rust 端 `desktop_oauth.rs` 和 `pkce.rs` 模块**：PKCE 密钥对生成（CSPRNG）+ Session 创建 + 后台轮询（tokio::spawn）+ Tauri Event 推送状态
- **新增 `auth_oauth_start` 和 `auth_oauth_cancel` Tauri command**：替代旧的 `auth_oauth_github`
- **新增 `OAuthLoginButton.vue` 组件**：支持多 provider（github/wechat/qq），替代 `GithubLoginButton.vue`
- **新增 `oauthStatus` 状态字段**：AuthStore 管理 OAuth 登录进度状态
- **新增 RepoErrorCodes**：`OAUTH_REDIRECTING`、`OAUTH_REJECTED`、`OAUTH_EXPIRED`
- ****BREAKING** 删除 `auth_oauth_github` Tauri command**：旧的 localhost 回调模式
- ****BREAKING** 删除 `oauth.rs`**：localhost 回调模块
- ****BREAKING** 删除 `GithubLoginButton.vue`**：含 mock 登录的组件
- ****BREAKING** 删除 `AuthStore.loginWithGithub()`**：绕过 Repository 的方法
- ****BREAKING** 删除 `AuthService.githubLogin()`**：绕过 Repository 的方法
- ****BREAKING** 重命名 `hasOAuthCallback` → `hasOAuthLogin`**：能力声明语义化
- **补充 `User.provider` 类型**：新增 `'qq'`

## Capabilities

### New Capabilities
- `desktop-oauth-login`: 桌面端 Session 中转轮询 OAuth 登录（PKCE 生成、Session 创建、后台轮询、Tauri Event 推送、取消机制）

### Modified Capabilities
- `auth-repository`: IAuthRepository 新增 `oauthLogin()` 和 `cancelOAuthLogin()` 方法
- `platform-capabilities`: `hasOAuthCallback` → `hasOAuthLogin` 重命名
- `auth-store`: 新增 `oauthStatus`/`oauthSessionId` 状态、`oauthLogin()`/`cancelOAuthLogin()`/`setupOAuthListener()` 方法，删除 `loginWithGithub()`

## Impact

- **Rust 后端**：新增 2 个文件（`desktop_oauth.rs`、`pkce.rs`），删除 1 个文件（`oauth.rs`），修改 `commands.rs`（新增 2 command、删除 1 command）、`auth/mod.rs`
- **前端 Repository**：修改 `auth.repository.ts`（接口新增）、`tauri/auth.repo.ts`（新增 2 方法）、`web/auth.repo.ts`（新增 2 方法）
- **前端 Store**：修改 `auth.ts`（重构 OAuth 登录逻辑）
- **前端组件**：删除 `GithubLoginButton.vue`，新增 `OAuthLoginButton.vue`，修改 `ProfileView.vue`
- **前端类型**：修改 `auth.ts`（provider 类型）、`errors.ts`（新增错误码）、`capabilities.ts`（重命名）
- **前端服务**：删除 `services/auth.ts` 中 `githubLogin()` 方法
- **依赖**：Rust 端新增 `ring`（CSPRNG + SHA-256）、`hex`（十六进制编码）、`base64`（URL-safe 编码）
- **后端 API**：无改动（契约已锁定）

## Non-Goals

- 不实现 Web 端 OAuth callback 页面到 Store 的对接（那是 Web 端项目的事）
- 不重构 AuthService 整体废弃（虽然价值已低，但超出本次范围）
- 不实现 Android 端 OAuth 登录（架构预留但不在本次实现范围）
- 不修改后端 API（契约已锁定）
- 不实现 provider 动态列表获取（初期硬编码 3 种 provider）