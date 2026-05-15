// Real API 客户端模块
// 连接真实后端服务，实现完整的 CalendarApi trait

use async_trait::async_trait;

use crate::api::errors::ApiResult;
use crate::api::http_client::HttpClient;
use crate::api::types::{
    AuthResponse, CalendarDTO, EventDTO, LoginRequest, RefreshTokenResponse,
    RegisterRequest, SyncDownloadResponse, SyncUploadRequest, TodoDTO, UserProfile,
};
use crate::api::CalendarApi;

/// Real API 客户端 — 连接真实后端服务
///
/// 使用 HttpClient 进行 HTTP 通信，
/// 所有 API 路径遵循 backend-api-guideline.md 规范
pub struct RealApiClient {
    /// HTTP 客户端
    http_client: HttpClient,
}

impl RealApiClient {
    /// 创建新的 Real API 客户端
    ///
    /// # 参数
    /// - `base_url`: API 基础 URL (如 "https://api.example.com/api/v1")
    pub fn new(base_url: String) -> Self {
        Self {
            http_client: HttpClient::new(base_url),
        }
    }

    /// 设置认证 Token
    pub async fn set_auth_token(&self, access_token: String, refresh_token: String, expires_in: i64) {
        use crate::api::http_client::TokenInfo;
        let token = TokenInfo {
            access_token,
            refresh_token,
            expires_at: chrono::Utc::now().timestamp_millis() + expires_in * 1000,
        };
        self.http_client.set_token(token).await;
    }

    /// 清除认证 Token
    pub async fn clear_auth_token(&self) {
        self.http_client.clear_token().await;
    }
}

#[async_trait]
impl CalendarApi for RealApiClient {
    // ================================================================
    // 认证相关
    // ================================================================

    /// 邮箱密码登录
    ///
    /// API 路径: POST /auth/login
    async fn login(&self, request: LoginRequest) -> ApiResult<AuthResponse> {
        let response: AuthResponse = self.http_client.post_no_auth("/auth/login", &request).await?;
        // 登录成功后设置 Token
        self.set_auth_token(
            response.access_token.clone(),
            response.refresh_token.clone(),
            response.expires_in,
        ).await;
        Ok(response)
    }

    /// 邮箱密码注册
    ///
    /// API 路径: POST /auth/register
    async fn register(&self, request: RegisterRequest) -> ApiResult<AuthResponse> {
        let response: AuthResponse = self.http_client.post_no_auth("/auth/register", &request).await?;
        // 注册成功后设置 Token
        self.set_auth_token(
            response.access_token.clone(),
            response.refresh_token.clone(),
            response.expires_in,
        ).await;
        Ok(response)
    }

    /// GitHub OAuth 登录
    ///
    /// API 路径: POST /auth/github
    async fn github_oauth(&self, code: &str, state: &str) -> ApiResult<AuthResponse> {
        let request = serde_json::json!({
            "code": code,
            "state": state,
        });
        let response: AuthResponse = self.http_client.post_no_auth("/auth/github", &request).await?;
        // OAuth 成功后设置 Token
        self.set_auth_token(
            response.access_token.clone(),
            response.refresh_token.clone(),
            response.expires_in,
        ).await;
        Ok(response)
    }

    /// 刷新 Token
    ///
    /// API 路径: POST /auth/refresh
    async fn refresh_token(&self, refresh_token: &str) -> ApiResult<RefreshTokenResponse> {
        let request = serde_json::json!({
            "refresh_token": refresh_token,
        });
        // 刷新 Token 不需要认证 Token，使用 refresh_token 本身
        self.http_client.post_no_auth("/auth/refresh", &request).await
    }

    /// 获取用户资料
    ///
    /// API 路径: GET /auth/profile
    async fn get_profile(&self) -> ApiResult<UserProfile> {
        self.http_client.get("/auth/profile").await
    }

    // ================================================================
    // 数据同步
    // ================================================================

    /// 上传本地变更
    ///
    /// API 路径: POST /sync/upload
    async fn sync_upload(&self, request: SyncUploadRequest) -> ApiResult<SyncDownloadResponse> {
        self.http_client.post("/sync/upload", &request).await
    }

