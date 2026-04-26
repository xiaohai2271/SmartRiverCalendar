# TypeScript / Vue 开发规范

## 目录
1. [组件风格](#组件风格)
2. [类型定义](#类型定义)
3. [命名约定](#命名约定)
4. [导入路径](#导入路径)
5. [状态管理](#状态管理)
6. [错误处理](#错误处理)
7. [注释规范](#注释规范)

## 组件风格

### 基础结构

使用 Vue 3 Composition API，逻辑优先顺序: `<script setup>` → `<template>` → `<style>`

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CalendarEvent } from '@/types'

// 1. Props 和 Emits 定义
const props = defineProps<{ event: CalendarEvent }>()
const emit = defineEmits<{ update: [event: CalendarEvent] }>()

// 2. 响应式状态
const isActive = ref(false)
const isEditing = ref(false)

// 3. 计算属性
const displayTitle = computed(() => {
  return props.event.title || '(无标题)'
})

// 4. 方法
function handleEdit() {
  isEditing.value = true
  emit('update', props.event)
}
</script>

<template>
  <div class="calendar-event" @click="handleEdit">
    {{ displayTitle }}
  </div>
</template>

<style scoped>
.calendar-event {
  padding: var(--space-sm);
  border-radius: var(--radius-md);
}
</style>
```

### 组件命名
- 单文件组件使用 `PascalCase` 命名
- 模板中使用 `PascalCase` 或 `kebab-case`

```vue
<!-- ✅ 正确 -->
<DayView :date="today" />
<day-view :date="today" />

<!-- ❌ 错误 -->
<dayview :date="today" />
```

## 类型定义

### 类型文件组织
- 所有复杂数据结构在 `src/types/index.ts` 中定义接口
- 按模块分组，使用 JSDoc 注释说明

```typescript
// src/types/index.ts

/** 日历事件 */
export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: number    // Unix 毫秒时间戳
  endTime: number
  isAllDay: boolean
  calendarId: string
  color?: string
  location?: string
  createdAt: number
  updatedAt: number
}

/** 事件重复规则 */
export type RepeatRule = 
  | { type: 'none' }
  | { type: 'daily'; interval: number }
  | { type: 'weekly'; interval: number; daysOfWeek: number[] }
  | { type: 'monthly'; interval: number; dayOfMonth: number }
  | { type: 'yearly'; interval: number }
```

### 类型导入
```typescript
// ✅ 使用 import type 明确这是类型导入
import type { CalendarEvent, RepeatRule } from '@/types'
import type { Ref, ComputedRef } from 'vue'

// ❌ 混用类型和值导入
import { CalendarEvent } from '@/types'  // 应该用 import type
```

### 禁止使用 any
```typescript
// ❌ 禁止
function processData(data: any): any {
  return data.value
}

// ✅ 使用具体类型或 unknown
function processData(data: unknown): unknown {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: unknown }).value
  }
  return data
}

// ✅ 更好的做法：使用泛型
function processData<T extends { value: unknown }>(data: T): T['value'] {
  return data.value
}
```

## 命名约定

| 类别 | 命名风格 | 示例 |
|------|----------|------|
| Vue 组件文件 | PascalCase | `DayView.vue`, `CalendarHeader.vue` |
| Store 文件 | camelCase | `calendar.ts`, `settings.ts` |
| Service 文件 | camelCase | `eventService.ts`, `syncService.ts` |
| 工具函数文件 | camelCase | `date.ts`, `lunar.ts` |
| 类型文件 | 按模块 | `types/index.ts`, `types/event.ts` |
| 变量/函数 | camelCase | `currentDate`, `getEvents()` |
| 常量 | UPPER_SNAKE_CASE | `MAX_EVENT_COUNT`, `DEFAULT_VIEW` |
| 类型/接口 | PascalCase | `CalendarEvent`, `ViewType` |
| 枚举 | PascalCase | `ViewType`, `ThemeMode` |
| CSS 类名 | kebab-case | `.calendar-header`, `.event-card` |
| Props | camelCase | `startDate`, `calendarId` |
| Events | camelCase | `@updateEvent`, `@deleteEvent` |
| 布尔 Props | is/has 前缀 | `isAllDay`, `hasReminder` |

### Props 命名
```vue
<script setup lang="ts">
// ✅ 正确
const props = defineProps<{
  isVisible: boolean      // 布尔值用 is 前缀
  hasChildren: boolean
  startDate: Date
  onUpdate: (event: Event) => void  // 事件回调用 on 前缀
}>()

// ❌ 错误
const props = defineProps<{
  visible: boolean        // 缺少 is 前缀
  date: Date              // 不够明确
}>
</script>
```

### 事件命名
```vue
<script setup lang="ts">
// ✅ 使用 kebab-case 发射事件
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'event-created': [event: CalendarEvent]
  'event-deleted': [eventId: string]
}>()

emit('update:modelValue', newValue)
emit('event-created', event)
</script>
```

## 导入路径

### 使用 @ 别名
```typescript
// ✅ 使用 @ 别名 (指向 src/)
import { useCalendarStore } from '@/stores/calendar'
import { formatDate } from '@/utils/date'
import type { CalendarEvent } from '@/types'

// ✅ 同目录内可用相对路径
import { SubComponent } from './SubComponent.vue'
import { helper } from './helper'

// ❌ 避免深层相对路径
import { useCalendarStore } from '../../stores/calendar'
import { formatDate } from '../../../utils/date'
```

### 导入顺序
```typescript
// 1. Vue 核心库
import { ref, computed, onMounted } from 'vue'

// 2. 第三方库
import { invoke } from '@tauri-apps/api/core'
import { format } from 'date-fns'

// 3. 项目内部 - 类型 (使用 import type)
import type { CalendarEvent } from '@/types'

// 4. 项目内部 - Store/Service/Utils
import { useCalendarStore } from '@/stores/calendar'
import { eventService } from '@/services/eventService'

// 5. 项目内部 - 组件
import DayView from '@/components/calendar/DayView.vue'

// 6. 样式
import './styles.css'
```

## 状态管理

### Pinia Setup Store 模式

使用 Composition API 风格的 Setup Store:

```typescript
// src/stores/calendar.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { CalendarEvent, ViewType } from '@/types'

export const useCalendarStore = defineStore('calendar', () => {
  // 状态 (state)
  const currentDate = ref(new Date())
  const currentView = ref<ViewType>('month')
  const events = ref<CalendarEvent[]>([])

  // 计算属性 (getters)
  const currentMonthEvents = computed(() => {
    return events.value.filter(e => {
      // 筛选当月事件
    })
  })

  const eventCount = computed(() => events.value.length)

  // 操作方法 (actions)
  function setView(view: ViewType) {
    currentView.value = view
  }

  function navigateDate(offset: number) {
    const newDate = new Date(currentDate.value)
    // 按视图类型导航
    currentDate.value = newDate
  }

  async function loadEvents() {
    // 异步加载数据
    const data = await eventService.getEvents(currentDate.value)
    events.value = data
  }

  // 返回对外暴露的内容
  return {
    currentDate,
    currentView,
    events,
    currentMonthEvents,
    eventCount,
    setView,
    navigateDate,
    loadEvents,
  }
})
```

### 组件中使用 Store
```vue
<script setup lang="ts">
import { useCalendarStore } from '@/stores/calendar'

const calendarStore = useCalendarStore()

// 直接访问状态
console.log(calendarStore.currentView)

// 调用操作
calendarStore.setView('week')
</script>
```

## 错误处理

### 异步操作必须有 try-catch
```typescript
// ✅ 正确
async function createEvent(event: CalendarEvent): Promise<void> {
  try {
    await invoke('create_event', { event })
    console.log(`[EventService] 事件创建成功: id=${event.id}`)
  } catch (error) {
    console.error(`[EventService] 创建事件失败:`, error)
    throw error  // 重新抛出让调用方处理
  }
}

// ✅ 在组件中处理错误并给用户反馈
async function handleCreate() {
  try {
    await eventService.createEvent(newEvent)
    showToast('事件创建成功', 'success')
  } catch (error) {
    showToast('创建失败，请重试', 'error')
  }
}

// ❌ 禁止：空的或者无用的 catch
try {
  await riskyOperation()
} catch (e) {}  // 禁止空 catch

try {
  await riskyOperation()
} catch (e) {
  // 禁止吞掉错误不处理
}
```

### 错误传播链
```
组件层 (UI反馈) → Service层 (日志+转换) → invoke (通信) → Rust层 (日志+处理)
```

## 注释规范

- 所有注释使用 **中文**
- 复杂业务逻辑必须添加注释
- 公共 API (函数导出) 应该有 JSDoc 注释

```typescript
/**
 * 计算给定日期所在周的所有日期
 * @param date - 参考日期
 * @param startOfWeek - 一周起始日 (0=周日, 1=周一)
 * @returns 包含该周所有日期的数组
 */
export function getWeekDates(date: Date, startOfWeek: number = 0): Date[] {
  const dayOfWeek = date.getDay()
  const diff = (dayOfWeek - startOfWeek + 7) % 7
  // 计算本周周一 (如果 startOfWeek=1)
  const monday = new Date(date)
  monday.setDate(date.getDate() - diff)

  // 生成周一到周日的日期数组
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// 简单逻辑可用行内注释
// 计算本周的起始偏移量
const diff = (dayOfWeek - startOfWeek + 7) % 7
```
