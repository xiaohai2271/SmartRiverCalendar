# 首页时间显示流程

## 概述

首页时间显示功能为用户提供实时的时间、日期、农历、节气、节假日和补休班提醒信息，位于首页欢迎区域和统计数据之间。

## 功能列表

| 功能 | 描述 | 刷新频率 |
|------|------|----------|
| 实时时钟 | 显示当前时间（HH:MM:SS 格式） | 每秒 |
| 日期显示 | 显示当前日期（YYYY年MM月DD日） | 自动更新 |
| 星期显示 | 显示当前星期 | 自动更新 |
| 农历日期 | 显示农历月份/日期 | 自动更新 |
| 节气显示 | 当日若有节气则显示 | 自动更新 |
| 节假日标签 | 当日若为法定节假日则突出显示 | 自动更新 |
| 补休提醒 | 当日若为调休补班日则显示提醒 | 自动更新 |

## 组件架构

```
HomeView.vue
    └── TimeDisplay.vue (新建)
            ├── 时间显示区域
            ├── 日期显示区域
            ├── 农历节气区域
            ├── 节假日标签
            └── 补休提醒
```

## 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                    TimeDisplay.vue                          │
├─────────────────────────────────────────────────────────────┤
│  currentTime (ref)                                          │
│       │                                                     │
│       ├── formattedTime (computed) ──→ 显示实时时间          │
│       ├── formattedDate (computed) ──→ 显示日期              │
│       ├── weekdayName (computed) ─────→ 显示星期             │
│       └── lunarInfo (computed) ───────→ 农历/节气/节假日信息  │
│                  │                                          │
│                  ▼                                          │
│           getLunarInfo(date)                                │
│                  │                                          │
│                  ▼                                          │
│    ┌─────────────────────────────────────┐                  │
│    │ LunarInfo {                         │                  │
│    │   lunarDate: string      // 农历日期│                  │
│    │   lunarMonth: string     // 农历月  │                  │
│    │   lunarDay: string       // 农历日  │                  │
│    │   lunarFestival?: string // 农历节日│                  │
│    │   solarTerm?: string     // 节气    │                  │
│    │   isWeekend: boolean     // 周末    │                  │
│    │   isHoliday: boolean     // 节假日  │                  │
│    │   holidayName?: string   // 节假日名│                  │
│    │   isWorkDay: boolean     // 调休上班│                  │
│    │   workDayName?: string   // 调休原因│                  │
│    │ }                                  │                  │
│    └─────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## 关键实现

### 1. 实时时间刷新

```typescript
// 每秒更新时间
const currentTime = ref(new Date())

let timeInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})
```

### 2. 农历信息获取

使用 `src/utils/lunar.ts` 中的 `getLunarInfo` 函数：

```typescript
import { getLunarInfo, type LunarInfo } from '@/utils/lunar'

const lunarInfo = computed<LunarInfo>(() => {
  return getLunarInfo(currentTime.value)
})
```

该函数内部使用 `tyme4ts` 库计算农历、节气，并从 `holidayData.ts` 获取节假日和调休数据。

### 3. 条件显示逻辑

| 条件 | 显示内容 | 样式 |
|------|----------|------|
| 有节气 | 节气名称 | 蓝色标签 |
| 有节假日 | 节假日名称 | 红/橙色渐变标签 |
| 是调休补班日 | 调休上班提醒 | 黄/橙色渐变标签 |

## 关键文件

| 文件路径 | 描述 |
|----------|------|
| `src/components/home/TimeDisplay.vue` | 时间显示组件 |
| `src/views/HomeView.vue` | 首页视图（集成组件） |
| `src/utils/lunar.ts` | 农历信息工具函数 |
| `src/utils/date.ts` | 日期格式化工具函数 |
| `src/utils/holidayData.ts` | 节假日和调休数据 |
| `src/__tests__/TimeDisplay.test.ts` | 单元测试 |

## UI 设计规范

遵循 Fluent Design 规范：

- **时间字体**: 56px, font-weight: 300, tabular-nums
- **日期字体**: 18px, 次要色
- **农历字体**: 15px, 次要色
- **节气标签**: 蓝色强调色背景
- **节假日标签**: 红/橙色渐变背景
- **补休提醒**: 黄/橙色渐变背景
- **卡片样式**: 16px 圆角, 轻微阴影

## 响应式设计

- 小于 600px 屏幕宽度时：
  - 时间字体缩小至 42px
  - 日期和农历区域改为垂直布局

## 深色模式

组件自动适配深色模式，通过 CSS 变量和 `:root.dark` 选择器实现。

## 维护说明

### 添加节假日数据

编辑 `src/utils/holidayData.ts`：

```typescript
// 添加节假日
export const HOLIDAYS: Record<string, string> = {
  '2027-01-01': '元旦',
  // ...
}

// 添加调休补班日
export const MAKEUP_DAYS: Record<string, string> = {
  '2027-01-25': '春节调休',
  // ...
}
```

### 扩展显示内容

1. 在 `LunarInfo` 接口中添加新字段
2. 在 `getLunarInfo` 函数中计算新数据
3. 在 `TimeDisplay.vue` 中显示新内容

## 相关 Issue

- Issue #4: 首页展示当前的实时时间以及日期等信息
