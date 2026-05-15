use log::{info, error};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use crate::caldav;
use crate::crypto;
use crate::db::connection::DatabaseConnection;
use crate::db::errors::DatabaseError;
use crate::db::repositories::account::{
    AccountRepository, Account as DbAccount, CreateAccountParams, UpdateAccountParams,
};
use crate::db::repositories::calendar::{
    CalendarRepository, Calendar as DbCalendar, CreateCalendarRequest, UpdateCalendarRequest,
};
use crate::db::repositories::event::{
    EventRepository, Event as DbEvent, CreateEvent, UpdateEvent,
};
use crate::db::repositories::todo::{
    TodoRepository, Todo as DbTodo, CreateTodoInput, UpdateTodoInput,
};
use crate::db::repositories::sync_state::{
    SyncStateRepository, SyncState, NewSyncState,
};
use crate::db::repositories::settings::{
    SettingEntry, SettingsRepository, UserHoliday, UserHolidaysRepository,
};
use crate::ews;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[derive(Default)]
pub struct AppState {
    pub always_on_top: bool,
    pub auto_hide: bool,
}

/// 账号类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccountType {
    Exchange,
    CalDav,
}

/// 账号信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    /// 账号唯一标识符
    pub id: String,
    /// 账号类型
    pub account_type: AccountType,
    /// 服务器地址
    pub server_url: String,
    /// 用户名
    pub username: String,
    /// 加密后的密码
    pub encrypted_password: String,
    /// 显示名称
    pub display_name: String,
    /// 是否启用
    pub enabled: bool,
    /// 最后同步时间（Unix 时间戳）
    pub last_sync: Option<i64>,
}

/// 日历信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarInfo {
    /// 日历唯一标识符
    pub id: String,
    /// 日历显示名称
    pub name: String,
    /// 日历颜色
    pub color: Option<String>,
    /// 日历 URL（用于 CalDAV 创建事件）
    pub url: Option<String>,
    /// 所属账号 ID
    pub account_id: String,
    /// 是否启用同步
    pub enabled: bool,
    /// 是否为只读日历
    pub read_only: bool,
}

/// 同步结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    /// 账号 ID
    pub account_id: String,
    /// 是否成功
    pub success: bool,
    /// 同步的事件数量
    pub events_synced: u32,
    /// 错误信息（如果有）
    pub error: Option<String>,
    /// 同步时间（Unix 时间戳）
    pub synced_at: i64,
}

/// 同步状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    /// 账号 ID
    pub account_id: String,
    /// 是否正在同步
    pub syncing: bool,
    /// 最后同步时间
    pub last_sync: Option<i64>,
    /// 下次同步时间
    pub next_sync: Option<i64>,
    /// 同步间隔（分钟）
    pub sync_interval: u32,
}

/// CalDAV/Exchange 连接结果，包含账号信息和日历列表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectResult {
    /// 是否成功
    pub success: bool,
    /// 错误信息
    pub error: Option<String>,
    /// 账号信息
    pub account: Option<AccountInfo>,
    /// 日历列表
    pub calendars: Option<Vec<CalDavCalendarInfo>>,
}

/// CalDAV 日历信息（用于连接结果）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalDavCalendarInfo {
    /// 日历唯一标识符
    pub id: String,
    /// 日历显示名称
    pub name: String,
    /// 日历颜色
    pub color: Option<String>,
    /// 日历 URL
    pub url: String,
    /// 是否只读
    pub read_only: bool,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "小河日历".to_string(),
        version: "0.1.1".to_string(),
    }
}

