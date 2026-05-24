// Mock API 客户端模块
// 使用内存 HashMap 模拟 API 响应，用于开发和测试

use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::api::errors::{ApiError, ApiResult};
use crate::api::types::{
    AuthResponse, BatchChanges, CalendarDTO, CalendarSyncItem, EntityChanges,
    EventDTO, EventSyncItem, LoginRequest, RefreshTokenResponse,
    RegisterRequest, SyncDownloadResponse, SyncUploadRequest, TodoDTO,
    TodoSyncItem, UserProfile,
};
use crate::api::CalendarApi;

/// Mock API 客户端 — 内存模拟数据
///
/// 用于开发和测试，不连接真实后端服务
/// 数据存储在 HashMap 中，支持完整的 CRUD 操作
pub struct MockApiClient {
    /// 日历存储 (key: calendar_id)
    calendars: Arc<Mutex<HashMap<i64, CalendarDTO>>>,
    /// 事件存储 (key: event_id)
    events: Arc<Mutex<HashMap<i64, EventDTO>>>,
    /// 待办存储 (key: todo_id)
    todos: Arc<Mutex<HashMap<i64, TodoDTO>>>,
    /// 上次同步时间戳
    last_sync_at: Arc<Mutex<i64>>,
    /// 当前 Token (模拟登录状态)
    current_token: Arc<Mutex<Option<MockToken>>>,
}

/// Mock Token 信息
struct MockToken {
    user_id: i64,
    email: String,
    display_name: String,
}

impl MockApiClient {
    /// 创建新的 Mock API 客户端
    pub fn new() -> Self {
        Self {
            calendars: Arc::new(Mutex::new(HashMap::new())),
            events: Arc::new(Mutex::new(HashMap::new())),
            todos: Arc::new(Mutex::new(HashMap::new())),
            last_sync_at: Arc::new(Mutex::new(0)),
            current_token: Arc::new(Mutex::new(None)),
        }
    }

    /// 生成 Mock Token
    fn generate_mock_token(user_id: i64, email: &str, display_name: &str) -> MockToken {
        MockToken {
            user_id,
            email: email.to_string(),
            display_name: display_name.to_string(),
        }
    }

    /// 生成唯一 ID
    async fn generate_id() -> i64 {
        chrono::Utc::now().timestamp_millis()
    }
}

impl Default for MockApiClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CalendarApi for MockApiClient {
    /// 获取类型信息，用于 downcast
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    // ================================================================
    // 认证相关
    // ================================================================

    /// 邮箱密码登录
    async fn login(&self, request: LoginRequest) -> ApiResult<AuthResponse> {
        // Mock 实现: 任何邮箱密码都能登录
        let user_id = Self::generate_id().await;

        // 存储 Token
        let token = Self::generate_mock_token(user_id, &request.email, "Mock 用户");
        let mut current = self.current_token.lock().await;
        *current = Some(token);

        Ok(AuthResponse {
            user_id,
            access_token: "mock_access_token_12345".to_string(),
            refresh_token: "mock_refresh_token_67890".to_string(),
            expires_in: 3600,
        })
    }

    /// 邮箱密码注册
    async fn register(&self, request: RegisterRequest) -> ApiResult<AuthResponse> {
        let user_id = Self::generate_id().await;

        // 存储 Token
        let token = Self::generate_mock_token(user_id, &request.email, &request.display_name);
        let mut current = self.current_token.lock().await;
        *current = Some(token);

        Ok(AuthResponse {
            user_id,
            access_token: "mock_access_token_register".to_string(),
            refresh_token: "mock_refresh_token_register".to_string(),
            expires_in: 3600,
        })
    }

    /// GitHub OAuth 登录
    async fn github_oauth(&self, _code: &str, _state: &str) -> ApiResult<AuthResponse> {
        let user_id = Self::generate_id().await;

        // 存储 Token
        let token = Self::generate_mock_token(user_id, "github@example.com", "GitHub 用户");
        let mut current = self.current_token.lock().await;
        *current = Some(token);

        Ok(AuthResponse {
            user_id,
            access_token: "mock_github_token".to_string(),
            refresh_token: "mock_github_refresh".to_string(),
            expires_in: 3600,
        })
    }

