# 桌面端 OAuth 登录设计文档

> **版本**: v1.0  
> **日期**: 2026-05-31  
> **状态**: 评审通过（两轮 Oracle 评审）

---

## 1. 概述

### 1.1 问题背景

桌面端当前 GitHub 登录是假的（`GithubLoginButton.vue` 中的 `mockGithubLogin()`），且存在多处架构违规：

- `AuthStore.loginWithGithub()` 直接调用 `safeInvoke`，绕过 Repository 层
- `AuthService.githubLogin()` 也直接调用 `safeInvoke`
- `IAuthRepository` 缺少 OAuth 登录接口
- Rust 端 `oauth.rs` 实现了 localhost 回调模式，已不适用

### 1.2 设计目标

1. 实现真实的 OAuth 第三方登录（GitHub、微信、QQ）
2. 复用 Web 端已有的 OAuth 授权流程（Session 中转轮询模式）
3. 修复所有架构违规，使 OAuth 登录走 Repository 接口
4. 删除所有 mock/假登录代码
5. 新增 provider 时前端零改动（只改 UI 配置）

### 1.3 选定方案

**方案 B：架构对齐 — Repository 接口新增 `oauthLogin`，Rust 端实现 Session 轮询**

复用 Web 端 OAuth 流程，桌面端通过 Session 中转轮询获取 token。Rust 端负责 PKCE 生成、Session 创建、浏览器打开、后台轮询，前端通过 Tauri Event 接收结果。

---

## 2. 核心数据流

### 2.1 桌面端 OAuth 登录流程

```
用户点击 "GitHub 登录"
  → AuthStore.oauthLogin('github')
    → TauriAuthRepository.oauthLogin('github')
      → safeInvoke('auth_oauth_start', { provider: 'github' })  ← command 立即返回
        → Rust: PkcePair::new() (CSPRNG 生成)
        → Rust: POST /v1/auth/client/session { provider, code_challenge }
        → Rust: open::that(browser_url) 打开系统浏览器
        → Rust: tokio::spawn(poll_loop) ← 后台轮询，不阻塞 IPC
        ← command 返回 { session_id }

  → AuthStore 监听 Tauri Event "oauth-status-change"
    → { status: 'PENDING' }     → 显示 "等待打开浏览器..."
    → { status: 'AUTHORIZING' } → 显示 "请在浏览器中完成登录"
    → { status: 'CONFIRMED' }   → Rust 已存 token 到 SQLite
      → AuthStore 调 authRepo.getCurrentUser() 获取用户信息
      → calendarStore.loginTransition() 切换日历身份
    → { status: 'FAILED' }      → 显示 "登录被拒绝"
    → { status: 'EXPIRED' }     → 显示 "登录已超时"
```

### 2.2 取消登录流程

```
用户点击 "取消登录"
  → AuthStore.cancelOAuthLogin()
    → TauriAuthRepository.cancelOAuthLogin()
      → safeInvoke('auth_oauth_cancel')
        → Rust: 设置 CancellationToken → tokio::spawn 中的轮询循环退出
        → Rust: emit("oauth-status-change", { status: 'CANCELLED' })
```

### 2.3 Web 端 OAuth 登录流程

```
用户点击 "GitHub 登录"
  → AuthStore.oauthLogin('github')
    → WebAuthRepository.oauthLogin('github')
      → GET /v1/auth/oauth/github/authorize-url
      → window.location.href = authorizeUrl
      → throw RepositoryError({ code: 'OAUTH_REDIRECTING', message: '正在跳转...' })
    ← AuthStore catch OAUTH_REDIRECTING → 不视为失败，显示 "正在跳转授权页面..."

  → 用户在浏览器完成 OAuth → 后端通过 Cookie 设 Token → 重定向回前端
  → 前端 callback 页面解析参数 → AuthStore.handleOAuthCallback() → getCurrentUser()
```

---

## 3. 接口变更

### 3.1 IAuthRepository 接口新增

```typescript
// src/platform/types/auth.repository.ts

/** OAuth 服务商 ID（编译期类型安全） */
type OAuthProviderId = 'github' | 'wechat' | 'qq'

export interface IAuthRepository {
  // ...现有方法不变

  /**
   * 启动 OAuth 第三方登录
   * - 桌面端：启动 Session 轮询流程，通过 Tauri Event 推送状态变更
   * - Web 端：跳转授权页面，抛出 OAUTH_REDIRECTING 错误
   * @throws RepositoryError(code='OAUTH_REDIRECTING') Web 端跳转时
   * @throws RepositoryError 其他错误
   */
  oauthLogin(provider: OAuthProviderId): Promise<void>

  /** 取消正在进行的 OAuth 登录流程 */
  cancelOAuthLogin(): Promise<void>
}
```

