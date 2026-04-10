// 多屏时钟区域缓存与坐标更新器
// 被 region_updater 写入，被 hook 回调读取

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::RwLock;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::RECT;

/// 多屏时钟区域缓存
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ClockRegionCache {
    /// 主屏时钟区域
    pub primary: Option<RECT>,
    /// 所有副屏时钟区域
    pub secondary: Vec<RECT>,
    /// 当前使用的检测方式名称（用于前端展示）
    pub detection_method: String,
}

/// 全局缓存实例
/// 使用 RwLock：更新器线程获取写锁（极短暂），钩子回调查获取读锁（极短暂）
pub static CLOCK_REGIONS: RwLock<ClockRegionCache> = RwLock::new(ClockRegionCache {
    primary: None,
    secondary: Vec::new(),
    detection_method: String::new(),
});

/// 显示器类型
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MonitorType {
    Primary,
    Secondary,
}

/// 判断点是否在矩形区域内
fn point_in_rect(pt: windows::Win32::Foundation::POINT, rect: &RECT) -> bool {
    pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom
}

impl ClockRegionCache {
    /// 判断点击是否落在任一屏幕的时钟区域
    pub fn hit_test(&self, pt: windows::Win32::Foundation::POINT) -> Option<MonitorType> {
        if let Some(rect) = &self.primary {
            if point_in_rect(pt, rect) {
                return Some(MonitorType::Primary);
            }
        }
        for rect in &self.secondary {
            if point_in_rect(pt, rect) {
                return Some(MonitorType::Secondary);
            }
        }
        None
    }
}

/// 坐标更新器
pub struct RegionUpdater {
    stop_flag: Arc<AtomicBool>,
    // app_handle 保留用于后续扩展：更新器线程可能需要发射事件通知前端（如扫描持续失败告警）
    #[allow(dead_code)]
    app_handle: AppHandle,
}

impl RegionUpdater {
    pub fn new(stop_flag: Arc<AtomicBool>, app_handle: AppHandle) -> Self {
        Self {
            stop_flag,
            app_handle,
        }
    }

    /// 启动更新器线程
    pub fn start(self) -> std::thread::JoinHandle<()> {
        std::thread::Builder::new()
            .name("clock-region-updater".to_string())
            .spawn(move || {
                log::info!("[RegionUpdater] 线程启动");

                // 注意：不在此处手动调用 CoInitializeEx
                // uiautomation crate 内部会自行初始化 COM（UIAutomation::new() 时自动完成）
                // 手动初始化可能与 crate 内部产生冲突，因此交由 crate 自行管理

                // 连续失败计数，用于降低扫描频率
                let mut consecutive_failures = 0u32;

                while !self.stop_flag.load(Ordering::SeqCst) {
                    // 在无锁状态下完成耗时查询
                    let new_cache = self.scan_all_regions();

                    match new_cache {
                        Some(cache) => {
                            consecutive_failures = 0;

                            // 短暂加锁，仅置换缓存指针（微秒级操作）
                            if let Ok(mut current) = CLOCK_REGIONS.write() {
                                // 只在坐标变化时更新（减少不必要的写操作）
                                if *current != cache {
                                    log::info!(
                                        "[RegionUpdater] 时钟区域已更新: primary={:?}, secondary={}个, method={}",
                                        cache.primary,
                                        cache.secondary.len(),
                                        cache.detection_method,
                                    );
                                    let new_method = cache.detection_method.clone();
                                    *current = cache;
                                    drop(current);
                                    if let Err(e) = self.app_handle.emit("clock-hook-detection-changed", &new_method) {
                                        log::warn!("[RegionUpdater] 发射检测方式变化事件失败: {}", e);
                                    }
                                }
                            }
                        }
                        None => {
                            consecutive_failures += 1;
                            if consecutive_failures == 1 {
                                log::warn!("[RegionUpdater] 坐标扫描失败");
                            } else if consecutive_failures % 10 == 0 {
                                log::warn!("[RegionUpdater] 坐标扫描连续失败 {} 次", consecutive_failures);
                            }
                        }
                    }

                    // 扫描间隔：正常 2 秒，连续失败后逐步增加到 10 秒
                    let interval = if consecutive_failures < 5 {
                        Duration::from_secs(2)
                    } else if consecutive_failures < 20 {
                        Duration::from_secs(5)
                    } else {
                        Duration::from_secs(10)
                    };

                    // 分段 sleep，以便及时响应停止信号
                    let sleep_step = Duration::from_millis(200);
                    let mut remaining = interval;
                    while remaining > sleep_step && !self.stop_flag.load(Ordering::SeqCst) {
                        std::thread::sleep(sleep_step);
                        remaining -= sleep_step;
                    }
                    if !self.stop_flag.load(Ordering::SeqCst) && remaining > Duration::ZERO {
                        std::thread::sleep(remaining);
                    }
                }

                log::info!("[RegionUpdater] 线程退出");
            })
            .expect("坐标更新器线程创建失败")
    }

    /// 扫描所有屏幕的时钟区域（无锁，耗时操作在此完成）
    fn scan_all_regions(&self) -> Option<ClockRegionCache> {
        let mut cache = ClockRegionCache::default();

        // ── 数据来源1（优先）：FindWindow 查找时钟窗口 ──
        // Win10: Shell_TrayWnd → TrayNotifyWnd → TrayClockWClass
        // Win11 22H2: Shell_TrayWnd → TrayNotifyWnd → ClockButton
        if let Some(primary_rect) = super::clock_finder::find_clock_window_rect() {
            cache.primary = Some(primary_rect);
            cache.detection_method = "窗口句柄查找".to_string();
        }

        // 查找副屏任务栏时钟
        let secondary_rects = super::clock_finder::find_secondary_clock_rects();
        if !secondary_rects.is_empty() {
            cache.secondary = secondary_rects;
        }

        // 主屏找到就返回
        if cache.primary.is_some() {
            return Some(cache);
        }

        // ── 数据来源2：UI Automation 查找时钟元素 ──
        // 适用于 Win11 24H2+（无 TrayClockWClass 窗口句柄）
        if let Some(automation_cache) = super::clock_finder::find_clock_via_automation() {
            return Some(automation_cache);
        }

        // ── 数据来源3（兜底）：任务栏位置估算 ──
        if let Some(estimated_cache) = super::clock_finder::estimate_clock_regions() {
            return Some(estimated_cache);
        }

        None
    }
}
