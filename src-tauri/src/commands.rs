use serde::Serialize;
use std::sync::Mutex;
use tauri::State;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
}

#[derive(Default)]
pub struct AppState {
    pub always_on_top: bool,
    pub auto_hide: bool,
}

#[tauri::command]
pub fn get_app_info() -> AppInfo {
    AppInfo {
        name: "小河日历".to_string(),
        version: "0.1.0".to_string(),
    }
}

#[tauri::command]
pub fn minimize_to_tray(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
pub fn toggle_always_on_top(
    window: tauri::WebviewWindow,
    state: State<'_, Mutex<AppState>>,
) -> bool {
    let mut app_state = state.lock().unwrap();
    app_state.always_on_top = !app_state.always_on_top;
    let _ = window.set_always_on_top(app_state.always_on_top);
    app_state.always_on_top
}

#[tauri::command]
pub fn get_always_on_top(state: State<'_, Mutex<AppState>>) -> bool {
    let app_state = state.lock().unwrap();
    app_state.always_on_top
}

#[tauri::command]
pub fn toggle_auto_hide(state: State<'_, Mutex<AppState>>) -> bool {
    let mut app_state = state.lock().unwrap();
    app_state.auto_hide = !app_state.auto_hide;
    app_state.auto_hide
}

#[tauri::command]
pub fn get_auto_hide(state: State<'_, Mutex<AppState>>) -> bool {
    let app_state = state.lock().unwrap();
    app_state.auto_hide
}

#[tauri::command]
pub fn show_main_window(window: tauri::Window) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn hide_main_window(window: tauri::Window) {
    let _ = window.hide();
}

#[tauri::command]
pub fn is_window_visible(window: tauri::Window) -> bool {
    window.is_visible().unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_app_info() {
        let info = get_app_info();
        assert_eq!(info.name, "小河日历");
        assert_eq!(info.version, "0.1.0");
    }

    #[test]
    fn test_app_info_serialization() {
        let info = AppInfo {
            name: "测试应用".to_string(),
            version: "1.0.0".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("测试应用"));
        assert!(json.contains("1.0.0"));
    }

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        assert!(!state.always_on_top);
        assert!(!state.auto_hide);
    }
}
