// 时钟点击检测管理器
// 职责：生命周期管理（启用/禁用）、协调钩子和更新器线程

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::AppHandle;

/// 时钟点击检测管理器
pub struct ClockHookManager {
    /// 功能是否启用
    enabled: Arc<AtomicBool>,
    /// 功能是否可用（更新器无法获取坐标时为 false）
    available: Arc<AtomicBool>,
    /// 更新器线程停止标志
    updater_stop: Arc<AtomicBool>,
    /// 更新器线程句柄
    updater_handle: Option<std::thread::JoinHandle<()>>,
    /// Tauri AppHandle
    app_handle: Option<AppHandle>,
}

impl ClockHookManager {
    pub fn new() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(false)),
            available: Arc::new(AtomicBool::new(true)),
            updater_stop: Arc::new(AtomicBool::new(false)),
            updater_handle: None,
            app_handle: None,
        }
    }

    /// 启用 Hook（设置开启时调用，立即生效）
    pub fn enable(&mut self, app_handle: AppHandle) -> Result<String, String> {
        if self.enabled.load(Ordering::SeqCst) {
            return Ok(self.get_detection_method());
        }

        self.app_handle = Some(app_handle.clone());
        self.updater_stop.store(false, Ordering::SeqCst);

        // 1. 启动坐标更新器线程
        let updater = super::region_updater::RegionUpdater::new(
            self.updater_stop.clone(),
            app_handle.clone(),
        );
        self.updater_handle = Some(updater.start());

        // 等待首次扫描完成（最多 5 秒）
        let wait_start = std::time::Instant::now();
        loop {
            if let Ok(cache) = super::region_updater::CLOCK_REGIONS.read() {
                if cache.primary.is_some() || !cache.secondary.is_empty() {
                    break;
                }
            }
            if wait_start.elapsed() > std::time::Duration::from_secs(5) {
                log::warn!("[ClockHook] 首次坐标扫描超时，将在后台继续尝试");
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }

        // 2. 安装 WH_MOUSE_LL 钩子
        super::hook::install_hook(app_handle)?;

        self.enabled.store(true, Ordering::SeqCst);
        let method = self.get_detection_method();
        log::info!(
            "[ClockHook] 功能已启用，检测方式: {}",
            if method.is_empty() {
                "等待中"
            } else {
                &method
            }
        );
        Ok(method)
    }

    /// 禁用 Hook（设置关闭时调用，立即生效）
    pub fn disable(&mut self) -> Result<(), String> {
        if !self.enabled.load(Ordering::SeqCst) {
            return Ok(()); // 已经禁用
        }

        // 1. 卸载鼠标钩子
        super::hook::uninstall_hook()?;

        // 2. 停止更新器线程（非阻塞：设置停止标志后丢弃句柄，线程自行退出）
        self.updater_stop.store(true, Ordering::SeqCst);
        self.updater_handle = None;

        // 3. 清空缓存
        {
            let mut cache = super::region_updater::CLOCK_REGIONS.write().unwrap();
            *cache = super::region_updater::ClockRegionCache::default();
        }

        self.enabled.store(false, Ordering::SeqCst);
        log::info!("[ClockHook] 功能已禁用");
        Ok(())
    }

    /// 更新「阻止系统弹窗」设置
    pub fn set_block_system_popup(&self, block: bool) {
        super::hook::BLOCK_POPUP.store(block, Ordering::SeqCst);
        log::info!("[ClockHook] 拦截系统弹窗: {}", block);
    }

    /// 获取当前检测方式名称
    pub fn get_detection_method(&self) -> String {
        let cache = super::region_updater::CLOCK_REGIONS.read().unwrap();
        cache.detection_method.clone()
    }

    /// 功能是否可用
    pub fn is_available(&self) -> bool {
        self.available.load(Ordering::SeqCst)
    }
}
