use serde::Serialize;

#[derive(Serialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
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