// API 模块
// 提供 HTTP API 客户端、Mock API 实现、API 配置管理
// 支持认证、同步、CRUD 等远程服务操作

pub mod config;
pub mod errors;
pub mod http_client;
pub mod types;
pub mod mock;
pub mod client;

// 重导出关键类型
pub use config::{ApiConfig, ApiMode};
pub use errors::{ApiError, ApiResult};
pub use types::{
    LoginRequest, RegisterRequest, AuthResponse, RefreshTokenResponse,
    UserProfile, SyncUploadRequest, SyncDownloadResponse, SyncChange,
    CalendarDTO, EventDTO, TodoDTO, ApiResponse, PaginatedResponse,
};
pub use http_client::HttpClient;
pub use mock::MockApiClient;
pub use client::RealApiClient;

use std::sync::Arc;

/// 创建 API 客户端
///
/// 根据配置选择 Mock 或 Real API 客户端
/// # 参数
/// - `config`: API 配置
/// # 返回
/// - `MockApiClient`: Mock 模式，用于开发和测试
/// - `RealApiClient`: Real 模式，连接真实后端服务
pub fn create_api_client(config: &ApiConfig) -> Arc<dyn CalendarApi> {
    match config.mode {
        ApiMode::Mock => Arc::new(MockApiClient::new()),
        ApiMode::Real => Arc::new(RealApiClient::new(config.base_url.clone())),
    }
}

/// Calendar API Trait — 扩展版本
///
/// 包含认证、同步、CRUD 等完整远程服务接口
/// auth 模块的 CalendarApi trait 专注于认证，
/// 本 trait 提供更完整的远程数据服务能力
#[async_trait::async_trait]
pub trait CalendarApi: Send + Sync {
    // ================================================================
    // 认证相关
    // ================================================================

    /// 邮箱密码登录
    async fn login(&self, request: LoginRequest) -> ApiResult<AuthResponse>;

    /// 邮箱密码注册
    async fn register(&self, request: RegisterRequest) -> ApiResult<AuthResponse>;

    /// GitHub OAuth 登录
    async fn github_oauth(&self, code: &str, state: &str) -> ApiResult<AuthResponse>;

    /// 刷新 Token
    async fn refresh_token(&self, refresh_token: &str) -> ApiResult<RefreshTokenResponse>;

    /// 获取用户资料
    async fn get_profile(&self) -> ApiResult<UserProfile>;

    // ================================================================
    // 数据同步
    // ================================================================

    /// 上传本地变更
    async fn sync_upload(&self, request: SyncUploadRequest) -> ApiResult<SyncDownloadResponse>;

    /// 下载远程变更
    async fn sync_download(&self, since_version: i64) -> ApiResult<SyncDownloadResponse>;

    // ================================================================
    // 日历 CRUD
    // ================================================================

    /// 获取所有日历
    async fn get_calendars(&self) -> ApiResult<Vec<CalendarDTO>>;

    /// 创建日历
    async fn create_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO>;

    /// 更新日历
    async fn update_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO>;

    /// 删除日历
    async fn delete_calendar(&self, calendar_id: i64) -> ApiResult<()>;

    // ================================================================
    // 事件 CRUD
    // ================================================================

    /// 获取事件列表
    async fn get_events(&self, calendar_id: i64) -> ApiResult<Vec<EventDTO>>;

    /// 创建事件
    async fn create_event(&self, event: EventDTO) -> ApiResult<EventDTO>;

    /// 更新事件
    async fn update_event(&self, event: EventDTO) -> ApiResult<EventDTO>;

    /// 删除事件
    async fn delete_event(&self, event_id: i64) -> ApiResult<()>;

    // ================================================================
    // 待办 CRUD
    // ================================================================

    /// 获取待办列表
    async fn get_todos(&self, calendar_id: i64) -> ApiResult<Vec<TodoDTO>>;

    /// 创建待办
    async fn create_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO>;

    /// 更新待办
    async fn update_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO>;

    /// 删除待办
    async fn delete_todo(&self, todo_id: i64) -> ApiResult<()>;
}