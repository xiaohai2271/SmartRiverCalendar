# 系统托盘集成流程

## 目录
1. [概述](#概述)
2. [托盘功能](#托盘功能)
3. [菜单结构](#菜单结构)
4. [事件处理](#事件处理)
5. [窗口管理](#窗口管理)
6. [状态管理](#状态管理)

## 概述

小河日历使用Tauri的系统托盘功能，提供以下能力：
- 托盘图标显示
- 右键菜单交互
- 窗口显示/隐藏控制
- 系统级功能集成

## 托盘功能

### 核心功能
1. **窗口控制**: 显示/隐藏主窗口
2. **功能快捷方式**: 检查更新、设置等
3. **状态切换**: 始终置顶、自动隐藏
4. **退出应用**: 完全关闭应用

## 菜单结构

### 菜单项定义
```rust
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
let check_update = MenuItemBuilder::new("检查更新")
    .id("check_update")
    .build(app)?;
let quit = MenuItemBuilder::new("退出").id("quit").build(app)?;
```

### 菜单布局
```
├── 显示主窗口
├── ──────────── (分隔符)
├── [✓] 始终置顶
├── [✓] 自动隐藏
├── ──────────── (分隔符)
├── 检查更新
├── ──────────── (分隔符)
└── 退出
```

## 事件处理

### 菜单事件处理
```rust
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
    "check_update" => {
        // 用户点击"检查更新"菜单项
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            let result = updater::check_for_updates(app_handle).await;
            updater::handle_update_result(result).await;
        });
    }
    _ => {}
})
```

### 托盘图标事件
```rust
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
```

## 窗口管理

### 窗口命令
1. **显示窗口**: `show_main_window`
2. **隐藏窗口**: `hide_main_window`
3. **检查可见性**: `is_window_visible`
4. **最小化到托盘**: `minimize_to_tray`

### 窗口事件处理
```rust
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
        _ => {}
    }
})
```

## 状态管理

### 应用状态结构
```rust
#[derive(Default)]
pub struct AppState {
    pub always_on_top: bool,
    pub auto_hide: bool,
}
```

### 状态操作
1. **始终置顶**: `toggle_always_on_top`
2. **自动隐藏**: `toggle_auto_hide`
3. **获取状态**: `get_always_on_top`, `get_auto_hide`

## 相关文件

- 托盘逻辑: `src-tauri/src/lib.rs`
- 窗口命令: `src-tauri/src/commands.rs`
- 应用状态: `src-tauri/src/commands.rs` (AppState)