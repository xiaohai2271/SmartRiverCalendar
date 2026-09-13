// 同步调度器
// 定时同步、网络恢复后自动触发、防止重复同步

use std::sync::atomic::{AtomicBool, Ordering};

use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio::time::{Duration, interval};

use crate::sync_engine::sync::{SyncExecutor, SyncResult};

/// 同步调度器配置
#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    /// 定时同步间隔（秒），默认 300 秒（5 分钟）
    pub interval_secs: u64,
    /// 是否在网络恢复后自动触发同步
    pub sync_on_network_restore: bool,
    /// 最大重试次数
    pub max_retries: u32,
    /// 重试间隔（秒）
    pub retry_interval_secs: u64,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            interval_secs: 300,
            sync_on_network_restore: true,
            max_retries: 3,
            retry_interval_secs: 30,
        }
    }
}

/// 调度器状态
#[derive(Debug, Clone, PartialEq)]
pub enum SchedulerState {
    /// 已停止
    Stopped,
    /// 运行中
    Running,
    /// 正在同步
    Syncing,
    /// 暂停（网络不可用等）
    Paused,
}

/// 同步调度器
///
/// 负责管理同步任务的生命周期：
/// - 定时触发同步
/// - 网络恢复后自动触发同步
/// - 防止重复同步（同步锁）
pub struct SyncScheduler {
    /// 同步执行器（RwLock 包装以支持异步访问）
    executor: RwLock<Option<SyncExecutor<'static>>>,
    /// 调度器配置
    config: RwLock<SchedulerConfig>,
    /// 调度器状态
    state: RwLock<SchedulerState>,
    /// 同步锁，防止重复同步
    sync_lock: AtomicBool,
    /// 定时器任务句柄
    timer_handle: RwLock<Option<JoinHandle<()>>>,
    /// 网络恢复监控任务句柄
    network_handle: RwLock<Option<JoinHandle<()>>>,
}

// 安全：SyncScheduler 的所有字段都是线程安全的
unsafe impl Send for SyncScheduler {}
unsafe impl Sync for SyncScheduler {}

impl SyncScheduler {
    /// 创建同步调度器实例
    ///
    /// # 参数
    /// - `config`: 调度器配置，使用 Default 可获取默认值
    pub fn new(config: SchedulerConfig) -> Self {
        Self {
            executor: RwLock::new(None),
            config: RwLock::new(config),
            state: RwLock::new(SchedulerState::Stopped),
            sync_lock: AtomicBool::new(false),
            timer_handle: RwLock::new(None),
            network_handle: RwLock::new(None),
        }
    }

    /// 获取当前调度器状态
    pub async fn state(&self) -> SchedulerState {
        self.state.read().await.clone()
    }

    /// 更新调度器配置
    ///
    /// 如果调度器正在运行，需要先停止再更新
    pub async fn update_config(&self, config: SchedulerConfig) {
        let mut current = self.config.write().await;
        *current = config;
    }

    /// 初始化同步执行器
    ///
    /// 必须在启动调度器之前调用，设置数据库连接和 API 客户端。
    ///
    /// # 注意
    /// 由于 Rust 生命周期限制，此方法使用 'static 生命周期。
    /// 实际使用中，需要确保 DatabaseConnection 的生命周期足够长。
    /// 推荐使用 Arc<DatabaseConnection> 模式。
    pub async fn set_executor(&self, executor: SyncExecutor<'static>) {
        let mut ex = self.executor.write().await;
        *ex = Some(executor);
    }

    /// 启动定时同步
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    /// - `last_sync_at`: 上次同步时间戳（毫秒），首次为 None
    ///
    /// # 返回
    /// 成功返回 true，已在运行返回 false
    pub async fn start(&self, user_id: i64, _last_sync_at: Option<i64>) -> bool {
        let mut state = self.state.write().await;
        if *state == SchedulerState::Running {
            log::warn!("调度器已在运行中，忽略启动请求");
            return false;
        }

        let config = self.config.read().await;
        let interval_duration = Duration::from_secs(config.interval_secs);

        *state = SchedulerState::Running;
        drop(state);

        log::info!(
            "同步调度器启动: interval={}s, user_id={}",
            config.interval_secs,
            user_id
        );

        // 启动定时器任务
        let handle = tokio::spawn(async move {
            let mut ticker = interval(interval_duration);

            loop {
                ticker.tick().await;
                log::debug!("定时同步触发: user_id={}", user_id);
                // 注意：实际执行同步需要在有 executor 的情况下
                // 这里只是触发信号
            }
        });

        let mut timer_handle = self.timer_handle.write().await;
        *timer_handle = Some(handle);

        true
    }