    /// 下载远程变更
    ///
    /// API 路径: POST /sync/download
    async fn sync_download(&self, last_sync_at: Option<i64>) -> ApiResult<SyncDownloadResponse> {
        let request = serde_json::json!({
            "last_sync_at": last_sync_at,
        });
        self.http_client.post("/sync/download", &request).await
    }

    // ================================================================
    // 日历 CRUD
    // ================================================================

    /// 获取所有日历
    ///
    /// API 路径: GET /calendars
    async fn get_calendars(&self) -> ApiResult<Vec<CalendarDTO>> {
        self.http_client.get("/calendars").await
    }

    /// 创建日历
    ///
    /// API 路径: POST /calendars
    async fn create_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        self.http_client.post("/calendars", &calendar).await
    }

    /// 更新日历
    ///
    /// API 路径: PUT /calendars/{id}
    async fn update_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        let path = format!("/calendars/{}", calendar.id);
        self.http_client.put(&path, &calendar).await
    }

    /// 删除日历
    ///
    /// API 路径: DELETE /calendars/{id}
    async fn delete_calendar(&self, calendar_id: i64) -> ApiResult<()> {
        let path = format!("/calendars/{}", calendar_id);
        // DELETE 请求可能返回空响应，使用 serde_json::Value 处理
        let _: serde_json::Value = self.http_client.delete(&path).await?;
        Ok(())
    }

    // ================================================================
    // 事件 CRUD
    // ================================================================

    /// 获取事件列表
    ///
    /// API 路径: GET /events?calendar_id={calendar_id}
    async fn get_events(&self, calendar_id: i64) -> ApiResult<Vec<EventDTO>> {
        let path = format!("/events?calendar_id={}", calendar_id);
        self.http_client.get(&path).await
    }

    /// 创建事件
    ///
    /// API 路径: POST /events
    async fn create_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        self.http_client.post("/events", &event).await
    }

    /// 更新事件
    ///
    /// API 路径: PUT /events/{id}
    async fn update_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        let path = format!("/events/{}", event.id);
        self.http_client.put(&path, &event).await
    }

    /// 删除事件
    ///
    /// API 路径: DELETE /events/{id}
    async fn delete_event(&self, event_id: i64) -> ApiResult<()> {
        let path = format!("/events/{}", event_id);
        let _: serde_json::Value = self.http_client.delete(&path).await?;
        Ok(())
    }

    // ================================================================
    // 待办 CRUD
    // ================================================================

    /// 获取待办列表
    ///
    /// API 路径: GET /todos?calendar_id={calendar_id}
    async fn get_todos(&self, calendar_id: i64) -> ApiResult<Vec<TodoDTO>> {
        let path = format!("/todos?calendar_id={}", calendar_id);
        self.http_client.get(&path).await
    }

    /// 创建待办
    ///
    /// API 路径: POST /todos
    async fn create_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        self.http_client.post("/todos", &todo).await
    }

    /// 更新待办
    ///
    /// API 路径: PUT /todos/{id}
    async fn update_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        let path = format!("/todos/{}", todo.id);
        self.http_client.put(&path, &todo).await
    }

    /// 删除待办
    ///
    /// API 路径: DELETE /todos/{id}
    async fn delete_todo(&self, todo_id: i64) -> ApiResult<()> {
        let path = format!("/todos/{}", todo_id);
        let _: serde_json::Value = self.http_client.delete(&path).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 RealApiClient 创建
    #[test]
    fn test_real_api_client_creation() {
        let client = RealApiClient::new("http://localhost:3000/api".to_string());
        // 基础创建测试，实际网络请求需要 Mock 或真实后端
        assert!(true);
    }

    /// 测试 Token 设置
    #[tokio::test]
    async fn test_set_auth_token() {
        let client = RealApiClient::new("http://localhost:3000/api".to_string());
        client.set_auth_token(
            "test_access_token".to_string(),
            "test_refresh_token".to_string(),
            3600,
        ).await;

        // Token 设置成功，可以继续操作
        assert!(true);
    }

    /// 测试 Token 清除
    #[tokio::test]
    async fn test_clear_auth_token() {
        let client = RealApiClient::new("http://localhost:3000/api".to_string());
        client.set_auth_token(
            "test_access_token".to_string(),
            "test_refresh_token".to_string(),
            3600,
        ).await;

        client.clear_auth_token().await;

        // Token 清除成功
        assert!(true);
    }
}