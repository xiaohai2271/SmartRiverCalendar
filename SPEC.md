# SmartRiverCalendar - 智能日历系统规格文档

## 1. 项目概述

### 项目名称
SmartRiverCalendar (智能河历)

### 项目类型
跨平台桌面/移动应用 (Android / Windows)

### 核心目标
打造最强替代系统日历的智能日历软件，支持完整日历功能、多日历聚合、时间块管理、AI智能日程规划，并实现Windows系统日历接管。

### 目标用户
- 需要高效管理时间的企业人士
- 需要同时管理多个日历账户的用户
- 追求智能化时间规划的用户

---

## 2. 技术架构

### 技术栈
- **桌面端框架**: Tauri 2.x (Rust 后端)
- **前端框架**: Vue 3 + TypeScript
- **状态管理**: Pinia
- **UI 组件**: 自定义组件 + Element Plus / Naive UI
- **数据存储**:
  - 本地: SQLite (通过 Tauri SQL 插件)
  - 云端: REST API 同步 (后期接入后端服务)
- **自动更新**: Tauri Updater
- **节假日**: 内置 + 远程更新

### 模块划分
```
src/
├── components/      # UI 组件
├── views/           # 页面视图
├── stores/          # Pinia 状态管理
├── services/        # 业务逻辑服务
├── utils/           # 工具函数
├── types/           # TypeScript 类型定义
└── assets/          # 静态资源
```

---

## 3. 功能规格

### 3.1 核心日历功能
- **视图模式**: 日视图、周视图、月视图、年视图
- **事件类型**: 普通事件、待办事项、纪念日、节日
- **重复规则**: 每日、每周、每月、每年、自定义规则
- **提醒机制**: 5分钟、15分钟、30分钟、1小时、1天前等多选项
- **全天事件**: 支持全天事件标记

### 3.2 多日历聚合
- **本地日历**: 默认本地日历
- **账户日历**: Google Calendar, Outlook Calendar (OAuth2)
- **日历颜色**: 每个日历独立颜色标识
- **显示控制**: 可单独显示/隐藏某个日历

### 3.3 时间块管理
- **时间块**: 将时间划分为工作块、休息块、会议块等
- **番茄钟集成**: 结合 Pomodoro 技术的专注时间块
- **可视化管理**: 直观的时间块占用可视化

### 3.4 AI 智能日历 (后期)
- **智能日程建议**: 基于用户习惯推荐最佳会议时间
- **时间分析**: 分析日历使用习惯，提供优化建议
- **自动分类**: AI 自动识别事件类型

### 3.5 Windows 系统日历接管
- **任务栏日历**: 点击任务栏时间自动打开应用
- **替代系统日历**: 通过系统集成替代默认日历弹出
- **托盘运行**: 最小化到系统托盘，后台运行

### 3.6 数据同步
- **本地优先**: 离线可用，本地 SQLite 存储
- **云端同步**: 登录后可同步到云端
- **冲突解决**: 本地优先 + 提示用户确认

---

## 4. UI/UX 规格

### 4.1 布局结构
- **主界面**: 左侧日历导航 + 右侧日程展示
- **顶部**: 视图切换 + 今日/搜索 + 设置入口
- **底部**: 状态栏（同步状态、时间）

### 4.2 配色方案
- **主题**: 浅色/深色模式支持
- **主色**: #4A90D9 (河流水蓝)
- **次色**: #2D3748 (深灰)
- **强调色**: #F5A623 (橙色，用于待办/提醒)
- **背景**: #F7FAFC (浅色) / #1A202C (深色)

### 4.3 交互规范
- **拖拽**: 支持事件拖拽调整时间
- **快捷键**: Ctrl+N 新建事件, Ctrl+F 搜索
- **右键菜单**: 事件/日期右键快捷操作

---

## 4.4 Fluent Design 规范

小河日历严格遵循 Microsoft Fluent Design System，为用户提供现代化、一致且美观的界面体验。

### 4.4.1 设计原则

#### 光影 (Light)
- 使用微妙的阴影和高光来表达层次关系
- 阴影用于提升元素，创造深度感
- 避免过度使用阴影，保持界面清爽

#### 深度 (Depth)
- 通过 z-index 和阴影创建视觉层次
- 模态框和弹窗使用更深层的阴影
- 卡片组件使用轻微阴影区分背景

#### 动效 (Motion)
- 所有交互都有平滑的过渡动画
- 使用 `cubic-bezier(0.1, 0.9, 0.2, 1)` 缓动函数
- 动画时长：快速 100ms，正常 200ms，平滑 250ms