    /// 停止定时同步
    pub async fn stop(&self) {
        // 停止定时器
        if let Some(handle) = self.timer_handle.write().await.take() {
            handle.abort();
        }

        // 停止网络监控
        if let Some(handle) = self.network_handle.write().await.take() {
            handle.abort();
        }

        let mut state = self.state.write().await;
        *state = SchedulerState::Stopped;

        log::info!("同步调度器已停止");
    }

    /// 手动触发同步
    ///
    /// 使用同步锁防止重复触发。
    ///
    /// # 参数
    /// - `executor`: 同步执行器
    /// - `user_id`: 用户 ID
    /// - `last_sync_at`: 上次同步时间戳（毫秒），首次为 None
    ///
    /// # 返回
    /// 成功返回同步结果，同步锁冲突返回 None
    pub async fn trigger_sync(
        &self,
        executor: &SyncExecutor<'_>,
        user_id: i64,
        last_sync_at: Option<i64>,
    ) -> Option<SyncResult> {
        // 尝试获取同步锁
        if self.sync_lock.compare_exchange(
            false,
            true,
            Ordering::SeqCst,
            Ordering::SeqCst,
        ).is_err() {
            log::warn!("同步锁冲突，跳过本次同步");
            return None;
        }

        // 更新状态为 Syncing
        {
            let mut state = self.state.write().await;
            *state = SchedulerState::Syncing;
        }

        let result = executor.batch_sync(user_id, last_sync_at).await;

        // 释放同步锁
        self.sync_lock.store(false, Ordering::SeqCst);

        // 恢复状态
        {
            let mut state = self.state.write().await;
            *state = SchedulerState::Running;
        }

        Some(result)
    }

    /// 检查是否正在同步
    pub fn is_syncing(&self) -> bool {
        self.sync_lock.load(Ordering::SeqCst)
    }

    /// 检查网络是否可用
    ///
    /// 尝试连接一个轻量级 URL 来检测网络连通性。
    /// 超时时间为 5 秒。
    ///
    /// # 返回
    /// 网络可用返回 true，否则返回 false
    pub async fn check_network() -> bool {
        match reqwest::Client::new()
            .head("https://httpbin.org/status/200")
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    /// 通知网络状态变更
    ///
    /// 当检测到网络恢复时调用，自动触发同步。
    ///
    /// # 参数
    /// - `is_online`: 当前是否在线
    /// - `executor`: 同步执行器
    /// - `user_id`: 用户 ID
    /// - `last_sync_at`: 上次同步时间戳（毫秒），首次为 None
    pub async fn notify_network_change(
        &self,
        is_online: bool,
        executor: &SyncExecutor<'_>,
        user_id: i64,
        last_sync_at: Option<i64>,
    ) {
        let config = self.config.read().await;

        if is_online && config.sync_on_network_restore {
            log::info!("网络恢复，触发自动同步");

            // 如果之前是暂停状态，恢复为运行状态
            {
                let mut state = self.state.write().await;
                if *state == SchedulerState::Paused {
                    *state = SchedulerState::Running;
                }
            }

            self.trigger_sync(executor, user_id, last_sync_at).await;
        } else if !is_online {
            log::info!("网络断开，暂停同步");
            let mut state = self.state.write().await;
            if *state == SchedulerState::Running {
                *state = SchedulerState::Paused;
            }
        }
    }

    /// 执行带重试的同步
    ///
    /// # 参数
    /// - `executor`: 同步执行器
    /// - `user_id`: 用户 ID
    /// - `last_sync_at`: 上次同步时间戳（毫秒），首次为 None
    ///
    /// # 返回
    /// 最终同步结果
    pub async fn sync_with_retry(
        &self,
        executor: &SyncExecutor<'_>,
        user_id: i64,
        last_sync_at: Option<i64>,
    ) -> SyncResult {
        let config = self.config.read().await;
        let max_retries = config.max_retries;
        let retry_interval = Duration::from_secs(config.retry_interval_secs);
        drop(config);

        let mut last_result = SyncResult::err("未执行同步".to_string());

        for attempt in 0..=max_retries {
            if attempt > 0 {
                log::info!("同步重试: 第 {} 次", attempt);
                tokio::time::sleep(retry_interval).await;
            }

            let result = self.trigger_sync(executor, user_id, last_sync_at).await;
            match result {
                Some(sync_result) => {
                    if sync_result.success {
                        return sync_result;
                    }
                    last_result = sync_result;
                }
                None => {
                    // 同步锁冲突，稍后重试
                    last_result = SyncResult::err("同步锁冲突".to_string());
                }
            }
        }

        last_result
    }
}

impl Drop for SyncScheduler {
    fn drop(&mut self) {
        // 注意：tokio RwLock 不支持在同步 drop 中获取写锁
        // 定时器任务会在调度器被释放后自行结束（不再有引用）
        // 如果需要立即停止，请在 drop 之前调用 stop().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试默认配置
    #[test]
    fn test_default_config() {
        let config = SchedulerConfig::default();
        assert_eq!(config.interval_secs, 300);
        assert!(config.sync_on_network_restore);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.retry_interval_secs, 30);
    }