### 3.2 TauriAuthRepository 实现

```typescript
// src/platform/tauri/auth.repo.ts 新增

async oauthLogin(provider: OAuthProviderId): Promise<void> {
  // 创建 session 并启动后台轮询（command 立即返回）
  const response = await safeInvoke<{ session_id: string }>(
    'auth_oauth_start',
    { provider }
  )

  if (!response?.session_id) {
    throw new RepositoryError({
      code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
      message: `启动 ${provider} OAuth 登录失败`,
      platform: this.platform,
    })
  }
  // command 返回后，轮询在 Rust 后台执行
  // 前端通过监听 Tauri Event "oauth-status-change" 接收结果
}

async cancelOAuthLogin(): Promise<void> {
  await safeInvoke('auth_oauth_cancel')
}
```

### 3.3 WebAuthRepository 实现

```typescript
// src/platform/web/auth.repo.ts 新增

async oauthLogin(provider: OAuthProviderId): Promise<void> {
  const data = await this.apiClient.get<ApiResponse<{ authorize_url: string }>>(
    `/auth/oauth/${provider}/authorize-url`
  )
  if (data.code === 0 && data.data) {
    // 先跳转，再抛出特殊错误（让 Store 知道这是跳转而非失败）
    window.location.href = data.data.authorize_url
    throw new RepositoryError({
      code: 'OAUTH_REDIRECTING' as string,
      message: '正在跳转 OAuth 授权页面',
      platform: this.platform,
    })
  }
  throw new RepositoryError({
    code: RepoErrorCodes.AUTH_FAILED,
    message: `获取 ${provider} 授权地址失败`,
    platform: this.platform,
  })
}

async cancelOAuthLogin(): Promise<void> {
  // Web 端无需取消（页面已跳转）
}
```

### 3.4 PlatformCapabilities 变更

```typescript
// src/platform/capabilities.ts

// 删除: hasOAuthCallback: boolean
// 新增:
/** 是否支持 OAuth 第三方登录 */
hasOAuthLogin: boolean
```

桌面端 `hasOAuthLogin: true`，Web 端 `hasOAuthLogin: true`。

### 3.5 RepoErrorCodes 新增

```typescript
// src/platform/errors.ts 新增错误码

/** OAuth 授权页面跳转中（非错误，Web 端专用） */
OAUTH_REDIRECTING = 'OAUTH_REDIRECTING',
/** OAuth 登录失败（用户拒绝授权） */
OAUTH_REJECTED = 'OAUTH_REJECTED',
/** OAuth 登录超时 */
OAUTH_EXPIRED = 'OAUTH_EXPIRED',
```

### 3.6 User 类型变更

```typescript
// src/types/auth.ts

// provider 字段补充 'qq'
provider: 'local' | 'github' | 'google' | 'wechat' | 'qq'
```

---

## 4. Rust 端实现

### 4.1 新增文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/auth/desktop_oauth.rs` | Session 中转轮询模块（替代 `oauth.rs`） |
| `src-tauri/src/auth/pkce.rs` | PKCE 密钥对生成（CSPRNG） |

### 4.2 废弃文件

| 文件 | 说明 |
|------|------|
| `src-tauri/src/auth/oauth.rs` | localhost 回调模式，不再适用 |

### 4.3 PKCE 模块 (`pkce.rs`)

```rust
/// PKCE 密钥对
pub struct PkcePair {
    /// 验证码（43 字符 URL-safe Base64，CSPRNG 生成）
    pub verifier: String,
    /// 挑战码（SHA-256 hex，64 字符小写）
    pub challenge_hex: String,
}

impl PkcePair {
    pub fn new() -> Self {
        // 使用 ring::rand::SystemRandom (CSPRNG)
        let rng = ring::rand::SystemRandom::new();
        let mut bytes = [0u8; 32];
        rng.fill(&mut bytes).expect("CSPRNG 生成失败");

        let verifier = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode(&bytes); // 43 字符

        let hash = ring::digest::digest(&ring::digest::SHA256, verifier.as_bytes());
        let challenge_hex = hex::encode(hash.as_ref()); // 64 字符小写

        Self { verifier, challenge_hex }
    }
}
```

