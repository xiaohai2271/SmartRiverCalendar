// 统一事件发射模块
// 时钟点击和托盘图标点击都通过此模块发射 Tauri 事件

use super::region_updater::{ClockRegion, MonitorType};
use serde::Serialize;
use tauri::Emitter;
use windows::Win32::Foundation::RECT;

/// 窗口切换请求来源
#[derive(Debug, Clone, Serialize)]
pub enum ToggleSource {
    /// 系统时钟区域点击
    ClockArea,
    /// 托盘图标点击
    TrayIcon,
}

/// 窗口切换请求事件
#[derive(Debug, Clone, Serialize)]
pub struct WindowToggleRequest {
    /// 触发来源
    pub source: ToggleSource,
    /// 屏幕类型（仅时钟点击时有值）
    pub monitor_type: Option<MonitorType>,
    /// 时钟区域矩形（仅时钟点击时有值）
    pub clock_rect: Option<RectInfo>,
}

/// 矩形区域信息（用于前端序列化）
#[derive(Debug, Clone, Serialize)]
pub struct RectInfo {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl From<RECT> for RectInfo {
    fn from(rect: RECT) -> Self {
        RectInfo {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
        }
    }
}

/// 发射时钟点击事件
pub fn emit_clock_click(app: &tauri::AppHandle, region: &ClockRegion) {
    let request = WindowToggleRequest {
        source: ToggleSource::ClockArea,
        monitor_type: Some(region.monitor_type),
        clock_rect: Some(RectInfo::from(region.rect)),
    };
    if let Err(e) = app.emit("window-toggle-request", &request) {
        log::error!("[ClockHook] 发射事件失败: {}", e);
    }
}

/// 发射托盘图标点击事件
pub fn emit_tray_click(app: &tauri::AppHandle) {
    let request = WindowToggleRequest {
        source: ToggleSource::TrayIcon,
        monitor_type: None,
        clock_rect: None,
    };
    if let Err(e) = app.emit("window-toggle-request", &request) {
        log::error!("[TrayIcon] 发射事件失败: {}", e);
    }
}
