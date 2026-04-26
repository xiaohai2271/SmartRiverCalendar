# 月视图事件显示模式

## 概述

月视图支持两种事件显示模式：横条模式和圆点模式。用户可在设置中切换，切换后即时生效。

## 显示模式

### 横条模式 (bar) - 默认
- 每个日期格子最多显示 3 个事件横条
- 横条高度 4px，间距 2px
- 跨天事件在多个日期格子中连续显示
- 横条颜色优先使用事件颜色，否则使用日历颜色

### 圆点模式 (dot)
- 每个日期格子最多显示 3 个事件圆点
- 圆点直径 8px
- 圆点颜色逻辑与横条一致

## 跨天事件处理

### 核心函数

| 函数 | 说明 |
|------|------|
| `isMultiDayEvent(event)` | 判断是否跨天事件 |
| `isEventOnDay(event, day)` | 判断事件是否覆盖某天 |
| `getEventSpanInfo(event, day)` | 获取事件在某天的跨度信息 |

### 全天事件处理

全天事件的 endTime 为次日的 00:00:00，需特殊处理：
- 单天全天事件：startDate = endDate，endTime = startDate次日00:00
- 跨天全天事件：endDate > startDate，endTime = endDate次日00:00

### 横条样式

| 位置 | 样式 |
|------|------|
| 开始日 | 左圆角 2px |
| 中间日 | 无圆角 |
| 结束日 | 右圆角 2px |

### 边距计算

跨天事件横条使用负 margin 突破格子内边距：
- `margin-left: -9px` (padding 8px + gap 1px)
- `margin-right: -9px`

## 事件颜色

### 颜色优先级
1. 事件自定义颜色 (`event.color`)
2. 所属日历颜色 (`calendar.color`)

### 颜色选择器

ColorPicker 组件提供：
- 10 个预设颜色
- 自定义颜色输入（HTML5 color picker）
- 与预设颜色互斥

## 设置存储

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `monthEventDisplayStyle` | `'bar' \| 'dot'` | `'bar'` | 月视图事件显示模式 |

## 关键文件

- `src/components/calendar/MonthView.vue` - 月视图主组件
- `src/components/calendar/EventBar.vue` - 横条渲染组件
- `src/components/calendar/EventTooltip.vue` - 悬浮提示组件
- `src/components/calendar/ColorPicker.vue` - 颜色选择器组件
- `src/utils/date.ts` - 跨天事件工具函数
- `src/views/CalendarView.vue` - 事件表单集成颜色选择器
- `src/components/settings/CalendarDisplayTab.vue` - 显示模式设置 UI