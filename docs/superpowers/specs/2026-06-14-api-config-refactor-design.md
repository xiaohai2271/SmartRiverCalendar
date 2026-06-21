# 调试界面 API 环境配置重构设计

> 日期：2026-06-14
> 状态：已实现

## 背景

当前调试界面的 API 配置存在以下问题：

1. **默认 Mock 模式**：应用首次启动默认进入 Mock 模式，需手动切换到 Real 才能连接后端
2. **平台地址硬编码**：OAuth 跳转地址 `WEB_BASE_URL` 在 `desktop_oauth.rs:25` 硬编码为常量 `https://calendar.menghuan.life`，与 API 地址耦合
3. **Mock 模式冗余**：Mock 模式已不再有实际用途，增加不必要的代码路径
4. **无法验证连通性**：切换环境后无法确认地址是否可达

## 目标

1. 默认使用线上环境，开箱即用
2. API 接口地址与平台地址（OAuth 跳转）分离，各自独立配置
3. 移除 Mock 模式（生产代码）
4. 支持检查地址连通性
5. 保留切换到自定义地址的能力
6. Web 端支持同样的配置能力，数据存储到 localStorage

## 设计方案

### 一、ApiConfig 结构变更

**当前结构**：

```rust
pub struct ApiConfig {
    pub mode: ApiMode,        // Mock | Real
    pub base_url: String,     // API 接口地址
    pub github_client_id: String,
}
```

**新结构**：

```rust
pub struct ApiConfig {
    pub api_url: String,       // API 接口地址（如 https://calendar.menghuan.life/api）
    pub platform_url: String,  // 平台地址（OAuth 跳转，如 https://calendar.menghuan.life）
    pub github_client_id: String,
}
```

**变更要点**：
- 移除 `ApiMode` 枚举及所有 `Mock`/`Real` 分支
- `base_url` 重命名为 `api_url`，语义更清晰
- 新增 `platform_url`，替代 `desktop_oauth.rs` 中的 `WEB_BASE_URL` 常量
- `Default` trait 实现返回线上默认值
- 环境变量重命名：`SMART_RIVER_API_BASE_URL` → `SMART_RIVER_API_URL`，新增 `SMART_RIVER_PLATFORM_URL`
- `from_env()` 移除 `SMART_RIVER_API_MODE` 检查

**线上默认值**：

| 字段 | 默认值 |
|------|--------|
| `api_url` | `https://calendar.menghuan.life/api` |
| `platform_url` | `https://calendar.menghuan.life` |
| `github_client_id` | 从环境变量 `SMART_RIVER_GITHUB_CLIENT_ID` 读取，无则留空 |

### 二、Mock 模式移除（生产代码）

**移除范围**：

| 文件 | 变更 |
|------|------|
| `src-tauri/src/api/config.rs` | 删除 `ApiMode` 枚举、`is_mock()`/`is_real()`/`default_mock()`/`real()` 方法 |
| `src-tauri/src/api/proxy.rs` | 移除 `create_client()` 中的 Mock 分支，简化为直接创建 `RealApiClient`；`get_base_url()` 返回类型从 `Option<String>` 改为 `String` |
| `src-tauri/src/api/mod.rs` | 移除 `ApiMode` 重导出、`create_api_client()` 中 Mock 分支 |

**`mock.rs` 保留策略**：

`mock.rs` **不删除**，保留供测试使用。在 `mod.rs` 中改为条件编译：

```rust
#[cfg(test)]
pub mod mock;
```

`MockApiClient` 的公开导出也改为仅测试可见：

```rust
#[cfg(test)]
pub use mock::MockApiClient;
```

这样 `sync_engine/sync.rs` 等 9 处测试仍可使用 `MockApiClient`，生产代码不引用。

**ProxyApiClient 简化**：

移除模式切换逻辑，`ProxyApiClient` 仍保留 `switch()` 方法（用于切换 `api_url` + `platform_url`），但内部始终为 `RealApiClient`：

```rust
pub struct ProxyApiClient {
    inner: RwLock<Arc<RealApiClient>>,
    config: RwLock<ApiConfig>,
}
```

