// API 类型定义模块
// 定义所有 API DTO 类型，包括认证、同步、日历、事件、待办等

use serde::{Deserialize, Serialize};

// ================================================================
// 认证相关 DTO
// ================================================================

/// 登录请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    /// 用户邮箱
    pub email: String,
    /// 用户密码
    pub password: String,
}

/// 注册请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    /// 用户邮箱
    pub email: String,
    /// 用户密码
    pub password: String,
    /// 显示名称
    pub display_name: String,
}

/// 认证响应（登录/注册/OAuth 成功后返回）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    /// 用户 ID
    pub user_id: i64,
    /// 访问令牌
    pub access_token: String,
    /// 刷新令牌
    pub refresh_token: String,
    /// 过期时间（秒）
    pub expires_in: i64,
}

/// 刷新 Token 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RefreshTokenResponse {
    /// 用户 ID
    pub user_id: i64,
    /// 新的访问令牌
    pub access_token: String,
    /// 新的刷新令牌
    pub refresh_token: String,
    /// 过期时间（秒）
    pub expires_in: i64,
}

/// 用户资料
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    /// 用户 ID
    pub id: i64,
    /// 用户邮箱
    pub email: String,
    /// 显示名称
    pub display_name: String,
    /// 头像 URL
    pub avatar_url: Option<String>,
    /// 认证提供商
    pub provider: String,
}

// ================================================================
// 数据同步 DTO — batch-sync API 规范
// ================================================================

/// 同步上传请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncUploadRequest {
    /// 上次同步时间戳（毫秒），首次为 None
    pub last_sync_at: Option<i64>,
    /// 批量变更
    pub changes: BatchChanges,
}

/// 同步下载响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDownloadResponse {
    /// 服务端变更
    pub server_changes: BatchChanges,
    /// 同步令牌（用于增量同步）
    pub sync_token: String,
    /// 服务端当前时间戳（毫秒）
    pub server_time: i64,
}

/// 批量变更集合
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchChanges {
    /// 日历变更
    #[serde(default)]
    pub calendars: EntityChanges<CalendarSyncItem>,
    /// 事件变更
    #[serde(default)]
    pub events: EntityChanges<EventSyncItem>,
    /// 待办变更
    #[serde(default)]
    pub todos: EntityChanges<TodoSyncItem>,
}

impl Default for BatchChanges {
    fn default() -> Self {
        Self {
            calendars: EntityChanges::default(),
            events: EntityChanges::default(),
            todos: EntityChanges::default(),
        }
    }
}

/// 实体变更（按操作类型分组）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityChanges<T> {
    /// 新建的实体列表
    pub created: Vec<T>,
    /// 更新的实体列表
    pub updated: Vec<T>,
    /// 删除的实体 ID 列表
    pub deleted: Vec<i64>,
}

impl<T> Default for EntityChanges<T> {
    fn default() -> Self {
        Self {
            created: Vec::new(),
            updated: Vec::new(),
            deleted: Vec::new(),
        }
    }
}

/// 日历同步条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSyncItem {
    /// 日历 ID
    pub id: i64,
    /// 日历名称
    pub name: String,
    /// 日历颜色
    pub color: String,
    /// 日历类型
    pub r#type: String,
    /// 关联账户 ID
    pub account_id: Option<i64>,
    /// 是否可见
    pub visible: bool,
    /// 是否启用同步
    pub sync_enabled: bool,
    /// 更新时间戳（毫秒）
    pub updated_at: i64,
}

/// 事件同步条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventSyncItem {
    /// 事件 ID
    pub id: i64,
    /// 事件标题
    pub title: String,
    /// 事件描述
    pub description: Option<String>,
    /// 开始时间戳（毫秒）
    pub start_time: i64,
    /// 结束时间戳（毫秒）
    pub end_time: i64,
    /// 是否全天事件
    pub all_day: bool,
    /// 所属日历 ID
    pub calendar_id: i64,
    /// 时区
    pub timezone: String,
    /// 颜色
    pub color: Option<String>,
    /// 提醒时间（分钟）
    pub reminder: Option<i32>,
    /// 位置
    pub location: Option<String>,
    /// 更新时间戳（毫秒）
    pub updated_at: i64,
}

/// 待办同步条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoSyncItem {
    /// 待办 ID
    pub id: i64,
    /// 待办标题
    pub title: String,
    /// 待办描述
    pub description: Option<String>,
    /// 截止日期时间戳（毫秒）
    pub due_date: Option<i64>,
    /// 是否完成
    pub completed: bool,
    /// 优先级 (low/medium/high)
    pub priority: String,
    /// 所属日历 ID
    pub calendar_id: i64,
    /// 更新时间戳（毫秒）
    pub updated_at: i64,
}

