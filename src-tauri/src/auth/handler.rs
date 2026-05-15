// 认证处理器模块
// 统一管理登录/注册/退出/Token 刷新/状态检查等认证功能
// 作为认证子系统的统一入口，协调 TokenStore、OAuthService 和 API 通信

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::api::{
    ApiError, AuthResponse, CalendarApi, LoginRequest, RegisterRequest,
    UserProfile,
};
use crate::auth::oauth::{OAuthConfig, OAuthService};
use crate::auth::token::{TokenError, TokenInfo, TokenStore};
use crate::db::connection::DatabaseConnection;

// ============================================================================
// 认证状态
// ============================================================================

/// 认证状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthStatus {
    /// 未认证
    NotAuthenticated,
    /// 已认证
    Authenticated {
        /// 用户 ID
        user_id: i64,
        /// 用户邮箱
        email: String,
        /// 显示名称
        display_name: String,
    },
}

impl Default for AuthStatus {
    fn default() -> Self {
        AuthStatus::NotAuthenticated
    }
}

impl AuthStatus {
    /// 获取用户 ID（如果已认证）
    pub fn user_id(&self) -> Option<i64> {
        match self {
            AuthStatus::Authenticated { user_id, .. } => Some(*user_id),
            AuthStatus::NotAuthenticated => None,
        }
    }

    /// 检查是否已认证
    pub fn is_authenticated(&self) -> bool {
        matches!(self, AuthStatus::Authenticated { .. })
    }
}

// ============================================================================
// 本地用户信息
// ============================================================================

/// 本地用户信息（存储在 SQLite 数据库）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalUser {
    /// 用户 ID
    pub user_id: i64,
    /// 用户邮箱
    pub email: String,
    /// 显示名称
    pub display_name: String,
    /// 是否为当前登录用户
    pub is_current: bool,
    /// 创建时间
    pub created_at: i64,
    /// 更新时间
    pub updated_at: i64,
}

// ============================================================================
// 认证处理器
// ============================================================================

/// 认证处理器 — 统一管理登录/注册/退出/Token
///
/// 协调 TokenStore（安全存储）、OAuthService（OAuth 流程）和 API 客户端
/// 使用 Arc + Mutex 实现线程安全（Tauri 状态管理要求）
pub struct AuthHandler {
    /// API 客户端
    api: Arc<dyn CalendarApi>,
    /// Token 安全存储
    token_store: TokenStore,
    /// 数据库连接
    db: Arc<DatabaseConnection>,
    /// 当前认证状态
    current_status: Arc<Mutex<AuthStatus>>,
}

impl AuthHandler {
    /// 创建新的认证处理器实例
    ///
    /// # 参数
    /// - `api`: API 客户端实现
    /// - `db`: 数据库连接
    pub fn new(api: Arc<dyn CalendarApi>, db: Arc<DatabaseConnection>) -> Self {
        Self {
            api,
            token_store: TokenStore::new(),
            db,
            current_status: Arc::new(Mutex::new(AuthStatus::NotAuthenticated)),
        }
    }

    /// 登录（邮箱+密码）
    ///
    /// 调用 API 登录接口，成功后保存 Token 到 keyring，
    /// 调用 getProfile 获取用户信息并保存到本地数据库，更新认证状态
    pub async fn login(&self, email: &str, password: &str) -> Result<AuthResponse, AuthError> {
        let response = self
            .api
            .login(LoginRequest {
                email: email.to_string(),
                password: password.to_string(),
            })
            .await
            .map_err(AuthError::ApiError)?;

        // 保存 Token 到 keyring
        let tokens = TokenInfo {
            access_token: response.access_token.clone(),
            refresh_token: response.refresh_token.clone(),
            expires_at: chrono::Utc::now().timestamp_millis() + response.expires_in * 1000,
            user_id: response.user_id,
        };
        self.token_store.save_tokens(&tokens)?;

        // 调用 getProfile 获取用户信息（Token 由 HttpClient 自动管理）
        let profile = self
            .api
            .get_profile()
            .await
            .map_err(AuthError::ApiError)?;

        // 保存用户信息到本地数据库
        self.save_local_user_from_profile(&profile).await?;

        // 更新认证状态
        let mut status = self.current_status.lock().await;
        *status = AuthStatus::Authenticated {
            user_id: response.user_id,
            email: profile.email.clone(),
            display_name: profile.display_name.clone(),
        };

        log::info!("用户登录成功: user_id={}, email={}", response.user_id, email);

        Ok(response)
    }

