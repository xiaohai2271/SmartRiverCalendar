# 右键菜单功能实现

## Why

### 问题背景

小河日历应用作为桌面端应用，其右键菜单行为需要符合桌面应用的交互规范。当前存在以下问题：

1. **默认菜单不符合应用定位**：所有页面显示的是浏览器默认右键菜单（刷新、检查元素、另存为等），与日历应用的功能完全无关
2. **用户操作效率低下**：用户想要编辑、删除、查看详情等操作时，需要额外的按钮或繁琐的导航路径
3. **交互一致性缺失**：不同页面的数据项（待办、日程）没有统一的交互模式

### 业务价值

- **提升用户体验**：提供符合桌面应用规范的右键菜单交互
- **提高操作效率**：减少操作步骤，常用功能一键触达
- **增强应用专业感**：让应用行为更接近原生桌面应用

---

## What Changes

### 核心变更

#### 1. 全局禁用默认右键菜单

在 `App.vue` 中全局拦截右键菜单事件，禁用浏览器默认菜单，同时保留输入框的原生功能（复制/粘贴）。

#### 2. 创建可复用的右键菜单组件

| 组件 | 用途 | 关键特性 |
|------|------|----------|
| `ContextMenu.vue` | 右键菜单容器 | 定位计算、溢出处理、点击外部关闭 |
| `ConfirmPopover.vue` | 气泡确认 | 删除二次确认、支持异步操作 |
| `TodoDetailModal.vue` | 待办详情弹窗 | 展示待办完整信息 |
| `EventDetailModal.vue` | 日程详情弹窗 | 展示日程完整信息 |

#### 3. 视图层集成

| 页面 | 数据项 | 菜单项 |
|------|--------|--------|
| HomeView | 待办项 | 编辑、删除(二次确认)、完成、详情 |
| HomeView | 日程项 | 编辑、删除(二次确认)、详情 |
| TodosView | 待办项 | 编辑、删除(二次确认)、完成、详情 |
| ScheduleView | 日程项 | 编辑、删除(二次确认)、详情 |

### 文件变更清单

**新增文件 (10个)**：
```
src/components/common/ContextMenu.vue
src/components/common/ConfirmPopover.vue
src/components/common/TodoDetailModal.vue
src/components/common/EventDetailModal.vue
src/components/common/__tests__/ContextMenu.test.ts
src/components/common/__tests__/ConfirmPopover.test.ts
src/components/common/__tests__/TodoDetailModal.test.ts
src/components/common/__tests__/EventDetailModal.test.ts
src-tauri/src/db/ (数据库模块)
src-tauri/src/commands.rs (Tauri 命令)
```

**修改文件 (12个)**：
```
src/App.vue - 全局禁用默认右键菜单
src/views/HomeView.vue - 首页右键菜单集成
src/views/TodosView.vue - 待办页面右键菜单集成
src/views/ScheduleView.vue - 日程页面右键菜单集成
src/stores/calendar.ts - Store 重构
src/stores/todo.ts - Store 重构
src/utils/tauri.ts - Tauri 工具函数
src/utils/database.ts - 已删除（前端不再直接操作数据库）
tsconfig.app.json - 路径别名配置
src-tauri/src/lib.rs - 注册命令
src-tauri/Cargo.toml - 依赖更新
.agents/skills/ - 业务文档更新
```

---

## Capabilities

### 新增能力

#### 1. 统一的右键菜单交互

用户可以在任意数据项上右键调用相关操作：
- **编辑**：打开编辑界面修改数据
- **删除**：气泡确认后删除数据
- **完成**：标记待办为已完成（仅待办项）
- **详情**：弹窗展示完整信息

#### 2. 桌面级交互体验

- 菜单定位自动避让屏幕边界
- 点击菜单外部自动关闭
- 滚动锁定防止页面滚动
- 多页面切换时状态正确处理（引用计数机制）

#### 3. 数据层迁移

作为此次变更的伴生工作，完成了前端数据层到 Rust 后端的迁移：
- 前端通过 `invoke` 调用 Rust 后端
- Rust 后端操作 SQLite 数据库
- ID 策略从字符串 UUID 改为自增整数

### 技术亮点

1. **引用计数溢出处理**：解决多页面 ContextMenu 实例导致的 `overflow: hidden` 状态混乱问题
2. **Teleport 渲染**：详情弹窗使用 Vue Teleport 渲染到 body，避免布局问题
3. **全量单元测试**：171 个测试用例覆盖所有新增功能

---

## Impact

### 用户影响

| 用户群体 | 影响 |
|----------|------|
| 所有用户 | 右键菜单行为改变，需适应新的交互方式 |
| 待办用户 | 可通过右键菜单快速完成待办 |
| 日程用户 | 可通过右键菜单查看详情、编辑、删除 |

### 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 用户习惯改变 | 低 | 右键菜单是桌面应用标准交互，用户易于接受 |
| 删除误操作 | 中 | 删除操作使用气泡确认二次确认 |
| 页面白屏 | 已修复 | 通过引用计数机制解决 |

### 测试覆盖

- **单元测试**：171/171 通过
- **构建状态**：成功
- **覆盖组件**：ContextMenu、ConfirmPopover、TodoDetailModal、EventDetailModal

### 后续优化建议

1. **键盘导航支持**：当前右键菜单不支持键盘操作
2. **子菜单支持**：未来可能需要分组菜单项
3. **自定义主题**：菜单样式可根据主题定制
