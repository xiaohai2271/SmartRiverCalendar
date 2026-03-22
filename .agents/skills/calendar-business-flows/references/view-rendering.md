# 视图切换与渲染流程

## 目录
1. [概述](#概述)
2. [视图类型](#视图类型)
3. [视图切换机制](#视图切换机制)
4. [组件结构](#组件结构)
5. [数据流](#数据流)
6. [状态管理](#状态管理)

## 概述

小河日历支持四种视图模式：日、周、月、年。每种视图都有对应的组件和渲染逻辑，通过统一的视图切换机制实现无缝切换。

## 视图类型

### 视图定义
```typescript
type CalendarView = 'day' | 'week' | 'month' | 'year'
```

### 视图特点
1. **日视图 (Day View)**
   - 显示单天的详细日程
   - 时间轴显示，精确到小时
   - 适合查看具体时间安排

2. **周视图 (Week View)**
   - 显示一周的事件
   - 7天并排显示
   - 适合查看一周安排

3. **月视图 (Month View)**
   - 显示整月的日历
   - 网格布局，每天一个格子
   - 适合查看长期安排

4. **年视图 (Year View)**
   - 显示整年的日历
   - 12个月并排显示
   - 适合查看年度概览

## 视图切换机制

### 视图状态管理
```typescript
// 在 calendar store 中
const currentView = ref<CalendarView>('month') // 默认月视图

function setView(view: CalendarView) {
  currentView.value = view
}
```

### 视图切换触发
1. **工具栏按钮**: 用户点击日/周/月/年按钮
2. **快捷键**: 支持键盘快捷键切换
3. **程序化切换**: 代码中根据逻辑自动切换

## 组件结构

### 组件目录
```
src/components/calendar/
├── DayView.vue
├── WeekView.vue
├── MonthView.vue
├── YearView.vue
└── CalendarView.vue (主容器)
```

### 主容器组件
```vue
<template>
  <div class="calendar-view">
    <DayView v-if="currentView === 'day'" />
    <WeekView v-else-if="currentView === 'week'" />
    <MonthView v-else-if="currentView === 'month'" />
    <YearView v-else-if="currentView === 'year'" />
  </div>
</template>
```

## 数据流

### 数据流向
```
Pinia Store → 计算属性 → 组件 → 渲染
```

### 关键计算属性
1. **currentDateRange**: 根据当前视图计算日期范围
2. **visibleEvents**: 过滤可见日历的事件
3. **eventsForCurrentView**: 获取当前视图范围内的事件

### 日期范围计算
```typescript
const currentDateRange = computed((): DateRange => {
  const date = currentDate.value
  const year = date.getFullYear()
  const month = date.getMonth()

  switch (currentView.value) {
    case 'day':
      const startOfDay = new Date(year, month, date.getDate())
      return { start: startOfDay, end: new Date(startOfDay.getTime() + 86400000) }
    case 'week':
      const dayOfWeek = date.getDay()
      const startOfWeek = new Date(year, month, date.getDate() - dayOfWeek)
      return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 86400000) }
    case 'month':
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0)
      return { start: startOfMonth, end: endOfMonth }
    case 'year':
      return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) }
  }
})
```

## 状态管理

### 视图状态
```typescript
// 视图相关状态
const currentView = ref<CalendarView>('month')
const currentDate = ref(new Date())
const selectedDate = ref<Date | null>(null)
```

### 导航操作
```typescript
function next() {
  const date = new Date(currentDate.value)
  switch (currentView.value) {
    case 'day':
      date.setDate(date.getDate() + 1)
      break
    case 'week':
      date.setDate(date.getDate() + 7)
      break
    case 'month':
      date.setMonth(date.getMonth() + 1)
      break
    case 'year':
      date.setFullYear(date.getFullYear() + 1)
      break
  }
  currentDate.value = date
}

function prev() {
  const date = new Date(currentDate.value)
  switch (currentView.value) {
    case 'day':
      date.setDate(date.getDate() - 1)
      break
    case 'week':
      date.setDate(date.getDate() - 7)
      break
    case 'month':
      date.setMonth(date.getMonth() - 1)
      break
    case 'year':
      date.setFullYear(date.getFullYear() - 1)
      break
  }
  currentDate.value = date
}
```

## 相关文件

- 视图组件: `src/components/calendar/`
- 状态管理: `src/stores/calendar.ts`
- 类型定义: `src/types/index.ts`
- 页面视图: `src/views/CalendarView.vue`