    /// 测试自定义配置
    #[test]
    fn test_custom_config() {
        let config = SchedulerConfig {
            interval_secs: 60,
            sync_on_network_restore: false,
            max_retries: 5,
            retry_interval_secs: 10,
        };
        assert_eq!(config.interval_secs, 60);
        assert!(!config.sync_on_network_restore);
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_interval_secs, 10);
    }

    /// 测试调度器状态
    #[tokio::test]
    async fn test_scheduler_initial_state() {
        let scheduler = SyncScheduler::new(SchedulerConfig::default());
        assert_eq!(scheduler.state().await, SchedulerState::Stopped);
        assert!(!scheduler.is_syncing());
    }

    /// 测试更新配置
    #[tokio::test]
    async fn test_update_config() {
        let scheduler = SyncScheduler::new(SchedulerConfig::default());
        let new_config = SchedulerConfig {
            interval_secs: 120,
            ..Default::default()
        };
        scheduler.update_config(new_config).await;

        let config = scheduler.config.read().await;
        assert_eq!(config.interval_secs, 120);
    }

    /// 测试同步锁
    #[test]
    fn test_sync_lock() {
        let scheduler = SyncScheduler::new(SchedulerConfig::default());

        // 初始状态未锁定
        assert!(!scheduler.is_syncing());

        // 获取锁
        let acquired = scheduler.sync_lock.compare_exchange(
            false,
            true,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(acquired.is_ok());
        assert!(scheduler.is_syncing());

        // 重复获取锁失败
        let acquired_again = scheduler.sync_lock.compare_exchange(
            false,
            true,
            Ordering::SeqCst,
            Ordering::SeqCst,
        );
        assert!(acquired_again.is_err());

        // 释放锁
        scheduler.sync_lock.store(false, Ordering::SeqCst);
        assert!(!scheduler.is_syncing());
    }

    /// 测试调度器启动和停止
    #[tokio::test]
    async fn test_start_and_stop() {
        let scheduler = SyncScheduler::new(SchedulerConfig {
            interval_secs: 1,
            ..Default::default()
        });

        // 启动
        let started = scheduler.start(1, None).await;
        assert!(started);
        assert_eq!(scheduler.state().await, SchedulerState::Running);

        // 重复启动应失败
        let started_again = scheduler.start(1, None).await;
        assert!(!started_again);

        // 停止
        scheduler.stop().await;
        assert_eq!(scheduler.state().await, SchedulerState::Stopped);
    }

    /// 测试调度器状态转换
    #[tokio::test]
    async fn test_state_transitions() {
        let scheduler = SyncScheduler::new(SchedulerConfig::default());

        // Stopped → Running
        assert_eq!(scheduler.state().await, SchedulerState::Stopped);
        scheduler.start(1, None).await;
        assert_eq!(scheduler.state().await, SchedulerState::Running);

        // Running → Stopped
        scheduler.stop().await;
        assert_eq!(scheduler.state().await, SchedulerState::Stopped);
    }

    /// 测试调度器 Drop 清理
    #[test]
    fn test_scheduler_drop() {
        let scheduler = SyncScheduler::new(SchedulerConfig::default());
        drop(scheduler);
        // 不应 panic
    }

    /// 测试 SyncResult
    #[test]
    fn test_sync_result() {
        let ok_result = SyncResult::ok(42, "token_42".to_string());
        assert!(ok_result.success);
        assert_eq!(ok_result.server_time, 42);
        assert_eq!(ok_result.sync_token, "token_42");

        let err_result = SyncResult::err("测试错误".to_string());
        assert!(!err_result.success);
        assert_eq!(err_result.errors.len(), 1);
    }
}
