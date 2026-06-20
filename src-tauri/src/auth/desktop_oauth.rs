// 桌面端 Session 中转 OAuth 登录模块
// 使用 PKCE + 后台轮询机制实现安全的桌面端 OAuth 登录流程
//
// 流程概述：
// 1. 生成 PKCE 密钥对（verifier + challenge）
// 2. POST /auth/client/session 创建会话，携带 provider 和 code_challenge
// 3. 打开浏览器到 Web 端登录页（携带 session_id 和 provider）
// 4. 后台轮询 GET /auth/client/session/{id}（携带 X-Client-Verifier 头）
// 5. 用户在浏览器中完成 OAuth 授权后，轮询获取到 CONFIRMED 状态
// 6. 保存 Token 到本地数据库，通知前端登录成功

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tokio_util::sync::CancellationToken;

use crate::auth::pkce::PkcePair;
use crate::auth::token::TokenStore;
use crate::db::connection::DatabaseConnection;

/// 全局 OAuth 进行中标志（防重入）
static OAUTH_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// Web 端基础 URL
const WEB_BASE_URL: &str = "https://calendar.menghuan.life";

/// 轮询间隔（毫秒）
const POLL_INTERVAL_MS: u64 = 2000;

/// 限速后的轮询间隔（毫秒）
const RATE_LIMIT_INTERVAL_MS: u64 = 5000;

/// 网络错误重试间隔（毫秒）
const NETWORK_ERROR_INTERVAL_MS: u64 = 3000;

/// 最大轮询次数（2秒 × 150 = 5 分钟超时）
const MAX_POLL_COUNT: u32 = 150;

/// Session 状态响应
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SessionStatus {
    /// 会话状态：PENDING / AUTHORIZING / CONFIRMED / FAILED / EXPIRED
    pub status: String,
    /// 访问令牌（CONFIRMED 时存在）
    pub access_token: Option<String>,
    /// 刷新令牌（CONFIRMED 时存在）
    pub refresh_token: Option<String>,
    /// 用户 ID（CONFIRMED 时存在）
    pub user_id: Option<i64>,
    /// 过期时间秒数（CONFIRMED 时存在）
    pub expires_in: Option<i64>,
}

/// 创建 OAuth session 的请求体
#[derive(Debug, serde::Serialize)]
struct CreateSessionRequest {
    provider: String,
    code_challenge: String,
}

/// 创建 OAuth session 的响应体
#[derive(Debug, serde::Deserialize)]
struct CreateSessionResponse {
    session_id: String,
    #[allow(dead_code)]
    expires_in: i64,
}

/// API 通用响应包装
#[derive(Debug, serde::Deserialize)]
struct ApiResponse<T> {
    code: i64,
    data: T,
}

/// API 错误响应
#[derive(Debug, serde::Deserialize)]
struct ApiErrorResponse {
    #[allow(dead_code)]
    code: i64,
    message: Option<String>,
}