    /// 注册
    ///
    /// 调用 API 注册接口，成功后与登录相同流程保存 Token 和用户信息
    pub async fn register(
        &self,
        email: &str,
        password: &str,
        display_name: &str,
    ) -> Result<AuthResponse, AuthError> {
        let response = self
            .api
            .register(RegisterRequest {
                email: email.to_string(),
                password: password.to_string(),
                display_name: display_name.to_string(),
            })
            .await
            .map_err(AuthError::ApiError)?;

        // 保存 Token 到 keyring
        let tokens = TokenInfo {
            access_token: response.access_token.clone(),
            refresh_token: response.refresh_token.clone(),
            expires_at: chrono::Utc::now().timestamp_millis() + response.expires_in * 1000,
            user_id: response.user_id,
        };
        self.token_store.save_tokens(&tokens)?;

        // 调用 getProfile 获取用户信息（Token 由 HttpClient 自动管理）
        let profile = self
            .api
            .get_profile()
            .await
            .map_err(AuthError::ApiError)?;

        // 保存用户信息到本地数据库
        self.save_local_user_from_profile(&profile).await?;

        // 更新认证状态
        let mut status = self.current_status.lock().await;
        *status = AuthStatus::Authenticated {
            user_id: response.user_id,
            email: email.to_string(),
            display_name: display_name.to_string(),
        };

        log::info!("用户注册成功: user_id={}, email={}", response.user_id, email);

        Ok(response)
    }

    /// GitHub OAuth 登录
    ///
    /// 启动 localhost 临时 HTTP 服务器接收 GitHub 回调，
    /// 获取授权码后调用 API 完成 OAuth 认证
    pub async fn github_oauth_login(
        &self,
        oauth_config: &OAuthConfig,
    ) -> Result<AuthResponse, AuthError> {
        let oauth = OAuthService::new(oauth_config.clone());
        let state = OAuthService::generate_state();
        let auth_url = oauth.get_authorization_url(&state);

        log::info!("GitHub OAuth 授权 URL: {}", auth_url);

        // 监听回调（5分钟超时）
        let callback = oauth.listen_for_callback(300).await?;

        // 验证 state（防 CSRF 攻击）
        if callback.state != state {
            log::warn!("OAuth state 不匹配，可能遭受 CSRF 攻击");
            return Err(AuthError::OAuthError(
                "state 不匹配，可能遭受 CSRF 攻击".to_string(),
            ));
        }

        // 用授权码调用 API 完成 OAuth
        let response = self.api.github_oauth(&callback.code, &callback.state).await?;

        // 保存 Token 到 keyring
        let tokens = TokenInfo {
            access_token: response.access_token.clone(),
            refresh_token: response.refresh_token.clone(),
            expires_at: chrono::Utc::now().timestamp_millis() + response.expires_in * 1000,
            user_id: response.user_id,
        };
        self.token_store.save_tokens(&tokens)?;

        // 调用 getProfile 获取用户信息（Token 由 HttpClient 自动管理）
        let profile = self
            .api
            .get_profile()
            .await
            .map_err(AuthError::ApiError)?;

        // 保存用户信息到本地数据库
        self.save_local_user_from_profile(&profile).await?;

        // 更新认证状态
        let mut status = self.current_status.lock().await;
        *status = AuthStatus::Authenticated {
            user_id: response.user_id,
            email: profile.email.clone(),
            display_name: profile.display_name.clone(),
        };

        log::info!(
            "GitHub OAuth 登录成功: user_id={}",
            response.user_id
        );

        Ok(response)
    }