### 4.4 Tauri Commands 变更

**新增命令**：

```rust
/// 启动 OAuth 登录（创建 session + 打开浏览器 + 启动后台轮询）
/// command 立即返回 session_id，轮询通过 Tauri Event 推送状态
#[tauri::command]
pub async fn auth_oauth_start(
    provider: String,
    api_client: State<'_, Arc<dyn CalendarApi>>,
    db: State<'_, Mutex<DatabaseConnection>>,
    app: tauri::AppHandle,
) -> Result<serde_json::Value, String> {
    // 1. PKCE 生成
    // 2. POST /v1/auth/client/session { provider, code_challenge }
    // 3. 构造浏览器 URL
    // 4. open::that(url)
    // 5. tokio::spawn(poll_loop) — 后台轮询
    // 6. 返回 { session_id }
}

/// 取消 OAuth 登录（设置 cancel flag）
#[tauri::command]
pub async fn auth_oauth_cancel(
    app: tauri::AppHandle,
) -> Result<(), String> {
    // 设置 CancellationToken，轮询循环检查后退出
}
```

**废弃命令**：

```rust
// 删除: auth_oauth_github（旧的 localhost 回调模式）
```

### 4.5 后台轮询逻辑

```rust
/// 后台轮询任务（tokio::spawn 中执行）
async fn poll_oauth_session(
    app: tauri::AppHandle,
    session_id: String,
    code_verifier: String,
    api_client: Arc<dyn CalendarApi>,
    db: Arc<DatabaseConnection>,
    cancel_token: CancellationToken,
) {
    let mut interval = Duration::from_secs(2);
    let max_attempts = 150; // 5 分钟 / 2 秒
    let start_time = Instant::now();

    for _ in 0..max_attempts {
        // 检查取消
        if cancel_token.is_cancelled() {
            app.emit("oauth-status-change", json!({ status: "CANCELLED" })).ok();
            return;
        }

        // 轮询 GET /v1/auth/client/session/{id}
        let result = fetch_session_status(&api_client, &session_id, &code_verifier).await;

        match result {
            Ok(status) => match status.status.as_str() {
                "PENDING" | "AUTHORIZING" => {
                    app.emit("oauth-status-change", json!({ status: status.status })).ok();
                    sleep(interval).await;
                }
                "CONFIRMED" => {
                    // 保存 token 到 SQLite 加密存储
                    // 保存用户信息到 local_users 表
                    // 设置 API 客户端 token
                    app.emit("oauth-status-change", json!({
                        status: "CONFIRMED",
                        user_id: status.user_id,
                    })).ok();
                    // 立即清除 verifier
                    drop(code_verifier);
                    return;
                }
                "FAILED" => {
                    app.emit("oauth-status-change", json!({ status: "FAILED" })).ok();
                    return;
                }
                _ => { sleep(interval).await; }
            },
            Err(ApiError::RateLimited) => {
                interval = Duration::from_secs(5); // 限速时增大间隔
                sleep(interval).await;
            },
            Err(ApiError::NotFound) => {
                app.emit("oauth-status-change", json!({ status: "EXPIRED" })).ok();
                return;
            },
            Err(_) => {
                // 网络错误：重试 2 次
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
    // 超时
    app.emit("oauth-status-change", json!({ status: "TIMEOUT" })).ok();
}
```

---

## 5. 前端实现

### 5.1 AuthStore 变更

