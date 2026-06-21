// 代理 API 客户端模块
// 支持运行时切换 Mock/Real 模式

use async_trait::async_trait;
use std::sync::{Arc, RwLock};

use crate::api::{
    ApiConfig, ApiMode, CalendarApi,
    LoginRequest, RegisterRequest, AuthResponse, RefreshTokenResponse,
    UserProfile, SyncUploadRequest, SyncDownloadResponse,
    CalendarDTO, EventDTO, TodoDTO, ApiResult,
    MockApiClient, RealApiClient,
};

/// 代理 API 客户端 — 支持运行时切换 Mock/Real 模式
///
/// 实现 CalendarApi trait，内部通过 RwLock 持有实际的 API 客户端，
/// 切换时仅替换内部指针，对调用方透明
pub struct ProxyApiClient {
    /// 内部 API 客户端（可运行时替换）
    inner: RwLock<Arc<dyn CalendarApi>>,
    /// 当前 API 配置
    config: RwLock<ApiConfig>,
}

impl ProxyApiClient {
    /// 创建代理客户端
    pub fn new(config: ApiConfig) -> Self {
        let client = create_client(&config);
        Self {
            inner: RwLock::new(Arc::from(client) as Arc<dyn CalendarApi>),
            config: RwLock::new(config),
        }
    }

    /// 获取当前 API 配置
    pub fn get_config(&self) -> ApiConfig {
        self.config.read().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// 获取当前 base_url（仅 Real 模式有值）
    pub fn get_base_url(&self) -> Option<String> {
        let config = self.config.read().unwrap_or_else(|e| e.into_inner());
        match config.mode {
            ApiMode::Real => Some(config.base_url.clone()),
            ApiMode::Mock => None,
        }
    }

    /// 设置内部客户端的认证 Token
    ///
    /// 应用启动时从 keyring 恢复 token 后调用，将 token 注入到 HTTP 客户端内存
    pub async fn set_inner_token(&self, access_token: String, refresh_token: String, expires_in: i64) {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(real_client) = inner.as_ref().as_any().downcast_ref::<RealApiClient>() {
            real_client.set_auth_token(access_token, refresh_token, expires_in).await;
        }
    }

    /// 获取内部客户端的认证 Token
    ///
    /// 用于 auth_check_status 成功后，读取可能已刷新的 Token 回写到 keyring
    pub async fn get_inner_token(&self) -> Option<crate::api::http_client::TokenInfo> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(real_client) = inner.as_ref().as_any().downcast_ref::<RealApiClient>() {
            real_client.get_auth_token().await
        } else {
            None
        }
    }

    /// 清除内部客户端的认证 Token
    pub async fn clear_inner_token(&self) {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        if let Some(real_client) = inner.as_ref().as_any().downcast_ref::<RealApiClient>() {
            real_client.clear_auth_token().await;
        }
    }

    /// 切换 API 配置（运行时替换客户端）
    ///
    /// 切换时会：
    /// 1. 清除旧客户端的认证 Token
    /// 2. 创建新客户端
    /// 3. 替换内部指针
    /// 4. 更新配置
    pub async fn switch(&self, new_config: ApiConfig) {
        // 先克隆 Arc，释放 RwLock 守卫后再 await
        let old_inner = {
            self.inner.read().unwrap_or_else(|e| e.into_inner()).clone()
        };
        if let Some(real_client) = old_inner.as_ref().as_any().downcast_ref::<RealApiClient>() {
            real_client.clear_auth_token().await;
        }

        // 创建新客户端
        let new_client = Arc::from(create_client(&new_config)) as Arc<dyn CalendarApi>;

        // 替换内部指针和配置
        *self.inner.write().unwrap_or_else(|e| e.into_inner()) = new_client;
        *self.config.write().unwrap_or_else(|e| e.into_inner()) = new_config;
    }
}

/// 根据 ApiConfig 创建对应的 API 客户端
fn create_client(config: &ApiConfig) -> Box<dyn CalendarApi> {
    match config.mode {
        ApiMode::Mock => Box::new(MockApiClient::new()),
        ApiMode::Real => Box::new(RealApiClient::new(config.base_url.clone())),
    }
}

#[async_trait]
impl CalendarApi for ProxyApiClient {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    // 以下方法均委托给内部客户端
    // 先克隆 Arc<dyn CalendarApi>，释放 RwLockReadGuard 后再 await
    // 避免 RwLockReadGuard 跨越 .await 导致 Future 非 Send

    async fn login(&self, request: LoginRequest) -> ApiResult<AuthResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.login(request).await
    }

    async fn register(&self, request: RegisterRequest) -> ApiResult<AuthResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.register(request).await
    }

    async fn github_oauth(&self, code: &str, state: &str) -> ApiResult<AuthResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.github_oauth(code, state).await
    }

    async fn refresh_token(&self, refresh_token: &str) -> ApiResult<RefreshTokenResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.refresh_token(refresh_token).await
    }

    async fn get_profile(&self) -> ApiResult<UserProfile> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.get_profile().await
    }

    async fn sync_upload(&self, request: SyncUploadRequest) -> ApiResult<SyncDownloadResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.sync_upload(request).await
    }

    async fn sync_download(&self, last_sync_at: Option<i64>) -> ApiResult<SyncDownloadResponse> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.sync_download(last_sync_at).await
    }

    async fn get_calendars(&self) -> ApiResult<Vec<CalendarDTO>> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.get_calendars().await
    }

    async fn create_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.create_calendar(calendar).await
    }

    async fn update_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.update_calendar(calendar).await
    }

    async fn delete_calendar(&self, calendar_id: i64) -> ApiResult<()> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.delete_calendar(calendar_id).await
    }

    async fn get_events(&self, calendar_id: i64) -> ApiResult<Vec<EventDTO>> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.get_events(calendar_id).await
    }

    async fn create_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.create_event(event).await
    }

    async fn update_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.update_event(event).await
    }

    async fn delete_event(&self, event_id: i64) -> ApiResult<()> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.delete_event(event_id).await
    }

    async fn get_todos(&self, calendar_id: i64) -> ApiResult<Vec<TodoDTO>> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.get_todos(calendar_id).await
    }

    async fn create_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.create_todo(todo).await
    }

    async fn update_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.update_todo(todo).await
    }

    async fn delete_todo(&self, todo_id: i64) -> ApiResult<()> {
        let inner = self.inner.read().unwrap_or_else(|e| e.into_inner()).clone();
        inner.delete_todo(todo_id).await
    }
}