    /// 退出登录
    ///
    /// 从 keyring 删除 Token，从本地数据库删除用户信息，重置认证状态
    pub async fn logout(&self) -> Result<(), AuthError> {
        let status = self.current_status.lock().await;
        if let AuthStatus::Authenticated { user_id, .. } = &*status {
            let uid = *user_id;

            // 从 keyring 删除 Token
            self.token_store.delete_tokens(uid)?;

            // 从本地数据库删除用户信息
            self.delete_local_user(uid).await?;

            log::info!("用户退出登录: user_id={}", uid);
        }
        drop(status);

        let mut status = self.current_status.lock().await;
        *status = AuthStatus::NotAuthenticated;

        Ok(())
    }

    /// 刷新 Token（401 时自动调用）
    ///
    /// 使用 refresh_token 获取新的 access_token
    pub async fn refresh_token(&self) -> Result<TokenInfo, AuthError> {
        let status = self.current_status.lock().await;
        if let AuthStatus::Authenticated { user_id, .. } = &*status {
            let uid = *user_id;
            let tokens = self
                .token_store
                .load_tokens(uid)?
                .ok_or(AuthError::TokenNotFound)?;
            drop(status);

            let response = self.api.refresh_token(&tokens.refresh_token).await?;

            let new_tokens = TokenInfo {
                access_token: response.access_token,
                refresh_token: response.refresh_token, // 使用服务端返回的新 refresh_token
                expires_at: chrono::Utc::now().timestamp_millis() + response.expires_in * 1000,
                user_id: uid,
            };
            self.token_store.save_tokens(&new_tokens)?;

            log::info!("Token 刷新成功: user_id={}", uid);

            Ok(new_tokens)
        } else {
            Err(AuthError::NotAuthenticated)
        }
    }

    /// 获取当前认证状态
    pub async fn get_status(&self) -> AuthStatus {
        self.current_status.lock().await.clone()
    }

    /// 检查登录状态（应用启动时调用）
    ///
    /// 从 keyring 加载 Token，验证是否有效
    /// 如果 Token 过期则尝试自动刷新
    pub async fn check_auth_on_startup(&self) -> AuthStatus {
        // 从本地数据库获取用户 ID
        let user_id = self.get_local_user_id().await;
        if let Some(uid) = user_id {
            match self.token_store.load_tokens(uid) {
                Ok(Some(tokens)) => {
                    if !self.token_store.is_token_expired(&tokens) {
                        // Token 有效，恢复认证状态
                        let local_user = self.get_local_user(uid).await;
                        let mut status = self.current_status.lock().await;
                        *status = AuthStatus::Authenticated {
                            user_id: uid,
                            email: local_user.as_ref().map(|u| u.email.clone()).unwrap_or_default(),
                            display_name: local_user
                                .as_ref()
                                .map(|u| u.display_name.clone())
                                .unwrap_or_default(),
                        };
                        log::info!("启动时恢复认证状态: user_id={}", uid);
                        return status.clone();
                    } else {
                        // Token 过期，尝试刷新
                        match self.refresh_token().await {
                            Ok(_) => {
                                let local_user = self.get_local_user(uid).await;
                                return AuthStatus::Authenticated {
                                    user_id: uid,
                                    email: local_user
                                        .as_ref()
                                        .map(|u| u.email.clone())
                                        .unwrap_or_default(),
                                    display_name: local_user
                                        .as_ref()
                                        .map(|u| u.display_name.clone())
                                        .unwrap_or_default(),
                                };
                            }
                            Err(e) => {
                                log::warn!("启动时刷新 Token 失败: {}", e);
                            }
                        }
                    }
                }
                Ok(None) => {
                    log::info!("启动时未找到 Token: user_id={}", uid);
                }
                Err(e) => {
                    log::warn!("启动时加载 Token 失败: {}", e);
                }
            }
        }
        AuthStatus::NotAuthenticated
    }

    /// 获取当前 access_token（供 Sync Engine 等模块使用）
    ///
    /// 自动检查 Token 是否过期，过期则刷新
    pub async fn get_access_token(&self) -> Result<String, AuthError> {
        let status = self.current_status.lock().await;
        if let AuthStatus::Authenticated { user_id, .. } = &*status {
            let uid = *user_id;
            let tokens = self
                .token_store
                .load_tokens(uid)?
                .ok_or(AuthError::TokenNotFound)?;

            if self.token_store.is_token_expired(&tokens) {
                drop(status);
                let new_tokens = self.refresh_token().await?;
                Ok(new_tokens.access_token)
            } else {
                Ok(tokens.access_token)
            }
        } else {
            Err(AuthError::NotAuthenticated)
        }
    }

