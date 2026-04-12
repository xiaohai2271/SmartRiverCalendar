// 时钟区域查找工具
// 三种数据来源：FindWindow → UI Automation → 任务栏位置估算

use crate::clock_hook::region_updater::{ClockRegion, ClockRegionCache, MonitorType};
use windows::core::w;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::UI::Shell::*;
use windows::Win32::UI::WindowsAndMessaging::*;

/// ============================================================
/// 数据来源1：FindWindow 查找时钟窗口
/// ============================================================

/// 查找主屏时钟窗口句柄
/// Win10:  Shell_TrayWnd → TrayNotifyWnd → TrayClockWClass
/// Win11:  Shell_TrayWnd → TrayNotifyWnd → ClockButton
pub fn find_clock_window() -> Option<HWND> {
    unsafe {
        let shell_tray = FindWindowW(w!("Shell_TrayWnd"), None).ok()?;

        // 尝试在 Shell_TrayWnd 的子窗口中查找
        let class_names = [
            w!("TrayClockWClass"), // Win10
            w!("ClockButton"),     // Win11 22H2
        ];

        // 有些系统时钟是 TrayNotifyWnd 的子窗口
        if let Ok(tray_notify) = FindWindowExW(Some(shell_tray), None, w!("TrayNotifyWnd"), None) {
            for class_name in &class_names {
                if let Ok(clock) = FindWindowExW(Some(tray_notify), None, *class_name, None) {
                    log::debug!(
                        "[ClockFinder] 在 TrayNotifyWnd 下找到时钟窗口: {:?}",
                        class_name
                    );
                    return Some(clock);
                }
            }
        }

        // 有些系统时钟直接是 Shell_TrayWnd 的子窗口
        for class_name in &class_names {
            if let Ok(clock) = FindWindowExW(Some(shell_tray), None, *class_name, None) {
                log::debug!(
                    "[ClockFinder] 在 Shell_TrayWnd 下找到时钟窗口: {:?}",
                    class_name
                );
                return Some(clock);
            }
        }

        log::debug!("[ClockFinder] 未找到时钟窗口句柄");
        None
    }
}

/// 获取主屏时钟窗口的矩形区域
pub fn find_clock_window_rect() -> Option<RECT> {
    let hwnd = find_clock_window()?;
    let mut rect = RECT::default();
    unsafe {
        GetWindowRect(hwnd, &mut rect).ok()?;
    }
    Some(rect)
}

/// 查找副屏任务栏时钟窗口矩形
/// Win10 多屏：每个副屏有独立的 Shell_SecondaryTrayWnd
pub fn find_secondary_clock_rects() -> Vec<RECT> {
    let mut results = Vec::new();
    unsafe {
        let mut hwnd = None;
        loop {
            hwnd = FindWindowExW(None, hwnd, w!("Shell_SecondaryTrayWnd"), None).ok();

            let current = match hwnd {
                Some(h) if h != HWND::default() => h,
                _ => break,
            };

            // 在副屏任务栏中查找时钟窗口
            let class_names = [w!("TrayClockWClass"), w!("ClockButton")];
            for class_name in &class_names {
                if let Ok(clock) = FindWindowExW(Some(current), None, *class_name, None) {
                    let mut rect = RECT::default();
                    if GetWindowRect(clock, &mut rect).is_ok() {
                        results.push(rect);
                    }
                    break;
                }
            }
        }
    }
    results
}

/// ============================================================
/// 数据来源2：UI Automation 查找时钟元素
/// ============================================================

