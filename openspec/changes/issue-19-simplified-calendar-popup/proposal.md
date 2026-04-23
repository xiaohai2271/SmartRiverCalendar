# Proposal: 系统时钟区域唤醒精简日历窗口

> Issue: #19 | PR: #20 | Status: In Progress (85%)

## Why

### 问题背景

当前用户点击系统时钟区域时，应用会唤醒完整的程序主界面。这种方式存在以下问题：

1. **响应延迟感强**：主界面加载复杂，涉及多个组件初始化，用户感知延迟明显
2. **信息密度不匹配**：用户只是想快速查看日期，却需要等待完整界面加载
3. **交互路径冗长**：查看今日日程需要多次点击和导航
4. **系统资源占用**：每次查看都启动完整界面，增加内存和 CPU 开销

### 机会

Windows 系统原生时钟点击行为已被用户习惯（显示日历小窗口）。提供类似的轻量级弹出窗口可以：

- 缩短信息获取路径，提升用户体验
- 与系统行为一致，降低学习成本
- 作为应用的快速入口，增强用户粘性

### 为什么现在做

1. **基础设施已就绪**：系统托盘集成和时钟 Hook 功能已实现（参见 `system-tray-integration.md`）
2. **用户反馈明确**：Issue #19 明确提出了精简窗口的需求
3. **技术验证完成**：PR #20 已完成核心功能实现，验证了技术可行性

---

## What Changes

### 新增功能

#### 1. 精简日历弹出窗口

独立的轻量级窗口，点击系统时钟区域时显示，包含三个核心区域：

| 区域 | 内容 |
|------|------|
| 日期信息区 | 当前时间、公历日期、农历日期、节假日/节气标识 |
| 月份导航区 | 上/下月切换、年月快速选择器 |
| 日历面板区 | 月历网格、农历/节假日显示、日程事件标记 |

#### 2. 右键菜单快捷操作

日历面板右键菜单提供以下功能：

- **创建日程** → 跳转主界面日程创建页
- **查看日程** → 跳转主界面日程详情
- **创建待办** → 跳转主界面待办创建页
- **查看待办** → 显示当日截止的待办列表

#### 3. 键盘快捷键支持

| 快捷键 | 功能 |
|--------|------|
| `Escape` | 关闭弹出窗口 |
| `←` / `→` | 上/下月切换 |
| `Enter` | 选择当前日期 |
| `↑` / `↓` | 日期导航 |

#### 4. 窗口行为控制

- **失焦自动隐藏**：窗口失去焦点时自动关闭
- **独立生命周期**：精简窗口与主窗口独立管理
- **智能定位**：紧贴任务栏上方显示

#### 5. 设置界面配置项

主界面设置中新增「精简日历面板」配置区域，控制：

- 是否显示农历
- 是否显示节假日/节气
- 是否显示日程事件标记
- 首日设置（周一/周日）

### 修改功能

#### 系统托盘集成

- Hook 系统时钟功能新增弹出窗口触发逻辑
- 区分「点击时钟区域」和「点击托盘图标」的行为

#### 类型定义扩展

`src/types/index.ts` 新增：

```typescript
// 弹出窗口设置
interface PopupSettings {
  showLunar: boolean      // 显示农历
  showHoliday: boolean    // 显示节假日/节气
  showEvents: boolean     // 显示日程标记
  firstDayOfWeek: 0 | 1   // 周日/周一为首日
}

// 弹出窗口状态
interface PopupWindowState {
  visible: boolean
  position: { x: number; y: number }
  selectedDate: Date
}

// 跨窗口消息类型
type PopupBroadcastMessage = {
  type: 'settings-update' | 'event-created' | 'todo-created'
  payload: unknown
  timestamp: number
}
```

---

## Capabilities

### New Capabilities

| 能力 | 描述 |
|------|------|
| 快速日历查看 | 用户点击系统时钟区域，200ms 内显示精简日历窗口 |
| 跨窗口通信 | 弹出窗口与主窗口通过 BroadcastChannel 同步状态 |
| 智能窗口定位 | 弹出窗口自动定位到任务栏上方，适配多显示器 |
| 上下文菜单操作 | 右键日期提供快捷操作入口 |
| 键盘导航 | 完整的键盘操作支持 |

### Modified Capabilities

| 能力 | 变更 |
|------|------|
| 系统时钟 Hook | 从「唤醒主界面」改为「显示/隐藏精简窗口」 |
| 设置持久化 | 新增 `popup-settings` localStorage 键 |

---

## Impact

### 代码影响

| 目录/文件 | 变更类型 | 说明 |
|-----------|----------|------|
| `src/components/popup/` | 新增 | 6 个弹出窗口组件 |
| `src/composables/useCalendarPopup.ts` | 新增 | 窗口控制逻辑 |
| `src/stores/popupSettings.ts` | 新增 | 设置状态管理 |
| `src/views/CalendarPopupView.vue` | 新增 | 弹出窗口页面 |
| `src/utils/broadcast.ts` | 新增 | 跨窗口通信工具 |
| `src/types/index.ts` | 修改 | 新增类型定义 |
| `src/views/SettingsView.vue` | 修改 | 新增配置项 |
| `src/router/index.ts` | 修改 | 新增弹出窗口路由 |
| `src-tauri/src/lib.rs` | 修改 | 时钟 Hook 触发逻辑 |
| `src-tauri/tauri.conf.json` | 修改 | 新增窗口配置 |
| `src-tauri/capabilities/default.json` | 修改 | 新增窗口权限 |

### API 影响

| API | 类型 | 说明 |
|-----|------|------|
| `show_popup_window` | Rust Command | 显示弹出窗口 |
| `hide_popup_window` | Rust Command | 隐藏弹出窗口 |
| `set_popup_position` | Rust Command | 设置窗口位置 |
| `popup-settings` | localStorage Key | 设置持久化键名 |

### 依赖影响

| 依赖 | 版本 | 用途 |
|------|------|------|
| tauri-plugin-positioner | 移除 | 使用手动定位替代 |
| BroadcastChannel API | 原生 | 跨窗口通信 |

### 测试影响

新增 6 个测试文件：

- `popupSettings.test.ts` - 设置 Store 测试
- `useCalendarPopup.test.ts` - 窗口控制逻辑测试
- `popup-positioning.test.ts` - 窗口定位测试
- `popup-keyboard.test.ts` - 键盘快捷键测试
- `popup-debounce.test.ts` - 防抖逻辑测试
- `router-popup.test.ts` - 路由测试