    /// 刷新 Token
    async fn refresh_token(&self, _refresh_token: &str) -> ApiResult<RefreshTokenResponse> {
        Ok(RefreshTokenResponse {
            user_id: 1,
            access_token: "mock_new_access_token".to_string(),
            refresh_token: "mock_new_refresh_token".to_string(),
            expires_in: 3600,
        })
    }

    /// 获取用户资料
    async fn get_profile(&self) -> ApiResult<UserProfile> {
        let current = self.current_token.lock().await;
        match &*current {
            Some(token) => Ok(UserProfile {
                id: token.user_id,
                email: token.email.clone(),
                display_name: token.display_name.clone(),
                avatar_url: None,
                provider: "local".to_string(),
            }),
            None => Err(ApiError::AuthError("未登录".to_string())),
        }
    }

    // ================================================================
    // 数据同步
    // ================================================================

    /// 上传本地变更
    async fn sync_upload(&self, request: SyncUploadRequest) -> ApiResult<SyncDownloadResponse> {
        // 处理上传的日历变更
        for calendar in &request.changes.calendars.created {
            let mut calendars = self.calendars.lock().await;
            calendars.insert(calendar.id, CalendarDTO {
                id: calendar.id,
                name: calendar.name.clone(),
                color: calendar.color.clone(),
                r#type: calendar.r#type.clone(),
                account_id: calendar.account_id,
                visible: calendar.visible,
                sync_enabled: calendar.sync_enabled,
                description: None,
                user_id: Some(0),
                is_default: false,
                created_at: calendar.updated_at,
                updated_at: calendar.updated_at,
            });
        }
        for calendar in &request.changes.calendars.updated {
            let mut calendars = self.calendars.lock().await;
            if let Some(existing) = calendars.get_mut(&calendar.id) {
                existing.name = calendar.name.clone();
                existing.color = calendar.color.clone();
                existing.updated_at = calendar.updated_at;
            }
        }
        {
            let mut calendars = self.calendars.lock().await;
            for id in &request.changes.calendars.deleted {
                calendars.remove(id);
            }
        }

        // 处理上传的事件变更
        for event in &request.changes.events.created {
            let mut events = self.events.lock().await;
            events.insert(event.id, EventDTO {
                id: event.id,
                calendar_id: event.calendar_id,
                title: event.title.clone(),
                description: event.description.clone(),
                start_time: event.start_time.to_string(),
                end_time: event.end_time.to_string(),
                is_all_day: event.all_day,
                location: event.location.clone(),
                reminder_minutes: event.reminder.map(|v| v as i64),
                recurrence_rule: None,
                user_id: Some(0),
                created_at: event.updated_at,
                updated_at: event.updated_at,
            });
        }
        for event in &request.changes.events.updated {
            let mut events = self.events.lock().await;
            if let Some(existing) = events.get_mut(&event.id) {
                existing.title = event.title.clone();
                existing.description = event.description.clone();
                existing.updated_at = event.updated_at;
            }
        }
        {
            let mut events = self.events.lock().await;
            for id in &request.changes.events.deleted {
                events.remove(id);
            }
        }

        // 处理上传的待办变更
        for todo in &request.changes.todos.created {
            let mut todos = self.todos.lock().await;
            todos.insert(todo.id, TodoDTO {
                id: todo.id,
                calendar_id: todo.calendar_id,
                title: todo.title.clone(),
                description: todo.description.clone(),
                due_date: todo.due_date.map(|v| v.to_string()),
                is_completed: todo.completed,
                completed_at: None,
                priority: match todo.priority.as_str() {
                    "high" => 2,
                    "medium" => 1,
                    _ => 0,
                },
                user_id: Some(0),
                created_at: todo.updated_at,
                updated_at: todo.updated_at,
            });
        }
        for todo in &request.changes.todos.updated {
            let mut todos = self.todos.lock().await;
            if let Some(existing) = todos.get_mut(&todo.id) {
                existing.title = todo.title.clone();
                existing.description = todo.description.clone();
                existing.updated_at = todo.updated_at;
            }
        }
        {
            let mut todos = self.todos.lock().await;
            for id in &request.changes.todos.deleted {
                todos.remove(id);
            }
        }

        // 更新同步时间戳
        let now = chrono::Utc::now().timestamp_millis();
        let mut last_sync = self.last_sync_at.lock().await;
        *last_sync = now;

        // Mock 实现: 暂不返回服务端变更
        Ok(SyncDownloadResponse {
            server_changes: BatchChanges {
                calendars: EntityChanges {
                    created: vec![],
                    updated: vec![],
                    deleted: vec![],
                },
                events: EntityChanges {
                    created: vec![],
                    updated: vec![],
                    deleted: vec![],
                },
                todos: EntityChanges {
                    created: vec![],
                    updated: vec![],
                    deleted: vec![],
                },
            },
            sync_token: format!("sync_{}", now),
            server_time: now,
        })
    }