/// 创建 OAuth session 并启动后台轮询
///
/// 1. 检查是否已有 OAuth 流程在进行中（防重入）
/// 2. 生成 PKCE 密钥对
/// 3. 调用后端 API 创建 session
/// 4. 打开浏览器到登录页
/// 5. 启动后台轮询任务
/// 6. 返回 session_id
pub async fn start_oauth(
    provider: &str,
    api_base_url: &str,
    app: tauri::AppHandle,
    cancel_token: CancellationToken,
) -> Result<String, String> {
    // 1. 检查防重入
    if OAUTH_IN_PROGRESS.load(Ordering::SeqCst) {
        return Err("OAuth 登录流程已在进行中，请先取消或等待完成".to_string());
    }
    OAUTH_IN_PROGRESS.store(true, Ordering::SeqCst);

    // 2. 生成 PKCE 密钥对
    let pkce = PkcePair::new();
    let code_verifier = pkce.verifier;
    let code_challenge = pkce.challenge_hex;

    log::info!("[desktop_oauth] 启动 OAuth 登录, provider: {}", provider);

    // 3. 调用后端 API 创建 session
    let client = reqwest::Client::new();
    let create_url = format!("{}/auth/client/session", api_base_url);
    let create_body = CreateSessionRequest {
        provider: provider.to_string(),
        code_challenge,
    };

    let response = client
        .post(&create_url)
        .json(&create_body)
        .send()
        .await
        .map_err(|e| {
            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
            format!("创建 OAuth session 失败: {}", e)
        })?;

    let status_code = response.status();
    let response_text = response.text().await.map_err(|e| {
        OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
        format!("读取 session 响应失败: {}", e)
    })?;

    if !status_code.is_success() {
        OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
        // 尝试解析错误消息
        if let Ok(err_resp) = serde_json::from_str::<ApiErrorResponse>(&response_text) {
            return Err(format!(
                "创建 OAuth session 失败 (code={}): {}",
                err_resp.code,
                err_resp.message.unwrap_or_else(|| "未知错误".to_string())
            ));
        }
        return Err(format!(
            "创建 OAuth session 失败 (HTTP {}): {}",
            status_code, response_text
        ));
    }

    let api_response: ApiResponse<CreateSessionResponse> =
        serde_json::from_str(&response_text).map_err(|e| {
            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
            format!("解析 session 响应失败: {}", e)
        })?;

    if api_response.code != 0 {
        OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
        return Err(format!(
            "创建 OAuth session 失败 (code={})",
            api_response.code
        ));
    }

    let session_id = api_response.data.session_id;
    log::info!("[desktop_oauth] Session 创建成功: {}", session_id);

    // 4. 构造浏览器 URL 并打开
    let browser_url = format!(
        "{}/client-login?session_id={}&provider={}",
        WEB_BASE_URL, session_id, provider
    );

    match open::that(&browser_url) {
        Ok(_) => log::info!("[desktop_oauth] 已打开浏览器进行 OAuth 授权"),
        Err(e) => {
            // 打开浏览器失败不是致命错误，用户可以手动打开
            log::warn!("[desktop_oauth] 打开浏览器失败: {}，用户可手动访问: {}", e, browser_url);
        }
    }

    // 5. 启动后台轮询任务
    let poll_provider = provider.to_string();
    let poll_api_base_url = api_base_url.to_string();
    let poll_session_id = session_id.clone();
    let poll_app = app.clone();
    let poll_cancel_token = cancel_token.clone();

    tokio::spawn(async move {
        poll_oauth_session(
            poll_app,
            poll_session_id,
            code_verifier,
            poll_api_base_url,
            poll_cancel_token,
            poll_provider,
        )
        .await;
    });

    // 6. 返回 session_id
    Ok(session_id)
}

/// 取消 OAuth 登录
pub fn cancel_oauth(cancel_token: &CancellationToken) {
    cancel_token.cancel();
    log::info!("[desktop_oauth] 用户取消 OAuth 登录");
}