// ================================================================
// 日历 DTO
// ================================================================

/// 日历数据传输对象
/// 字段命名遵循 snake_case (与后端 API 对齐)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarDTO {
    /// 日历 ID
    pub id: i64,
    /// 日历名称
    pub name: String,
    /// 日历颜色
    pub color: String,
    /// 日历描述
    pub description: Option<String>,
    /// 用户 ID
    pub user_id: i64,
    /// 是否默认日历
    pub is_default: bool,
    /// 创建时间 (Unix 时间戳，毫秒)
    pub created_at: i64,
    /// 更新时间 (Unix 时间戳，毫秒)
    pub updated_at: i64,
}

// ================================================================
// 事件 DTO
// ================================================================

/// 事件数据传输对象
/// 字段命名遵循 snake_case (与后端 API 对齐)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDTO {
    /// 事件 ID
    pub id: i64,
    /// 日历 ID
    pub calendar_id: i64,
    /// 事件标题
    pub title: String,
    /// 事件描述
    pub description: Option<String>,
    /// 开始时间 (ISO 8601 格式)
    pub start_time: String,
    /// 结束时间 (ISO 8601 格式)
    pub end_time: String,
    /// 是否全天事件
    pub is_all_day: bool,
    /// 位置
    pub location: Option<String>,
    /// 提醒时间 (分钟)
    pub reminder_minutes: Option<i64>,
    /// 重复规则 (RRULE 格式)
    pub recurrence_rule: Option<String>,
    /// 用户 ID
    pub user_id: i64,
    /// 创建时间 (Unix 时间戳，毫秒)
    pub created_at: i64,
    /// 更新时间 (Unix 时间戳，毫秒)
    pub updated_at: i64,
}

// ================================================================
// 待办 DTO
// ================================================================

/// 待办数据传输对象
/// 字段命名遵循 snake_case (与后端 API 对齐)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoDTO {
    /// 待办 ID
    pub id: i64,
    /// 日历 ID
    pub calendar_id: i64,
    /// 待办标题
    pub title: String,
    /// 待办描述
    pub description: Option<String>,
    /// 截止日期 (ISO 8601 格式)
    pub due_date: Option<String>,
    /// 完成状态
    pub is_completed: bool,
    /// 完成时间 (Unix 时间戳，毫秒)
    pub completed_at: Option<i64>,
    /// 优先级 (0: 低, 1: 中, 2: 高)
    pub priority: i64,
    /// 用户 ID
    pub user_id: i64,
    /// 创建时间 (Unix 时间戳，毫秒)
    pub created_at: i64,
    /// 更新时间 (Unix 时间戳，毫秒)
    pub updated_at: i64,
}

// ================================================================
// API 响应包装
// ================================================================

/// 通用 API 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    /// 是否成功
    pub success: bool,
    /// 响应数据
    pub data: Option<T>,
    /// 错误消息
    pub message: Option<String>,
}