```typescript
// src/stores/auth.ts

// 新增状态
const oauthStatus = ref<'idle' | 'pending' | 'authorizing' | 'confirmed' | 'failed' | 'expired' | 'cancelled' | 'timeout'>('idle')
const oauthSessionId = ref<string | null>(null)

// 新增方法
async function oauthLogin(provider: OAuthProviderId): Promise<void> {
  if (oauthStatus.value !== 'idle') {
    console.warn('[AuthStore] OAuth 登录正在进行中，忽略重复调用')
    return  // 并发防护
  }

  oauthStatus.value = 'pending'

  try {
    const { authRepo } = usePlatform()
    await authRepo.oauthLogin(provider)
    // 桌面端：command 已返回，后续通过 Tauri Event 接收
    // Web 端：已跳转，不会走到这里
  } catch (error) {
    if (error instanceof RepositoryError && error.code === 'OAUTH_REDIRECTING') {
      // Web 端跳转，不是失败
      oauthStatus.value = 'authorizing'
      return
    }
    oauthStatus.value = 'idle'
    throw error
  }
}

async function cancelOAuthLogin(): Promise<void> {
  const { authRepo } = usePlatform()
  await authRepo.cancelOAuthLogin()
  oauthStatus.value = 'idle'
}

// 监听 Tauri Event（桌面端）
function setupOAuthListener(): void {
  const { listen } = usePlatform()

  // 桌面端监听 "oauth-status-change" 事件
  listen('oauth-status-change', (event: any) => {
    const { status } = event.payload

    switch (status) {
      case 'PENDING':
        oauthStatus.value = 'pending'
        break
      case 'AUTHORIZING':
        oauthStatus.value = 'authorizing'
        break
      case 'CONFIRMED':
        oauthStatus.value = 'confirmed'
        // 获取用户信息并完成登录
        handleOAuthConfirmed()
        break
      case 'FAILED':
        oauthStatus.value = 'failed'
        break
      case 'EXPIRED':
        oauthStatus.value = 'expired'
        break
      case 'CANCELLED':
        oauthStatus.value = 'idle'
        break
      case 'TIMEOUT':
        oauthStatus.value = 'timeout'
        break
    }
  })
}

async function handleOAuthConfirmed(): Promise<void> {
  const { authRepo } = usePlatform()
  const currentUser = await authRepo.getCurrentUser()
  if (currentUser) {
    user.value = currentUser
    isAuthenticated.value = true
    oauthStatus.value = 'idle'

    // 日历身份切换（与 login/register 一致）
    const { useCalendarStore } = await import('./calendar')
    const calendarStore = useCalendarStore()
    await calendarStore.loginTransition()
  } else {
    console.error('[AuthStore] OAuth 登录成功但获取用户信息失败')
    oauthStatus.value = 'idle'
  }
}
```

### 5.2 删除的代码

| 文件 | 删除内容 |
|------|----------|
| `src/stores/auth.ts` | `loginWithGithub()` 方法（直接调 safeInvoke） |
| `src/services/auth.ts` | `githubLogin()` 方法（直接调 safeInvoke） |
| `src/components/profile/GithubLoginButton.vue` | 整个文件（含 mockGithubLogin） |

### 5.3 新增组件

**`src/components/profile/OAuthLoginButton.vue`**：

- 支持多 provider（github、wechat、qq）
- 根据 `oauthStatus` 显示不同状态文案：
  - idle → "使用 GitHub 登录" / "使用微信登录" / "使用 QQ 登录"
  - pending → "等待打开浏览器..."
  - authorizing → "请在浏览器中完成登录"
  - failed → "登录被拒绝，请重试"
  - expired/timeout → "登录已超时，请重试"
- 提供取消按钮（authorizing 状态时）

Provider 配置（UI 层，不在 Repository 中）：

```typescript
const PROVIDERS: Record<OAuthProviderId, { name: string; icon: string }> = {
  github: { name: 'GitHub', icon: 'github-icon-svg' },
  wechat: { name: '微信', icon: 'wechat-icon-svg' },
  qq: { name: 'QQ', icon: 'qq-icon-svg' },
}
```

---

## 6. 安全措施

### 6.1 code_verifier 传输风险缓解

后端 API 要求每次轮询都带 `X-Client-Verifier`，无法修改。缓解措施：

1. **全链路 HTTPS**：后端已配置 HTTPS，verifier 不会暴露在明文网络中
2. **后端限速**：30 次/分钟/会话，降低暴力猜测可行性
3. **UUID v4 熵**：session_id 为 122 位随机熵，暴力猜测成本极高
4. **一次性消费**：CONFIRMED 状态被原子读取并删除，即使攻击者截获 verifier，也必须在桌面端轮询之前完成确认才有效
5. **Tauri 端限制**：`X-Client-Verifier` 不出现在 URL 中（不进浏览器历史），仅在 Rust 端 HTTP 请求 Header 中

### 6.2 PKCE 安全要求

- verifier 由 `ring::rand::SystemRandom` (CSPRNG) 生成，32 字节随机数据
- verifier 仅存储在 Rust 进程内存中，轮询完成后 `drop()` 清除
- verifier 不进入任何日志（`#[derive(Debug)]` 时排除）
- 不在前端 JS 中生成或存储

### 6.3 Token 存储

