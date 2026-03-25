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
    /// 所属账号 ID
    pub account_id: String,
    /// 是否启用同步
    pub enabled: bool,
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
) -> Result<AccountInfo, String> {
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

    Ok(AccountInfo {
        id: account_id,
        account_type: AccountType::Exchange,
        server_url: username.clone(), // 存储邮箱地址，服务器地址由 Autodiscover 动态获取
        username: username.clone(),
        encrypted_password,
        display_name: username,
        enabled: true,
        last_sync: None,
    })
}

/// 连接 CalDAV 服务器
#[tauri::command]
pub async fn connect_caldav(
    server_url: String,
    username: String,
    password: String,
) -> Result<AccountInfo, String> {
    // 加密密码
    let encrypted_password = crypto::encrypt_password(&password)
        .map_err(|e| format!("密码加密失败: {}", e))?;

    // 创建 CalDAV 客户端并验证连接
    let client = caldav::CalDavClient::new(server_url.clone(), username.clone(), password);
    client.connect().await?;

    // 生成账号 ID
    let account_id = format!("caldav_{}", uuid::Uuid::new_v4());

    Ok(AccountInfo {
        id: account_id,
        account_type: AccountType::CalDav,
        server_url,
        username: username.clone(),
        encrypted_password,
        display_name: username,
        enabled: true,
        last_sync: None,
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
    if account_id.is_empty() {
        return Err("账号 ID 不能为空".to_string());
    }

    // 解密密码
    let password = crypto::decrypt_password(&encrypted_password)
        .map_err(|e| format!("密码解密失败: {}", e))?;

    // 根据账号类型获取日历列表
    let calendars = match account_type.as_str() {
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
                    account_id: account_id.clone(),
                    enabled: true,
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
                    account_id: account_id.clone(),
                    enabled: true,
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
