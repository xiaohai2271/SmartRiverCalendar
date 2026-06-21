## 1. Rust 端基础模块

- [ ] 1.1 创建 `src-tauri/src/auth/pkce.rs` — PkcePair 结构体，CSPRNG 生成 verifier，SHA-256 计算 challenge_hex。编写单元测试：verifier 长度 43 字符、challenge_hex 长度 64 字符、两次生成不同
- [ ] 1.2 创建 `src-tauri/src/auth/desktop_oauth.rs` — Session 创建、浏览器 URL 构造、open::that() 打开浏览器、tokio::spawn 后台轮询、CancellationToken 取消机制、AtomicBool 防重入。编写单元测试：mock API 各种状态
- [ ] 1.3 修改 `src-tauri/src/auth/mod.rs` — 新增 `pub mod pkce; pub mod desktop_oauth;`，保留 `pub mod oauth;`（暂时不删除，避免编译错误）
- [ ] 1.4 添加 Rust 依赖 — `Cargo.toml` 新增 `ring`（CSPRNG + SHA-256）、`hex`、`base64`、`tokio-util`（CancellationToken）、`open`（浏览器打开）

## 2. Rust 端 Tauri Commands

- [ ] 2.1 新增 `auth_oauth_start` command — `src-tauri/src/commands.rs` 新增命令，实现：PKCE 生成 → 创建 session → 打开浏览器 → tokio::spawn 轮询 → 立即返回 session_id
- [ ] 2.2 新增 `auth_oauth_cancel` command — `src-tauri/src/commands.rs` 新增命令，实现：设置 CancellationToken 退出轮询循环
- [ ] 2.3 注册新命令 — `src-tauri/src/lib.rs` 在 `invoke_handler` 中注册 `auth_oauth_start` 和 `auth_oauth_cancel`

## 3. 前端类型与接口变更

- [ ] 3.1 新增 `OAuthProviderId` 类型 — `src/platform/types/auth.repository.ts` 新增 `type OAuthProviderId = 'github' | 'wechat' | 'qq'`，IAuthRepository 新增 `oauthLogin(provider)` 和 `cancelOAuthLogin()` 方法签名
- [ ] 3.2 新增 RepoErrorCodes — `src/platform/errors.ts` 新增 `OAUTH_REDIRECTING`、`OAUTH_REJECTED`、`OAUTH_EXPIRED` 错误码
- [ ] 3.3 补充 User.provider 类型 — `src/types/auth.ts` 将 provider 字段类型从 `'local' | 'github' | 'google' | 'wechat'` 改为 `'local' | 'github' | 'google' | 'wechat' | 'qq'`
- [ ] 3.4 重命名 hasOAuthCallback → hasOAuthLogin — `src/platform/capabilities.ts` 重命名能力声明字段，同步更新 Tauri 和 Web 端的 capabilities 初始化代码

## 4. 前端 Repository 实现

- [ ] 4.1 实现 `TauriAuthRepository.oauthLogin()` — `src/platform/tauri/auth.repo.ts` 新增方法，调用 `safeInvoke('auth_oauth_start', { provider })`，失败时抛 RepositoryError
- [ ] 4.2 实现 `TauriAuthRepository.cancelOAuthLogin()` — `src/platform/tauri/auth.repo.ts` 新增方法，调用 `safeInvoke('auth_oauth_cancel')`
- [ ] 4.3 实现 `WebAuthRepository.oauthLogin()` — `src/platform/web/auth.repo.ts` 新增方法，获取授权 URL → window.location.href → 抛 RepositoryError(OAUTH_REDIRECTING)
- [ ] 4.4 实现 `WebAuthRepository.cancelOAuthLogin()` — `src/platform/web/auth.repo.ts` 新增方法，空操作（Web 端页面已跳转）

## 5. 前端 AuthStore 重构

- [ ] 5.1 新增 AuthStore OAuth 状态 — `src/stores/auth.ts` 新增 `oauthStatus` ref 和 `oauthSessionId` ref
- [ ] 5.2 实现 `AuthStore.oauthLogin()` — `src/stores/auth.ts` 新增方法，并发防护 + 调 authRepo.oauthLogin() + catch OAUTH_REDIRECTING
- [ ] 5.3 实现 `AuthStore.cancelOAuthLogin()` — `src/stores/auth.ts` 新增方法
- [ ] 5.4 实现 `AuthStore.setupOAuthListener()` — `src/stores/auth.ts` 新增方法，监听 Tauri Event "oauth-status-change"，映射状态到 oauthStatus ref
- [ ] 5.5 实现 `AuthStore.handleOAuthConfirmed()` — `src/stores/auth.ts` 新增方法，getCurrentUser + loginTransition
- [ ] 5.6 删除 `AuthStore.loginWithGithub()` — `src/stores/auth.ts` 删除直接调 safeInvoke 的方法
- [ ] 5.7 删除 `AuthService.githubLogin()` — `src/services/auth.ts` 删除方法

## 6. 前端 UI 组件

- [ ] 6.1 创建 `OAuthLoginButton.vue` — `src/components/profile/OAuthLoginButton.vue`，支持多 provider，根据 oauthStatus 显示不同状态文案，authorizing 时显示取消按钮
- [ ] 6.2 修改 `ProfileView.vue` — 替换 GithubLoginButton 为 OAuthLoginButton，更新 import 和事件处理
- [ ] 6.3 删除 `GithubLoginButton.vue` — `src/components/profile/GithubLoginButton.vue` 删除整个文件（含 mockGithubLogin）

## 7. 清理旧代码

- [ ] 7.1 删除 `auth_oauth_github` command — `src-tauri/src/commands.rs` 删除旧命令及其注册
- [ ] 7.2 删除 `oauth.rs` — `src-tauri/src/auth/oauth.rs` 删除文件，从 mod.rs 移除 `pub mod oauth;`
- [ ] 7.3 更新 `AuthHandler.github_oauth_login()` — `src-tauri/src/auth/handler.rs` 中方法仍被测试使用，评估是否一并删除或保留（测试中的 mock api 依赖此方法）

## 8. 测试

- [ ] 8.1 Rust 端 PKCE 测试 — `src-tauri/src/auth/pkce.rs` 内联测试：verifier 长度、challenge_hex 长度、两次生成不同、CSPRNG 不可预测
- [ ] 8.2 Rust 端 desktop_oauth 测试 — mock API 测试：session 创建、轮询各种状态、cancel 机制、浏览器打开失败处理
- [ ] 8.3 前端 TauriAuthRepository.oauthLogin 测试 — `src/__tests__/` mock safeInvoke，验证参数和返回
- [ ] 8.4 前端 WebAuthRepository.oauthLogin 测试 — 验证抛出 OAUTH_REDIRECTING
- [ ] 8.5 前端 AuthStore.oauthLogin 测试 — 并发防护、OAUTH_REDIRECTING catch、handleOAuthConfirmed
- [ ] 8.6 前端 OAuthLoginButton 组件测试 — 各 oauthStatus 下的渲染和交互

## 9. 验证

- [ ] 9.1 运行 `pnpm test:run` — 所有前端测试通过
- [ ] 9.2 运行 `cargo test` — 所有 Rust 测试通过
- [ ] 9.3 运行 `pnpm tauri:dev` — 实际验证桌面端 OAuth 登录流程（需要后端可用）