`switch()` 内部创建新客户端时传 `config.api_url.clone()` 而非 `config.base_url.clone()`。

新增 `get_platform_url()` 方法，供 `auth_oauth_start` 获取平台地址。

### 三、桌面端 OAuth 跳转地址改造

**当前**：`desktop_oauth.rs:25` 硬编码 `const WEB_BASE_URL`

**改造后**：`start_oauth` 函数新增 `platform_url` 参数，构造浏览器 URL 时使用：

```rust
pub async fn start_oauth(
    provider: &str,
    api_base_url: &str,
    platform_url: &str,    // 新增
    app: tauri::AppHandle,
    cancel_token: CancellationToken,
) -> Result<String, String> {
    // ...
    let browser_url = format!(
        "{}/client-login?session_id={}&provider={}",
        platform_url, session_id, provider
    );
    // ...
}
```

**`auth_oauth_start` 命令变更**：

从 `ProxyApiClient` 配置中获取 `platform_url`：

```rust
let platform_url = proxy.get_platform_url();
let session_id = crate::auth::desktop_oauth::start_oauth(
    &provider,
    &api_base_url,
    &platform_url,   // 新增
    app,
    cancel_token,
).await?;
```

### 四、数据库持久化变更

`app_settings` 表中的配置键：

| 键 | 说明 |
|----|------|
| `api_url` | API 接口地址 |
| `api_platform_url` | 平台地址 |

> **注意**：本地开发期间的历史数据库可直接删除重建，无需迁移逻辑。

### 五、Tauri 命令变更（仅桌面端）

#### 5.1 `switch_api_config`

**当前签名**：`switch_api_config(mode: String, base_url: String)`

**新签名**：`switch_api_config(api_url: String, platform_url: String)`

移除 `mode` 参数，只接收两个地址。新增防重入保护，使用 `AtomicBool` 防止并发切换。

#### 5.2 `get_api_config`

返回值新增 `platformUrl` 字段：

```json
{
  "apiUrl": "https://calendar.menghuan.life/api",
  "platformUrl": "https://calendar.menghuan.life"
}
```

#### 5.3 `auth_get_public_key` Mock 降级分支移除

`commands.rs:1776-1801` 中当前 Mock 模式返回 `"mock_rsa_public_key"`，重构后始终从 API 获取公钥。

#### 5.4 `check_api_connectivity` — 不新增

检查连通性改为前端统一实现（见 6.4），桌面端和 Web 端共用 `src/utils/connectivity.ts`，无需 Tauri 命令。

### 六、前端变更

#### 6.1 `DebugView.vue` API 配置 Tab 重构

**当前 UI**：模式选择（Mock/Real）+ API 地址输入框

**新 UI**：

```
┌─ API 配置 ──────────────────────────────────────┐
│                                                  │
│  [线上环境]  按钮 — 一键填入默认线上地址           │
│                                                  │
│  API 接口地址                                     │
│  ┌──────────────────────────────┐ [检查连接] ✅   │
│  │ https://calendar.menghuan.life/api            │
│  └──────────────────────────────┘                │
│                                                  │
│  平台地址（OAuth 跳转）                            │
│  ┌──────────────────────────────┐ [检查连接] ✅   │
│  │ https://calendar.menghuan.life                │
│  └──────────────────────────────┘                │
│                                                  │
│  [应用配置]                                       │
│                                                  │
│  ⚠️ 切换地址会清除当前登录状态和 Token，需重新登录    │
└──────────────────────────────────────────────────┘
```

**交互细节**：

- 点击「线上环境」按钮：自动填入两个默认地址
- 「检查连接」按钮：调用 `checkConnectivity()`（见 6.4），显示结果图标
  - ✅ 可达（绿色，显示延迟）
  - ❌ 不可达（红色，显示错误原因）
  - ⚠️ 可达但未检测到"小河日历"关键字（黄色警告，提示可能是错误地址，仍允许保存）
  - ⏳ 检查中（loading 状态）
- 「应用配置」按钮：桌面端调用 `switchApiConfig`，Web 端调用 `switchWebApiConfig`，确认对话框提示重登
- 地址输入前校验格式：必须以 `http://` 或 `https://` 开头，自动去除尾部斜杠