/// 通过 UI Automation 查找时钟元素并获取区域
/// 适用于 Win11 24H2+（UWP 任务栏，无传统窗口句柄）
pub fn find_clock_via_automation() -> Option<ClockRegionCache> {
    use uiautomation::types::TreeScope;
    use uiautomation::types::UIProperty;
    use uiautomation::variants::Variant;
    use uiautomation::UIAutomation;

    // UIAutomation 不是 Send，每次在函数内部创建新实例
    let mut cache = ClockRegionCache::default();

    // 初始化 UIAutomation（内部自动管理 COM 初始化）
    let automation = match UIAutomation::new() {
        Ok(a) => a,
        Err(e) => {
            log::warn!("[ClockFinder] UIAutomation::new 失败: {:?}", e);
            return None;
        }
    };

    // 获取桌面根节点
    let root = match automation.get_root_element() {
        Ok(r) => r,
        Err(_) => return None,
    };

    // 尝试多个备选类名（Win11 24H2+ 的实际 ClassName 需要实测确认）
    let class_names = [
        "ClockButton",
        "TrayClockWClass",
        "Windows.UI.Xaml.Controls.TextBlock",
    ];
    let mut found_elements: Vec<_> = Vec::new();

    for class_name in &class_names {
        let condition = match automation.create_property_condition(
            UIProperty::ClassName,
            Variant::from(*class_name),
            None,
        ) {
            Ok(c) => c,
            Err(_) => continue,
        };

        if let Ok(elements) = root.find_all(TreeScope::Descendants, &condition) {
            if !elements.is_empty() {
                found_elements = elements;
                break;
            }
        }
    }

    if found_elements.is_empty() {
        log::debug!("[ClockFinder] ClassName 查找无结果");
        return None;
    }

    let primary_monitor =
        unsafe { MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY) };
    let mut found = false;

    for elem in found_elements {
        if let Ok(rect_f) = elem.get_bounding_rectangle() {
            let rect = RECT {
                left: rect_f.get_left() as i32,
                top: rect_f.get_top() as i32,
                right: rect_f.get_right() as i32,
                bottom: rect_f.get_bottom() as i32,
            };

            // 使用 MonitorFromPoint 判断元素属于哪个显示器
            let center_x = (rect.left + rect.right) / 2;
            let center_y = (rect.top + rect.bottom) / 2;
            let element_monitor = unsafe {
                MonitorFromPoint(
                    POINT {
                        x: center_x,
                        y: center_y,
                    },
                    MONITOR_DEFAULTTONULL,
                )
            };

            if element_monitor == primary_monitor {
                cache.primary = Some(ClockRegion {
                    rect,
                    monitor_type: MonitorType::Primary,
                });
                found = true;
            } else if element_monitor != HMONITOR::default() {
                // 非主屏但有有效显示器 → 副屏时钟
                cache.secondary.push(ClockRegion {
                    rect,
                    monitor_type: MonitorType::Secondary,
                });
                found = true;
            }
            // element_monitor 为空 → 元素不在任何显示器上，忽略
        }
    }

    if found {
        cache.detection_method = "UI Automation".to_string();
        Some(cache)
    } else {
        None
    }
}

/// ============================================================
/// 数据来源3：任务栏位置估算
/// ============================================================

/// 通过任务栏位置估算时钟区域（兜底方案）
pub fn estimate_clock_regions() -> Option<ClockRegionCache> {
    let mut cache = ClockRegionCache::default();

    // 获取主屏任务栏位置
    let taskbar_rect = get_taskbar_rect()?;
    let primary_monitor = get_primary_monitor_rect();

    // 估算主屏时钟区域
    cache.primary =
        estimate_clock_from_taskbar(&taskbar_rect, &primary_monitor).map(|rect| ClockRegion {
            rect,
            monitor_type: MonitorType::Primary,
        });

    // 获取副屏任务栏并估算
    let secondary_bars = get_secondary_taskbar_rects();
    for bar_rect in secondary_bars {
        if let Some(clock_rect) = estimate_clock_from_taskbar_simple(&bar_rect) {
            cache.secondary.push(ClockRegion {
                rect: clock_rect,
                monitor_type: MonitorType::Secondary,
            });
        }
    }

    cache.detection_method = "任务栏位置估算".to_string();

    if cache.primary.is_some() || !cache.secondary.is_empty() {
        Some(cache)
    } else {
        None
    }
}

