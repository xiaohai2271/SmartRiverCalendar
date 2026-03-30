use log::{info, error};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use crate::caldav;
use crate::crypto;
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
        version: "0.1.0".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_info() {
        let info = get_app_info();
        assert_eq!(info.name, "小河日历");
        assert_eq!(info.version, "0.1.0");
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
