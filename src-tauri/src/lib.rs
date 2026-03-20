#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::Manager;

mod commands;

pub fn run() {
    env_logger::init();

    let app_state = Mutex::new(commands::AppState::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(app_state)
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder};
                use tauri::tray::TrayIconBuilder;

                // 创建菜单项
                let show = MenuItemBuilder::new("显示主窗口").id("show").build(app)?;
                let always_on_top = CheckMenuItemBuilder::new("始终置顶")
                    .id("always_on_top")
                    .checked(false)
                    .build(app)?;
                let auto_hide = CheckMenuItemBuilder::new("自动隐藏")
                    .id("auto_hide")
                    .checked(false)
                    .build(app)?;
                let quit = MenuItemBuilder::new("退出").id("quit").build(app)?;

                // 构建菜单
                let menu = MenuBuilder::new(app)
                    .item(&show)
                    .separator()
                    .item(&always_on_top)
                    .item(&auto_hide)
                    .separator()
                    .item(&quit)
                    .build()?;

                // 创建托盘图标
                let _tray = TrayIconBuilder::new()
                    .menu(&menu)
                    .tooltip("小河日历")
                    .icon(app.default_window_icon().unwrap().clone())
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
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
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| match event {
                        tauri::tray::TrayIconEvent::Click {
                            button,
                            button_state,
                            ..
                        } => {
                            if button == tauri::tray::MouseButton::Left
                                && button_state == tauri::tray::MouseButtonState::Up
                            {
                                let app = tray.app_handle();
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
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::Focused(focused) => {
                    // 当窗口失去焦点且启用了自动隐藏时，隐藏窗口
                    if !focused {
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
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // 拦截关闭请求，改为隐藏到托盘
                    let _ = window.hide();
                    api.prevent_close();
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
