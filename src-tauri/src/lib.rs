#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager};

mod commands;
mod crypto;
pub mod ews;
pub mod caldav;
pub mod db;
mod sync;
mod updater;
mod log_buffer;

#[cfg(target_os = "windows")]
mod clock_hook;

use db::connection::DatabaseConnection;
use db::schema::create_tables;

/// 初始化数据库连接
fn init_database() -> Result<Mutex<DatabaseConnection>, Box<dyn std::error::Error>> {
    // 获取应用数据目录
    let app_data_dir = dirs::data_local_dir()
        .or_else(|| dirs::data_dir())
        .ok_or("无法确定应用数据目录")?;
    
    let db_dir = app_data_dir.join("SmartRiverCalendar");
    
    // 创建目录（如果不存在）
    std::fs::create_dir_all(&db_dir)?;
    
    let db_path = db_dir.join("calendar.db");
    let db_path_str = db_path.to_string_lossy().to_string();
    
    log::info!("数据库路径: {}", db_path_str);
    
    // 连接数据库
    let db = DatabaseConnection::connect(&db_path_str)?;
    
    // 创建表结构
    db.execute(|conn| create_tables(conn).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        )))
    }))?;
    
    log::info!("数据库初始化完成");
    
    Ok(Mutex::new(db))
}

