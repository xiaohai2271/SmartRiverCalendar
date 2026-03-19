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