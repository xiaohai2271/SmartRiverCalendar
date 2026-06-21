//! 同步引擎模块
//!
//! 实现日历事件的同步功能，包括：
//! - SyncEngine: 同步引擎核心，负责执行同步逻辑
//! - SyncTimer: 后台定时器，支持定时和手动触发同步
//! - 通过 Tauri 事件系统通知前端同步状态
//!
//! 同步流程：
//! 1. 从数据库读取账号信息（accounts 表）
//! 2. 获取各日历的服务器端事件
//! 3. 与本地事件 diff（新增/更新/删除）
//! 4. 将差异写入 SQLite
//! 5. 通过 app.emit 发送 `external-sync-complete` 事件通知前端刷新

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use tokio::task::JoinHandle;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use std::sync::Mutex;

use crate::crypto;
use crate::ews::EwsClient;
use crate::caldav::CalDavClient;
use crate::db::connection::DatabaseConnection;
use crate::db::repositories::account::{AccountRepository, Account as DbAccount};
use crate::db::repositories::calendar::{CalendarRepository, Calendar as DbCalendar};
use crate::db::repositories::event::{EventRepository, Event as DbEvent, CreateEvent};

/// 同步配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub past_days: i64,
    pub future_days: i64,
    pub interval_minutes: u64,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            past_days: 30,
            future_days: 90,
            interval_minutes: 15,
        }
    }
}

/// 同步状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncStatus {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "syncing")]
    Syncing,
    #[serde(rename = "completed")]
    Completed,
    #[serde(rename = "failed")]
    Failed,
}

/// 同步进度信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgress {
    pub account_id: String,
    pub status: SyncStatus,
    pub message: String,
    pub progress: f32,
}

/// 单个账号的同步结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountSyncResult {
    pub account_id: i64,
    pub success: bool,
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
    pub errors: Vec<String>,
}

/// 同步事件数据（从服务器获取的规范化事件）
#[derive(Debug, Clone)]
struct SyncEventData {
    external_id: String,
    title: String,
    description: Option<String>,
    start_time: i64,
    end_time: i64,
    all_day: bool,
    color: Option<String>,
    reminder: Option<i32>,
    repeat_rule: Option<String>,
    location: Option<String>,
    local_id: Option<i64>,
}

/// diff 动作
#[derive(Debug, Clone)]
enum DiffAction {
    Add(SyncEventData),
    Update(SyncEventData),
    Delete(i64),
}

/// 同步引擎
///
/// 负责执行日历事件的同步逻辑。通过 AppHandle 访问数据库和发送事件。
/// 所有数据库操作在同步代码块中完成（不跨 await 持有 MutexGuard），
/// 网络请求在异步代码块中完成（不持有任何锁）。
pub struct SyncEngine {
    app_handle: AppHandle,
    config: RwLock<SyncConfig>,
    status: RwLock<SyncStatus>,
}