pub fn run() {
    // 初始化日志系统（同时输出到控制台和缓冲区）
    log_buffer::init_logger();
    log::info!("日志系统初始化完成");

    // 初始化数据库
    let db = match init_database() {
        Ok(db) => db,
        Err(e) => {
            log::error!("数据库初始化失败: {}", e);
            std::process::exit(1);
        }
    };

    let app_state = Mutex::new(commands::AppState::default());

    // 时钟点击检测管理器（仅 Windows）
    #[cfg(target_os = "windows")]
    let clock_hook_manager = Mutex::new(clock_hook::ClockHookManager::new());

    let mut app_builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .manage(db);

    // 注册时钟点击检测管理器（仅 Windows）
    #[cfg(target_os = "windows")]
    {
        app_builder = app_builder.manage(clock_hook_manager);
    }

    // 仅在调试模式下启用 MCP Bridge 插件
    #[cfg(debug_assertions)]
    {
        app_builder = app_builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    app_builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
                use tauri::tray::TrayIconBuilder;

                // 创建菜单项
                let show = MenuItemBuilder::new("显示主窗口").id("show").build(app)?;
                let show_popup = CheckMenuItemBuilder::new("日历面板")
                    .id("show_popup")
                    .checked(false)
                    .build(app)?;
                let always_on_top = CheckMenuItemBuilder::new("始终置顶")
                    .id("always_on_top")
                    .checked(false)
                    .build(app)?;
                let auto_hide = CheckMenuItemBuilder::new("自动隐藏")
                    .id("auto_hide")
                    .checked(false)
                    .build(app)?;
                let settings = MenuItemBuilder::new("系统设置")
                    .id("settings")
                    .build(app)?;
                let check_update = MenuItemBuilder::new("检查更新")
                    .id("check_update")
                    .build(app)?;
                let quit = MenuItemBuilder::new("退出").id("quit").build(app)?;

                // 构建菜单
                let menu = MenuBuilder::new(app)
                    .item(&show)
                    .item(&show_popup)
                    .separator()
                    .item(&always_on_top)
                    .item(&auto_hide)
                    .separator()
                    .item(&settings)
                    .item(&check_update)
                    .separator()
                    .item(&quit)
                    .build()?;

                // 创建托盘图标
                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .tooltip("小河日历")
                    .icon(app.default_window_icon().unwrap().clone())
                    .on_menu_event(|app: &tauri::AppHandle, event| match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "show_popup" => {
                            // 用户点击「日历面板」菜单项
                            // 通过事件驱动让前端统一调度精简窗口的显隐
                            // 这样可以与时钟区域 Hook 的唤醒机制不冲突
                            #[cfg(target_os = "windows")]
                            {
                                clock_hook::toggle::emit_popup_toggle(app);
                            }
                            #[cfg(not(target_os = "windows"))]
                            {
                                // 非 Windows 平台：直接操作窗口并更新菜单状态
                                if let Some(popup) = app.get_webview_window("calendar-popup") {
                                    let visible = popup.is_visible().unwrap_or(false);
                                    if visible {
                                        let _ = popup.hide();
                                    } else {
                                        let _ = popup.show();
                                        let _ = popup.set_focus();
                                    }
                                    // 更新菜单项 checked 状态
                                    let _ = show_popup.set_checked(app, !visible);
                                }
                            }
                        }
                        "always_on_top" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let state = app.state::<Mutex<commands::AppState>>();
                                let is_on_top = commands::toggle_always_on_top(window, state);
                                println!("始终置顶: {}", is_on_top);
                            }
                        }
                        "auto_hide" => {
                            let state = app.state::<Mutex<commands::AppState>>();
                            let is_auto_hide = commands::toggle_auto_hide(state);
                            println!("自动隐藏: {}", is_auto_hide);
                        }
                        "settings" => {
                            // 显示主窗口并导航到设置页面
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            // 发射事件到前端，由前端控制导航
                            let _ = app.emit("navigate-to-settings", ());
                        }
                        "check_update" => {
                            // 用户点击"检查更新"菜单项
                            // 先恢复主窗口（如果被隐藏），然后发射事件到前端处理
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            // 发射事件到前端，由前端控制更新弹窗流程
                            let _ = app.emit("check-update", ());
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                        // 让 positioner 插件处理托盘事件
                        tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                        match &event {
                        tauri::tray::TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } => {
                            if *button == tauri::tray::MouseButton::Left
                                && *button_state == tauri::tray::MouseButtonState::Up
                            {
                                let app = tray.app_handle();
                                // Windows 平台：通过事件驱动，前端统一调度
                                #[cfg(target_os = "windows")]
                                {
                                    clock_hook::toggle::emit_tray_click(app);
                                }
                                // 非 Windows 平台：保持原有直接操作窗口逻辑
                                #[cfg(not(target_os = "windows"))]
                                {
                                    if let Some(window) = app.get_webview_window("main") {
                                        if window.is_visible().unwrap_or(false) {
                                            let _ = window.hide();
                                        } else {
                                            let _ = window.show();
                                            let _ = window.set_focus();
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                        }
                    })
                    .build(app)?;

                // 监听前端发送的 popup-visibility-changed 事件
                // 更新菜单项的 checked 状态
                let popup_menu_item = show_popup.clone();
                app.listen("popup-visibility-changed", move |event: tauri::Event| {
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                        if let Some(visible) = payload.get("visible").and_then(|v| v.as_bool()) {
                            let _ = popup_menu_item.set_checked(visible);
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label();
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if label == "calendar-popup" {
                        // calendar-popup 窗口：阻止关闭，改为隐藏
                        api.prevent_close();
                        let _ = window.hide();
                        // 通知前端更新菜单状态
                        let app = window.app_handle();
                        let _ = app.emit("popup-hidden", ());
                    } else {
                        // main 窗口：程序退出时确保清理 Hook（仅 Windows）
                        #[cfg(target_os = "windows")]
                        {
                            use crate::clock_hook::ClockHookManager;
                            let state = window.app_handle().state::<Mutex<ClockHookManager>>();
                            if let Ok(mut manager) = state.lock() {
                                let _ = manager.disable();
                            };
                        }
                    }
                }
                tauri::WindowEvent::Focused(focused) => {
                    // main 窗口：当窗口失去焦点且启用了自动隐藏时，隐藏窗口
                    // calendar-popup 窗口的失焦隐藏由前端控制
                    if !focused && label == "main" {
                        let app = window.app_handle();
                        let state = app.state::<Mutex<commands::AppState>>();
                        let auto_hide = {
                            let app_state = state.lock().unwrap();
                            app_state.auto_hide
                        };
                        if auto_hide {
                            let _ = window.hide();
                        }
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::minimize_to_tray,
            commands::toggle_always_on_top,
            commands::get_always_on_top,
            commands::toggle_auto_hide,
            commands::get_auto_hide,
            commands::show_main_window,
            commands::hide_main_window,
            commands::is_window_visible,
            commands::connect_exchange,
            commands::connect_caldav,
            commands::get_all_accounts,
            commands::delete_account,
            commands::get_external_calendars,
            commands::sync_now,
            commands::sync_all,
            commands::get_sync_status,
            commands::set_sync_interval,
            commands::create_external_event,
            commands::get_external_events,
            commands::update_external_event,
            commands::delete_external_event,
            // 时钟点击检测命令
            commands::enable_clock_hook,
            commands::disable_clock_hook,
            commands::set_clock_hook_block_popup,
            commands::get_clock_hook_status,
            commands::is_clock_hook_available,
            commands::set_popup_window_rect,
            // 本地日历命令
            commands::get_calendars,
            commands::create_calendar,
            commands::update_calendar,
            commands::delete_calendar,
            // 本地事件命令
            commands::get_events,
            commands::get_events_by_calendar,
            commands::get_events_by_time_range,
            commands::create_event,
            commands::update_event,
            commands::delete_event,
            // 本地待办命令
            commands::get_todos,
            commands::get_todos_by_calendar,
            commands::create_todo,
            commands::update_todo,
            commands::delete_todo,
            // 本地账号命令
            commands::get_all_db_accounts,
            commands::get_account_by_id,
            commands::create_account,
            commands::update_account,
            commands::delete_db_account,
            // 同步状态命令
            commands::get_sync_state,
            commands::upsert_sync_state,
            commands::delete_sync_state,
            // 调试命令
            commands::debug_get_table_schema,
            commands::debug_get_table_data,
            commands::debug_open_devtools,
            commands::debug_get_logs,
            commands::debug_clear_logs,
            // 应用设置命令
            commands::get_setting,
            commands::set_setting,
            commands::get_all_settings,
            commands::get_proxy_config,
            commands::test_proxy_connection,
            commands::get_setting_entry,
            commands::get_all_setting_entries,
            // 用户节假日命令
            commands::add_user_holiday,
            commands::remove_user_holiday,
            commands::get_all_user_holidays,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