#### 6.2 `src/utils/tauri.ts` 变更

```typescript
// 新接口
export interface ApiConfigInfo {
  apiUrl: string
  platformUrl: string
}

export async function getApiConfig(): Promise<ApiConfigInfo | null>

export async function switchApiConfig(
  apiUrl: string,
  platformUrl: string
): Promise<{ success: boolean; apiUrl: string; platformUrl: string } | null>
```

#### 6.3 Web 端 API 配置

Web 端当前 `BASE_URL` 是模块顶层常量，无法运行时切换。需要改造为动态读取。

**6.3.1 `src/platform/web/api-client.ts` 改造**

将 `BASE_URL` 从顶层常量改为动态读取函数：

```typescript
// localStorage 键
const LS_KEY_API_URL = 'sr_api_url'
const LS_KEY_PLATFORM_URL = 'sr_platform_url'

// 默认值
const DEFAULT_API_URL = 'https://calendar.menghuan.life/api'
const DEFAULT_PLATFORM_URL = 'https://calendar.menghuan.life'

/** 获取当前 API 接口地址 */
function getApiUrl(): string {
  return localStorage.getItem(LS_KEY_API_URL) || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL
}

/** 获取当前平台地址 */
function getPlatformUrl(): string {
  return localStorage.getItem(LS_KEY_PLATFORM_URL) || DEFAULT_PLATFORM_URL
}
```

**所有 `BASE_URL` 引用点改为动态调用**：

| 位置 | 当前 | 改为 |
|------|------|------|
| `apiFetch` 中 `fetch(\`${BASE_URL}${path}\`)` | 静态常量 | `getApiUrl()` |
| `doRefreshToken` 中 `fetch(\`${BASE_URL}/auth/refresh\`)` | 静态常量 | `getApiUrl()` |
| 重试请求 `fetch(\`${BASE_URL}${path}\`)` | 静态常量 | `getApiUrl()` |
| `WebApiClient.getBaseUrl()` | 返回 `BASE_URL` | 返回 `getApiUrl()` |

**6.3.2 `WebApiClient` 新增方法**

```typescript
/** 设置 API 接口地址（存入 localStorage） */
setApiUrl(url: string): void {
  localStorage.setItem(LS_KEY_API_URL, url)
}

/** 设置平台地址（存入 localStorage） */
setPlatformUrl(url: string): void {
  localStorage.setItem(LS_KEY_PLATFORM_URL, url)
}

/** 获取平台地址 */
getPlatformUrl(): string {
  return getPlatformUrl()
}
```

**6.3.3 Web 端 OAuth 跳转改造**

`auth.repo.ts` 中 `oauthLogin` 当前通过后端接口获取 `authorize_url`，不受 `api_url` 切换影响。

`detectSsoSession` 中直接拼接了 `${this.apiClient.getBaseUrl()}/user/profile`，`getBaseUrl()` 改为动态后自动适配。

**6.3.4 `src/services/webApi.ts` 同步改造**

此文件也有硬编码 `BASE_URL`（`webApi.ts:4`），同样改为 `getApiUrl()` 动态读取。与 `api-client.ts` 复用相同的 localStorage 键和默认值。

**6.3.5 Web 端切换配置时的清理**

Web 端切换地址后需要清除 Token（localStorage + 内存）和登录状态：

```typescript
/** 切换 API 配置 */
async function switchWebApiConfig(apiUrl: string, platformUrl: string): Promise<void> {
  localStorage.setItem(LS_KEY_API_URL, apiUrl)
  localStorage.setItem(LS_KEY_PLATFORM_URL, platformUrl)
  // 清除旧 Token（localStorage + 内存）
  clearTokens()
}
```

`clearTokens()` 同时清除 `localStorage` 中的 `access_token`/`refresh_token` 和内存中的 `accessToken`/`refreshTokenValue` 变量。

#### 6.4 连通性检查工具 `src/utils/connectivity.ts`

桌面端和 Web 端共用的纯前端连通性检查模块：