impl SyncEngine {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            config: RwLock::new(SyncConfig::default()),
            status: RwLock::new(SyncStatus::Idle),
        }
    }

    pub async fn get_status(&self) -> SyncStatus {
        self.status.read().await.clone()
    }

    pub async fn update_config(&self, config: SyncConfig) {
        *self.config.write().await = config;
    }

    fn emit_progress(&self, progress: SyncProgress) {
        let _ = self.app_handle.emit("sync-progress", progress);
    }

    fn emit_result(&self, result: &AccountSyncResult) {
        let _ = self.app_handle.emit("sync-result", result);
    }

    fn emit_external_sync_complete(&self) {
        let _ = self.app_handle.emit("external-sync-complete", serde_json::json!({
            "timestamp": chrono::Utc::now().timestamp_millis(),
        }));
    }

    fn get_current_user_id(conn: &rusqlite::Connection) -> Option<i64> {
        conn.query_row(
            "SELECT user_id FROM local_users WHERE is_current = 1 LIMIT 1",
            [],
            |row| row.get(0),
        ).ok()
    }

    fn decrypt_account_password(account: &DbAccount, user_id: i64) -> Result<String, String> {
        let salt = account.key_salt.as_deref()
            .ok_or_else(|| format!("账号 {} 缺少密钥盐值", account.id))?;
        let salt_bytes = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            salt,
        ).map_err(|e| format!("盐值解码失败: {}", e))?;
        if salt_bytes.len() < 16 {
            return Err(format!("盐值长度不足: {} < 16", salt_bytes.len()));
        }
        crypto::decrypt_password(&account.encrypted_password, user_id, &salt_bytes)
            .map_err(|e| format!("密码解密失败: {}", e))
    }

    /// 同步所有外部账号
    pub async fn sync_all_accounts(&self) -> Vec<AccountSyncResult> {
        {
            let mut status = self.status.write().await;
            *status = SyncStatus::Syncing;
        }

        // 读取账号列表（同步块，不跨 await）
        let accounts: Vec<DbAccount> = {
            let db = self.app_handle.state::<Mutex<DatabaseConnection>>();
            let db_conn = db.lock().unwrap_or_else(|e| {
                log::error!("[SyncEngine] 数据库锁获取失败: {}", e);
                panic!("数据库锁获取失败")
            });
            let repo = AccountRepository::new(&db_conn);
            repo.get_all()
                .unwrap_or_else(|e| {
                    log::error!("[SyncEngine] 读取账号列表失败: {}", e);
                    vec![]
                })
                .into_iter()
                .filter(|a| a.enabled && (a.type_ == "exchange" || a.type_ == "caldav"))
                .collect()
            // db_conn 在此 drop，不跨 await
        };

        if accounts.is_empty() {
            log::info!("[SyncEngine] 没有启用的外部账号需要同步");
            *self.status.write().await = SyncStatus::Completed;
            return vec![];
        }

        if accounts.is_empty() {
            log::info!("[SyncEngine] 没有启用的外部账号需要同步");
            *self.status.write().await = SyncStatus::Completed;
            return vec![];
        }

        self.emit_progress(SyncProgress {
            account_id: "all".to_string(),
            status: SyncStatus::Syncing,
            message: format!("开始同步 {} 个账号", accounts.len()),
            progress: 0.0,
        });

        let mut results = Vec::new();
        let total = accounts.len();

        for (index, account) in accounts.iter().enumerate() {
            let progress = (index as f32 / total as f32) * 100.0;
            self.emit_progress(SyncProgress {
                account_id: account.id.to_string(),
                status: SyncStatus::Syncing,
                message: format!("同步账号 {}/{}: {}", index + 1, total, account.username),
                progress,
            });

            let result = self.sync_account(&account).await;
            results.push(result);
        }

        *self.status.write().await = SyncStatus::Completed;
        self.emit_external_sync_complete();

        self.emit_progress(SyncProgress {
            account_id: "all".to_string(),
            status: SyncStatus::Completed,
            message: "所有账号同步完成".to_string(),
            progress: 100.0,
        });

        results
    }

    /// 对单个账号执行同步
    ///
    /// 严格遵循分步锁策略：外部 API 调用不持有任何锁。
    pub async fn sync_account(&self, account: &DbAccount) -> AccountSyncResult {
        let mut result = AccountSyncResult {
            account_id: account.id,
            success: true,
            added: 0,
            updated: 0,
            deleted: 0,
            errors: Vec::new(),
        };

        // 步骤1：获取锁 → 读取日历 + 用户 ID → 释放锁
        let (calendars, user_id) = {
            let db = self.app_handle.state::<Mutex<DatabaseConnection>>();
            let db_conn = match db.lock() {
                Ok(conn) => conn,
                Err(e) => {
                    result.success = false;
                    result.errors.push(format!("数据库锁获取失败: {}", e));
                    return result;
                }
            };

            let cal_repo = CalendarRepository::new(&db_conn);
            let cals = match cal_repo.get_by_account_id(account.id) {
                Ok(c) => c,
                Err(e) => {
                    result.success = false;
                    result.errors.push(format!("读取账号日历失败: {}", e));
                    return result;
                }
            };

            let uid = Self::get_current_user_id(&db_conn.get_connection());
            (cals, uid)
        };

        let user_id = match user_id {
            Some(uid) => uid,
            None => {
                result.success = false;
                result.errors.push("无法获取当前用户 ID".to_string());
                return result;
            }
        };

        // 步骤2：解密密码（无锁）
        let password = match Self::decrypt_account_password(account, user_id) {
            Ok(p) => p,
            Err(e) => {
                result.success = false;
                result.errors.push(e);
                return result;
            }
        };

        let config = self.config.read().await;
        let now = chrono::Utc::now().timestamp();
        let start_time = now - (config.past_days * 24 * 3600);
        let end_time = now + (config.future_days * 24 * 3600);
        drop(config);

        // 步骤3：获取服务器端事件（无锁，网络请求）
        let server_events_by_calendar = match account.type_.as_str() {
            "exchange" => {
                match self.fetch_exchange_events(&account.server_url, &account.username, &password, &calendars, start_time, end_time).await {
                    Ok(events) => events,
                    Err(e) => {
                        result.success = false;
                        result.errors.push(format!("Exchange 同步失败: {}", e));
                        self.emit_result(&result);
                        return result;
                    }
                }
            }
            "caldav" => {
                match self.fetch_caldav_events(&account.server_url, &account.username, &password, &calendars, start_time, end_time).await {
                    Ok(events) => events,
                    Err(e) => {
                        result.success = false;
                        result.errors.push(format!("CalDAV 同步失败: {}", e));
                        self.emit_result(&result);
                        return result;
                    }
                }
            }
            _ => {
                result.success = false;
                result.errors.push(format!("不支持的账号类型: {}", account.type_));
                return result;
            }
        };

        // 步骤4：获取锁 → 读取本地事件 → 释放锁
        let local_events_by_calendar: HashMap<i64, Vec<DbEvent>> = {
            let db = self.app_handle.state::<Mutex<DatabaseConnection>>();
            let db_conn = match db.lock() {
                Ok(conn) => conn,
                Err(e) => {
                    result.success = false;
                    result.errors.push(format!("数据库锁获取失败: {}", e));
                    return result;
                }
            };

            let event_repo = EventRepository::new(&db_conn);
            let mut map = HashMap::new();
            for cal in &calendars {
                match event_repo.get_by_calendar_id(cal.id) {
                    Ok(events) => { map.insert(cal.id, events); }
                    Err(e) => {
                        log::warn!("[SyncEngine] 读取日历 {} 的本地事件失败: {}", cal.id, e);
                        map.insert(cal.id, vec![]);
                    }
                }
            }
            map
        };

        // 步骤5+6：diff 计算 + 写入 SQLite
        for cal in &calendars {
            let server_events = server_events_by_calendar.get(&cal.id).cloned().unwrap_or_default();
            let local_events = local_events_by_calendar.get(&cal.id).cloned().unwrap_or_default();

            let diff = Self::compute_diff(&local_events, &server_events);

            if !diff.is_empty() {
                // 获取锁 → 写入 SQLite → 释放锁
                let db = self.app_handle.state::<Mutex<DatabaseConnection>>();
                let db_conn = match db.lock() {
                    Ok(conn) => conn,
                    Err(e) => {
                        result.errors.push(format!("数据库锁获取失败: {}", e));
                        continue;
                    }
                };

                let event_repo = EventRepository::new(&db_conn);
                for action in &diff {
                    match action {
                        DiffAction::Add(event_data) => {
                            let create_event = CreateEvent {
                                title: event_data.title.clone(),
                                description: event_data.description.clone(),
                                start_time: event_data.start_time,
                                end_time: event_data.end_time,
                                all_day: event_data.all_day,
                                calendar_id: cal.id,
                                color: event_data.color.clone().or_else(|| Some(cal.color.clone())),
                                reminder: event_data.reminder,
                                repeat_rule: event_data.repeat_rule.clone(),
                                location: event_data.location.clone(),
                                external_id: Some(event_data.external_id.clone()),
                                user_id: None,
                                timezone: None,
                            };
                            match event_repo.create(&create_event) {
                                Ok(_) => result.added += 1,
                                Err(e) => result.errors.push(format!("创建事件失败: {}", e)),
                            }
                        }
                        DiffAction::Update(event_data) => {
                            let local_id = match event_data.local_id {
                                Some(id) => id,
                                None => {
                                    result.errors.push(format!("更新事件 {} 缺少本地 ID", event_data.external_id));
                                    continue;
                                }
                            };
                            let update_event = crate::db::repositories::event::UpdateEvent {
                                id: local_id,
                                title: event_data.title.clone(),
                                description: event_data.description.clone(),
                                start_time: event_data.start_time,
                                end_time: event_data.end_time,
                                all_day: event_data.all_day,
                                calendar_id: cal.id,
                                color: event_data.color.clone().or_else(|| Some(cal.color.clone())),
                                reminder: event_data.reminder,
                                repeat_rule: event_data.repeat_rule.clone(),
                                location: event_data.location.clone(),
                                external_id: Some(event_data.external_id.clone()),
                            };
                            match event_repo.update(&update_event) {
                                Ok(_) => result.updated += 1,
                                Err(e) => result.errors.push(format!("更新事件失败: {}", e)),
                            }
                        }
                        DiffAction::Delete(local_id) => {
                            match event_repo.delete(*local_id) {
                                Ok(_) => result.deleted += 1,
                                Err(e) => result.errors.push(format!("删除事件失败: {}", e)),
                            }
                        }
                    }
                }
            }
        }

        self.emit_result(&result);
        result
    }

    async fn fetch_exchange_events(
        &self,
        server_url: &str,
        username: &str,
        password: &str,
        calendars: &[DbCalendar],
        start_time: i64,
        end_time: i64,
    ) -> Result<HashMap<i64, Vec<SyncEventData>>, String> {
        let client = EwsClient::new(server_url.to_string(), username.to_string(), password.to_string());

        self.emit_progress(SyncProgress {
            account_id: "exchange".to_string(),
            status: SyncStatus::Syncing,
            message: "验证 Exchange 服务器连接...".to_string(),
            progress: 10.0,
        });

        client.connect().await.map_err(|e| format!("Exchange 连接失败: {}", e))?;

        let mut events_map = HashMap::new();

        for (index, cal) in calendars.iter().enumerate() {
            let progress = 10.0 + (index as f32 / calendars.len().max(1) as f32) * 80.0;
            self.emit_progress(SyncProgress {
                account_id: "exchange".to_string(),
                status: SyncStatus::Syncing,
                message: format!("同步日历: {}", cal.name),
                progress,
            });

            match client.fetch_events(&cal.id.to_string(), start_time, end_time).await {
                Ok(server_events) => {
                    let sync_events: Vec<SyncEventData> = server_events.iter().map(|e| SyncEventData {
                        external_id: e.id.clone(),
                        title: e.title.clone(),
                        description: e.description.clone(),
                        start_time: e.start_time * 1000,
                        end_time: e.end_time * 1000,
                        all_day: e.all_day,
                        color: None,
                        reminder: None,
                        repeat_rule: None,
                        location: e.location.clone(),
                        local_id: None,
                    }).collect();
                    events_map.insert(cal.id, sync_events);
                }
                Err(e) => {
                    log::error!("[SyncEngine] Exchange 获取日历 {} 事件失败: {}", cal.name, e);
                }
            }
        }

        Ok(events_map)
    }

    async fn fetch_caldav_events(
        &self,
        server_url: &str,
        username: &str,
        password: &str,
        calendars: &[DbCalendar],
        start_time: i64,
        end_time: i64,
    ) -> Result<HashMap<i64, Vec<SyncEventData>>, String> {
        let client = CalDavClient::new(server_url.to_string(), username.to_string(), password.to_string());

        let caldav_calendars = client.list_calendars().await
            .map_err(|e| format!("CalDAV 获取日历列表失败: {}", e))?;

        let mut events_map = HashMap::new();

        for (index, cal) in calendars.iter().enumerate() {
            let calendar_url = caldav_calendars.iter()
                .find(|cc| cc.id == cal.id.to_string())
                .map(|cc| cc.url.clone())
                .unwrap_or_default();

            if calendar_url.is_empty() {
                log::warn!("[SyncEngine] 日历 {} 没有对应的 CalDAV URL，跳过", cal.name);
                continue;
            }

            let progress = 10.0 + (index as f32 / calendars.len().max(1) as f32) * 80.0;
            self.emit_progress(SyncProgress {
                account_id: "caldav".to_string(),
                status: SyncStatus::Syncing,
                message: format!("同步日历: {}", cal.name),
                progress,
            });

            match client.fetch_events(&calendar_url, start_time, end_time).await {
                Ok(server_events) => {
                    let sync_events: Vec<SyncEventData> = server_events.iter().map(|e| SyncEventData {
                        external_id: e.id.clone(),
                        title: e.title.clone(),
                        description: e.description.clone(),
                        start_time: e.start_time * 1000,
                        end_time: e.end_time * 1000,
                        all_day: e.all_day,
                        color: None,
                        reminder: None,
                        repeat_rule: None,
                        location: e.location.clone(),
                        local_id: None,
                    }).collect();
                    events_map.insert(cal.id, sync_events);
                }
                Err(e) => {
                    log::error!("[SyncEngine] CalDAV 获取日历 {} 事件失败: {}", cal.name, e);
                }
            }
        }

        Ok(events_map)
    }

    /// 计算本地事件与服务器事件的差异（服务器优先策略）
    fn compute_diff(local_events: &[DbEvent], server_events: &[SyncEventData]) -> Vec<DiffAction> {
        let mut actions = Vec::new();

        let local_by_external: HashMap<&str, &DbEvent> = local_events.iter()
            .filter_map(|e| e.external_id.as_ref().map(|eid| (eid.as_str(), e)))
            .collect();

        let server_by_external: HashMap<&str, &SyncEventData> = server_events.iter()
            .map(|e| (e.external_id.as_str(), e))
            .collect();

        // 本地有但服务器没有 → 删除
        for (external_id, local_event) in &local_by_external {
            if !server_by_external.contains_key(external_id) {
                actions.push(DiffAction::Delete(local_event.id));
            }
        }

        // 服务器有但本地没有 → 新增；两边都有但内容不同 → 更新
        for server_event in server_events {
            if let Some(local_event) = local_by_external.get(server_event.external_id.as_str()) {
                if local_event.title != server_event.title
                    || local_event.start_time != server_event.start_time
                    || local_event.end_time != server_event.end_time
                    || local_event.all_day != server_event.all_day
                    || local_event.description != server_event.description
                    || local_event.location != server_event.location
                {
                    let mut update_data = server_event.clone();
                    update_data.local_id = Some(local_event.id);
                    actions.push(DiffAction::Update(update_data));
                }
            } else {
                actions.push(DiffAction::Add(server_event.clone()));
            }
        }

        actions
    }
}