- Token 通过 Rust 端直接存入 SQLite 加密存储（`TokenStore.save_tokens`）
- CONFIRMED 事件 payload 不包含 token 本身，只包含 `user_id`
- 前端通过 `getCurrentUser()` 获取用户信息（token 已在 Rust 端安全管理）

---

## 7. 错误处理

| 场景 | 桌面端处理 | Web 端处理 |
|------|-----------|-----------|
| 浏览器打开失败 | Rust 返回错误 → AuthStore 抛 RepositoryError | 不涉及 |
| 用户拒绝 OAuth 授权 | `FAILED` event → oauthStatus='failed' | callback 页面检测无 code → 显示错误 |
| Session 过期 | `EXPIRED` event → oauthStatus='expired' | 不涉及 |
| 轮询超时（5 分钟） | `TIMEOUT` event → oauthStatus='timeout' | 不涉及 |
| 用户取消登录 | `CANCELLED` event → oauthStatus='idle' | 不涉及 |
| 网络中断 | Rust 端重试 2 次 → 最终 NETWORK_ERROR | 不涉及 |
| 限速（429） | 增大轮询间隔到 5 秒 | 不涉及 |
| verifier 不匹配 | Rust 端抛出错误 → EXPIRED | 不涉及 |
| 两次快速点击 | Store 层 `oauthStatus !== 'idle'` 拒绝 | Store 层拒绝 |

---

## 8. 废弃清单

| 项目 | 类型 | 说明 |
|------|------|------|
| `src-tauri/src/auth/oauth.rs` | Rust 文件 | localhost 回调模式，改用 `desktop_oauth.rs` |
| `auth_oauth_github` command | Tauri command | 改用 `auth_oauth_start` + `auth_oauth_cancel` |
| `src/components/profile/GithubLoginButton.vue` | Vue 组件 | 含 mock 登录，改用 `OAuthLoginButton.vue` |
| `AuthStore.loginWithGithub()` | Store 方法 | 直接调 safeInvoke，改用 `oauthLogin()` |
| `AuthService.githubLogin()` | Service 方法 | 直接调 safeInvoke，整体废弃 AuthService |
| `IAuthRepository.hasOAuthCallback` | 能力声明 | 改名 `hasOAuthLogin` |

---

## 9. 测试策略

### 9.1 Rust 端测试

| 测试 | 说明 |
|------|------|
| `PkcePair::new()` | verifier 长度 43 字符，challenge_hex 长度 64 字符小写，两次生成结果不同 |
| `auth_oauth_start` command | mock API → 创建 session → 返回 session_id |
| `poll_oauth_session` | mock 各种状态（PENDING/AUTHORIZING/CONFIRMED/FAILED/EXPIRED），验证 emit |
| 取消机制 | cancel_token 设置后轮询退出，emit CANCELLED |
| 浏览器打开失败 | open::that 失败时返回错误 |

### 9.2 前端测试

| 测试 | 说明 |
|------|------|
| `TauriAuthRepository.oauthLogin` | mock safeInvoke → 验证参数和返回 |
| `TauriAuthRepository.oauthLogin` 失败 | 验证抛出 RepositoryError |
| `WebAuthRepository.oauthLogin` | 验证抛出 OAUTH_REDIRECTING |
| `AuthStore.oauthLogin` 并发防护 | 两次调用，第二次被忽略 |
| `AuthStore.oauthLogin` Web 端 | catch OAUTH_REDIRECTING，oauthStatus 变为 authorizing |
| `AuthStore.handleOAuthConfirmed` | getCurrentUser + loginTransition |
| OAuthLoginButton 组件 | 各 oauthStatus 下的渲染和交互 |

---

## 10. 相关文档

1. **后端桌面端 OAuth 对接指南**：`C:\Users\zheng\Desktop\RiverCalenderWeb\docs\desktop-oauth-integration-guide.md`
2. **后端 OAuth 设计文档**：`C:\Users\zheng\Desktop\RiverCalenderWeb\docs\superpowers\specs\2026-05-26-oauth-login-design.md`
3. **后端桌面端 OAuth 设计文档**：`C:\Users\zheng\Desktop\RiverCalenderWeb\docs\superpowers\specs\2026-05-30-desktop-oauth-login-design.md`
4. **项目架构约束**：`.agents/skills/tech-constraints/SKILL.md`
5. **项目代码风格**：`.agents/skills/coding-style/SKILL.md`