/// 后台轮询 session 状态
///
/// 以固定间隔轮询后端 API，根据 session 状态执行相应操作：
/// - PENDING/AUTHORIZING：继续等待
/// - CONFIRMED：保存 Token，通知前端登录成功
/// - FAILED/EXPIRED：通知前端登录失败
/// - 网络错误：重试
/// - 取消：通知前端已取消
/// - 超时：通知前端超时
async fn poll_oauth_session(
    app: tauri::AppHandle,
    session_id: String,
    code_verifier: String,
    api_base_url: String,
    cancel_token: CancellationToken,
    provider: String,
) {
    let client = reqwest::Client::new();
    let poll_url = format!("{}/auth/client/session/{}", api_base_url, session_id);
    let mut poll_count: u32 = 0;

    // 发出初始状态事件
    let _ = app.emit(
        "oauth-status-change",
        serde_json::json!({ "status": "PENDING" }),
    );

    loop {
        // 检查取消信号
        if cancel_token.is_cancelled() {
            log::info!("[desktop_oauth] OAuth 登录已取消 (session_id={})", session_id);
            let _ = app.emit(
                "oauth-status-change",
                serde_json::json!({ "status": "CANCELLED" }),
            );
            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
            return;
        }

        // 检查超时
        poll_count += 1;
        if poll_count > MAX_POLL_COUNT {
            log::warn!("[desktop_oauth] OAuth 登录轮询超时 (session_id={})", session_id);
            let _ = app.emit(
                "oauth-status-change",
                serde_json::json!({ "status": "TIMEOUT" }),
            );
            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
            return;
        }

        // 执行轮询请求
        let mut next_interval = POLL_INTERVAL_MS;

        match client
            .get(&poll_url)
            .header("X-Client-Verifier", &code_verifier)
            .send()
            .await
        {
            Ok(response) => {
                let status_code = response.status();

                // 处理限速
                if status_code.as_u16() == 429 {
                    log::warn!("[desktop_oauth] 轮询请求被限速，增大间隔");
                    next_interval = RATE_LIMIT_INTERVAL_MS;
                    tokio::time::sleep(tokio::time::Duration::from_millis(next_interval)).await;
                    continue;
                }

                let response_text = match response.text().await {
                    Ok(text) => text,
                    Err(e) => {
                        log::error!("[desktop_oauth] 读取轮询响应失败: {}", e);
                        tokio::time::sleep(tokio::time::Duration::from_millis(NETWORK_ERROR_INTERVAL_MS)).await;
                        continue;
                    }
                };

                // 尝试解析为成功响应
                if let Ok(api_response) =
                    serde_json::from_str::<ApiResponse<SessionStatus>>(&response_text)
                {
                    if api_response.code != 0 {
                        log::warn!(
                            "[desktop_oauth] 轮询返回错误 code: {}",
                            api_response.code
                        );
                        // 特定错误码处理：NotFound(40401) → EXPIRED
                        if api_response.code == 40401 {
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": "EXPIRED" }),
                            );
                            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return;
                        }
                        tokio::time::sleep(tokio::time::Duration::from_millis(next_interval)).await;
                        continue;
                    }

                    let session_status = api_response.data;

                    match session_status.status.as_str() {
                        "PENDING" | "AUTHORIZING" => {
                            // 继续等待
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": session_status.status }),
                            );
                        }
                        "CONFIRMED" => {
                            // 登录成功，保存 Token 和用户信息
                            log::info!(
                                "[desktop_oauth] OAuth 登录成功 (session_id={}, user_id={})",
                                session_id,
                                session_status.user_id.unwrap_or(0)
                            );

                            let access_token = session_status
                                .access_token
                                .unwrap_or_default();
                            let refresh_token = session_status
                                .refresh_token
                                .unwrap_or_default();
                            let user_id = session_status
                                .user_id
                                .unwrap_or(0);
                            let expires_in = session_status.expires_in.unwrap_or(3600);

                            // 保存 Token 到 SQLite 加密存储
                            let token_store = TokenStore::new();
                            let token_info = crate::auth::token::TokenInfo {
                                access_token: access_token.clone(),
                                refresh_token: refresh_token.clone(),
                                expires_at: chrono::Utc::now().timestamp_millis()
                                    + expires_in * 1000,
                                user_id,
                            };

                            // 通过 AppHandle 获取数据库状态
                            // 注意：所有数据库操作必须在同步块内完成，不跨 await 持有锁
                            if let Some(db) = app.try_state::<Mutex<DatabaseConnection>>() {
                                // 保存 Token
                                {
                                    let db_conn = db.lock();
                                    if let Ok(db_conn) = db_conn {
                                        let conn = db_conn.get_connection();
                                        if let Err(e) = token_store.save_tokens(&conn, &token_info) {
                                            log::error!("[desktop_oauth] 保存 Token 到数据库失败: {}", e);
                                        } else {
                                            log::info!(
                                                "[desktop_oauth] 已保存 Token 到数据库 (user_id={})",
                                                user_id
                                            );
                                        }
                                    }
                                }
                                // db_conn 在此处已释放

                                // 保存用户信息到 local_users
                                {
                                    let now = chrono::Utc::now().timestamp();
                                    let db_conn = db.lock();
                                    if let Ok(db_conn) = db_conn {
                                        let _ = db_conn.execute(|conn| {
                                            conn.execute(
                                                "UPDATE local_users SET is_current = 0 WHERE is_current = 1",
                                                [],
                                            )
                                        });
                                        let _ = db_conn.execute(|conn| {
                                            conn.execute(
                                                "INSERT OR REPLACE INTO local_users (user_id, email, display_name, is_current, created_at, updated_at)
                                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                                                rusqlite::params![
                                                    user_id,
                                                    format!("oauth_{}_{}", provider, user_id),
                                                    format!("OAuth 用户 {}", user_id),
                                                    1,
                                                    now,
                                                    now,
                                                ],
                                            )
                                        });
                                    }
                                }
                                // db_conn 在此处已释放
                            }

                            // 设置 API 客户端 Token
                            if let Some(api_client) = app.try_state::<std::sync::Arc<dyn crate::api::CalendarApi>>() {
                                if let Some(proxy) = api_client
                                    .as_ref()
                                    .as_any()
                                    .downcast_ref::<crate::api::ProxyApiClient>()
                                {
                                    proxy
                                        .set_inner_token(
                                            access_token.clone(),
                                            refresh_token.clone(),
                                            expires_in,
                                        )
                                        .await;
                                    log::info!("[desktop_oauth] 已通过 ProxyApiClient 设置 Token");
                                } else if let Some(real_client) = api_client
                                    .as_ref()
                                    .as_any()
                                    .downcast_ref::<crate::api::RealApiClient>()
                                {
                                    real_client
                                        .set_auth_token(
                                            access_token.clone(),
                                            refresh_token.clone(),
                                            expires_in,
                                        )
                                        .await;
                                    log::info!("[desktop_oauth] 已通过 RealApiClient 设置 Token");
                                }

                                // 尝试获取用户资料更新本地用户信息
                                match api_client.get_profile().await {
                                    Ok(profile) => {
                                        // 更新用户信息（同步块，不跨 await 持锁）
                                        if let Some(db) = app.try_state::<Mutex<DatabaseConnection>>() {
                                            let now = chrono::Utc::now().timestamp();
                                            {
                                                let db_conn = db.lock();
                                                if let Ok(db_conn) = db_conn {
                                                    let _ = db_conn.execute(|conn| {
                                                        conn.execute(
                                                            "UPDATE local_users SET email = ?1, display_name = ?2, updated_at = ?3 WHERE user_id = ?4",
                                                            rusqlite::params![profile.email, profile.display_name, now, profile.id],
                                                        )
                                                    });
                                                }
                                            }
                                            // db_conn 已释放

                                            // 回写可能刷新后的 Token
                                            // 先获取新的 Token（可能触发 await），再写入数据库
                                            let new_token_info = if let Some(proxy) = api_client
                                                .as_ref()
                                                .as_any()
                                                .downcast_ref::<crate::api::ProxyApiClient>()
                                            {
                                                proxy.get_inner_token().await.map(|current_token| {
                                                    crate::auth::token::TokenInfo {
                                                        access_token: current_token.access_token,
                                                        refresh_token: current_token.refresh_token,
                                                        expires_at: current_token.expires_at,
                                                        user_id,
                                                    }
                                                })
                                            } else if let Some(real_client) = api_client
                                                .as_ref()
                                                .as_any()
                                                .downcast_ref::<crate::api::RealApiClient>()
                                            {
                                                real_client.get_auth_token().await.map(|current_token| {
                                                    crate::auth::token::TokenInfo {
                                                        access_token: current_token.access_token,
                                                        refresh_token: current_token.refresh_token,
                                                        expires_at: current_token.expires_at,
                                                        user_id,
                                                    }
                                                })
                                            } else {
                                                None
                                            };

                                            // Token 获取完成后，再获取锁写入数据库
                                            if let Some(new_token_info) = new_token_info {
                                                let db_conn = db.lock();
                                                if let Ok(db_conn) = db_conn {
                                                    let conn = db_conn.get_connection();
                                                    if let Err(e) = token_store.save_tokens(&conn, &new_token_info) {
                                                        log::warn!("[desktop_oauth] 回写刷新后 Token 失败: {}", e);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        log::warn!("[desktop_oauth] 获取用户资料失败: {}", e);
                                    }
                                }
                            }

                            // 通知前端登录成功
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({
                                    "status": "CONFIRMED",
                                    "user_id": user_id,
                                }),
                            );

                            // 销毁 code_verifier（安全最佳实践）
                            drop(code_verifier);

                            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return;
                        }
                        "FAILED" => {
                            log::warn!(
                                "[desktop_oauth] OAuth 登录失败 (session_id={})",
                                session_id
                            );
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": "FAILED" }),
                            );
                            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return;
                        }
                        "EXPIRED" => {
                            log::warn!(
                                "[desktop_oauth] OAuth session 已过期 (session_id={})",
                                session_id
                            );
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": "EXPIRED" }),
                            );
                            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return;
                        }
                        other => {
                            log::warn!(
                                "[desktop_oauth] 未知的 session 状态: {}",
                                other
                            );
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": other }),
                            );
                        }
                    }
                } else {
                    // 尝试解析为错误响应
                    if let Ok(err_resp) =
                        serde_json::from_str::<ApiErrorResponse>(&response_text)
                    {
                        if err_resp.code == 40401 {
                            let _ = app.emit(
                                "oauth-status-change",
                                serde_json::json!({ "status": "EXPIRED" }),
                            );
                            OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                            return;
                        }
                        log::warn!(
                            "[desktop_oauth] 轮询返回错误 (code={}): {}",
                            err_resp.code,
                            err_resp.message.unwrap_or_default()
                        );
                    } else if !status_code.is_success() {
                        log::warn!(
                            "[desktop_oauth] 轮询请求失败 (HTTP {})",
                            status_code
                        );
                    }
                }
            }
            Err(e) => {
                // 网络错误，重试
                log::warn!("[desktop_oauth] 轮询请求网络错误: {}", e);
                next_interval = NETWORK_ERROR_INTERVAL_MS;
            }
        }

        // 等待下次轮询（可被取消信号中断）
        tokio::select! {
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(next_interval)) => {}
            _ = cancel_token.cancelled() => {
                log::info!("[desktop_oauth] 等待期间收到取消信号 (session_id={})", session_id);
                let _ = app.emit(
                    "oauth-status-change",
                    serde_json::json!({ "status": "CANCELLED" }),
                );
                OAUTH_IN_PROGRESS.store(false, Ordering::SeqCst);
                return;
            }
        }
    }
}
