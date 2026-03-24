//! 同步引擎模块
//!
//! 实现日历事件的同步功能，包括：
//! - SyncEngine: 同步引擎核心，负责执行同步逻辑
//! - SyncTimer: 后台定时器，支持定时和手动触发同步
//! - 通过 Tauri 事件系统通知前端同步状态

#![allow(dead_code)]

use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use tokio::task::JoinHandle;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::ews::EwsClient;
use crate::caldav::CalDavClient;

/// 账号类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AccountType {
    #[serde(rename = "exchange")]
    Exchange,
    #[serde(rename = "caldav")]
    CalDav,
}

/// 账号信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountInfo {
    pub id: String,
    pub name: String,
    pub account_type: AccountType,
    pub server_url: String,
    pub username: String,
    pub password: String,
    pub enabled: bool,
    pub sync_token: Option<String>,
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

/// 同步结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub account_id: String,
    pub success: bool,
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
    pub errors: Vec<String>,
}

/// 同步配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    /// 同步过去多少天的事件（默认 30 天）
    pub past_days: i64,
    /// 同步未来多少天的事件（默认 90 天）
    pub future_days: i64,
    /// 定时同步间隔（分钟，默认 15 分钟）
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

/// 同步引擎
///
/// 负责执行日历事件的同步逻辑，包括：
/// - 从服务器获取事件
/// - 对比本地和服务器事件差异
/// - 处理冲突（服务器优先）
/// - 通知前端同步状态
pub struct SyncEngine {
    /// 应用句柄，用于发送事件通知
    app_handle: AppHandle,
    /// 同步配置
    config: RwLock<SyncConfig>,
    /// 当前同步状态
    status: RwLock<SyncStatus>,
}

