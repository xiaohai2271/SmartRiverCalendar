# Design: 精简日历弹出窗口

## Context

### 背景与现状

小河日历已实现系统托盘集成和时钟区域 Hook 功能：

- 用户可通过托盘图标右键菜单操作应用
- 已实现 Hook 系统时钟区域点击的能力
- 点击时钟区域当前行为是唤醒主窗口

相关文档：`system-tray-integration.md`

### 技术约束

1. **Tauri 2.x 窗口管理**：多窗口独立生命周期管理
2. **Windows 平台特性**：失焦事件可能由窗口内部点击触发
3. **跨窗口状态同步**：主窗口与弹出窗口需要共享数据
4. **响应速度要求**：用户期望点击后立即响应（< 200ms）

### 相关决策记录

从 PR #20 开发过程中提取的关键学习：

| 决策 | 原因 |
|------|------|
| 手动定位替代 positioner 插件 | positioner 插件定位不稳定，手动 setPosition 更可控 |
| Pinia Setup Store 模式 | 与 Vue 3 Composition API 风格一致，代码更简洁 |
| BroadcastChannel 跨窗口通信 | 原生 API，无需额外依赖，支持多窗口实时同步 |
| localStorage 键名 popup-settings | 使用 kebab-case 保持一致性 |

---

## Goals / Non-Goals

### Goals

1. **快速响应**：点击系统时钟区域后 200ms 内显示弹出窗口
2. **三段式布局**：日期信息 + 月份导航 + 日历面板
3. **丰富信息展示**：公历、农历、节假日、节气、日程事件
4. **快捷操作入口**：右键菜单提供创建/查看日程和待办的入口
5. **键盘可访问**：完整的键盘快捷键支持
6. **智能行为**：失焦自动隐藏、独立于主窗口
7. **设置可配置**：设置界面提供面板显示选项

### Non-Goals

1. **天气信息显示**：需要天气服务集成，暂不实现（Issue 未要求）
2. **日程编辑功能**：弹出窗口仅提供入口，编辑在主窗口完成
3. **待办管理功能**：弹出窗口仅显示当日截止待办入口，管理在主窗口
4. **移动端适配**：当前仅针对 Windows 桌面平台
5. **多日历切换**：弹出窗口显示默认日历，切换在主窗口完成

---

## Decisions

### 1. 窗口架构设计

**决策**：使用独立的 Tauri 窗口而非 Vue 组件覆盖层

**理由**：
- 独立窗口生命周期与主窗口解耦
- 可独立控制窗口属性（大小、位置、置顶）
- 主窗口可保持隐藏状态
- 符合系统原生时钟行为模式

**架构图**：
```
主窗口 (main)          弹出窗口 (popup)
    |                      |
    +-- Pinia Store <-----+-- 共享 localStorage
    |                      |
    +-- BroadcastChannel <-+-- 实时同步
```

### 2. 窗口定位策略

**决策**：手动定位替代 tauri-plugin-positioner

**理由**：
- positioner 插件在多显示器场景定位不准确
- 主窗口错误定位到任务栏上方的 Bug
- 手动定位更灵活，可精确控制坐标

**实现要点**：
- 获取当前显示器信息
- 计算任务栏高度（通过显示器工作区与全屏区差值）
- 窗口居中定位在任务栏上方

### 3. 状态管理架构

**决策**：使用 Pinia Setup Store + localStorage 持久化 + BroadcastChannel 同步

**理由**：
- Setup Store 与 Vue 3 Composition API 风格一致
- localStorage 提供跨会话持久化
- BroadcastChannel 实现多窗口实时同步

**消息格式**：
```typescript
interface PopupBroadcastMessage {
  type: 'settings-update' | 'event-created' | 'todo-created'
  key?: string
  value?: unknown
  timestamp: number
}
```

### 4. 失焦隐藏策略

**决策**：使用 Tauri onFocusChanged 事件 + 点击时间追踪

**理由**：
- DOM blur 事件在 Windows 平台不准确
- 点击窗口内部可能触发短暂失焦
- 需要区分「真正失焦」和「点击内部」

**实现策略**：
```typescript
// 点击时间追踪
const lastClickInWindow = ref(0)

// 失焦处理
function handleFocusChange(focused: boolean) {
  if (!focused) {
    const timeSinceClick = Date.now() - lastClickInWindow.value
    if (timeSinceClick > 100) {
      // 真正失焦，隐藏窗口
      hideWindow()
    }
  }
}
```

### 5. 窗口尺寸决策

**决策**：固定尺寸 340x480 像素

**理由**：
- 足够显示完整月历和日期信息
- 与 Windows 原生日历弹窗尺寸接近
- 经过实际测试调整（原 320x420 出现滚动条）

---

## Risks / Trade-offs

### 已知风险

| 风险 | 影响 | 缓解措施 | 状态 |
|------|------|----------|------|
| Windows 失焦事件异常 | 点击内部导致窗口隐藏 | 点击时间追踪 + 防抖 | 进行中 |
| 多显示器定位 | 窗口可能显示在错误屏幕 | 获取鼠标所在显示器 | 已解决 |
| 窗口尺寸适配 | 内容溢出出现滚动条 | 压缩内边距 + 调整字体 | 已解决 |

### 技术权衡

| 权衡点 | 选择 | 放弃 | 理由 |
|--------|------|------|------|
| 窗口方案 | 独立 Tauri 窗口 | Vue 覆盖层 | 独立生命周期，更灵活 |
| 定位方案 | 手动定位 | positioner 插件 | 更可控，避免 Bug |
| 状态同步 | BroadcastChannel | Tauri IPC | 前端直接通信，延迟更低 |
| 持久化 | localStorage | SQLite | 设置数据量小，localStorage 足够 |

### 待解决问题

1. **Windows 平台失焦问题**：点击窗口内部元素可能触发失焦，需要进一步优化点击追踪逻辑
2. **天气信息集成**：需要确定天气数据源和 API 集成方案
