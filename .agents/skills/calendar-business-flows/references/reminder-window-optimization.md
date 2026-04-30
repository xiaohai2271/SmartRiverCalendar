# 提醒窗口优化业务流程

## 概述

Issue #42 的优化将事件提醒从主窗口内嵌弹窗改为独立的 Tauri 窗口，实现以下改进：
- 主界面和精简面板不显示时也能正常展示提醒
- 提醒自动隐藏，无需用户手动关闭
- 同一时间只显示一个提醒，后续提醒排队
- 与精简面板协调位置，避免遮挡
- 响应系统夜间模式/勿扰模式设置

## 架构设计

### 窗口架构

```
┌─────────────────────────────────────┐
│            main 主窗口              │
│  ┌─ App.vue ──────────────────────┐ │
│  │  路由视图 (日/周/月/年)        │ │
│  │  ReminderPopup (:reminder=null)│ │
│  │  reminder-action 事件监听       │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
         │ Tauri 事件系统
         ▼
┌─────────────────────────────────────┐
│       calendar-popup 精简面板       │
│  ┌─ CalendarPopupView.vue ────────┐ │
│  │  月份导航 + 日期网格           │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
         │ Tauri 事件系统
         ▼
┌─────────────────────────────────────┐
│       reminder-popup 提醒窗口       │
│  ┌─ ReminderPopupView.vue ────────┐ │
│  │  ReminderPopup 组件             │ │
│  │  reminder-data 事件接收          │ │
│  │  自动消失 + 交互按钮            │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 提醒排队机制

```
提醒触发 → enqueueReminder() → 队列
                                 │
                          ┌──────┴──────┐
                          │   队列检查   │
                          │ 同一时间     │
                          │ 只显示一个   │
                          └──────┬──────┘
                                 │
                          showReminderInWindow()
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              显示提醒窗口   发送事件     启动自动消失
              (reminder-popup) (reminder-data) (setTimeout)
                    │
              ┌─────┴─────┐
              │  用户交互  │
              ├───────────┤
              │ 查看详情   │ → emit('reminder-action', {action:'view'})
              │ 稍后提醒   │ → emit('reminder-action', {action:'snooze'})
              │ 标记完成   │ → emit('reminder-action', {action:'complete'})
              │ 自动消失   │ → emit('reminder-action', {action:'dismiss'})
              └─────┬─────┘
                    │
              dequeueReminder()
                    │
              显示下一个提醒
```

### 显示时长配置

| 提醒强度 | 显示时长 | 关闭按钮 |
|----------|----------|----------|
| standard (标准) | 10 秒 | 显示 |
| strong (强提醒) | 30 秒 | 显示 |
| silent (静默) | 5 秒 | 隐藏 |

### 与精简面板协调

```
屏幕右下角定位:
  baseX = workArea.x + workArea.width - WINDOW_WIDTH - MARGIN
  baseY = workArea.y + workArea.height - WINDOW_HEIGHT - MARGIN

精简面板显示时:
  adjustedY = baseY - POPUP_OFFSET (100px)
  任务栏在顶部时:
  adjustedY = baseY + POPUP_OFFSET
```

### 夜间模式/勿扰模式

```
显示提醒窗口前检查:
  if settings.theme === 'dark' → 不显示窗口，仅发送系统通知
  if isDndMode() → 不显示窗口，静默入队
```

## 关键代码路径

### 提醒服务
- `src/services/reminder.ts`
  - `enqueueReminder(data)` - 将提醒加入队列
  - `dequeueReminder()` - 从队列移除已处理提醒
  - `showReminderInWindow(data)` - 在独立窗口中显示提醒
  - `handleReminderDeleted(id)` - 处理提醒对应的项目被删除
  - 夜间模式检测逻辑

### 窗口定位
- `src/composables/useReminderPopup.ts`
  - `calculateBaseReminderPosition(monitor)` - 计算基础位置
  - `adjustPositionForPopup(base, popupPos, taskbarPos)` - 根据精简面板调整
  - `checkAndAdjustBounds(position, monitor)` - 边界检查
  - `isRapidTrigger()` - 快速触发防护（5 秒冷却）
  - `getReminderWindowSize()` - 获取窗口尺寸 (320x200)

### 提醒组件
- `src/components/reminder/ReminderPopup.vue`
  - Props: `reminder`, `duration`, `showCloseButton`, `reminderMode`
  - Emits: `dismiss`, `snooze`, `complete`, `view`
  - 默认时长: DEFAULT_DURATIONS (10s/30s/5s)

### 独立视图
- `src/views/ReminderPopupView.vue`
  - 路由: `/reminder-popup`
  - 监听 `reminder-data` 事件
  - 处理 `reminder-action` 响应

### 跨窗口通信
- `src/App.vue`
  - 监听 `reminder-action` 事件（view, snooze, complete, dismiss）
  - 路由跳转到对应详情页

## 测试文件
- `src/__tests__/reminder.test.ts` - 提醒服务单元测试
- `src/__tests__/ReminderPopup.test.ts` - 提醒组件测试
- `src/__tests__/useReminderPopup.test.ts` - 窗口定位逻辑测试