#[tauri::command]
pub fn minimize_to_tray(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
pub fn toggle_always_on_top(
    window: tauri::WebviewWindow,
    state: State<'_, Mutex<AppState>>,
) -> bool {
    let mut app_state = state.lock().unwrap();
    app_state.always_on_top = !app_state.always_on_top;
    let _ = window.set_always_on_top(app_state.always_on_top);
    app_state.always_on_top
}

#[tauri::command]
pub fn get_always_on_top(state: State<'_, Mutex<AppState>>) -> bool {
    let app_state = state.lock().unwrap();
    app_state.always_on_top
}

#[tauri::command]
pub fn toggle_auto_hide(state: State<'_, Mutex<AppState>>) -> bool {
    let mut app_state = state.lock().unwrap();
    app_state.auto_hide = !app_state.auto_hide;
    app_state.auto_hide
}

#[tauri::command]
pub fn get_auto_hide(state: State<'_, Mutex<AppState>>) -> bool {
    let app_state = state.lock().unwrap();
    app_state.auto_hide
}

#[tauri::command]
pub fn show_main_window(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn hide_main_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
pub fn is_window_visible(window: tauri::Window) -> bool {
    window.is_visible().unwrap_or(false)
}

/// 连接 Exchange 服务器
///
/// 使用 Autodiscover 自动发现 EWS 服务器地址
#[tauri::command]
pub async fn connect_exchange(
    server_url: Option<String>,
    username: String,
    password: String,
) -> Result<ConnectResult, String> {
    // 加密密码
    let encrypted_password = crypto::encrypt_password(&password)
        .map_err(|e| format!("密码加密失败: {}", e))?;

    // 创建 EWS 客户端
    let client = if let Some(url) = server_url {
        // 如果提供了服务器地址，直接使用
        ews::EwsClient::new(url, username.clone(), password)
    } else {
        // 否则使用 Autodiscover 自动发现
        ews::EwsClient::discover(username.clone(), password).await
            .map_err(|e| format!("Autodiscover 失败: {}", e))?
    };

    // 验证连接
    client.connect().await?;

    // 生成账号 ID
    let account_id = format!("exchange_{}", uuid::Uuid::new_v4());

    Ok(ConnectResult {
        success: true,
        error: None,
        account: Some(AccountInfo {
            id: account_id,
            account_type: AccountType::Exchange,
            server_url: username.clone(), // 存储邮箱地址，服务器地址由 Autodiscover 动态获取
            username: username.clone(),
            encrypted_password,
            display_name: username,
            enabled: true,
            last_sync: None,
        }),
        calendars: None,
    })
}

/// 连接 CalDAV 服务器
#[tauri::command]
pub async fn connect_caldav(
    server_url: String,
    username: String,
    password: String,
) -> Result<ConnectResult, String> {
    info!("[CalDAV] 开始连接, server_url: {}, username: {}", server_url, username);

    // 加密密码
    let encrypted_password = crypto::encrypt_password(&password)
        .map_err(|e| {
            error!("[CalDAV] 密码加密失败: {}", e);
            format!("密码加密失败: {}", e)
        })?;

    // 创建 CalDAV 客户端并获取日历列表
    let client = caldav::CalDavClient::new(server_url.clone(), username.clone(), password.clone());

    // 获取日历列表（list_calendars 内部会自动尝试标准发现和用户路径发现）
    let calendars = match client.list_calendars().await {
        Ok(cals) => {
            info!("[CalDAV] 获取到 {} 个日历", cals.len());
            cals
        }
        Err(e) => {
            error!("[CalDAV] 获取日历列表失败: {}", e);
            return Err(format!("获取日历列表失败: {}", e));
        }
    };

    // 转换为 CalDavCalendarInfo
    let cal_dav_calendars: Vec<CalDavCalendarInfo> = calendars.into_iter().map(|c| {
        CalDavCalendarInfo {
            id: c.id,
            name: c.name,
            color: c.color,
            url: c.url,
            read_only: c.read_only,
        }
    }).collect();

    // 生成账号 ID
    let account_id = format!("caldav_{}", uuid::Uuid::new_v4());

    let account = AccountInfo {
        id: account_id,
        account_type: AccountType::CalDav,
        server_url,
        username: username.clone(),
        encrypted_password,
        display_name: username,
        enabled: true,
        last_sync: None,
    };

    Ok(ConnectResult {
        success: true,
        error: None,
        account: Some(account),
        calendars: Some(cal_dav_calendars),
    })
}

/// 获取所有账号
#[tauri::command]
pub async fn get_all_accounts() -> Result<Vec<AccountInfo>, String> {
    // TODO: 从数据库读取账号列表
    // 目前返回空列表，等待数据库模块实现
    Ok(Vec::new())
}

/// 删除账号
#[tauri::command]
pub async fn delete_account(account_id: String) -> Result<(), String> {
    // TODO: 从数据库删除账号
    // 目前仅验证账号 ID 格式
    if account_id.is_empty() {
        return Err("账号 ID 不能为空".to_string());
    }
    Ok(())
}

/// 获取外部日历列表
#[tauri::command]
pub async fn get_external_calendars(
    account_id: String,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
) -> Result<Vec<CalendarInfo>, String> {
    info!("[get_external_calendars] accountId: {}, accountType: {}, serverUrl: {}", account_id, account_type, server_url);

    if account_id.is_empty() {
        return Err("账号 ID 不能为空".to_string());
    }

    // 解密密码
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    // 根据账号类型获取日历列表
    let account_type_lower = account_type.to_lowercase();
    let calendars = match account_type_lower.as_str() {
        "exchange" => {
            let client = ews::EwsClient::new(server_url, username, password);
            let ews_calendars = client.list_calendars().await
                .map_err(|e| format!("获取 Exchange 日历列表失败: {}", e))?;

            // 转换为 CalendarInfo
            ews_calendars
                .into_iter()
                .map(|cal| CalendarInfo {
                    id: cal.id,
                    name: cal.name,
                    color: cal.color,
                    url: None, // Exchange 不需要 URL
                    account_id: account_id.clone(),
                    enabled: true,
                    read_only: false,
                })
                .collect()
        }
        "caldav" => {
            let client = caldav::CalDavClient::new(server_url, username, password);
            let caldav_calendars = client.list_calendars().await
                .map_err(|e| format!("获取 CalDAV 日历列表失败: {}", e))?;

            // 转换为 CalendarInfo
            caldav_calendars
                .into_iter()
                .map(|cal| CalendarInfo {
                    id: cal.id,
                    name: cal.name,
                    color: cal.color,
                    url: Some(cal.url),
                    account_id: account_id.clone(),
                    enabled: true,
                    read_only: cal.read_only,
                })
                .collect()
        }
        _ => return Err(format!("不支持的账号类型: {}", account_type)),
    };

    Ok(calendars)
}

/// 手动触发同步
#[tauri::command]
pub async fn sync_now(account_id: Option<String>) -> Result<SyncResult, String> {
    let id = account_id.unwrap_or_else(|| "all".to_string());

    // TODO: 调用同步模块执行同步
    // 目前返回模拟结果
    Ok(SyncResult {
        account_id: id,
        success: true,
        events_synced: 0,
        error: None,
        synced_at: chrono::Utc::now().timestamp(),
    })
}

/// 同步所有账号
#[tauri::command]
pub async fn sync_all() -> Result<Vec<SyncResult>, String> {
    // TODO: 调用同步模块同步所有账号
    // 目前返回空列表
    Ok(Vec::new())
}

/// 获取同步状态
#[tauri::command]
pub async fn get_sync_status(account_id: String) -> Result<SyncStatus, String> {
    if account_id.is_empty() {
        return Err("账号 ID 不能为空".to_string());
    }

    // TODO: 从数据库获取同步状态
    // 目前返回默认状态
    Ok(SyncStatus {
        account_id,
        syncing: false,
        last_sync: None,
        next_sync: None,
        sync_interval: 30,
    })
}

/// 设置同步间隔
#[tauri::command]
pub async fn set_sync_interval(minutes: u32) -> Result<(), String> {
    if minutes < 5 {
        return Err("同步间隔不能小于 5 分钟".to_string());
    }

    if minutes > 1440 {
        return Err("同步间隔不能大于 24 小时".to_string());
    }

    // TODO: 保存同步间隔到数据库
    Ok(())
}

/// 外部日历创建事件
#[tauri::command]
pub async fn create_external_event(
    account_id: String,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    calendar_url: String,
    event: ExternalEventInput,
) -> Result<ExternalEventResult, String> {
    info!("[create_external_event] 账号: {}, 日历: {}, 类型: {}", account_id, calendar_url, account_type);

    // 解密密码
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    let account_type_lower = account_type.to_lowercase();

    match account_type_lower.as_str() {
        "caldav" => {
            let client = caldav::CalDavClient::new(
                server_url,
                username,
                password
            );

            // 为 CalDAV 事件生成全新的 UUID，避免使用前端内部 ID 导致冲突
            let caldav_uid = uuid::Uuid::new_v4().to_string();
            info!("[create_external_event] 生成 CalDAV UID: {}", caldav_uid);

            let event_info = caldav::EventInfo {
                id: caldav_uid,
                title: event.title,
                description: event.description,
                start_time: event.start_time / 1000, // 毫秒转秒
                end_time: event.end_time / 1000,
                all_day: event.all_day,
                location: event.location,
            };

            // create_event 内部会发送 PUT 请求，不需要先验证服务器连接
            let event_url = client.create_event(&calendar_url, &event_info).await?;

            info!("[create_external_event] CalDAV 事件创建成功: {}", event_url);

            Ok(ExternalEventResult {
                success: true,
                external_id: event_url,
                error: None,
            })
        }
        "exchange" => {
            // Exchange 创建事件 - TODO: 实现
            error!("[create_external_event] Exchange 暂不支持创建事件");
            Err("Exchange 暂不支持创建事件".to_string())
        }
        _ => Err(format!("不支持的账号类型: {}", account_type))
    }
}

/// 获取外部日历事件
#[tauri::command]
pub async fn get_external_events(
    account_id: String,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    calendar_url: String,
    calendar_id: String,
    start_time: i64,
    end_time: i64,
) -> Result<Vec<ExternalEventOutput>, String> {
    info!("[get_external_events] 获取外部事件: 账号 {}, 日历 {}", account_id, calendar_url);

    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    let account_type_lower = account_type.to_lowercase();

    match account_type_lower.as_str() {
        "caldav" => {
            let client = caldav::CalDavClient::new(server_url, username, password);
            // fetch_events 内部会直接使用 calendar_url 发送 REPORT 请求
            // 不需要先调用 connect() 验证服务器根地址
            // 因为 calendar_url 已经是完整的日历路径
            let events = client.fetch_events(&calendar_url, start_time / 1000, end_time / 1000).await?;
            
            let output_events = events.into_iter().map(|e| ExternalEventOutput {
                id: e.id.clone(),
                title: e.title,
                description: e.description,
                start_time: e.start_time * 1000, // 转换回毫秒
                end_time: e.end_time * 1000,
                all_day: e.all_day,
                calendar_id: calendar_id.clone(),
                location: e.location,
                account_id: account_id.clone(),
                external_id: e.id,
            }).collect();

            Ok(output_events)
        }
        "exchange" => {
            error!("[get_external_events] Exchange 暂不支持事件获取");
            Err("Exchange 暂不支持事件获取".to_string())
        }
        _ => Err(format!("不支持的账号类型: {}", account_type))
    }
}

/// 外部日历更新事件
#[tauri::command]
pub async fn update_external_event(
    account_id: String,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    calendar_url: String,
    event: ExternalEventInput,
) -> Result<ExternalEventResult, String> {
    info!("[update_external_event] 更新事件: 账号 {}, 事件 {}", account_id, event.id);

    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    let account_type_lower = account_type.to_lowercase();

    match account_type_lower.as_str() {
        "caldav" => {
            let client = caldav::CalDavClient::new(server_url, username, password);

            let event_info = caldav::EventInfo {
                id: event.id.clone(),
                title: event.title,
                description: event.description,
                start_time: event.start_time / 1000, // 毫秒转秒
                end_time: event.end_time / 1000,
                all_day: event.all_day,
                location: event.location,
            };

            // event.id 现在存储的是完整的事件 URL，直接使用
            // 不需要再拼接 calendar_url
            client.update_event(&event.id, &event_info).await?;

            Ok(ExternalEventResult {
                success: true,
                external_id: event.id,
                error: None,
            })
        }
        "exchange" => {
            error!("[update_external_event] Exchange 暂不支持更新事件");
            Err("Exchange 暂不支持更新事件".to_string())
        }
        _ => Err(format!("不支持的账号类型: {}", account_type))
    }
}

/// 外部日历删除事件
#[tauri::command]
pub async fn delete_external_event(
    account_id: String,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    calendar_url: String,
    event_id: String,
) -> Result<ExternalEventResult, String> {
    info!("[delete_external_event] 删除事件: 账号 {}, 事件 {}", account_id, event_id);

    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    let account_type_lower = account_type.to_lowercase();

    match account_type_lower.as_str() {
        "caldav" => {
            let client = caldav::CalDavClient::new(server_url, username, password);

            // event_id 现在存储的是完整的事件 URL，直接使用
            // 不需要再拼接 calendar_url
            client.delete_event(&event_id).await?;

            Ok(ExternalEventResult {
                success: true,
                external_id: event_id,
                error: None,
            })
        }
        "exchange" => {
            error!("[delete_external_event] Exchange 暂不支持删除事件");
            Err("Exchange 暂不支持删除事件".to_string())
        }
        _ => Err(format!("不支持的账号类型: {}", account_type))
    }
}

/// 外部事件输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalEventInput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub all_day: bool,
    pub location: Option<String>,
}

/// 外部事件输出与前台的 CalendarEvent 一致
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalEventOutput {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub all_day: bool,
    pub calendar_id: String,
    pub location: Option<String>,
    pub account_id: String,
    pub external_id: String,
}

/// 外部事件结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalEventResult {
    pub success: bool,
    pub external_id: String,
    pub error: Option<String>,
}