#### 材质 (Material)
- 使用亚克力 (Acrylic) 和云母 (Mica) 效果
- 背景模糊：`backdrop-filter: blur(20px) saturate(180%)`
- 半透明背景增加层次感

#### 缩放 (Scale)
- 响应式设计，适配不同屏幕尺寸
- 按钮和交互元素有适当的点击区域
- 使用相对单位 (rem, em, %) 保持比例

### 4.4.2 颜色系统

#### 浅色主题
```css
--bg-primary: rgba(255, 255, 255, 0.8);
--bg-secondary: rgba(255, 255, 255, 0.9);
--bg-tertiary: rgba(243, 243, 243, 0.8);
--bg-hover: rgba(0, 0, 0, 0.04);
--bg-active: rgba(0, 0, 0, 0.08);

--text-primary: #1a1a1a;
--text-secondary: #5c5c5c;
--text-tertiary: #8a8a8a;

--border-color: rgba(0, 0, 0, 0.08);
--border-strong: rgba(0, 0, 0, 0.12);

--accent-color: #0078d4;
--accent-light: rgba(0, 120, 212, 0.1);
--accent-hover: #006cbd;
--accent-active: #005a9e;
```

#### 深色主题
```css
--bg-primary: rgba(32, 32, 32, 0.8);
--bg-secondary: rgba(45, 45, 45, 0.9);
--bg-tertiary: rgba(55, 55, 55, 0.8);
--bg-hover: rgba(255, 255, 255, 0.06);
--bg-active: rgba(255, 255, 255, 0.1);

--text-primary: #ffffff;
--text-secondary: #b3b3b3;
--text-tertiary: #808080;

--border-color: rgba(255, 255, 255, 0.08);
--border-strong: rgba(255, 255, 255, 0.14);

--accent-color: #60cdff;
--accent-light: rgba(96, 205, 255, 0.15);
--accent-hover: #4dc3ff;
--accent-active: #7dd4ff;
```

#### 语义颜色
```css
--warning-color: #ffc107;
--warning-light: rgba(255, 193, 7, 0.1);
--warning-text: #d39e00;

--success-color: #28a745;
--success-light: rgba(40, 167, 69, 0.1);
--success-text: #1e7e34;
```

### 4.4.3 阴影系统

#### 浅色主题阴影
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.06), 0 4px 8px rgba(0, 0, 0, 0.04);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.08), 0 16px 32px rgba(0, 0, 0, 0.04);
--shadow-fluent: 0 2px 6px rgba(0, 0, 0, 0.04), 0 8px 16px rgba(0, 0, 0, 0.08);
```

#### 深色主题阴影
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
--shadow-md: 0 2px 4px rgba(0, 0, 0, 0.3), 0 4px 8px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.3), 0 16px 32px rgba(0, 0, 0, 0.2);
--shadow-fluent: 0 2px 6px rgba(0, 0, 0, 0.2), 0 8px 16px rgba(0, 0, 0, 0.3);
```

### 4.4.4 圆角规范

```css
--radius-sm: 4px;   /* 小型元素：按钮、输入框 */
--radius-md: 8px;   /* 中型元素：卡片、菜单项 */
--radius-lg: 12px;  /* 大型元素：面板、模态框 */
--radius-xl: 16px;  /* 特大型元素：容器 */
```

### 4.4.5 间距系统

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
```

### 4.4.6 动画规范

```css
--transition-fast: 100ms ease-out;
--transition-normal: 200ms ease-out;
--transition-smooth: 250ms cubic-bezier(0.1, 0.9, 0.2, 1);
```

#### 预定义动画
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

### 4.4.7 字体规范

```css
font-family: 'Segoe UI Variable', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
font-size: 14px;
line-height: 1.5;
```

### 4.4.8 组件规范

#### 卡片 (.fluent-card)
```css
.fluent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-fluent);
  transition: box-shadow var(--transition-normal), transform var(--transition-normal);
}

.fluent-card:hover {
  box-shadow: var(--shadow-md);
}
```

#### 按钮 (.fluent-button)
```css
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.fluent-button:hover {
  background: var(--bg-hover);
}

.fluent-button:active {
  background: var(--bg-active);
  transform: scale(0.98);
}

.fluent-button.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.fluent-button.primary:hover {
  background: var(--accent-hover);
}

