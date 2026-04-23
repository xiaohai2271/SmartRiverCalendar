// WH_MOUSE_LL 全局鼠标钩子
// 检测鼠标点击是否落在时钟区域，根据设置拦截系统弹窗

use std::sync::atomic::{AtomicBool, AtomicIsize, AtomicPtr, Ordering};
use std::sync::Mutex;
use tauri::AppHandle;
use windows::Win32::Foundation::*;
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::WindowsAndMessaging::*;

/// 钩子是否正在运行
pub static HOOK_RUNNING: AtomicBool = AtomicBool::new(false);

/// 是否拦截系统弹窗（用户设置）
pub static BLOCK_POPUP: AtomicBool = AtomicBool::new(false);

/// 弹出窗口区域（用于点击穿透判断）
static POPUP_WINDOW_RECT: AtomicPtr<RECT> = AtomicPtr::new(std::ptr::null_mut());

/// 设置弹出窗口区域
pub fn set_popup_window_rect(rect: Option<RECT>) {
    let old_ptr = POPUP_WINDOW_RECT.swap(
        rect.map(|r| Box::into_raw(Box::new(r)))
            .unwrap_or(std::ptr::null_mut()),
        Ordering::SeqCst,
    );
    if !old_ptr.is_null() {
        unsafe {
            let _ = Box::from_raw(old_ptr);
        }
    }
}

/// 检查点是否在弹出窗口区域内
fn is_point_in_popup_window(pt: POINT) -> bool {
    let ptr = POPUP_WINDOW_RECT.load(Ordering::SeqCst);
    if ptr.is_null() {
        return false;
    }
    unsafe {
        let rect = &*ptr;
        pt.x >= rect.left && pt.x <= rect.right && pt.y >= rect.top && pt.y <= rect.bottom
    }
}

/// 钩子回调中持有 AppHandle 的方式：
/// 使用 Mutex<Option<AppHandle>> 以允许动态重置
static APP_HANDLE: std::sync::OnceLock<Mutex<Option<AppHandle>>> = std::sync::OnceLock::new();

/// 钩子句柄（存储为 isize，避免 HHOOK 非 Send/Sync 造成的编译错误）
static HOOK_HANDLE: AtomicIsize = AtomicIsize::new(0);

/// 安装 WH_MOUSE_LL 钩子
pub fn install_hook(app_handle: AppHandle) -> Result<(), String> {
    if HOOK_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }

    // 保存 AppHandle
    APP_HANDLE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap()
        .replace(app_handle);

    // 安装低级鼠标钩子
    let hook_handle = unsafe {
        SetWindowsHookExW(
            WH_MOUSE_LL,
            Some(mouse_ll_callback),
            // 使用当前模块句柄（不需要 DLL 注入）
            Some(HINSTANCE(
                GetModuleHandleW(None)
                    .map_err(|e| format!("GetModuleHandleW 失败: {:?}", e))?
                    .0,
            )),
            0, // 全局钩子，线程ID为0
        )
    };

    match hook_handle {
        Ok(handle) => {
            HOOK_HANDLE.store(handle.0 as isize, Ordering::SeqCst);
            HOOK_RUNNING.store(true, Ordering::SeqCst);
            log::info!("[Hook] WH_MOUSE_LL 钩子安装成功");
            Ok(())
        }
        Err(e) => {
            let err_msg = format!("SetWindowsHookExW 失败: {:?}。可能被安全软件拦截", e);
            log::error!("[Hook] {}", err_msg);
            Err(err_msg)
        }
    }
}

/// 卸载钩子
pub fn uninstall_hook() -> Result<(), String> {
    if !HOOK_RUNNING.load(Ordering::SeqCst) {
        return Ok(());
    }

    HOOK_RUNNING.store(false, Ordering::SeqCst);

    let handle_val = HOOK_HANDLE.swap(0, Ordering::SeqCst);
    if handle_val != 0 {
        unsafe {
            let _ = UnhookWindowsHookEx(HHOOK(handle_val as *mut core::ffi::c_void));
        }
    }

    log::info!("[Hook] WH_MOUSE_LL 钩子已卸载");
    Ok(())
}

/// WH_MOUSE_LL 回调函数
///
/// 关键约束：
/// - 回调必须轻量，不能超过 300ms（Windows 低级钩子超时限制）
/// - 只做内存坐标比较，零 IO / 零 COM 调用
/// - 读缓存使用 RwLock 的 try_read()，持有时间极短
/// - 使用 panic::catch_unwind 防止回调崩溃
unsafe extern "system" fn mouse_ll_callback(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let msg = wparam.0 as u32;

        // 只处理左键弹起（WM_LBUTTONUP）
        // 使用 BUTTONUP 而非 BUTTONDOWN 的原因：
        // 1. BUTTONUP 更符合用户的"点击"预期
        // 2. 避免误判拖拽操作
        if msg == WM_LBUTTONUP && HOOK_RUNNING.load(Ordering::SeqCst) {
            let mouse_data = *(lparam.0 as *const MSLLHOOKSTRUCT);
            let pt = mouse_data.pt;

            // 检查是否点击在弹出窗口区域内（弹出窗口打开时的点击穿透）
            if is_point_in_popup_window(pt) {
                return CallNextHookEx(None, code, wparam, lparam);
            }

            // 读取缓存（read 锁，持有时间极短）
            let hit = match crate::clock_hook::region_updater::CLOCK_REGIONS.try_read() {
                Ok(cache) => {
                    let result = cache.hit_test(pt).cloned();
                    drop(cache); // 立即释放
                    result
                }
                Err(_) => {
                    // 获取锁失败（更新器正在极速写入），跳过本次检测
                    None
                }
            };

            if let Some(region) = hit {
                log::debug!(
                    "[Hook] 时钟区域点击检测命中: {:?}, monitor_type: {:?}",
                    pt,
                    region.monitor_type
                );

                // 发射 Tauri 事件通知前端，携带区域信息
                if let Some(mutex) = APP_HANDLE.get() {
                    if let Ok(guard) = mutex.lock() {
                        if let Some(app) = guard.as_ref() {
                            let app_clone = app.clone();
                            let region_clone = region;
                            let _ =
                                std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || {
                                    crate::clock_hook::toggle::emit_clock_click(
                                        &app_clone,
                                        &region_clone,
                                    );
                                }));
                        }
                    }
                }

                // 根据设置决定是否拦截系统弹窗
                if BLOCK_POPUP.load(Ordering::SeqCst) {
                    // 返回非零值：吞掉此鼠标事件
                    // 系统不会将此点击传递给 explorer.exe
                    // → Windows 自带的日历/通知弹窗不会出现
                    return LRESULT(1);
                }
            }
        }
    }

    // 所有未拦截的事件都传递给下一个钩子
    CallNextHookEx(None, code, wparam, lparam)
}
