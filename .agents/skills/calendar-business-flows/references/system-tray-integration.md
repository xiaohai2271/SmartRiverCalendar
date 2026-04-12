# 系统托盘集成流程

## 目录
1. [概述](#概述)
2. [托盘功能](#托盘功能)
3. [菜单结构](#菜单结构)
4. [事件处理](#事件处理)
5. [窗口管理](#窗口管理)
6. [弹出窗口](#弹出窗口)
7. [状态管理](#状态管理)

## 概述

小河日历使用Tauri的系统托盘功能，提供以下能力：
- 托盘图标显示
- 右键菜单交互
- 窗口显示/隐藏控制
- 系统级功能集成
- **精简日历弹出窗口**（点击系统时钟区域唤醒）

## 托盘功能

### 核心功能
1. **窗口控制**: 显示/隐藏主窗口
2. **功能快捷方式**: 检查更新、设置等
3. **状态切换**: 始终置顶、自动隐藏
4. **退出应用**: 完全关闭应用
5. **精简日历**: 点击系统时钟区域显示弹出窗口

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

## 弹出窗口

### 功能概述

精简日历弹出窗口（calendar-popup）是一个轻量级日历界面，通过点击 Windows 系统时钟区域唤醒。主要功能：
- 快速查看日历月份视图
- 显示农历、节假日信息
- 双击日期创建事件
- 右键菜单快捷操作
- 键盘快捷键支持

### 窗口配置

弹出窗口在 `tauri.conf.json` 中定义：
```json
{
  "label": "calendar-popup",
  "title": "精简日历",
  "url": "calendar-popup",
  "width": 320,
  "height": 420,
  "resizable": false,
  "decorations": false,
  "transparent": false,
  "visible": false,
  "focus": true,
  "skipTaskbar": true
}
```

### 权限配置

弹出窗口需要在 `capabilities/default.json` 中配置权限：
```json
{
  "windows": ["main", "calendar-popup"],
  "permissions": [
    "core:window:allow-set-position",
    "positioner:default"
  ]
}
```

**关键权限说明：**
- `core:window:allow-set-position`: 允许设置窗口位置
- `positioner:default`: 允许使用 positioner 插件定位窗口
- `windows` 数组必须包含 `calendar-popup`

### 窗口定位逻辑

弹出窗口定位流程：

1. **优先使用 positioner 插件**（推荐）
   ```typescript
   // 使用 tauri-plugin-positioner 定位
   await moveWindowConstrained(window, Position.TrayBottomRight)
   ```

2. **回退到手动定位**
   ```typescript
   // 根据时钟区域和显示器信息计算位置
   const position = calculatePopupPosition(monitor, clockRect)
   await window.setPosition(new PhysicalPosition(position.x, position.y))
   ```

### 前端组件结构

```
src/
├── views/
│   └── CalendarPopupView.vue      # 弹出窗口主视图
├── components/popup/
│   ├── PopupDateInfo.vue          # 日期信息区域
│   ├── PopupMonthNav.vue          # 月份导航
│   ├── PopupCalendarGrid.vue      # 日历网格
│   ├── PopupYearMonthPicker.vue   # 年月选择器
│   └── PopupContextMenu.vue       # 右键菜单
├── composables/
│   ├── useCalendarPopup.ts        # 弹出窗口控制逻辑
│   └── useWindowToggle.ts         # 窗口切换监听
└── stores/
    └── popupSettings.ts           # 弹出窗口设置
```

### 事件流程

```
用户点击时钟区域
       ↓
WH_MOUSE_LL 钩子捕获
       ↓
Rust 后端发送 ClockArea 事件
       ↓
前端 useWindowToggle 监听事件
       ↓
调用 toggleCalendarPopup()
       ↓
显示/隐藏弹出窗口
```

### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 关闭弹出窗口（或关闭菜单/选择器） |
| `←` / `→` | 选中日期减/加一天 |
| `↑` / `↓` | 选中日期减/加一周 |
| `Enter` | 确认选中日期，跳转主窗口创建事件 |

### 失焦隐藏

弹出窗口支持失焦自动隐藏，但有以下例外：
- 右键菜单打开时不隐藏
- 年月选择器打开时不隐藏

实现方式：
```typescript
// 延迟检查，给菜单关闭事件处理时间
setTimeout(async () => {
  if (!isContextMenuOpen.value) {
    await window.hide()
  }
}, 100)
```

### 常见问题

#### 1. 弹出窗口不显示

**症状**: 点击时钟区域，弹出窗口不出现

**排查步骤**:
1. 检查控制台日志是否有权限错误：
   ```
   window.set_position not allowed. Permissions associated with this command: core:window:allow-set-position
   ```
2. 确认 `capabilities/default.json` 中：
   - `windows` 数组包含 `calendar-popup`
   - 包含 `core:window:allow-set-position` 权限
   - 包含 `positioner:default` 权限
3. 重启 Tauri 开发服务器

#### 2. 弹出窗口位置错误

**症状**: 弹出窗口出现在错误位置

**排查步骤**:
1. 检查显示器检测日志
2. 确认 positioner 插件正确配置
3. 验证时钟区域坐标传递正确

### 相关文件

- 托盘逻辑: `src-tauri/src/lib.rs`
- 窗口命令: `src-tauri/src/commands.rs`
- 应用状态: `src-tauri/src/commands.rs` (AppState)
- 弹出窗口控制: `src/composables/useCalendarPopup.ts`
- 窗口切换监听: `src/composables/useWindowToggle.ts`
- 弹出窗口视图: `src/views/CalendarPopupView.vue`
- 弹出窗口设置: `src/stores/popupSettings.ts`
- 权限配置: `src-tauri/capabilities/default.json`