    /// 下载远程变更
    async fn sync_download(&self, last_sync_at: Option<i64>) -> ApiResult<SyncDownloadResponse> {
        let sync_time = self.last_sync_at.lock().await;
        let now = chrono::Utc::now().timestamp_millis();

        // Mock 实现: 如果有数据则返回所有数据作为 created
        let since = last_sync_at.unwrap_or(0);
        if since < *sync_time {
            // 收集所有日历变更
            let calendar_items: Vec<CalendarSyncItem> = {
                let calendars = self.calendars.lock().await;
                calendars
                    .values()
                    .map(|c| CalendarSyncItem {
                        id: c.id,
                        name: c.name.clone(),
                        color: c.color.clone(),
                        r#type: "local".to_string(),
                        account_id: None,
                        visible: true,
                        sync_enabled: false,
                        updated_at: c.updated_at,
                    })
                    .collect()
            };

            // 收集所有事件变更
            let event_items: Vec<EventSyncItem> = {
                let events = self.events.lock().await;
                events
                    .values()
                    .map(|e| EventSyncItem {
                        id: e.id,
                        title: e.title.clone(),
                        description: e.description.clone(),
                        start_time: e.start_time.parse().unwrap_or(0),
                        end_time: e.end_time.parse().unwrap_or(0),
                        all_day: e.is_all_day,
                        calendar_id: e.calendar_id,
                        timezone: "Asia/Shanghai".to_string(),
                        color: None,
                        reminder: e.reminder_minutes.map(|v| v as i32),
                        location: e.location.clone(),
                        updated_at: e.updated_at,
                    })
                    .collect()
            };

            // 收集所有待办变更
            let todo_items: Vec<TodoSyncItem> = {
                let todos = self.todos.lock().await;
                todos
                    .values()
                    .map(|t| TodoSyncItem {
                        id: t.id,
                        title: t.title.clone(),
                        description: t.description.clone(),
                        due_date: t.due_date.as_ref().and_then(|d| d.parse::<i64>().ok()),
                        completed: t.is_completed,
                        priority: match t.priority {
                            2 => "high".to_string(),
                            1 => "medium".to_string(),
                            _ => "low".to_string(),
                        },
                        calendar_id: t.calendar_id,
                        updated_at: t.updated_at,
                    })
                    .collect()
            };

            Ok(SyncDownloadResponse {
                server_changes: BatchChanges {
                    calendars: EntityChanges {
                        created: calendar_items,
                        updated: vec![],
                        deleted: vec![],
                    },
                    events: EntityChanges {
                        created: event_items,
                        updated: vec![],
                        deleted: vec![],
                    },
                    todos: EntityChanges {
                        created: todo_items,
                        updated: vec![],
                        deleted: vec![],
                    },
                },
                sync_token: format!("sync_{}", now),
                server_time: now,
            })
        } else {
            // 无新变更
            Ok(SyncDownloadResponse {
                server_changes: BatchChanges {
                    calendars: EntityChanges {
                        created: vec![],
                        updated: vec![],
                        deleted: vec![],
                    },
                    events: EntityChanges {
                        created: vec![],
                        updated: vec![],
                        deleted: vec![],
                    },
                    todos: EntityChanges {
                        created: vec![],
                        updated: vec![],
                        deleted: vec![],
                    },
                },
                sync_token: format!("sync_{}", now),
                server_time: now,
            })
        }
    }

    // ================================================================
    // 日历 CRUD
    // ================================================================

    /// 获取所有日历
    async fn get_calendars(&self) -> ApiResult<Vec<CalendarDTO>> {
        let calendars = self.calendars.lock().await;
        Ok(calendars.values().cloned().collect())
    }

    /// 创建日历
    async fn create_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        let id = Self::generate_id().await;
        let now = chrono::Utc::now().timestamp_millis();

