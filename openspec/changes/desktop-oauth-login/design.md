## Context

桌面端当前 GitHub 登录是假的（`mockGithubLogin()`），且存在多处架构违规：
- `AuthStore.loginWithGithub()` 直接调用 `safeInvoke`，绕过 Repository 层
- `AuthService.githubLogin()` 也直接调用 `safeInvoke`
- Rust 端 `oauth.rs` 实现了 localhost 回调模式，已不适用

Web 端已实现真实 OAuth 登录（GitHub/微信/QQ），后端提供了 Session 中转轮询 API。桌面端需要复用 Web 端 OAuth 流程，同时修复架构违规。

后端 API 契约已锁定，详见 `C:\Users\zheng\Desktop\RiverCalenderWeb\docs\desktop-oauth-integration-guide.md`。

## Goals / Non-Goals

**Goals:**
1. 实现真实的 OAuth 第三方登录（GitHub、微信、QQ）
2. 复用 Web 端已有的 OAuth 授权流程（Session 中转轮询模式）
3. 修复所有架构违规，使 OAuth 登录走 Repository 接口
4. 删除所有 mock/假登录代码
5. 新增 provider 时前端零改动（只改 UI 配置）

**Non-Goals:**
- 不实现 Web 端 OAuth callback 页面到 Store 的对接（那是 Web 端项目的事）
- 不重构 AuthService 整体废弃（虽然价值已低，但超出本次范围）
- 不实现 Android 端 OAuth 登录（架构预留但不在本次实现范围）
- 不修改后端 API（契约已锁定）

## Decisions

### D1: Session 中转轮询 vs localhost 回调 vs Custom URL Scheme

**选择**: Session 中转轮询

**理由**: 
- 完全复用 Web 端 OAuth 流程，新增 provider 时桌面端零改动
- 无需 localhost HTTP 服务器（无端口冲突/防火墙风险）
- 后端 API 契约已锁定
- 用户体验类似扫码登录，直观清晰

**替代方案**: localhost 回调（当前 oauth.rs）需每个 provider 注册 redirect URI；Custom URL Scheme 需注册 scheme + Tauri deep link 插件。

### D2: Rust 端全做 PKCE + 轮询 vs 前端直接调 API

**选择**: Rust 端全做

**理由**:
- PKCE verifier 是安全敏感数据，不能暴露给前端 JS
- 打开系统浏览器是系统级操作
- 长时间轮询在 tokio::spawn 中更可靠
- Token 直接存入 SQLite 加密存储，不经过 JS 层

### D3: 异步事件模式 vs 同步等待

**选择**: 异步事件模式（Tauri Event）

**理由**:
- 同步等待会阻塞 IPC 通道，safeInvoke 超时 5 分钟不现实
- tokio::spawn 后台轮询 + `app.emit()` 推送状态，前端可实时显示进度
- 符合 Tauri 2.x 最佳实践

### D4: oauthLogin 返回 void vs AuthResult

**选择**: 返回 void

**理由**:
- 结果通过 Tauri Event 异步推送，无法在 Promise 中同步返回
- Web 端跳转后页面卸载，也不适合返回 AuthResult
- Store 通过监听状态变更获取结果

### D5: Web 端 oauthLogin 抛 OAUTH_REDIRECTING vs 返回 null

**选择**: 抛 RepositoryError(OAUTH_REDIRECTING)

**理由**:
- 返回 null 吞掉行为，违反 Repository 禁止清单
- OAUTH_REDIRECTING 是控制流语义而非错误，Store 层可 catch 并特殊处理
- 让 Store 明确知道这是"跳转中"而非"失败了"

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| code_verifier 每次轮询重复传输（后端 API 不改） | HTTPS 强制 + 后端限速 30次/分 + UUID v4 122位熵 + 一次性消费。风险可控，已接受 |
| Rust 端 tokio::spawn 轮询与 cancel 机制 | CancellationToken + AtomicBool 防重入。轮询循环每 2 秒检查 cancel |
| Store 监听 Tauri Event 可能违反架构 | Event 监听封装在 TauriAuthRepository 内部，Store 只调 authRepo.oauthLogin() |
| 并发双击创建两个 session | Rust 端 AtomicBool 防重入 + Store 端 oauthStatus !== 'idle' 拒绝 |
| 浏览器打开失败（无浏览器环境） | Rust 端 catch open::that 错误，返回给前端显示手动 URL |
| Cancel 后 session 仍存活 5 分钟 | session 自然过期，不主动删除。风险已接受 |

## Migration Plan

1. 先新增所有新代码（PKCE、desktop_oauth、auth_oauth_start/cancel、IAuthRepository.oauthLogin、OAuthLoginButton.vue）
2. 再删除旧代码（oauth.rs、auth_oauth_github、GithubLoginButton.vue、loginWithGithub）
3. 重命名 hasOAuthCallback → hasOAuthLogin
4. 补充 User.provider 类型 'qq'
5. 运行 `pnpm test:run` + `cargo test` 确保无破坏