// ============================================================
// 本地日历命令
// ============================================================

/// 获取所有本地日历
#[tauri::command]
pub fn get_calendars(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbCalendar>, DatabaseError> {
    info!("[get_calendars] 获取所有日历");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = CalendarRepository::new(&db);
    repo.get_all()
}

/// 创建本地日历
#[tauri::command]
pub fn create_calendar(
    name: String,
    color: String,
    calendar_type: String,
    account_id: Option<i64>,
    visible: Option<bool>,
    sync_enabled: Option<bool>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbCalendar, DatabaseError> {
    info!("[create_calendar] 创建日历: {}", name);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = CalendarRepository::new(&db);
    let req = CreateCalendarRequest {
        name,
        color,
        type_: calendar_type,
        account_id,
        visible: visible.unwrap_or(true),
        sync_enabled: sync_enabled.unwrap_or(false),
        user_id: None,
        timezone: None,
    };
    repo.create(&req)
}

/// 更新本地日历
#[tauri::command]
pub fn update_calendar(
    id: i64,
    name: Option<String>,
    color: Option<String>,
    visible: Option<bool>,
    sync_enabled: Option<bool>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbCalendar, DatabaseError> {
    info!("[update_calendar] 更新日历: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = CalendarRepository::new(&db);
    let req = UpdateCalendarRequest {
        id,
        name,
        color,
        visible,
        sync_enabled,
    };
    repo.update(&req)
}

/// 删除本地日历
#[tauri::command]
pub fn delete_calendar(
    id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<(), DatabaseError> {
    info!("[delete_calendar] 删除日历: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = CalendarRepository::new(&db);
    repo.delete(id)
}

// ============================================================
// 本地事件命令
// ============================================================

/// 获取所有本地事件
#[tauri::command]
pub fn get_events(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError> {
    info!("[get_events] 获取所有事件");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    repo.get_all()
}

/// 根据日历 ID 获取事件
#[tauri::command]
pub fn get_events_by_calendar(
    calendar_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError> {
    info!("[get_events_by_calendar] 获取日历 {} 的事件", calendar_id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    repo.get_by_calendar_id(calendar_id)
}

/// 根据时间范围获取事件
#[tauri::command]
pub fn get_events_by_time_range(
    start_time: i64,
    end_time: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbEvent>, DatabaseError> {
    info!("[get_events_by_time_range] 获取时间范围内的事件: {} - {}", start_time, end_time);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    repo.get_by_time_range(start_time, end_time)
}

/// 创建本地事件
#[tauri::command]
pub fn create_event(
    title: String,
    description: Option<String>,
    start_time: i64,
    end_time: i64,
    all_day: bool,
    calendar_id: i64,
    color: Option<String>,
    reminder: Option<i32>,
    repeat_rule: Option<String>,
    location: Option<String>,
    external_id: Option<String>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbEvent, DatabaseError> {
    info!("[create_event] 创建事件: {}", title);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    let event = CreateEvent {
        title,
        description,
        start_time,
        end_time,
        all_day,
        calendar_id,
        color,
        reminder,
        repeat_rule,
        location,
        external_id,
        user_id: None,
        timezone: None,
    };
    repo.create(&event)
}

/// 更新本地事件
#[tauri::command]
pub fn update_event(
    id: i64,
    title: String,
    description: Option<String>,
    start_time: i64,
    end_time: i64,
    all_day: bool,
    calendar_id: i64,
    color: Option<String>,
    reminder: Option<i32>,
    repeat_rule: Option<String>,
    location: Option<String>,
    external_id: Option<String>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbEvent, DatabaseError> {
    info!("[update_event] 更新事件: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    let event = UpdateEvent {
        id,
        title,
        description,
        start_time,
        end_time,
        all_day,
        calendar_id,
        color,
        reminder,
        repeat_rule,
        location,
        external_id,
    };
    repo.update(&event)
}

/// 删除本地事件
#[tauri::command]
pub fn delete_event(
    id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<bool, DatabaseError> {
    info!("[delete_event] 删除事件: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = EventRepository::new(&db);
    repo.delete(id)
}

// ============================================================
// 待办事项命令
// ============================================================

/// 获取所有待办事项
#[tauri::command]
pub fn get_todos(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbTodo>, DatabaseError> {
    info!("[get_todos] 获取所有待办事项");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = TodoRepository::new(&db);
    repo.get_all()
}

/// 根据日历 ID 获取待办事项
#[tauri::command]
pub fn get_todos_by_calendar(
    calendar_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbTodo>, DatabaseError> {
    info!("[get_todos_by_calendar] 获取日历 {} 的待办事项", calendar_id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = TodoRepository::new(&db);
    repo.get_by_calendar_id(calendar_id)
}

/// 创建待办事项
#[tauri::command]
pub fn create_todo(
    title: String,
    description: Option<String>,
    due_date: Option<i64>,
    completed: Option<bool>,
    priority: Option<String>,
    calendar_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbTodo, DatabaseError> {
    info!("[create_todo] 创建待办: {}", title);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = TodoRepository::new(&db);
    let input = CreateTodoInput {
        title,
        description,
        due_date,
        completed,
        priority,
        calendar_id,
        user_id: None,
        timezone: None,
    };
    repo.create(&input)
}

/// 更新待办事项
#[tauri::command]
pub fn update_todo(
    id: i64,
    title: Option<String>,
    description: Option<String>,
    due_date: Option<i64>,
    completed: Option<bool>,
    priority: Option<String>,
    calendar_id: Option<i64>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbTodo, DatabaseError> {
    info!("[update_todo] 更新待办: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = TodoRepository::new(&db);
    let input = UpdateTodoInput {
        id,
        title,
        description,
        due_date,
        completed,
        priority,
        calendar_id,
    };
    repo.update(&input)
}

/// 删除待办事项
#[tauri::command]
pub fn delete_todo(
    id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<bool, DatabaseError> {
    info!("[delete_todo] 删除待办: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = TodoRepository::new(&db);
    repo.delete(id)
}

// ============================================================
// 账号命令
// ============================================================

/// 获取所有账号（数据库版本）
#[tauri::command]
pub fn get_all_db_accounts(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DbAccount>, DatabaseError> {
    info!("[get_all_db_accounts] 获取所有账号");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = AccountRepository::new(&db);
    repo.get_all()
}

/// 根据 ID 获取账号
#[tauri::command]
pub fn get_account_by_id(
    id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Option<DbAccount>, DatabaseError> {
    info!("[get_account_by_id] 获取账号: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = AccountRepository::new(&db);
    repo.get_by_id(id)
}

/// 创建账号
#[tauri::command]
pub fn create_account(
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    display_name: Option<String>,
    enabled: Option<bool>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbAccount, DatabaseError> {
    info!("[create_account] 创建账号: {} ({})", username, account_type);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = AccountRepository::new(&db);
    let params = CreateAccountParams {
        type_: account_type,
        server_url,
        username,
        encrypted_password,
        display_name,
        enabled: enabled.unwrap_or(true),
    };
    repo.create(params)
}

/// 更新账号
#[tauri::command]
pub fn update_account(
    id: i64,
    account_type: String,
    server_url: String,
    username: String,
    encrypted_password: String,
    display_name: Option<String>,
    enabled: bool,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<DbAccount, DatabaseError> {
    info!("[update_account] 更新账号: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = AccountRepository::new(&db);
    let params = UpdateAccountParams {
        id,
        type_: account_type,
        server_url,
        username,
        encrypted_password,
        display_name,
        enabled,
    };
    repo.update(params)
}

/// 删除账号（数据库版本）
#[tauri::command]
pub fn delete_db_account(
    id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<usize, DatabaseError> {
    info!("[delete_db_account] 删除账号: id={}", id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let repo = AccountRepository::new(&db);
    repo.delete(id)
}

// ============================================================
// 同步状态命令
// ============================================================

/// 获取同步状态
#[tauri::command]
pub fn get_sync_state(
    account_id: i64,
    calendar_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Option<SyncState>, DatabaseError> {
    info!("[get_sync_state] 获取同步状态: account={}, calendar={}", account_id, calendar_id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    SyncStateRepository::get(&conn, account_id, calendar_id).map_err(|e| e.into())
}

/// 插入或更新同步状态
#[tauri::command]
pub fn upsert_sync_state(
    account_id: i64,
    calendar_id: i64,
    sync_token: Option<String>,
    last_sync_at: Option<i64>,
    sync_window_start: Option<i64>,
    sync_window_end: Option<i64>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<(), DatabaseError> {
    info!("[upsert_sync_state] 更新同步状态: account={}, calendar={}", account_id, calendar_id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let new_state = NewSyncState {
        account_id,
        calendar_id,
        sync_token,
        last_sync_at,
        sync_window_start,
        sync_window_end,
    };
    let conn = db.get_connection();
    SyncStateRepository::upsert(&conn, &new_state).map_err(|e| e.into())
}

/// 删除同步状态
#[tauri::command]
pub fn delete_sync_state(
    account_id: i64,
    calendar_id: i64,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<usize, DatabaseError> {
    info!("[delete_sync_state] 删除同步状态: account={}, calendar={}", account_id, calendar_id);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    SyncStateRepository::delete(&conn, account_id, calendar_id).map_err(|e| e.into())
}

// ============================================================
// 远程认证命令
// ============================================================

/// 检查是否已登录（Token 是否存在且未过期）
#[tauri::command]
pub async fn auth_check_status() -> Result<bool, String> {
    info!("[auth_check_status] 检查认证状态");
    // TODO: 调用 auth handler 检查 Token
    Ok(false)
}

/// 邮箱密码登录
#[tauri::command]
pub async fn auth_login(
    email: String,
    password: String,
) -> Result<serde_json::Value, String> {
    info!("[auth_login] 邮箱密码登录: {}", email);
    // TODO: 调用 auth handler.login()
    Err("认证模块尚未连接".to_string())
}

/// 邮箱密码注册
#[tauri::command]
pub async fn auth_register(
    email: String,
    password: String,
    display_name: String,
) -> Result<serde_json::Value, String> {
    info!("[auth_register] 邮箱注册: {}", email);
    // TODO: 调用 auth handler.register()
    Err("认证模块尚未连接".to_string())
}

/// GitHub OAuth 登录
#[tauri::command]
pub async fn auth_oauth_github() -> Result<serde_json::Value, String> {
    info!("[auth_oauth_github] GitHub OAuth 登录");
    // TODO: 调用 auth handler.oauth_github()
    Err("认证模块尚未连接".to_string())
}

/// 退出登录
#[tauri::command]
pub async fn auth_logout() -> Result<(), String> {
    info!("[auth_logout] 退出登录");
    // TODO: 调用 auth handler.logout()
    Ok(())
}

/// 获取用户资料
#[tauri::command]
pub async fn auth_get_profile() -> Result<serde_json::Value, String> {
    info!("[auth_get_profile] 获取用户资料");
    // TODO: 调用 auth handler.get_profile()
    Err("认证模块尚未连接".to_string())
}

/// 刷新 Token
#[tauri::command]
pub async fn auth_refresh_token() -> Result<bool, String> {
    info!("[auth_refresh_token] 刷新 Token");
    // TODO: 调用 auth handler.refresh_token()
    Ok(false)
}

/// 获取 RSA 公钥
#[tauri::command]
pub async fn auth_get_public_key() -> Result<serde_json::Value, String> {
    info!("[auth_get_public_key] 获取 RSA 公钥");
    Err("认证模块尚未连接".to_string())
}

// ============================================================
// 云同步命令
// ============================================================

/// 启动同步
#[tauri::command]
pub async fn cloud_sync_trigger() -> Result<serde_json::Value, String> {
    info!("[cloud_sync_trigger] 触发同步");
    // TODO: 调用 sync engine.trigger_sync()
    Err("同步引擎尚未连接".to_string())
}

/// 获取同步状态
#[tauri::command]
pub async fn cloud_sync_get_status() -> Result<serde_json::Value, String> {
    info!("[cloud_sync_get_status] 获取同步状态");
    Ok(serde_json::json!({
        "status": "idle",
        "lastSyncAt": null,
        "pendingChanges": 0
    }))
}

// ==================== 时钟点击 Hook 相关命令 ====================

#[cfg(target_os = "windows")]
use crate::clock_hook::ClockHookManager;

/// 启用时钟点击检测
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn enable_clock_hook(
    app: tauri::AppHandle,
    state: State<'_, Mutex<ClockHookManager>>,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;
    manager.enable(app)
}

/// 禁用时钟点击检测
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn disable_clock_hook(
    state: State<'_, Mutex<ClockHookManager>>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;
    manager.disable()
}

/// 设置是否阻止系统日历弹窗
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_clock_hook_block_popup(
    block: bool,
    state: State<'_, Mutex<ClockHookManager>>,
) -> Result<(), String> {
    let manager = state.lock().map_err(|e| e.to_string())?;
    manager.set_block_system_popup(block);
    Ok(())
}

/// 获取时钟点击检测状态
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn get_clock_hook_status(
    state: State<'_, Mutex<ClockHookManager>>,
) -> String {
    let manager = state.lock().unwrap();
    manager.get_detection_method()
}

/// 检查时钟点击检测功能是否可用
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn is_clock_hook_available(
    state: State<'_, Mutex<ClockHookManager>>,
) -> bool {
    let manager = state.lock().unwrap();
    manager.is_available()
}

/// 弹出窗口区域结构（用于前端传递）
#[cfg(target_os = "windows")]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopupRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

/// 设置弹出窗口区域跟踪
#[cfg(target_os = "windows")]
#[tauri::command]
pub fn set_popup_window_rect(rect: Option<PopupRect>) -> Result<(), String> {
    use crate::clock_hook::hook::set_popup_window_rect as set_rect;
    let rect = rect.map(|r| windows::Win32::Foundation::RECT {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
    });
    set_rect(rect);
    Ok(())
}

// 非 Windows 平台的 stub 函数

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn enable_clock_hook() -> Result<String, String> {
    Err("此功能仅在 Windows 平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn disable_clock_hook() -> Result<(), String> {
    Err("此功能仅在 Windows 平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn set_clock_hook_block_popup(_block: bool) -> Result<(), String> {
    Err("此功能仅在 Windows 平台可用".to_string())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn get_clock_hook_status() -> String {
    "不支持".to_string()
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn is_clock_hook_available() -> bool {
    false
}

/// 弹出窗口区域结构（非 Windows 平台占位）
#[cfg(not(target_os = "windows"))]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopupRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn set_popup_window_rect(_rect: Option<PopupRect>) -> Result<(), String> {
    Err("此功能仅在 Windows 平台可用".to_string())
}

// ============================================================
// 应用设置命令
// ============================================================

/// 获取应用设置
#[tauri::command]
pub fn get_setting(
    key: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Option<String>, DatabaseError> {
    info!("[get_setting] 获取设置: key={}", key);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    repo.get(&key)
}

/// 设置应用设置
#[tauri::command]
pub fn set_setting(
    key: String,
    value: String,
    description: Option<String>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<(), DatabaseError> {
    info!("[set_setting] 设置: key={}, value={}", key, value);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    repo.set(&key, &value, description.as_deref())
}

/// 按前缀获取所有设置
#[tauri::command]
pub fn get_all_settings(
    prefix: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<(String, String)>, DatabaseError> {
    info!("[get_all_settings] 获取前缀为 {} 的所有设置", prefix);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    repo.get_by_prefix(&prefix)
}

/// 获取完整设置条目（含描述和时间戳）
#[tauri::command]
pub fn get_setting_entry(
    key: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Option<SettingEntry>, DatabaseError> {
    info!("[get_setting_entry] 获取设置条目: key={}", key);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    repo.get_entry(&key)
}

/// 按前缀获取所有设置条目（含描述和时间戳）
#[tauri::command]
pub fn get_all_setting_entries(
    prefix: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<SettingEntry>, DatabaseError> {
    info!("[get_all_setting_entries] 获取前缀为 {} 的所有设置条目", prefix);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    repo.get_entries_by_prefix(&prefix)
}

// ============================================================
// 用户节假日命令
// ============================================================

/// 添加用户节假日
#[tauri::command]
pub fn add_user_holiday(
    date: String,
    name: String,
    category: String,
    source: Option<String>,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<(), DatabaseError> {
    info!("[add_user_holiday] 添加节假日: date={}, name={}, category={}", date, name, category);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = UserHolidaysRepository::new(&conn);
    repo.add(&date, &name, &category, source.as_deref())
}

/// 删除用户节假日
#[tauri::command]
pub fn remove_user_holiday(
    date: String,
    category: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<bool, DatabaseError> {
    info!("[remove_user_holiday] 删除节假日: date={}, category={}", date, category);
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = UserHolidaysRepository::new(&conn);
    repo.remove(&date, &category)
}

/// 获取所有用户节假日
#[tauri::command]
pub fn get_all_user_holidays(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<UserHoliday>, DatabaseError> {
    info!("[get_all_user_holidays] 获取所有用户节假日");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = UserHolidaysRepository::new(&conn);
    repo.get_all()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_info() {
        let info = get_app_info();
        assert_eq!(info.name, "小河日历");
        assert_eq!(info.version, "0.1.1");
    }

    #[test]
    fn test_app_info_serialization() {
        let info = AppInfo {
            name: "测试应用".to_string(),
            version: "1.0.0".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("测试应用"));
        assert!(json.contains("1.0.0"));
    }

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        assert!(!state.always_on_top);
        assert!(!state.auto_hide);
    }

    #[test]
    fn test_account_info_serialization() {
        let account = AccountInfo {
            id: "test-123".to_string(),
            account_type: AccountType::Exchange,
            server_url: "https://mail.example.com/EWS/Exchange.asmx".to_string(),
            username: "user@example.com".to_string(),
            encrypted_password: "encrypted_password_123".to_string(),
            display_name: "测试用户".to_string(),
            enabled: true,
            last_sync: Some(1700000000),
        };

        let json = serde_json::to_string(&account).unwrap();
        assert!(json.contains("test-123"));
        assert!(json.contains("Exchange"));
        assert!(json.contains("测试用户"));
    }

    #[test]
    fn test_calendar_info_serialization() {
        let calendar = CalendarInfo {
            id: "cal-456".to_string(),
            name: "工作日历".to_string(),
            color: Some("#FF5733".to_string()),
            account_id: "account-123".to_string(),
            enabled: true,
            url: Some("https://caldav.example.com/calendars/user/work/".to_string()),
            read_only: false,
        };

        let json = serde_json::to_string(&calendar).unwrap();
        assert!(json.contains("cal-456"));
        assert!(json.contains("工作日历"));
        assert!(json.contains("#FF5733"));
    }

    #[test]
    fn test_sync_result_serialization() {
        let result = SyncResult {
            account_id: "acc-789".to_string(),
            success: true,
            events_synced: 10,
            error: None,
            synced_at: 1700000000,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("acc-789"));
        assert!(json.contains("true"));
        assert!(json.contains("10"));
    }

    #[test]
    fn test_sync_status_serialization() {
        let status = SyncStatus {
            account_id: "acc-101".to_string(),
            syncing: false,
            last_sync: Some(1700000000),
            next_sync: Some(1700001800),
            sync_interval: 30,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("acc-101"));
        assert!(json.contains("false"));
        assert!(json.contains("30"));
    }

    #[test]
    fn test_account_type_equality() {
        assert_eq!(AccountType::Exchange, AccountType::Exchange);
        assert_eq!(AccountType::CalDav, AccountType::CalDav);
        assert_ne!(AccountType::Exchange, AccountType::CalDav);
    }
}

// ============================================================
// 网络代理命令
// ============================================================

/// 代理配置信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyConfig {
    /// 代理模式：none(不走代理) | system(系统代理) | custom(自定义代理)
    pub proxy_mode: String,
    /// 自定义代理主机地址
    pub proxy_host: String,
    /// 自定义代理端口
    pub proxy_port: u16,
    /// 代理认证用户名
    pub proxy_username: String,
    /// 代理认证密码
    pub proxy_password: String,
}

/// 获取代理配置
#[tauri::command]
pub fn get_proxy_config(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<ProxyConfig, DatabaseError> {
    info!("[get_proxy_config] 获取代理配置");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    let repo = SettingsRepository::new(&conn);
    
    let proxy_mode = repo.get("app.proxyMode").ok().flatten()
        .and_then(|v| serde_json::from_str::<String>(&v).ok())
        .unwrap_or_else(|| "none".to_string());
    let proxy_host = repo.get("app.proxyHost").ok().flatten()
        .and_then(|v| serde_json::from_str::<String>(&v).ok())
        .unwrap_or_default();
    let proxy_port = repo.get("app.proxyPort").ok().flatten()
        .and_then(|v| serde_json::from_str::<u16>(&v).ok())
        .unwrap_or(0);
    let proxy_username = repo.get("app.proxyUsername").ok().flatten()
        .and_then(|v| serde_json::from_str::<String>(&v).ok())
        .unwrap_or_default();
    let proxy_password = repo.get("app.proxyPassword").ok().flatten()
        .and_then(|v| serde_json::from_str::<String>(&v).ok())
        .unwrap_or_default();
    
    Ok(ProxyConfig {
        proxy_mode,
        proxy_host,
        proxy_port,
        proxy_username,
        proxy_password,
    })
}

/// 应用代理配置到 reqwest 客户端
/// 返回配置好的 reqwest::Client，供 CalDAV、sync 等模块后续使用
pub fn create_proxied_client(
    db: &Mutex<DatabaseConnection>,
) -> Result<reqwest::Client, String> {
    let db_lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
    let conn = db_lock.get_connection();
    let repo = SettingsRepository::new(&conn);
    
    let proxy_mode = repo.get("app.proxyMode").ok().flatten()
        .and_then(|v| serde_json::from_str::<String>(&v).ok())
        .unwrap_or_else(|| "none".to_string());
    
    let mut client_builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30));
    
    match proxy_mode.as_str() {
        "system" => {
            // 使用系统代理（reqwest 默认从环境变量 HTTP_PROXY/HTTPS_PROXY 读取）
            // 无需额外配置，保持默认行为即可
            info!("[create_proxied_client] 使用系统代理");
        }
        "custom" => {
            let proxy_host = repo.get("app.proxyHost").ok().flatten()
                .and_then(|v| serde_json::from_str::<String>(&v).ok())
                .unwrap_or_default();
            let proxy_port = repo.get("app.proxyPort").ok().flatten()
                .and_then(|v| serde_json::from_str::<u16>(&v).ok())
                .unwrap_or(0);
            let proxy_username = repo.get("app.proxyUsername").ok().flatten()
                .and_then(|v| serde_json::from_str::<String>(&v).ok())
                .unwrap_or_default();
            let proxy_password = repo.get("app.proxyPassword").ok().flatten()
                .and_then(|v| serde_json::from_str::<String>(&v).ok())
                .unwrap_or_default();
            
            if !proxy_host.is_empty() && proxy_port > 0 {
                let proxy_url = if !proxy_username.is_empty() {
                    format!("http://{}:{}@{}:{}", proxy_username, proxy_password, proxy_host, proxy_port)
                } else {
                    format!("http://{}:{}", proxy_host, proxy_port)
                };
                match reqwest::Proxy::all(&proxy_url) {
                    Ok(proxy) => {
                        client_builder = client_builder.proxy(proxy);
                        info!("[create_proxied_client] 使用自定义代理: {}:{}", proxy_host, proxy_port);
                    }
                    Err(e) => {
                        error!("[create_proxied_client] 代理配置无效: {}", e);
                        return Err(format!("代理配置无效: {}", e));
                    }
                }
            } else {
                error!("[create_proxied_client] 自定义代理配置不完整");
                return Err("自定义代理配置不完整，请填写代理地址和端口".to_string());
            }
        }
        _ => {
            // none - 不使用代理，显式禁用系统代理（阻止读取环境变量）
            client_builder = client_builder.no_proxy();
            info!("[create_proxied_client] 不使用代理");
        }
    }
    
    client_builder.build().map_err(|e| format!("创建HTTP客户端失败: {}", e))
}

/// 代理连接测试结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyTestResult {
    /// 是否成功
    pub success: bool,
    /// 结果描述
    pub message: String,
    /// 响应耗时（毫秒）
    pub elapsed_ms: u64,
}

/// 测试代理连接
/// 使用当前代理配置对指定地址发起 HTTP 请求，验证代理是否可用
#[tauri::command]
pub async fn test_proxy_connection(
    test_url: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<ProxyTestResult, String> {
    info!("[test_proxy_connection] 开始测试代理连接, 目标地址: {}", test_url);

    // 校验 URL 格式
    if test_url.is_empty() || !test_url.starts_with("http") {
        return Err("测试地址格式无效，请以 http:// 或 https:// 开头".to_string());
    }
    
    // 先获取当前代理模式
    let proxy_mode = {
        let db_lock = db.lock().map_err(|e| format!("数据库锁获取失败: {}", e))?;
        let conn = db_lock.get_connection();
        let repo = SettingsRepository::new(&conn);
        repo.get("app.proxyMode").ok().flatten()
            .and_then(|v| serde_json::from_str::<String>(&v).ok())
            .unwrap_or_else(|| "none".to_string())
    };
    
    // 创建带代理配置的 HTTP 客户端
    let client = create_proxied_client(&db)?;
    
    let start = std::time::Instant::now();
    
    match client.get(&test_url).send().await {
        Ok(response) => {
            let elapsed_ms = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                info!("[test_proxy_connection] 测试成功, 耗时: {}ms, 状态码: {}", elapsed_ms, response.status());
                Ok(ProxyTestResult {
                    success: true,
                    message: format!("连接成功（{}模式，耗时 {}ms，状态码 {}）", proxy_mode, elapsed_ms, response.status()),
                    elapsed_ms,
                })
            } else {
                let status = response.status();
                error!("[test_proxy_connection] 服务器返回错误: {}", status);
                Ok(ProxyTestResult {
                    success: false,
                    message: format!("服务器返回错误: {}（耗时 {}ms）", status, elapsed_ms),
                    elapsed_ms,
                })
            }
        }
        Err(e) => {
            let elapsed_ms = start.elapsed().as_millis() as u64;
            error!("[test_proxy_connection] 连接失败: {}", e);
            Ok(ProxyTestResult {
                success: false,
                message: format!("连接失败: {}（耗时 {}ms）", e, elapsed_ms),
                elapsed_ms,
            })
        }
    }
}

// ============================================================
// 调试命令
// ============================================================

/// 数据库表列信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugColumnInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub pk: bool,
    pub notnull: bool,
}

/// 数据库表结构信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugTableSchema {
    pub name: String,
    pub columns: Vec<DebugColumnInfo>,
}

/// 获取数据库所有表的结构
#[tauri::command]
pub fn debug_get_table_schema(
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<DebugTableSchema>, DatabaseError> {
    info!("[debug_get_table_schema] 获取数据库表结构");
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    
    // 获取所有表名
    let tables: Vec<String> = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| row.get(0))?;
            rows.collect::<Result<Vec<_>, _>>()
        })
        .map_err(|e| DatabaseError::QueryError { message: e.to_string() })?;
    
    let mut result = Vec::new();
    
    for table_name in tables {
        // 获取表的列信息
        let columns: Vec<DebugColumnInfo> = conn
            .prepare(&format!("PRAGMA table_info({})", table_name))
            .and_then(|mut stmt| {
                let rows = stmt.query_map([], |row| {
                    Ok(DebugColumnInfo {
                        name: row.get(1)?,
                        type_: row.get(2)?,
                        pk: row.get::<_, i32>(5)? == 1,
                        notnull: row.get::<_, i32>(3)? == 1,
                    })
                })?;
                rows.collect::<Result<Vec<_>, _>>()
            })
            .map_err(|e| DatabaseError::QueryError { message: e.to_string() })?;
        
        result.push(DebugTableSchema {
            name: table_name,
            columns,
        });
    }
    
    Ok(result)
}

/// 获取指定表的数据
#[tauri::command]
pub fn debug_get_table_data(
    table_name: String,
    db: State<'_, Mutex<DatabaseConnection>>,
) -> Result<Vec<serde_json::Value>, DatabaseError> {
    info!("[debug_get_table_data] 获取表数据: {}", table_name);
    
    // 安全检查：只允许查询特定表
    let allowed_tables = ["calendars", "events", "todos", "accounts", "sync_state", "app_settings", "user_holidays"];
    if !allowed_tables.contains(&table_name.as_str()) {
        return Err(DatabaseError::QueryError {
            message: format!("不允许查询表: {}", table_name),
        });
    }
    
    let db = db.lock().map_err(|_| DatabaseError::ConnectionError {
        message: "数据库连接锁获取失败".to_string(),
    })?;
    let conn = db.get_connection();
    
    // 查询表数据（限制最多 1000 条）
    let data: Vec<serde_json::Value> = conn
        .prepare(&format!("SELECT * FROM {} LIMIT 1000", table_name))
        .and_then(|mut stmt| {
            let column_names: Vec<String> = stmt
                .column_names()
                .into_iter()
                .map(|s| s.to_string())
                .collect();
            
            let rows = stmt.query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for (i, name) in column_names.iter().enumerate() {
                    let value: rusqlite::types::Value = row.get(i)?;
                    let json_value = rusqlite_value_to_json(value);
                    obj.insert(name.clone(), json_value);
                }
                Ok(serde_json::Value::Object(obj))
            })?;
            rows.collect::<Result<Vec<_>, _>>()
        })
        .map_err(|e| DatabaseError::QueryError { message: e.to_string() })?;
    
    Ok(data)
}

/// 将 rusqlite::Value 转换为 serde_json::Value
fn rusqlite_value_to_json(value: rusqlite::types::Value) -> serde_json::Value {
    use rusqlite::types::Value;
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Integer(i) => serde_json::Value::Number(i.into()),
        Value::Real(f) => {
            if let Some(n) = serde_json::Number::from_f64(f) {
                serde_json::Value::Number(n)
            } else {
                serde_json::Value::Null
            }
        }
        Value::Text(s) => serde_json::Value::String(s),
        Value::Blob(b) => serde_json::Value::String(format!("[BLOB: {} bytes]", b.len())),
    }
}

/// 打开开发者工具
#[tauri::command]
pub fn debug_open_devtools(window: tauri::WebviewWindow) -> Result<(), String> {
    info!("[debug_open_devtools] 打开开发者工具");
    
    #[cfg(debug_assertions)]
    {
        window.open_devtools();
        Ok(())
    }
    
    #[cfg(not(debug_assertions))]
    {
        let _ = window;
        Err("开发者工具仅在开发模式下可用".to_string())
    }
}

// ==================== 日志命令 ====================

/// 日志条目（用于前端显示）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub target: String,
    pub message: String,
}

/// 获取后端日志
#[tauri::command]
pub fn debug_get_logs() -> Vec<LogEntry> {
    let logs = crate::log_buffer::get_logs();
    logs.into_iter().map(|l| LogEntry {
        timestamp: l.timestamp,
        level: l.level,
        target: l.target,
        message: l.message,
    }).collect()
}

/// 清空后端日志
#[tauri::command]
pub fn debug_clear_logs() {
    crate::log_buffer::clear_logs();
    info!("[debug_clear_logs] 日志已清空");
}