.fluent-button.primary:active {
  background: var(--accent-active);
}
```

#### 输入框 (.fluent-input)
```css
.fluent-input {
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.fluent-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.fluent-input::placeholder {
  color: var(--text-tertiary);
}
```

#### 滚动条
```css
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.4);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.6);
  background-clip: content-box;
}
```

### 4.4.9 主题切换

项目支持三种主题模式：
1. **浅色模式** (`.light`)
2. **深色模式** (`.dark`)
3. **自动模式** (跟随系统 `prefers-color-scheme`)

#### 实现方式
```javascript
// 应用主题到 :root
function applyTheme() {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  
  if (settings.theme === 'dark') {
    root.classList.add('dark')
  } else if (settings.theme === 'light') {
    root.classList.add('light')
  }
  // 'auto' 模式依赖 CSS 媒体查询
}
```

#### CSS 媒体查询
```css
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    /* 深色主题变量 */
  }
}
```

### 4.4.10 亚克力效果 (Acrylic)

亚克力效果用于创建半透明、模糊的背景材质，增强视觉层次感。

```css
/* 应用亚克力效果 */
backdrop-filter: blur(20px) saturate(180%);
-webkit-backdrop-filter: blur(20px) saturate(180%);
```

#### 使用场景
- 侧边栏背景
- 模态框背景
- 弹出菜单背景

### 4.4.11 无障碍设计

- **键盘导航**: 所有交互元素支持 Tab 键导航
- **焦点指示**: 使用 `box-shadow` 创建清晰的焦点指示器
- **对比度**: 文本颜色与背景保持足够的对比度
- **语义化**: 使用正确的 HTML 语义标签

### 4.4.12 响应式设计

- 使用相对单位 (rem, em, %) 保持比例
- 弹性布局 (Flexbox) 适应不同屏幕尺寸
- 媒体查询针对不同设备优化布局

---

## 4.5 Fluent Design 实现检查清单

在开发新组件或修改现有组件时，请确保：

- [ ] 使用 CSS 变量定义颜色、阴影、圆角
- [ ] 实现浅色/深色主题支持
- [ ] 添加适当的过渡动画
- [ ] 使用正确的阴影层级
- [ ] 保持一致的圆角规范
- [ ] 实现亚克力效果（如需要）
- [ ] 支持键盘导航
- [ ] 测试不同主题下的显示效果

---

## 5. Windows 平台特性

### 5.1 系统集成
- **任务栏图标**: 显示当前日期
- **日历弹出**: 点击唤醒应用（替代系统日历）
- **最小化**: 关闭按钮最小化到托盘
- **托盘菜单**: 打开/新建事件/退出

### 5.2 自动更新
- **检测更新**: 启动时检查更新
- **静默下载**: 后台下载更新包
- **热更新**: 无需重启应用

---

## 6. 数据模型

### Event (事件)
```typescript
interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: number;      // Unix timestamp
  endTime: number;
  allDay: boolean;
  calendarId: string;
  color?: string;
  reminder?: number;      // 提醒提前分钟数
  repeatRule?: RepeatRule;
  location?: string;
  createdAt: number;
  updatedAt: number;
}
```

### Calendar (日历)
```typescript
interface Calendar {
  id: string;
  name: string;
  color: string;
  type: 'local' | 'google' | 'outlook';
  accountId?: string;
  visible: boolean;
  syncEnabled: boolean;
}
```

### Todo (待办)
```typescript
interface Todo {
  id: string;
  title: string;
  description?: string;
  dueDate?: number;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  calendarId: string;
  createdAt: number;
  updatedAt: number;
}
```

---

## 7. 里程碑规划

### Phase 1: 基础框架
- [ ] Tauri + Vue 3 项目初始化
- [ ] 基础日历 UI 组件
- [ ] SQLite 本地存储
- [ ] CRUD 事件功能

### Phase 2: 核心功能
- [ ] 多视图切换 (日/周/月/年)
- [ ] 重复事件支持
- [ ] 提醒功能
- [ ] 搜索功能

### Phase 3: 多日历
- [ ] 多日历管理 UI
- [ ] 账户集成框架
- [ ] 日历显示/隐藏控制

### Phase 4: 时间块管理
- [ ] 时间块组件
- [ ] 时间块可视化
- [ ] 番茄钟集成

### Phase 5: Windows 集成
- [ ] 任务栏日历接管
- [ ] 系统托盘
- [ ] 自动更新

### Phase 6: 云端同步 (后期)
- [ ] 用户系统
- [ ] REST API 对接
- [ ] 同步逻辑

---

## 8. 非功能性要求

- **性能**: 日历渲染 < 100ms，支持 10000+ 事件
- **兼容性**: Windows 10/11, Android 10+
- **无障碍**: 键盘导航支持
- **安全**: 本地数据加密存储 (可选)