    /// 获取 GitHub OAuth 授权 URL（供前端打开浏览器使用）
    ///
    /// 返回授权 URL 和 state 参数，前端需要保存 state 用于验证
    pub fn get_github_oauth_url(&self, oauth_config: &OAuthConfig) -> (String, String) {
        let state = OAuthService::generate_state();
        let oauth = OAuthService::new(oauth_config.clone());
        let url = oauth.get_authorization_url(&state);
        (url, state)
    }

    // ========================================================================
    // 内部方法: 本地用户数据库操作
    // ========================================================================

    /// 保存用户到 local_users 表（基于 UserProfile）
    ///
    /// 如果用户已存在则更新，否则插入
    async fn save_local_user_from_profile(&self, profile: &UserProfile) -> Result<(), AuthError> {
        let now = chrono::Utc::now().timestamp();
        let db = self.db.clone();

        // 先将其他用户的 is_current 设为 0
        db.execute(|conn| {
            conn.execute("UPDATE local_users SET is_current = 0 WHERE is_current = 1", [])
        })
        .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        // 插入或替换用户
        db.execute(|conn| {
            conn.execute(
                "INSERT OR REPLACE INTO local_users (user_id, email, display_name, is_current, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    profile.id,
                    profile.email,
                    profile.display_name,
                    1, // is_current = true
                    now,
                    now,
                ],
            )
        })
        .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// 从本地数据库删除用户
    async fn delete_local_user(&self, user_id: i64) -> Result<(), AuthError> {
        self.db
            .execute(|conn| {
                conn.execute("DELETE FROM local_users WHERE user_id = ?1", [user_id])
            })
            .map_err(|e| AuthError::DatabaseError(e.to_string()))?;

        Ok(())
    }

    /// 获取当前登录用户的 ID
    async fn get_local_user_id(&self) -> Option<i64> {
        self.db
            .execute(|conn| {
                conn.query_row(
                    "SELECT user_id FROM local_users WHERE is_current = 1 LIMIT 1",
                    [],
                    |row| row.get(0),
                )
            })
            .ok()
    }

    /// 获取本地用户信息
    async fn get_local_user(&self, user_id: i64) -> Option<LocalUser> {
        self.db
            .execute(|conn| {
                conn.query_row(
                    "SELECT user_id, email, display_name, is_current, created_at, updated_at FROM local_users WHERE user_id = ?1",
                    [user_id],
                    |row| {
                        Ok(LocalUser {
                            user_id: row.get(0)?,
                            email: row.get(1)?,
                            display_name: row.get(2)?,
                            is_current: row.get::<_, i32>(3)? == 1,
                            created_at: row.get(4)?,
                            updated_at: row.get(5)?,
                        })
                    },
                )
            })
            .ok()
    }
}

// ============================================================================
// 认证错误类型
// ============================================================================

/// 认证错误类型
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    /// API 通信错误
    #[error("API 错误: {0}")]
    ApiError(ApiError),
    /// Token 操作错误
    #[error("Token 错误: {0}")]
    TokenError(#[from] TokenError),
    /// OAuth 流程错误
    #[error("OAuth 错误: {0}")]
    OAuthError(String),
    /// 未认证
    #[error("未认证")]
    NotAuthenticated,
    /// Token 未找到
    #[error("Token 未找到")]
    TokenNotFound,
    /// 数据库错误
    #[error("数据库错误: {0}")]
    DatabaseError(String),
}

impl From<crate::auth::oauth::OAuthError> for AuthError {
    fn from(err: crate::auth::oauth::OAuthError) -> Self {
        AuthError::OAuthError(err.to_string())
    }
}