```typescript
export interface ConnectivityStatus {
  reachable: boolean
  latencyMs: number | null
  error: string | null
  keywordFound: boolean | null   // 仅平台地址使用
}

export interface ConnectivityCheckResult {
  apiUrl: ConnectivityStatus
  platformUrl: ConnectivityStatus
}

export async function checkConnectivity(
  apiUrl: string,
  platformUrl: string
): Promise<ConnectivityCheckResult>
```

**检查逻辑**：

- API 地址：`GET {apiUrl}/health`，超时 5 秒
  - 降级：若 `/health` 返回 404，改为 `HEAD {apiUrl}` 检测 HTTP 层可达性
- 平台地址：`GET {platformUrl}`，超时 5 秒，检查响应 HTML 是否包含"小河日历"
  - `keywordFound: true` — 找到关键字
  - `keywordFound: false` — 可达但未找到关键字（黄色警告，允许保存）
  - `keywordFound: null` — 不可达，无法检查

**CORS 处理**（Web 端）：

Web 端 `fetch` 跨域请求受 CORS 限制。处理策略：
1. 同源场景（部署在同域下）：正常工作
2. 跨域场景：后端需配置 CORS 允许 `/health` 和根路径跨域访问
3. CORS 失败时：`fetch` 抛出 `TypeError`，视为不可达，`error` 记录 "CORS 限制，无法检查"

桌面端（Tauri webview）不受 CORS 限制，始终可正常检查。

### 七、后端 API 需求

详见 [2026-06-14-api-health-endpoint-requirements.md](./2026-06-14-api-health-endpoint-requirements.md)

### 八、变更影响矩阵

| 文件 | 变更类型 | 影响说明 |
|------|----------|----------|
| `src-tauri/src/api/config.rs` | 重构 | 移除 ApiMode，新增 platform_url，环境变量重命名，修改默认值 |
| `src-tauri/src/api/mock.rs` | 条件编译 | 改为 `#[cfg(test)]`，生产代码不可见 |
| `src-tauri/src/api/proxy.rs` | 简化 | 移除 Mock 分支，`get_base_url()` → `String`，新增 `get_platform_url()` |
| `src-tauri/src/api/mod.rs` | 重构 | Mock 导出改为条件编译 |
| `src-tauri/src/auth/desktop_oauth.rs` | 修改 | 移除硬编码常量，新增 platform_url 参数 |
| `src-tauri/src/commands.rs` | 重构 | 修改 get/switch_api_config 签名，auth_oauth_start 传 platform_url，移除 auth_get_public_key Mock 分支，日志适配 |
| `src-tauri/src/lib.rs` | 修改 | 移除 mode 日志，适配新配置结构 |
| `src-tauri/src/sync_engine/sync.rs` | 无变更 | 测试仍可使用 `#[cfg(test)]` 的 MockApiClient |
| `src/views/DebugView.vue` | 重构 | API 配置 Tab 全新 UI，双端统一 |
| `src/utils/tauri.ts` | 修改 | 更新接口类型和函数签名 |
| `src/utils/connectivity.ts` | 新增 | 双端共用连通性检查模块 |
| `src/platform/web/api-client.ts` | 重构 | BASE_URL 改为动态读取 localStorage，getBaseUrl() 动态化，新增 set/get 方法 |
| `src/platform/web/auth.repo.ts` | 修改 | detectSsoSession 改用动态 getBaseUrl() |
| `src/services/webApi.ts` | 重构 | BASE_URL 同步改为动态读取 |
| `src/__tests__/**` | 修改 | 适配新接口签名，移除 Mock 模式相关测试 |

### 九、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 已有用户数据库中存有 `api_mode=mock` 的配置 | 本地开发阶段，直接删除本地数据库重建即可 |
| 后端暂无 `/health` 接口 | 降级为 HEAD 请求检测 |
| Web 端跨域请求受 CORS 限制 | 后端配置 CORS；CORS 失败时提示不可达 |
| Web 端 localStorage 存入绝对地址覆盖 Vite 代理相对路径 | Web 端统一使用绝对地址，调试界面切换时始终存入完整 URL |
| 并发切换 API 配置 | Tauri 命令加 `AtomicBool` 防重入 |
| 地址格式不合法 | 前端校验 `http://` 或 `https://` 开头，自动去除尾部斜杠 |