/// 分页响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    /// 数据列表
    pub items: Vec<T>,
    /// 总条数
    pub total: i64,
    /// 当前页码
    pub page: i64,
    /// 每页条数
    pub page_size: i64,
    /// 总页数
    pub total_pages: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 LoginRequest 序列化
    #[test]
    fn test_login_request_serialization() {
        let request = LoginRequest {
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("test@example.com"));
        assert!(json.contains("password123"));

        let deserialized: LoginRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.email, request.email);
    }

    /// 测试 RegisterRequest 序列化
    #[test]
    fn test_register_request_serialization() {
        let request = RegisterRequest {
            email: "new@example.com".to_string(),
            password: "password123".to_string(),
            display_name: "新用户".to_string(),
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("new@example.com"));
        assert!(json.contains("新用户"));
    }

    /// 测试 AuthResponse 序列化
    #[test]
    fn test_auth_response_serialization() {
        let response = AuthResponse {
            user_id: 1,
            access_token: "at_123".to_string(),
            refresh_token: "rt_456".to_string(),
            expires_in: 3600,
        };
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: AuthResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.access_token, "at_123");
        assert_eq!(deserialized.user_id, 1);
    }

    /// 测试 RefreshTokenResponse 序列化
    #[test]
    fn test_refresh_token_response_serialization() {
        let response = RefreshTokenResponse {
            user_id: 1,
            access_token: "new_at".to_string(),
            refresh_token: "new_rt".to_string(),
            expires_in: 7200,
        };
        let json = serde_json::to_string(&response).unwrap();
        let deserialized: RefreshTokenResponse = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.access_token, "new_at");
        assert_eq!(deserialized.expires_in, 7200);
    }

    /// 测试 UserProfile 序列化
    #[test]
    fn test_user_profile_serialization() {
        let profile = UserProfile {
            id: 42,
            email: "user@example.com".to_string(),
            display_name: "用户名".to_string(),
            avatar_url: Some("https://example.com/avatar.png".to_string()),
            provider: "local".to_string(),
        };
        let json = serde_json::to_string(&profile).unwrap();
        let deserialized: UserProfile = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, 42);
    }

    /// 测试 BatchChanges 序列化
    #[test]
    fn test_batch_changes_serialization() {
        let changes = BatchChanges {
            calendars: EntityChanges {
                created: vec![CalendarSyncItem {
                    id: 1,
                    name: "工作日历".to_string(),
                    color: "#FF5733".to_string(),
                    r#type: "local".to_string(),
                    account_id: None,
                    visible: true,
                    sync_enabled: false,
                    updated_at: 1700000000000,
                }],
                updated: vec![],
                deleted: vec![],
            },
            events: EntityChanges {
                created: vec![EventSyncItem {
                    id: 1,
                    title: "测试事件".to_string(),
                    description: None,
                    start_time: 1700000000000,
                    end_time: 1700003600000,
                    all_day: false,
                    calendar_id: 1,
                    timezone: "Asia/Shanghai".to_string(),
                    color: None,
                    reminder: None,
                    location: None,
                    updated_at: 1700000000000,
                }],
                updated: vec![],
                deleted: vec![2],
            },
            todos: EntityChanges {
                created: vec![],
                updated: vec![],
                deleted: vec![],
            },
        };
        let json = serde_json::to_string(&changes).unwrap();
        assert!(json.contains("calendars"));
        assert!(json.contains("events"));
        assert!(json.contains("todos"));
    }

    /// 测试 SyncUploadRequest 序列化
    #[test]
    fn test_sync_upload_request_serialization() {
        let request = SyncUploadRequest {
            last_sync_at: Some(1700000000000),
            changes: BatchChanges {
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
        };
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("last_sync_at"));
        assert!(json.contains("changes"));
    }

    /// 测试 SyncDownloadResponse 序列化
    #[test]
    fn test_sync_download_response_serialization() {
        let response = SyncDownloadResponse {
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
            sync_token: "token_abc123".to_string(),
            server_time: 1700000000000,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("server_changes"));
        assert!(json.contains("sync_token"));
        assert!(json.contains("server_time"));
    }

    /// 测试 CalendarDTO 序列化
    #[test]
    fn test_calendar_dto_serialization() {
        let calendar = CalendarDTO {
            id: 1,
            name: "工作日历".to_string(),
            color: "#FF5733".to_string(),
            description: Some("工作相关事件".to_string()),
            user_id: 1,
            is_default: true,
            created_at: 1700000000000,
            updated_at: 1700000000000,
        };
        let json = serde_json::to_string(&calendar).unwrap();
        assert!(json.contains("工作日历"));
        assert!(json.contains("#FF5733"));
    }

    /// 测试 EventDTO 序列化
    #[test]
    fn test_event_dto_serialization() {
        let event = EventDTO {
            id: 1,
            calendar_id: 1,
            title: "会议".to_string(),
            description: Some("团队周会".to_string()),
            start_time: "2024-01-01T10:00:00Z".to_string(),
            end_time: "2024-01-01T11:00:00Z".to_string(),
            is_all_day: false,
            location: Some("会议室 A".to_string()),
            reminder_minutes: Some(15),
            recurrence_rule: None,
            user_id: 1,
            created_at: 1700000000000,
            updated_at: 1700000000000,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("会议"));
        assert!(json.contains("calendar_id"));
    }

    /// 测试 TodoDTO 序列化
    #[test]
    fn test_todo_dto_serialization() {
        let todo = TodoDTO {
            id: 1,
            calendar_id: 1,
            title: "完成任务".to_string(),
            description: Some("重要任务".to_string()),
            due_date: Some("2024-01-01".to_string()),
            is_completed: false,
            completed_at: None,
            priority: 2,
            user_id: 1,
            created_at: 1700000000000,
            updated_at: 1700000000000,
        };
        let json = serde_json::to_string(&todo).unwrap();
        assert!(json.contains("完成任务"));
        assert!(json.contains("priority"));
    }

    /// 测试 ApiResponse 序列化
    #[test]
    fn test_api_response_serialization() {
        let response = ApiResponse::<String> {
            success: true,
            data: Some("操作成功".to_string()),
            message: None,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("success"));
    }

    /// 测试 PaginatedResponse 序列化
    #[test]
    fn test_paginated_response_serialization() {
        let response = PaginatedResponse::<i64> {
            items: vec![1, 2, 3],
            total: 100,
            page: 1,
            page_size: 10,
            total_pages: 10,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("total"));
        assert!(json.contains("page"));
    }
}