impl From<ApiError> for AuthError {
    fn from(err: ApiError) -> Self {
        AuthError::ApiError(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use crate::api::RefreshTokenResponse;

    /// 测试用的 Mock API 客户端
    struct MockApi {
        should_fail: bool,
    }

    #[async_trait]
    impl CalendarApi for MockApi {
        fn as_any(&self) -> &dyn std::any::Any {
            self
        }

        async fn login(&self, _request: LoginRequest) -> crate::api::errors::ApiResult<AuthResponse> {
            if self.should_fail {
                return Err(ApiError::AuthError("测试失败".to_string()));
            }
            Ok(AuthResponse {
                user_id: 1,
                access_token: "mock_access_token".to_string(),
                refresh_token: "mock_refresh_token".to_string(),
                expires_in: 3600,
            })
        }

        async fn register(&self, _request: RegisterRequest) -> crate::api::errors::ApiResult<AuthResponse> {
            if self.should_fail {
                return Err(ApiError::Other("注册失败".to_string()));
            }
            Ok(AuthResponse {
                user_id: 2,
                access_token: "mock_access_token".to_string(),
                refresh_token: "mock_refresh_token".to_string(),
                expires_in: 3600,
            })
        }

        async fn github_oauth(&self, _code: &str, _state: &str) -> crate::api::errors::ApiResult<AuthResponse> {
            Ok(AuthResponse {
                user_id: 3,
                access_token: "mock_github_token".to_string(),
                refresh_token: "mock_github_refresh".to_string(),
                expires_in: 3600,
            })
        }

        async fn refresh_token(&self, _refresh_token: &str) -> crate::api::errors::ApiResult<RefreshTokenResponse> {
            Ok(RefreshTokenResponse {
                user_id: 1,
                access_token: "new_access_token".to_string(),
                refresh_token: "new_refresh_token".to_string(),
                expires_in: 3600,
            })
        }

        async fn get_profile(&self) -> crate::api::errors::ApiResult<UserProfile> {
            Ok(UserProfile {
                id: 1,
                email: "test@example.com".to_string(),
                display_name: "测试用户".to_string(),
                avatar_url: None,
                provider: "local".to_string(),
            })
        }

        async fn sync_upload(&self, _request: crate::api::SyncUploadRequest) -> crate::api::errors::ApiResult<crate::api::SyncDownloadResponse> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn sync_download(&self, _last_sync_at: Option<i64>) -> crate::api::errors::ApiResult<crate::api::SyncDownloadResponse> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn get_calendars(&self) -> crate::api::errors::ApiResult<Vec<crate::api::CalendarDTO>> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn create_calendar(&self, _calendar: crate::api::CalendarDTO) -> crate::api::errors::ApiResult<crate::api::CalendarDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn update_calendar(&self, _calendar: crate::api::CalendarDTO) -> crate::api::errors::ApiResult<crate::api::CalendarDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn delete_calendar(&self, _calendar_id: i64) -> crate::api::errors::ApiResult<()> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn get_events(&self, _calendar_id: i64) -> crate::api::errors::ApiResult<Vec<crate::api::EventDTO>> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn create_event(&self, _event: crate::api::EventDTO) -> crate::api::errors::ApiResult<crate::api::EventDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn update_event(&self, _event: crate::api::EventDTO) -> crate::api::errors::ApiResult<crate::api::EventDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn delete_event(&self, _event_id: i64) -> crate::api::errors::ApiResult<()> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn get_todos(&self, _calendar_id: i64) -> crate::api::errors::ApiResult<Vec<crate::api::TodoDTO>> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn create_todo(&self, _todo: crate::api::TodoDTO) -> crate::api::errors::ApiResult<crate::api::TodoDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn update_todo(&self, _todo: crate::api::TodoDTO) -> crate::api::errors::ApiResult<crate::api::TodoDTO> {
            Err(ApiError::Other("未实现".to_string()))
        }

        async fn delete_todo(&self, _todo_id: i64) -> crate::api::errors::ApiResult<()> {
            Err(ApiError::Other("未实现".to_string()))
        }
    }

    /// 测试 AuthStatus 默认值
    #[test]
    fn test_auth_status_default() {
        let status = AuthStatus::default();
        assert!(matches!(status, AuthStatus::NotAuthenticated));
    }

    /// 测试 AuthStatus::is_authenticated
    #[test]
    fn test_auth_status_is_authenticated() {
        let not_auth = AuthStatus::NotAuthenticated;
        assert!(!not_auth.is_authenticated());

        let auth = AuthStatus::Authenticated {
            user_id: 1,
            email: "test@example.com".to_string(),
            display_name: "测试".to_string(),
        };
        assert!(auth.is_authenticated());
    }

    /// 测试 AuthStatus::user_id
    #[test]
    fn test_auth_status_user_id() {
        let not_auth = AuthStatus::NotAuthenticated;
        assert!(not_auth.user_id().is_none());

        let auth = AuthStatus::Authenticated {
            user_id: 42,
            email: "test@example.com".to_string(),
            display_name: "测试".to_string(),
        };
        assert_eq!(auth.user_id(), Some(42));
    }

    /// 测试 AuthStatus 序列化/反序列化
    #[test]
    fn test_auth_status_serialization() {
        let not_auth = AuthStatus::NotAuthenticated;
        let json = serde_json::to_string(&not_auth).unwrap();
        let deserialized: AuthStatus = serde_json::from_str(&json).unwrap();
        assert!(matches!(deserialized, AuthStatus::NotAuthenticated));

        let auth = AuthStatus::Authenticated {
            user_id: 1,
            email: "test@example.com".to_string(),
            display_name: "测试".to_string(),
        };
        let json = serde_json::to_string(&auth).unwrap();
        let deserialized: AuthStatus = serde_json::from_str(&json).unwrap();
        assert!(deserialized.is_authenticated());
        assert_eq!(deserialized.user_id(), Some(1));
    }

    /// 测试 LocalUser 序列化
    #[test]
    fn test_local_user_serialization() {
        let user = LocalUser {
            user_id: 1,
            email: "test@example.com".to_string(),
            display_name: "测试".to_string(),
            is_current: true,
            created_at: 1700000000,
            updated_at: 1700000000,
        };
        let json = serde_json::to_string(&user).unwrap();
        let deserialized: LocalUser = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.user_id, 1);
        assert_eq!(deserialized.email, "test@example.com");
        assert!(deserialized.is_current);
    }

    /// 测试 AuthError 显示
    #[test]
    fn test_auth_error_display() {
        let err = AuthError::NotAuthenticated;
        assert_eq!(format!("{}", err), "未认证");

        let err = AuthError::TokenNotFound;
        assert_eq!(format!("{}", err), "Token 未找到");

        let err = AuthError::OAuthError("state mismatch".to_string());
        assert_eq!(format!("{}", err), "OAuth 错误: state mismatch");

        let err = AuthError::DatabaseError("connection failed".to_string());
        assert_eq!(format!("{}", err), "数据库错误: connection failed");
    }

    /// 测试使用内存数据库创建 AuthHandler
    #[tokio::test]
    async fn test_auth_handler_creation() {
        let api: Arc<dyn CalendarApi> = Arc::new(MockApi { should_fail: false });
        let db = Arc::new(
            crate::db::connection::DatabaseConnection::in_memory().unwrap(),
        );

        db.execute(|conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS local_users (
                    user_id INTEGER PRIMARY KEY,
                    email TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    is_current INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );",
            )
        }).unwrap();

        let handler = AuthHandler::new(api, db);

        let status = handler.get_status().await;
        assert!(matches!(status, AuthStatus::NotAuthenticated));
    }

    /// 测试未认证状态下获取 access_token 失败
    #[tokio::test]
    async fn test_auth_handler_get_access_token_not_authenticated() {
        let api: Arc<dyn CalendarApi> = Arc::new(MockApi { should_fail: false });
        let db = Arc::new(
            crate::db::connection::DatabaseConnection::in_memory().unwrap(),
        );

        db.execute(|conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS local_users (
                    user_id INTEGER PRIMARY KEY,
                    email TEXT NOT NULL,
                    display_name TEXT NOT NULL,
                    is_current INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );",
            )
        }).unwrap();

        let handler = AuthHandler::new(api, db);

        let result = handler.get_access_token().await;
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), AuthError::NotAuthenticated));
    }
}
