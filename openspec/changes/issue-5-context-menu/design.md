# 右键菜单功能设计文档

## Context

### 系统架构

```
前端 (Vue 3)
├── Views
│   ├── HomeView.vue
│   ├── TodosView.vue
│   └── ScheduleView.vue
│       │
│       └── ContextMenu.vue (右键触发)
│           ├── ConfirmPopover.vue (删除确认)
│           └── DetailModal.vue (详情展示)
│
└── invoke 调用
    ↓
后端 (Rust/Tauri)
├── commands.rs
├── db/repositories
└── SQLite
```

### 现有约束

1. Vue 3 Composition API：所有组件使用 `<script setup>` 语法
2. Fluent Design：UI 需遵循 Microsoft Fluent Design 规范
3. 单元测试覆盖：核心功能需有测试用例
4. 中文注释：代码注释必须使用中文

---

## Goals

### 主要目标

1. 禁用浏览器默认右键菜单：全局拦截 contextmenu 事件
2. 实现功能右键菜单：根据数据类型展示对应操作项
3. 提供删除二次确认：防止误删除操作
4. 展示数据详情：弹窗形式展示完整信息

### 非目标 (Non-Goals)

1. 日程完成功能：日程数据模型无完成状态，不提供此功能
2. 键盘导航：当前版本不支持键盘操作菜单
3. 子菜单：不支持嵌套菜单结构
4. 自定义菜单项：菜单项固定，不支持运行时动态配置

---

## Decisions

### 决策 1: 右键菜单定位策略

问题：右键菜单需要正确处理屏幕边界溢出

方案：
- 计算点击位置与视口边界的距离
- 菜单宽度向右溢出时，向左定位
- 菜单高度向下溢出时，向上定位
- 使用 getBoundingClientRect() 获取准确尺寸

代码实现：
```typescript
const position = computed(() => {
  const menuWidth = 160
  const menuHeight = items.length * 36
  const x = props.x + menuWidth > window.innerWidth 
    ? props.x - menuWidth : props.x
  const y = props.y + menuHeight > window.innerHeight 
    ? props.y - menuHeight : props.y
  return { x, y }
})
```

### 决策 2: 删除确认方式

问题：删除操作需要二次确认，选择何种交互方式？

选项对比：
- 模态对话框：明确、强制，但阻断操作流程
- 气泡确认：轻量、不阻断，但确认按钮较小

决策：选择气泡确认 (ConfirmPopover)

理由：
1. 符合 Fluent Design 设计语言
2. 不打断用户操作流程
3. 删除是危险操作，但仍需轻量体验
4. 气泡确认位置紧贴触发元素，操作路径短

### 决策 3: 详情展示方式

问题：详情信息如何展示？

选项对比：
- 右侧抽屉：展示空间大，但布局复杂
- 模态弹窗：简单、聚焦，但空间有限

决策：选择模态弹窗 (Modal)

理由：
1. 详情查看是临时性操作，弹窗更合适
2. 用户查看后需要关闭继续操作
3. 实现简单，测试覆盖容易
4. 使用 Vue Teleport 渲染到 body，避免 z-index 问题

### 决策 4: 多页面滚动锁定

问题：多个页面各有 ContextMenu 实例，页面切换时 overflow:hidden 状态混乱导致白屏

方案：使用引用计数器管理滚动锁定

实现：
```typescript
const overflowLockCount = ref(0)

function lockOverflow() {
  overflowLockCount.value++
  if (overflowLockCount.value === 1) {
    document.body.style.overflow = 'hidden'
  }
}

function unlockOverflow() {
  overflowLockCount.value--
  if (overflowLockCount.value === 0) {
    document.body.style.overflow = ''
  }
}

watch(() => props.visible, (newVal, oldVal) => {
  if (newVal && !oldVal) lockOverflow()
  if (!newVal && oldVal) unlockOverflow()
})

onUnmounted(() => {
  if (props.visible) unlockOverflow()
})
```

### 决策 5: 数据层迁移

问题：此 PR 同时包含数据层迁移到 Rust 后端

原因：
1. 原计划为独立 PR，但存在依赖冲突
2. 避免在旧架构上开发新功能
3. 统一数据流：前端 -> invoke -> Rust -> SQLite

变更：
- 删除 src/utils/database.ts
- 新增 src-tauri/src/db/ 数据库模块
- 新增 src-tauri/src/commands.rs Tauri 命令
- 重构 src/stores/calendar.ts 和 src/stores/todo.ts

---

## Risks

### 已解决风险

| 风险 | 触发原因 | 解决方案 |
|------|----------|----------|
| 页面白屏 | overflow:hidden 状态混乱 | 引用计数器机制 |
| 页面切换白屏 | 多根元素与 transition 冲突 | 移入容器，组件使用 Teleport |
| 删除无确认 | ScheduleView 按钮删除 | 添加 ConfirmPopover |

### 待观察风险

| 风险 | 等级 | 监控措施 |
|------|------|----------|
| 用户习惯改变 | 低 | 右键菜单是桌面应用标准交互 |
| 输入框功能保留 | 低 | App.vue 特殊处理输入框 contextmenu |

### 技术债务

1. 键盘导航支持：未来版本考虑
2. 子菜单支持：如有需求再扩展
3. 菜单样式定制：跟随主题系统