/// 从任务栏矩形估算时钟区域
/// 保守估算：宁可区域稍小也不要覆盖到其他图标区域
fn estimate_clock_from_taskbar(taskbar: &RECT, monitor: &RECT) -> Option<RECT> {
    let bar_height = taskbar.bottom - taskbar.top;
    let bar_width = taskbar.right - taskbar.left;

    // 判断任务栏位置
    let is_bottom = taskbar.bottom == monitor.bottom && bar_height < 100;
    let is_top = taskbar.top == monitor.top && bar_height < 100;
    let is_left = taskbar.left == monitor.left && bar_width < 100;
    let is_right = taskbar.right == monitor.right && bar_width < 100;

    if is_bottom || is_top {
        // 水平任务栏：时钟在右侧末端
        // 保守宽度 80px，仅覆盖时间文字区域，不覆盖通知图标
        let clock_width = 80i32;
        Some(RECT {
            left: taskbar.right - clock_width,
            top: taskbar.top,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    } else if is_left {
        // 左侧垂直任务栏：时钟在底部末端
        let clock_height = 40i32;
        Some(RECT {
            left: taskbar.left,
            top: taskbar.bottom - clock_height,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    } else if is_right {
        // 右侧垂直任务栏：时钟在底部末端
        let clock_height = 40i32;
        Some(RECT {
            left: taskbar.left,
            top: taskbar.bottom - clock_height,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    } else {
        // 无法判断任务栏位置，使用默认估算
        Some(RECT {
            left: taskbar.right - 80,
            top: taskbar.top,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    }
}

/// 简化版估算（无显示器信息时）
fn estimate_clock_from_taskbar_simple(taskbar: &RECT) -> Option<RECT> {
    let width = taskbar.right - taskbar.left;
    let height = taskbar.bottom - taskbar.top;

    if height < width {
        // 水平任务栏
        Some(RECT {
            left: taskbar.right - 80,
            top: taskbar.top,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    } else {
        // 垂直任务栏
        Some(RECT {
            left: taskbar.left,
            top: taskbar.bottom - 40,
            right: taskbar.right,
            bottom: taskbar.bottom,
        })
    }
}

/// ============================================================
/// 通用工具函数
/// ============================================================

/// 获取主屏任务栏矩形
pub fn get_taskbar_rect() -> Option<RECT> {
    unsafe {
        // 优先使用 SHAppBarMessage
        let mut app_bar_data: APPBARDATA = std::mem::zeroed();
        app_bar_data.cbSize = std::mem::size_of::<APPBARDATA>() as u32;

        let result = SHAppBarMessage(ABM_GETTASKBARPOS, &mut app_bar_data);
        if result != 0 {
            return Some(app_bar_data.rc);
        }

        // 降级：通过窗口句柄获取
        let shell_tray = FindWindowW(w!("Shell_TrayWnd"), None).ok()?;
        let mut rect = RECT::default();
        GetWindowRect(shell_tray, &mut rect).ok()?;
        Some(rect)
    }
}

/// 获取主显示器矩形区域
pub fn get_primary_monitor_rect() -> RECT {
    unsafe {
        let monitor = MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY);
        let mut monitor_info: MONITORINFO = std::mem::zeroed();
        monitor_info.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        let _ = GetMonitorInfoW(monitor, &mut monitor_info);
        monitor_info.rcMonitor
    }
}

/// 获取副屏任务栏矩形列表
pub fn get_secondary_taskbar_rects() -> Vec<RECT> {
    let mut results = Vec::new();
    unsafe {
        let mut hwnd = None;
        loop {
            hwnd = FindWindowExW(None, hwnd, w!("Shell_SecondaryTrayWnd"), None).ok();

            let current = match hwnd {
                Some(h) if h != HWND::default() => h,
                _ => break,
            };

            let mut rect = RECT::default();
            if GetWindowRect(current, &mut rect).is_ok() {
                results.push(rect);
            }
        }
    }
    results
}
