# Tasks: 精简日历弹出窗口

> 进度: 85% | PR: #20 | 最后更新: 2026-04-19

## 1. 核心窗口架构

- [x] 1.1 创建弹出窗口路由配置 `src/router/index.ts`
- [x] 1.2 创建弹出窗口页面视图 `src/views/CalendarPopupView.vue`
- [x] 1.3 实现窗口控制 composable `src/composables/useCalendarPopup.ts`
- [x] 1.4 配置 Tauri 窗口权限 `src-tauri/capabilities/default.json`
- [x] 1.5 更新 Tauri 窗口配置 `src-tauri/tauri.conf.json`

**涉及文件**: router, views, composables, capabilities, tauri.conf.json
**测试文件**: `router-popup.test.ts`, `useCalendarPopup.test.ts`

---

## 2. UI 组件实现

- [x] 2.1 创建日期信息组件 `src/components/popup/PopupDateInfo.vue`
  - 显示当前时间、公历、农历、节假日、节气
- [x] 2.2 创建月份导航组件 `src/components/popup/PopupMonthNav.vue`
  - 上/下月切换按钮
- [x] 2.3 创建年月快速选择器 `src/components/popup/PopupYearMonthPicker.vue`
  - 年份月份下拉选择
- [x] 2.4 创建日历网格组件 `src/components/popup/PopupCalendarGrid.vue`
  - 月历显示、农历、节假日、日程标记
- [x] 2.5 创建右键菜单组件 `src/components/popup/PopupContextMenu.vue`
  - 创建日程、查看日程、创建待办、查看待办
- [x] 2.6 创建样式文件 `src/styles/popup.scss`, `src/styles/popup.css`

**涉及文件**: src/components/popup/*, src/styles/popup.*
**测试覆盖**: 组件渲染、事件交互、键盘导航

---

## 3. 状态管理

- [x] 3.1 创建弹出窗口设置 Store `src/stores/popupSettings.ts`
  - 显示农历、节假日、日程事件、首日设置
- [x] 3.2 扩展类型定义 `src/types/index.ts`
  - PopupSettings, PopupWindowState, PopupBroadcastMessage
- [x] 3.3 创建跨窗口广播工具 `src/utils/broadcast.ts`
  - BroadcastChannel 封装、消息订阅/发布

**涉及文件**: stores/popupSettings.ts, types/index.ts, utils/broadcast.ts
**测试文件**: `popupSettings.test.ts`

---

## 4. 系统集成

- [x] 4.1 更新时钟 Hook 触发逻辑 `src-tauri/src/clock_hook/hook.rs`
  - 区分时钟区域点击和托盘图标点击
- [x] 4.2 实现弹出窗口 Rust 命令 `src-tauri/src/commands.rs`
  - show_popup_window, hide_popup_window, set_popup_position
- [x] 4.3 更新应用初始化逻辑 `src-tauri/src/lib.rs`
  - 弹出窗口创建、事件监听
- [x] 4.4 更新系统托盘文档 `.agents/skills/calendar-business-flows/references/system-tray-integration.md`

**涉及文件**: clock_hook/*.rs, commands.rs, lib.rs, 文档

---

## 5. 窗口定位优化

- [x] 5.1 移除 positioner 插件依赖
- [x] 5.2 实现手动窗口定位逻辑
  - 获取显示器信息、计算任务栏高度、居中定位
- [x] 5.3 修复多显示器场景定位问题
- [x] 5.4 调整窗口尺寸从 320x420 到 340x480

**涉及文件**: useCalendarPopup.ts, tauri.conf.json
**测试文件**: `popup-positioning.test.ts`

---

## 6. 用户交互

- [x] 6.1 实现键盘快捷键支持
  - Escape 关闭、方向键导航、Enter 选择
- [x] 6.2 实现失焦自动隐藏
- [x] 6.3 实现双击日期创建事件
- [x] 6.4 实现右键菜单快捷操作
- [x] 6.5 实现点击日程事件跳转主界面

**涉及文件**: CalendarPopupView.vue, PopupCalendarGrid.vue
**测试文件**: `popup-keyboard.test.ts`, `popup-debounce.test.ts`

---

## 7. 设置界面集成

- [x] 7.1 创建设置组件 `src/views/SettingsView.vue` 新增配置区域
- [x] 7.2 实现设置项持久化
  - localStorage 存储 popup-settings
- [ ] 7.3 完善设置项 UI 交互
  - 复选框、下拉选择器样式优化

**涉及文件**: SettingsView.vue, popupSettings.ts

---

## 8. 问题修复

- [x] 8.1 修复弹出窗口定位问题
  - 原问题：窗口显示在左上角，主窗口错误定位
  - 解决：移除 positioner，统一使用手动定位
- [x] 8.2 修复日历面板滚动条问题
  - 原问题：精简窗口内日历面板出现垂直滚动条
  - 解决：增加窗口尺寸、压缩组件内边距和字体
- [ ] 8.3 修复点击窗口内部自动隐藏问题
  - 原问题：点击精简窗口内任意区域导致窗口自动隐藏
  - 分析：Windows 平台点击窗口内部元素触发短暂失焦事件
  - 进行中：优化点击时间追踪逻辑

---

## 9. 测试与验证

- [x] 9.1 创建 popupSettings Store 测试
- [x] 9.2 创建窗口定位测试
- [x] 9.3 创建键盘快捷键测试
- [x] 9.4 创建防抖逻辑测试
- [x] 9.5 创建路由测试
- [x] 9.6 运行完整测试套件 (171/171 通过)
- [x] 9.7 生成覆盖率报告 (47.32%)

**测试文件**: src/__tests__/popup*.test.ts

---

## 10. 文档更新

- [x] 10.1 更新系统托盘集成文档
- [x] 10.2 更新 AGENTS.md 技术栈说明
- [ ] 10.3 创建用户使用指南
- [ ] 10.4 更新 README 功能特性说明

---

## 阻塞项

| 阻塞原因 | 影响 | 需要操作 |
|----------|------|----------|
| Windows 失焦问题未完全解决 | 用户体验受影响 | 需进一步调试点击追踪机制 |
| 天气数据源未确定 | 功能不完整 | 需评估第三方天气 API |

---

## 下一步行动

1. 优先解决 Windows 平台失焦问题 (#8.3)
2. 完善设置界面 UI 交互 (#7.3)
3. 考虑天气 API 集成方案
4. 完成用户文档更新 (#10.3, #10.4)