        let new_calendar = CalendarDTO {
            id,
            name: calendar.name,
            color: calendar.color,
            r#type: calendar.r#type,
            account_id: calendar.account_id,
            visible: calendar.visible,
            sync_enabled: calendar.sync_enabled,
            description: calendar.description,
            user_id: calendar.user_id,
            is_default: calendar.is_default,
            created_at: now,
            updated_at: now,
        };

        let mut calendars = self.calendars.lock().await;
        calendars.insert(id, new_calendar.clone());

        Ok(new_calendar)
    }

    /// 更新日历
    async fn update_calendar(&self, calendar: CalendarDTO) -> ApiResult<CalendarDTO> {
        let mut calendars = self.calendars.lock().await;

        match calendars.get_mut(&calendar.id) {
            Some(existing) => {
                existing.name = calendar.name;
                existing.color = calendar.color;
                existing.description = calendar.description;
                existing.is_default = calendar.is_default;
                existing.updated_at = chrono::Utc::now().timestamp_millis();
                Ok(existing.clone())
            }
            None => Err(ApiError::ParamError(format!("日历不存在: {}", calendar.id))),
        }
    }

    /// 删除日历
    async fn delete_calendar(&self, calendar_id: i64) -> ApiResult<()> {
        let mut calendars = self.calendars.lock().await;
        calendars.remove(&calendar_id);
        Ok(())
    }

    // ================================================================
    // 事件 CRUD
    // ================================================================

    /// 获取事件列表
    async fn get_events(&self, calendar_id: i64) -> ApiResult<Vec<EventDTO>> {
        let events = self.events.lock().await;
        Ok(events
            .values()
            .filter(|e| e.calendar_id == calendar_id)
            .cloned()
            .collect())
    }

    /// 创建事件
    async fn create_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        let id = Self::generate_id().await;
        let now = chrono::Utc::now().timestamp_millis();

        let new_event = EventDTO {
            id,
            calendar_id: event.calendar_id,
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            is_all_day: event.is_all_day,
            location: event.location,
            reminder_minutes: event.reminder_minutes,
            recurrence_rule: event.recurrence_rule,
            user_id: event.user_id,
            created_at: now,
            updated_at: now,
        };

        let mut events = self.events.lock().await;
        events.insert(id, new_event.clone());

        Ok(new_event)
    }

    /// 更新事件
    async fn update_event(&self, event: EventDTO) -> ApiResult<EventDTO> {
        let mut events = self.events.lock().await;

        match events.get_mut(&event.id) {
            Some(existing) => {
                existing.title = event.title;
                existing.description = event.description;
                existing.start_time = event.start_time;
                existing.end_time = event.end_time;
                existing.is_all_day = event.is_all_day;
                existing.location = event.location;
                existing.reminder_minutes = event.reminder_minutes;
                existing.recurrence_rule = event.recurrence_rule;
                existing.updated_at = chrono::Utc::now().timestamp_millis();
                Ok(existing.clone())
            }
            None => Err(ApiError::ParamError(format!("事件不存在: {}", event.id))),
        }
    }

    /// 删除事件
    async fn delete_event(&self, event_id: i64) -> ApiResult<()> {
        let mut events = self.events.lock().await;
        events.remove(&event_id);
        Ok(())
    }

    // ================================================================
    // 待办 CRUD
    // ================================================================

    /// 获取待办列表
    async fn get_todos(&self, calendar_id: i64) -> ApiResult<Vec<TodoDTO>> {
        let todos = self.todos.lock().await;
        Ok(todos
            .values()
            .filter(|t| t.calendar_id == calendar_id)
            .cloned()
            .collect())
    }

    /// 创建待办
    async fn create_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        let id = Self::generate_id().await;
        let now = chrono::Utc::now().timestamp_millis();

        let new_todo = TodoDTO {
            id,
            calendar_id: todo.calendar_id,
            title: todo.title,
            description: todo.description,
            due_date: todo.due_date,
            is_completed: todo.is_completed,
            completed_at: todo.completed_at,
            priority: todo.priority,
            user_id: todo.user_id,
            created_at: now,
            updated_at: now,
        };

        let mut todos = self.todos.lock().await;
        todos.insert(id, new_todo.clone());

        Ok(new_todo)
    }

    /// 更新待办
    async fn update_todo(&self, todo: TodoDTO) -> ApiResult<TodoDTO> {
        let mut todos = self.todos.lock().await;

        match todos.get_mut(&todo.id) {
            Some(existing) => {
                existing.title = todo.title;
                existing.description = todo.description;
                existing.due_date = todo.due_date;
                existing.is_completed = todo.is_completed;
                existing.completed_at = todo.completed_at;
                existing.priority = todo.priority;
                existing.updated_at = chrono::Utc::now().timestamp_millis();
                Ok(existing.clone())
            }
            None => Err(ApiError::ParamError(format!("待办不存在: {}", todo.id))),
        }
    }

    /// 删除待办
    async fn delete_todo(&self, todo_id: i64) -> ApiResult<()> {
        let mut todos = self.todos.lock().await;
        todos.remove(&todo_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 MockApiClient 创建
    #[tokio::test]
    async fn test_mock_api_client_creation() {
        let client = MockApiClient::new();
        assert!(client.calendars.lock().await.is_empty());
    }

    /// 测试 MockApiClient 登录
    #[tokio::test]
    async fn test_mock_api_login() {
        let client = MockApiClient::new();
        let request = LoginRequest {
            email: "test@example.com".to_string(),
            password: "password".to_string(),
        };

        let response = client.login(request).await.unwrap();
        assert!(response.access_token.starts_with("mock_"));
        assert_eq!(response.user_id > 0, true);
    }

    /// 测试 MockApiClient 注册
    #[tokio::test]
    async fn test_mock_api_register() {
        let client = MockApiClient::new();
        let request = RegisterRequest {
            email: "new@example.com".to_string(),
            password: "password".to_string(),
            display_name: "新用户".to_string(),
        };

        let response = client.register(request).await.unwrap();
        assert!(response.access_token.starts_with("mock_"));
        assert_eq!(response.user_id > 0, true);
    }

    /// 测试 MockApiClient GitHub OAuth
    #[tokio::test]
    async fn test_mock_api_github_oauth() {
        let client = MockApiClient::new();
        let response = client.github_oauth("code123", "state456").await.unwrap();
        assert!(response.access_token.starts_with("mock_"));
        assert_eq!(response.user_id > 0, true);
    }

    /// 测试 MockApiClient 刷新 Token
    #[tokio::test]
    async fn test_mock_api_refresh_token() {
        let client = MockApiClient::new();
        let response = client.refresh_token("old_refresh_token").await.unwrap();
        assert!(response.access_token.starts_with("mock_"));
        assert_eq!(response.expires_in, 3600);
        assert_eq!(response.user_id, 1);
    }

    /// 测试 MockApiClient 获取用户资料
    #[tokio::test]
    async fn test_mock_api_get_profile() {
        let client = MockApiClient::new();

        // 未登录时应返回错误
        let result = client.get_profile().await;
        assert!(result.is_err());

        // 登录后获取资料
        client
            .login(LoginRequest {
                email: "test@example.com".to_string(),
                password: "password".to_string(),
            })
            .await
            .unwrap();

        let profile = client.get_profile().await.unwrap();
        assert_eq!(profile.email, "test@example.com");
    }

    /// 测试 MockApiClient 日历 CRUD
    #[tokio::test]
    async fn test_mock_api_calendar_crud() {
        let client = MockApiClient::new();

        // 创建日历
        let calendar = CalendarDTO {
            id: 0, // Mock 会自动生成 ID
            name: "工作日历".to_string(),
            color: "#FF5733".to_string(),
            r#type: "online".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
            description: Some("工作相关".to_string()),
            user_id: Some(1),
            is_default: true,
            created_at: 0,
            updated_at: 0,
        };
        let created = client.create_calendar(calendar).await.unwrap();
        assert!(created.id > 0);

        // 获取日历列表
        let calendars = client.get_calendars().await.unwrap();
        assert_eq!(calendars.len(), 1);

        // 更新日历
        let updated_calendar = CalendarDTO {
            id: created.id,
            name: "更新后的日历".to_string(),
            color: "#00FF00".to_string(),
            r#type: "online".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
            description: None,
            user_id: Some(1),
            is_default: false,
            created_at: created.created_at,
            updated_at: 0,
        };
        let updated = client.update_calendar(updated_calendar).await.unwrap();
        assert_eq!(updated.name, "更新后的日历");

        // 删除日历
        client.delete_calendar(created.id).await.unwrap();
        let calendars = client.get_calendars().await.unwrap();
        assert_eq!(calendars.len(), 0);
    }

    /// 测试 MockApiClient 事件 CRUD
    #[tokio::test]
    async fn test_mock_api_event_crud() {
        let client = MockApiClient::new();

        // 先创建日历
        let calendar = CalendarDTO {
            id: 0,
            name: "测试日历".to_string(),
            color: "#FF5733".to_string(),
            r#type: "online".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
            description: None,
            user_id: Some(1),
            is_default: true,
            created_at: 0,
            updated_at: 0,
        };
        let created_calendar = client.create_calendar(calendar).await.unwrap();

        // 创建事件
        let event = EventDTO {
            id: 0,
            calendar_id: created_calendar.id,
            title: "会议".to_string(),
            description: Some("团队周会".to_string()),
            start_time: "2024-01-01T10:00:00Z".to_string(),
            end_time: "2024-01-01T11:00:00Z".to_string(),
            is_all_day: false,
            location: Some("会议室".to_string()),
            reminder_minutes: Some(15),
            recurrence_rule: None,
            user_id: Some(1),
            created_at: 0,
            updated_at: 0,
        };
        let created_event = client.create_event(event).await.unwrap();
        assert!(created_event.id > 0);

        // 获取事件列表
        let events = client.get_events(created_calendar.id).await.unwrap();
        assert_eq!(events.len(), 1);

        // 删除事件
        client.delete_event(created_event.id).await.unwrap();
        let events = client.get_events(created_calendar.id).await.unwrap();
        assert_eq!(events.len(), 0);
    }

    /// 测试 MockApiClient 待办 CRUD
    #[tokio::test]
    async fn test_mock_api_todo_crud() {
        let client = MockApiClient::new();

        // 先创建日历
        let calendar = CalendarDTO {
            id: 0,
            name: "测试日历".to_string(),
            color: "#FF5733".to_string(),
            r#type: "online".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
            description: None,
            user_id: Some(1),
            is_default: true,
            created_at: 0,
            updated_at: 0,
        };
        let created_calendar = client.create_calendar(calendar).await.unwrap();

        // 创建待办
        let todo = TodoDTO {
            id: 0,
            calendar_id: created_calendar.id,
            title: "完成任务".to_string(),
            description: Some("重要任务".to_string()),
            due_date: Some("2024-01-01".to_string()),
            is_completed: false,
            completed_at: None,
            priority: 2,
            user_id: Some(1),
            created_at: 0,
            updated_at: 0,
        };
        let created_todo = client.create_todo(todo).await.unwrap();
        assert!(created_todo.id > 0);

        // 获取待办列表
        let todos = client.get_todos(created_calendar.id).await.unwrap();
        assert_eq!(todos.len(), 1);

        // 删除待办
        client.delete_todo(created_todo.id).await.unwrap();
        let todos = client.get_todos(created_calendar.id).await.unwrap();
        assert_eq!(todos.len(), 0);
    }

    /// 测试 MockApiClient 数据同步
    #[tokio::test]
    async fn test_mock_api_sync() {
        let client = MockApiClient::new();

        // 上传变更
        let upload_request = SyncUploadRequest {
            last_sync_at: None,
            changes: BatchChanges {
                calendars: EntityChanges {
                    created: vec![CalendarSyncItem {
                        id: 100,
                        name: "同步日历".to_string(),
                        color: "#FF5733".to_string(),
                        r#type: "local".to_string(),
                        account_id: None,
                        visible: true,
                        sync_enabled: false,
                        updated_at: chrono::Utc::now().timestamp_millis(),
                    }],
                    updated: vec![],
                    deleted: vec![],
                },
                events: EntityChanges {
                    created: vec![],
                    updated: vec![],
                    deleted: vec![],
                },
                todos: EntityChanges {
                    created: vec![],
                    updated: vec![],
                    deleted: vec![],
                },
            },
        };

        let upload_response = client.sync_upload(upload_request).await.unwrap();
        assert!(!upload_response.sync_token.is_empty());
        assert!(upload_response.server_time > 0);

        // 下载变更
        let download_response = client.sync_download(None).await.unwrap();
        assert!(!download_response.sync_token.is_empty());
        assert_eq!(download_response.server_changes.calendars.created.len(), 1);
    }
}