/// 同步定时器状态
struct TimerState {
    handle: Option<JoinHandle<()>>,
    running: bool,
}

/// 同步定时器
pub struct SyncTimer {
    engine: Arc<SyncEngine>,
    state: RwLock<TimerState>,
}

impl SyncTimer {
    pub fn new(engine: Arc<SyncEngine>) -> Self {
        Self {
            engine,
            state: RwLock::new(TimerState {
                handle: None,
                running: false,
            }),
        }
    }

    pub async fn start_timer(&self, interval_minutes: u64) {
        let mut state = self.state.write().await;

        if state.running {
            if let Some(handle) = state.handle.take() {
                let _ = handle.abort();
            }
        }

        let engine = self.engine.clone();
        let interval_duration = Duration::from_secs(interval_minutes * 60);

        let handle = tokio::spawn(async move {
            let mut interval = interval(interval_duration);

            loop {
                interval.tick().await;

                log::info!("[SyncTimer] 定时同步触发");
                let results = engine.sync_all_accounts().await;

                for result in results {
                    if result.success {
                        log::info!(
                            "[SyncTimer] 账号 {} 同步成功: 新增 {}, 更新 {}, 删除 {}",
                            result.account_id, result.added, result.updated, result.deleted
                        );
                    } else {
                        log::error!(
                            "[SyncTimer] 账号 {} 同步失败: {:?}",
                            result.account_id, result.errors
                        );
                    }
                }
            }
        });

        state.handle = Some(handle);
        state.running = true;

        log::info!("[SyncTimer] 定时同步已启动，间隔: {} 分钟", interval_minutes);
    }

