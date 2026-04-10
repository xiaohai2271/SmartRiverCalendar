// 统一事件发射模块
// 时钟点击和托盘图标点击都通过此模块发射 Tauri 事件

use serde::Serialize;
use tauri::Emitter;

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
}

/// 发射时钟点击事件
pub fn emit_clock_click(app: &tauri::AppHandle) {
    let request = WindowToggleRequest {
        source: ToggleSource::ClockArea,
    };
    if let Err(e) = app.emit("window-toggle-request", &request) {
        log::error!("[ClockHook] 发射事件失败: {}", e);
    }
}

/// 发射托盘图标点击事件
pub fn emit_tray_click(app: &tauri::AppHandle) {
    let request = WindowToggleRequest {
        source: ToggleSource::TrayIcon,
    };
    if let Err(e) = app.emit("window-toggle-request", &request) {
        log::error!("[TrayIcon] 发射事件失败: {}", e);
    }
}