impl SyncEngine {
    /// 创建新的同步引擎实例
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            config: RwLock::new(SyncConfig::default()),
            status: RwLock::new(SyncStatus::Idle),
        }
    }

    /// 获取当前同步状态
    pub async fn get_status(&self) -> SyncStatus {
        let status = self.status.read().await;
        status.clone()
    }

    /// 更新同步配置
    pub async fn update_config(&self, config: SyncConfig) {
        let mut current_config = self.config.write().await;
        *current_config = config;
    }

    /// 发送同步进度通知到前端
    fn emit_progress(&self, progress: SyncProgress) {
        let _ = self.app_handle.emit("sync-progress", progress);
    }

    /// 发送同步结果通知到前端
    fn emit_result(&self, result: SyncResult) {
        let _ = self.app_handle.emit("sync-result", result);
    }

    /// 对单个账号执行同步
    ///
    /// # 参数
    /// * `account` - 账号信息
    ///
    /// # 返回
    /// * `Ok(SyncResult)` - 同步结果
    /// * `Err(String)` - 同步失败，包含错误信息
    pub async fn sync_account(&self, account: &AccountInfo) -> Result<SyncResult, String> {
        {
            let mut status = self.status.write().await;
            *status = SyncStatus::Syncing;
        }

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Syncing,
            message: format!("开始同步账号: {}", account.name),
            progress: 0.0,
        });

        let config = self.config.read().await;
        let now = chrono::Utc::now().timestamp();
        let start_time = now - (config.past_days * 24 * 3600);
        let end_time = now + (config.future_days * 24 * 3600);

        let result = match account.account_type {
            AccountType::Exchange => {
                self.sync_exchange_account(account, start_time, end_time).await
            }
            AccountType::CalDav => {
                self.sync_caldav_account(account, start_time, end_time).await
            }
        };

        {
            let mut status = self.status.write().await;
            *status = if result.is_ok() {
                SyncStatus::Completed
            } else {
                SyncStatus::Failed
            };
        }

        result
    }

    /// 同步 Exchange 账号
    async fn sync_exchange_account(
        &self,
        account: &AccountInfo,
        start_time: i64,
        end_time: i64,
    ) -> Result<SyncResult, String> {
        let client = EwsClient::new(
            account.server_url.clone(),
            account.username.clone(),
            account.password.clone(),
        );

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Syncing,
            message: "验证 Exchange 服务器连接...".to_string(),
            progress: 10.0,
        });

        client.connect().await.map_err(|e| format!("Exchange 连接失败: {}", e))?;

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Syncing,
            message: "获取日历列表...".to_string(),
            progress: 20.0,
        });

        let calendars = client.list_calendars().await
            .map_err(|e| format!("获取日历列表失败: {}", e))?;

        let mut result = SyncResult {
            account_id: account.id.clone(),
            success: true,
            added: 0,
            updated: 0,
            deleted: 0,
            errors: Vec::new(),
        };

        let total_calendars = calendars.len();
        for (index, calendar) in calendars.iter().enumerate() {
            let progress = 20.0 + (index as f32 / total_calendars as f32) * 70.0;

            self.emit_progress(SyncProgress {
                account_id: account.id.clone(),
                status: SyncStatus::Syncing,
                message: format!("同步日历: {}", calendar.name),
                progress,
            });

            match client.fetch_events(&calendar.id, start_time, end_time).await {
                Ok(server_events) => {
                    let _ = self.app_handle.emit("server-events-fetched", serde_json::json!({
                        "account_id": account.id,
                        "calendar_id": calendar.id,
                        "calendar_name": calendar.name,
                        "events": server_events,
                    }));

                    result.added += server_events.len();
                }
                Err(e) => {
                    let error_msg = format!("获取日历 {} 事件失败: {}", calendar.name, e);
                    log::error!("{}", error_msg);
                    result.errors.push(error_msg);
                }
            }
        }

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Completed,
            message: format!("同步完成: 新增 {}, 更新 {}, 删除 {}", result.added, result.updated, result.deleted),
            progress: 100.0,
        });

        self.emit_result(result.clone());

        Ok(result)
    }

    /// 同步 CalDAV 账号
    async fn sync_caldav_account(
        &self,
        account: &AccountInfo,
        start_time: i64,
        end_time: i64,
    ) -> Result<SyncResult, String> {
        let client = CalDavClient::new(
            account.server_url.clone(),
            account.username.clone(),
            account.password.clone(),
        );

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Syncing,
            message: "验证 CalDAV 服务器连接...".to_string(),
            progress: 10.0,
        });

        client.connect().await.map_err(|e| format!("CalDAV 连接失败: {}", e))?;

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Syncing,
            message: "获取日历列表...".to_string(),
            progress: 20.0,
        });

        let calendars = client.list_calendars().await
            .map_err(|e| format!("获取日历列表失败: {}", e))?;

        let mut result = SyncResult {
            account_id: account.id.clone(),
            success: true,
            added: 0,
            updated: 0,
            deleted: 0,
            errors: Vec::new(),
        };

        let total_calendars = calendars.len();
        for (index, calendar) in calendars.iter().enumerate() {
            let progress = 20.0 + (index as f32 / total_calendars as f32) * 70.0;

            self.emit_progress(SyncProgress {
                account_id: account.id.clone(),
                status: SyncStatus::Syncing,
                message: format!("同步日历: {}", calendar.name),
                progress,
            });

            match client.fetch_events(&calendar.url, start_time, end_time).await {
                Ok(server_events) => {
                    let _ = self.app_handle.emit("server-events-fetched", serde_json::json!({
                        "account_id": account.id,
                        "calendar_id": calendar.id,
                        "calendar_name": calendar.name,
                        "calendar_url": calendar.url,
                        "events": server_events,
                    }));

                    result.added += server_events.len();
                }
                Err(e) => {
                    let error_msg = format!("获取日历 {} 事件失败: {}", calendar.name, e);
                    log::error!("{}", error_msg);
                    result.errors.push(error_msg);
                }
            }
        }

        self.emit_progress(SyncProgress {
            account_id: account.id.clone(),
            status: SyncStatus::Completed,
            message: format!("同步完成: 新增 {}, 更新 {}, 删除 {}", result.added, result.updated, result.deleted),
            progress: 100.0,
        });

        self.emit_result(result.clone());

        Ok(result)
    }

    /// 同步所有启用的账号
    ///
    /// # 参数
    /// * `accounts` - 账号列表
    ///
    /// # 返回
    /// * `Vec<SyncResult>` - 每个账号的同步结果
    pub async fn sync_all_accounts(&self, accounts: &[AccountInfo]) -> Vec<SyncResult> {
        let mut results = Vec::new();

        let enabled_accounts: Vec<&AccountInfo> = accounts.iter()
            .filter(|account| account.enabled)
            .collect();

        if enabled_accounts.is_empty() {
            log::info!("没有启用的账号需要同步");
            return results;
        }

        self.emit_progress(SyncProgress {
            account_id: "all".to_string(),
            status: SyncStatus::Syncing,
            message: format!("开始同步 {} 个账号", enabled_accounts.len()),
            progress: 0.0,
        });

        let total_accounts = enabled_accounts.len();
        for (index, account) in enabled_accounts.iter().enumerate() {
            let progress = (index as f32 / total_accounts as f32) * 100.0;

            self.emit_progress(SyncProgress {
                account_id: account.id.clone(),
                status: SyncStatus::Syncing,
                message: format!("同步账号 {}/{}: {}", index + 1, total_accounts, account.name),
                progress,
            });

            match self.sync_account(account).await {
                Ok(result) => results.push(result),
                Err(e) => {
                    log::error!("同步账号 {} 失败: {}", account.name, e);
                    results.push(SyncResult {
                        account_id: account.id.clone(),
                        success: false,
                        added: 0,
                        updated: 0,
                        deleted: 0,
                        errors: vec![e],
                    });
                }
            }
        }

        self.emit_progress(SyncProgress {
            account_id: "all".to_string(),
            status: SyncStatus::Completed,
            message: "所有账号同步完成".to_string(),
            progress: 100.0,
        });

        results
    }
}

