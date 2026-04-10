# 系统时钟点击唤醒功能

## 概述

点击 Windows 系统时钟区域（任务栏右侧的时间显示区域）可唤出/隐藏小河日历主窗口。

## 功能特性

- **点击唤醒**：点击系统时钟区域切换主窗口显隐
- **多屏支持**：主屏和副屏时钟点击均响应，窗口在主屏显示
- **阻止弹窗**：可选阻止 Windows 原生日历弹窗
- **事件驱动**：统一的事件架构，托盘图标和时钟点击由前端统一调度
- **安全清理**：程序退出后自动清理 Hook，不影响系统功能

## 技术实现

### 三级检测策略

1. **窗口句柄查找**：Win10/Win11 22H2 通过 FindWindow 查找 TrayClockWClass/ClockButton
2. **UI Automation**：Win11 24H2+ 通过 UIAutomation 查找时钟元素
3. **任务栏位置估算**：兜底方案，根据任务栏位置估算时钟区域

### 核心模块

| 模块 | 职责 |
|------|------|
| `clock_hook/mod.rs` | 模块入口 |
| `clock_hook/toggle.rs` | 统一事件发射（ToggleSource、emit_clock_click、emit_tray_click） |
| `clock_hook/hook.rs` | WH_MOUSE_LL 全局鼠标钩子安装/卸载/回调 |
| `clock_hook/region_updater.rs` | 坐标缓存 + 后台更新器线程 |
| `clock_hook/clock_finder.rs` | 三级时钟区域查找 |
| `clock_hook/manager.rs` | ClockHookManager 生命周期管理 |

### 关键设计

- **锁竞争优化**：后台线程无锁查询 → 短暂加锁置换缓存 → 立即释放
- **非阻塞关闭**：disable() 不等待线程退出，避免 UI 卡顿
- **实时通知**：检测方式变化时 emit 事件通知前端刷新显示

## 用户设置

- `clockHookEnabled`：是否启用时钟点击唤醒
- `clockHookBlockPopup`：是否阻止系统日历弹窗

## 涉及文件

- Rust 后端：`src-tauri/src/clock_hook/`
- 前端组件：`src/composables/useWindowToggle.ts`
- 设置页面：`src/views/SettingsView.vue`
- 类型定义：`src/types/index.ts` (AppSettings)

## 相关配置

- Cargo 依赖：`windows` crate、`uiautomation` crate
- Tauri 命令：enable_clock_hook、disable_clock_hook、set_clock_hook_block_popup、get_clock_hook_status、is_clock_hook_available