    pub async fn stop_timer(&self) {
        let mut state = self.state.write().await;
        if let Some(handle) = state.handle.take() {
            let _ = handle.abort();
        }
        state.running = false;
        log::info!("[SyncTimer] 定时同步已停止");
    }

    pub async fn is_running(&self) -> bool {
        self.state.read().await.running
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sync_config_default() {
        let config = SyncConfig::default();
        assert_eq!(config.past_days, 30);
        assert_eq!(config.future_days, 90);
        assert_eq!(config.interval_minutes, 15);
    }

    #[test]
    fn test_sync_status_serialization() {
        assert_eq!(serde_json::to_string(&SyncStatus::Idle).unwrap(), "\"idle\"");
        assert_eq!(serde_json::to_string(&SyncStatus::Syncing).unwrap(), "\"syncing\"");
        assert_eq!(serde_json::to_string(&SyncStatus::Completed).unwrap(), "\"completed\"");
        assert_eq!(serde_json::to_string(&SyncStatus::Failed).unwrap(), "\"failed\"");
    }

    #[test]
    fn test_account_sync_result_creation() {
        let result = AccountSyncResult {
            account_id: 1,
            success: true,
            added: 5,
            updated: 3,
            deleted: 1,
            errors: Vec::new(),
        };
        assert!(result.success);
        assert_eq!(result.added, 5);
    }

    #[test]
    fn test_compute_diff_empty() {
        let actions = SyncEngine::compute_diff(&[], &[]);
        assert!(actions.is_empty());
    }

    #[test]
    fn test_compute_diff_add_new() {
        let server_events = vec![SyncEventData {
            external_id: "ext-1".to_string(),
            title: "新事件".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            local_id: None,
        }];

        let actions = SyncEngine::compute_diff(&[], &server_events);
        assert_eq!(actions.len(), 1);
        assert!(matches!(&actions[0], DiffAction::Add(d) if d.external_id == "ext-1"));
    }

    #[test]
    fn test_compute_diff_delete_local() {
        let local_events = vec![DbEvent {
            id: 42,
            title: "旧事件".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id: 1,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: Some("ext-1".to_string()),
            user_id: None,
            deleted_at: None,
            timezone: "Asia/Shanghai".to_string(),
            created_at: 0,
            updated_at: 0,
        }];

        let actions = SyncEngine::compute_diff(&local_events, &[]);
        assert_eq!(actions.len(), 1);
        assert!(matches!(&actions[0], DiffAction::Delete(id) if *id == 42));
    }

    #[test]
    fn test_compute_diff_update_changed() {
        let local_events = vec![DbEvent {
            id: 42,
            title: "旧标题".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id: 1,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: Some("ext-1".to_string()),
            user_id: None,
            deleted_at: None,
            timezone: "Asia/Shanghai".to_string(),
            created_at: 0,
            updated_at: 0,
        }];

        let server_events = vec![SyncEventData {
            external_id: "ext-1".to_string(),
            title: "新标题".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            local_id: None,
        }];

        let actions = SyncEngine::compute_diff(&local_events, &server_events);
        assert_eq!(actions.len(), 1);
        assert!(matches!(&actions[0], DiffAction::Update(d) if d.title == "新标题" && d.local_id == Some(42)));
    }

    #[test]
    fn test_compute_diff_no_change() {
        let local_events = vec![DbEvent {
            id: 42,
            title: "相同标题".to_string(),
            description: Some("描述".to_string()),
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id: 1,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: Some("地点".to_string()),
            external_id: Some("ext-1".to_string()),
            user_id: None,
            deleted_at: None,
            timezone: "Asia/Shanghai".to_string(),
            created_at: 0,
            updated_at: 0,
        }];

        let server_events = vec![SyncEventData {
            external_id: "ext-1".to_string(),
            title: "相同标题".to_string(),
            description: Some("描述".to_string()),
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: Some("地点".to_string()),
            local_id: None,
        }];

        let actions = SyncEngine::compute_diff(&local_events, &server_events);
        assert!(actions.is_empty());
    }
}