/// 同步定时器状态
struct TimerState {
    /// 定时器任务句柄
    handle: Option<JoinHandle<()>>,
    /// 是否正在运行
    running: bool,
}

/// 同步定时器
///
/// 负责管理后台定时同步任务，支持：
/// - 启动定时同步
/// - 停止定时同步
/// - 手动触发即时同步
pub struct SyncTimer {
    /// 同步引擎
    engine: Arc<SyncEngine>,
    /// 定时器状态
    state: RwLock<TimerState>,
}

impl SyncTimer {
    /// 创建新的同步定时器实例
    pub fn new(engine: Arc<SyncEngine>) -> Self {
        Self {
            engine,
            state: RwLock::new(TimerState {
                handle: None,
                running: false,
            }),
        }
    }

    /// 启动定时同步
    ///
    /// # 参数
    /// * `interval_minutes` - 同步间隔（分钟）
    /// * `get_accounts` - 获取账号列表的回调函数
    pub async fn start_timer<F, Fut>(&self, interval_minutes: u64, get_accounts: F)
    where
        F: Fn() -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Vec<AccountInfo>> + Send,
    {
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

                log::info!("定时同步触发");

                let accounts = get_accounts().await;

                let results = engine.sync_all_accounts(&accounts).await;

                for result in results {
                    if result.success {
                        log::info!(
                            "账号 {} 同步成功: 新增 {}, 更新 {}, 删除 {}",
                            result.account_id,
                            result.added,
                            result.updated,
                            result.deleted
                        );
                    } else {
                        log::error!(
                            "账号 {} 同步失败: {:?}",
                            result.account_id,
                            result.errors
                        );
                    }
                }
            }
        });

        state.handle = Some(handle);
        state.running = true;

        log::info!("定时同步已启动，间隔: {} 分钟", interval_minutes);
    }

    /// 停止定时同步
    pub async fn stop_timer(&self) {
        let mut state = self.state.write().await;

        if let Some(handle) = state.handle.take() {
            let _ = handle.abort();
        }

        state.running = false;

        log::info!("定时同步已停止");
    }

    /// 手动触发即时同步
    ///
    /// # 参数
    /// * `accounts` - 账号列表
    ///
    /// # 返回
    /// * `Vec<SyncResult>` - 同步结果
    pub async fn trigger_manual_sync(&self, accounts: &[AccountInfo]) -> Vec<SyncResult> {
        log::info!("手动触发同步");

        self.engine.emit_progress(SyncProgress {
            account_id: "manual".to_string(),
            status: SyncStatus::Syncing,
            message: "手动同步开始".to_string(),
            progress: 0.0,
        });

        let results = self.engine.sync_all_accounts(accounts).await;

        self.engine.emit_progress(SyncProgress {
            account_id: "manual".to_string(),
            status: SyncStatus::Completed,
            message: "手动同步完成".to_string(),
            progress: 100.0,
        });

        results
    }

    /// 检查定时器是否正在运行
    pub async fn is_running(&self) -> bool {
        self.state.read().await.running
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_account_type_serialization() {
        let exchange = AccountType::Exchange;
        let caldav = AccountType::CalDav;

        let exchange_json = serde_json::to_string(&exchange).unwrap();
        let caldav_json = serde_json::to_string(&caldav).unwrap();

        assert_eq!(exchange_json, "\"exchange\"");
        assert_eq!(caldav_json, "\"caldav\"");
    }

    #[test]
    fn test_account_info_creation() {
        let account = AccountInfo {
            id: "test-123".to_string(),
            name: "测试账号".to_string(),
            account_type: AccountType::Exchange,
            server_url: "https://mail.example.com/EWS/Exchange.asmx".to_string(),
            username: "user@example.com".to_string(),
            password: "encrypted_password".to_string(),
            enabled: true,
            sync_token: None,
        };

        assert_eq!(account.id, "test-123");
        assert_eq!(account.name, "测试账号");
        assert_eq!(account.account_type, AccountType::Exchange);
        assert!(account.enabled);
    }

    #[test]
    fn test_sync_config_default() {
        let config = SyncConfig::default();

        assert_eq!(config.past_days, 30);
        assert_eq!(config.future_days, 90);
        assert_eq!(config.interval_minutes, 15);
    }

    #[test]
    fn test_sync_config_custom() {
        let config = SyncConfig {
            past_days: 7,
            future_days: 30,
            interval_minutes: 5,
        };

        assert_eq!(config.past_days, 7);
        assert_eq!(config.future_days, 30);
        assert_eq!(config.interval_minutes, 5);
    }

    #[test]
    fn test_sync_result_creation() {
        let result = SyncResult {
            account_id: "test-456".to_string(),
            success: true,
            added: 5,
            updated: 3,
            deleted: 1,
            errors: Vec::new(),
        };

        assert_eq!(result.account_id, "test-456");
        assert!(result.success);
        assert_eq!(result.added, 5);
        assert_eq!(result.updated, 3);
        assert_eq!(result.deleted, 1);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_sync_result_with_errors() {
        let result = SyncResult {
            account_id: "test-789".to_string(),
            success: false,
            added: 0,
            updated: 0,
            deleted: 0,
            errors: vec!["错误1".to_string(), "错误2".to_string()],
        };

        assert!(!result.success);
        assert_eq!(result.errors.len(), 2);
    }

    #[test]
    fn test_sync_progress_serialization() {
        let progress = SyncProgress {
            account_id: "test".to_string(),
            status: SyncStatus::Syncing,
            message: "正在同步...".to_string(),
            progress: 50.0,
        };

        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("test"));
        assert!(json.contains("syncing"));
        assert!(json.contains("正在同步..."));
    }

    #[test]
    fn test_sync_status_variants() {
        let idle = SyncStatus::Idle;
        let syncing = SyncStatus::Syncing;
        let completed = SyncStatus::Completed;
        let failed = SyncStatus::Failed;

        assert_eq!(serde_json::to_string(&idle).unwrap(), "\"idle\"");
        assert_eq!(serde_json::to_string(&syncing).unwrap(), "\"syncing\"");
        assert_eq!(serde_json::to_string(&completed).unwrap(), "\"completed\"");
        assert_eq!(serde_json::to_string(&failed).unwrap(), "\"failed\"");
    }

    #[test]
    fn test_account_info_serialization() {
        let account = AccountInfo {
            id: "acc-001".to_string(),
            name: "工作邮箱".to_string(),
            account_type: AccountType::CalDav,
            server_url: "https://caldav.example.com".to_string(),
            username: "user".to_string(),
            password: "pass".to_string(),
            enabled: false,
            sync_token: Some("token123".to_string()),
        };

        let json = serde_json::to_string(&account).unwrap();
        let deserialized: AccountInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, account.id);
        assert_eq!(deserialized.name, account.name);
        assert_eq!(deserialized.account_type, account.account_type);
        assert_eq!(deserialized.enabled, account.enabled);
        assert_eq!(deserialized.sync_token, account.sync_token);
    }
}
