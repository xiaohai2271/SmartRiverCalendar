# 日历界面优化流程 (Issue #40)

## 目录
1. [概述](#概述)
2. [休/补徽标](#休补徽标)
3. [右键菜单](#右键菜单)
4. [全天事件内联显示](#全天事件内联显示)
5. [事件颜色优先级](#事件颜色优先级)
6. [相关类型定义](#相关类型定义)

## 概述

Issue #40 对日历界面进行了多项优化，包括移除日期单元格背景色、添加休/补徽标、实现右键菜单、重写全天事件显示区域、修复事件颜色优先级 bug。

## 休/补徽标

### 功能说明
在月视图日期单元格右上角显示"休"或"补"徽标，替代原有的背景色区分方式。

### 徽标类型
| 徽标 | 类型 | 显示条件 | 优先级 |
|------|------|----------|--------|
| 休 | rest | 周末或法定节假日 | 1 (最高) |
| 补 | makeup | 调休补班日 | 1 |
| 法定节假日名称 | holiday | 非休徽标时的法定节假日 | 2 |
| 农历节日 | festival | 无法定节假日和休徽标时 | 3 |
| 节气 | solar-term | 有节气时独立显示 | 4 |

### 配置常量
```typescript
export const REST_BADGE_CONFIG: Record<RestBadgeType, { text: string; cssClass: string; priority: number }> = {
  rest: { text: '休', cssClass: 'badge-rest', priority: 1 },
  makeup: { text: '补', cssClass: 'badge-makeup', priority: 1 }
}
```

### 关键逻辑
- `getBadgesForDay()` 函数按优先级构建徽标列表
- 最多显示3个徽标（`badges.slice(0, 3)`）
- 当已有"休"徽标时，不再重复显示节假日名称徽标
- 徽标显示受 `showMakeupDay` 设置控制

## 右键菜单

### 日期单元格右键菜单 (DateCellContextMenu)
- **触发方式**: 在月视图日期单元格上右键点击
- **菜单项**:
  - 📋 查看事件 (viewEvents) — 无事件时禁用
  - ➕ 创建事件 (createEvent)
  - ✅ 查看待办 (viewTodos) — 无待办时禁用
  - 📝 创建待办 (createTodo)
  - ── 分隔线 ──
  - 📅 切换到日视图 (switchToDayView)
  - 📆 切换到周视图 (switchToWeekView)

### 事件块右键菜单 (EventBlockContextMenu)
- **触发方式**: 在日/周视图的事件块上右键点击
- **菜单项**:
  - ✏️ 编辑事件 (edit)
  - ℹ️ 事件详情 (detail)
  - ── 分隔线 ──
  - 🗑️ 删除事件 (delete)

### 菜单组件架构
```
ContextMenu.vue (基础组件，通用)
├── DateCellContextMenu.vue (日期单元格菜单，包装 ContextMenu)
└── EventBlockContextMenu.vue (事件块菜单，包装 ContextMenu)
```
- ContextMenu.vue 提供 Teleport、定位、点击外部关闭、ESC 关闭等基础能力
- 包装组件负责构建菜单项、触发动作
- 动作类型通过 TypeScript 类型约束，确保类型安全

## 全天事件内联显示

### 变更说明
DayView 和 WeekView 的全天事件区域从原来的纯色块填充改为内联排列样式：
- 左侧 3px 彩色边框（事件颜色）
- 半透明背景（事件颜色 + 10% 透明度）
- 事件标题以主要文字颜色显示

### 样式实现
```css
.all-day-event {
  border-left: 3px solid var(--accent-color); /* 被 :style 覆盖为事件颜色 */
  border-radius: 4px;
  padding: 4px 8px;
  background-color: color + '18'; /* 10% 透明度 */
}
```

## 事件颜色优先级

### 正确优先级
```
event.color > calendar.color > '#4A90D9'
```

### Bug 修复
DayView 和 WeekView 的 `getEventColor()` 函数之前不检查 `event.color`，直接使用 `calendar.color`。Issue #40 修复了此问题，使其与 MonthView 保持一致。

### 正确实现 (MonthView 参考)
```typescript
function getEventColor(event: CalendarEvent): string {
  if (event.color) return event.color
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}
```

## 相关类型定义

```typescript
// 日期单元格右键菜单动作
export type DateCellMenuAction =
  | 'viewEvents' | 'createEvent' | 'viewTodos'
  | 'createTodo' | 'switchToDayView' | 'switchToWeekView'

// 事件块右键菜单动作
export type EventBlockMenuAction = 'edit' | 'detail' | 'delete'

// 休息日徽标类型
export type RestBadgeType = 'rest' | 'makeup'
```

## 相关文件
- 日期右键菜单: `src/components/calendar/DateCellContextMenu.vue`
- 事件右键菜单: `src/components/calendar/EventBlockContextMenu.vue`
- 基础菜单: `src/components/common/ContextMenu.vue`
- 月视图: `src/components/calendar/MonthView.vue`
- 日视图: `src/components/calendar/DayView.vue`
- 周视图: `src/components/calendar/WeekView.vue`
- 类型定义: `src/types/index.ts`
- 单元测试: `src/__tests__/types-constants.test.ts`