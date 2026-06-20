## ADDED Requirements

### Requirement: 桌面端 Session 中转轮询 OAuth 登录

系统 SHALL 通过 Session 中转轮询机制为桌面端提供第三方 OAuth 登录能力，复用 Web 端已有的 OAuth 授权流程。支持的 provider 包括 github、wechat、qq。

#### Scenario: GitHub 登录成功
- **WHEN** 用户在桌面端点击 "使用 GitHub 登录" 按钮
- **THEN** 系统生成 PKCE 密钥对（CSPRNG），创建后端 session，打开系统浏览器到 `/client-login?session_id=xxx&provider=github`，并在后台轮询 session 状态；当 session 状态变为 CONFIRMED 时，Rust 端保存 token 到 SQLite 加密存储并通知前端，前端获取用户信息并完成登录

#### Scenario: 用户拒绝 OAuth 授权
- **WHEN** 用户在浏览器中拒绝 GitHub 授权
- **THEN** 后端 session 状态变为 FAILED，桌面端收到 FAILED 事件，显示 "登录被拒绝，请重试"

#### Scenario: Session 过期
- **WHEN** 用户未在 5 分钟内完成浏览器中的 OAuth 授权
- **THEN** session 自然过期，桌面端收到 EXPIRED 事件，显示 "登录已超时，请重试"

#### Scenario: 用户取消登录
- **WHEN** 用户在桌面端点击 "取消登录" 按钮
- **THEN** Rust 端设置 CancellationToken，轮询循环退出，桌面端收到 CANCELLED 事件，oauthStatus 重置为 idle

### Requirement: PKCE 安全生成与管理

系统 SHALL 使用 CSPRNG（ring::rand::SystemRandom）生成 code_verifier（32 字节随机数据，43 字符 URL-safe Base64 编码），并通过 SHA-256 计算 code_challenge（64 字符小写十六进制字符串）。verifier 仅存储在 Rust 进程内存中，轮询完成后立即 drop() 清除，不进入任何日志。

#### Scenario: PKCE 密钥对生成
- **WHEN** 系统启动 OAuth 登录流程
- **THEN** Rust 端使用 SystemRandom 生成 verifier，计算 SHA-256 challenge_hex，将 challenge_hex 发送到后端创建 session，将 verifier 保密存储在内存中供轮询时使用

#### Scenario: verifier 安全清除
- **WHEN** OAuth 登录完成（CONFIRMED/FAILED/EXPIRED/CANCELLED/TIMEOUT）
- **THEN** Rust 端立即 drop() verifier，确保不残留在内存中

### Requirement: 后台轮询不阻塞 IPC

系统 SHALL 使用 tokio::spawn 在后台执行 session 状态轮询，`auth_oauth_start` Tauri command 立即返回 session_id，不阻塞前端 IPC 通道。轮询状态变更通过 Tauri Event `oauth-status-change` 推送到前端。

#### Scenario: 后台轮询进度推送
- **WHEN** 轮询检测到 session 状态为 PENDING 或 AUTHORIZING
- **THEN** Rust 端通过 `app.emit("oauth-status-change", { status })` 通知前端，前端更新 oauthStatus ref

#### Scenario: 轮询超时处理
- **WHEN** 轮询超过 max_attempts（5 分钟）仍未收到 CONFIRMED
- **THEN** Rust 端 emit TIMEOUT 事件，前端显示 "登录已超时"

#### Scenario: 轮询限速处理
- **WHEN** 轮询请求收到 HTTP 429（限速）
- **THEN** Rust 端增大轮询间隔到 5 秒后继续轮询

### Requirement: 并发防护

系统 SHALL 防止同一用户同时创建多个 OAuth session。Rust 端使用 AtomicBool 标记"有 OAuth 进行中"，Store 端使用 oauthStatus ref 防止重复调用。

#### Scenario: 快速双击防护
- **WHEN** 用户在 oauthStatus 不为 idle 时再次点击登录按钮
- **THEN** Store 层忽略该调用，不创建新 session

### Requirement: Token 存储安全

系统 SHALL 将 OAuth 登录获得的 token 通过 Rust 端直接存入 SQLite 加密存储（TokenStore.save_tokens），不经过前端 JS 层。CONFIRMED 事件 payload 不包含 token 本身，只包含 user_id。

#### Scenario: Token 安全存储
- **WHEN** 轮询检测到 CONFIRMED 状态
- **THEN** Rust 端将 access_token、refresh_token、expires_at 保存到 SQLite 加密存储，将用户信息保存到 local_users 表，设置 API 客户端 token，然后 emit CONFIRMED 事件（仅含 user_id）

### Requirement: code_verifier 传输风险接受

系统 SHALL 在每次轮询请求中通过 X-Client-Verifier 请求头传递 code_verifier（后端 API 契约已锁定，无法修改）。缓解措施包括：全链路 HTTPS、后端限速 30次/分、UUID v4 122位熵、CONFIRMED 状态一次性消费原子删除。

#### Scenario: verifier 通过 HTTPS 传输
- **WHEN** Rust 端发起轮询请求
- **THEN** verifier 通过 HTTPS X-Client-Verifier 请求头传输，不出现在 URL 中，不进入浏览器历史或代理日志

### Requirement: 浏览器打开失败处理

系统 SHALL 处理浏览器打开失败的情况（如无浏览器环境），Rust 端 catch open::that() 错误并返回给前端，前端显示手动 URL 供用户复制打开。

#### Scenario: 无浏览器环境
- **WHEN** open::that() 调用失败
- **THEN** Rust 端返回错误给前端，前端显示 session URL 供用户手动打开