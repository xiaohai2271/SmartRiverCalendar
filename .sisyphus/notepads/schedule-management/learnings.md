# Schedule Management Learnings

## WeekView.vue Drag-to-Create Implementation

### Pattern: Drag Selection for Time Range
- **State Variables**: `isDragging`, `dragStartDay`, `dragStartHour`, `dragEndHour`
- **Event Handlers**: `handleMouseDown`, `handleMouseMove`, `handleMouseUp`
- **Visual Feedback**: CSS class `dragging` applied to selected hour cells

### Implementation Details
1. **MouseDown**: Initialize drag state, set start day and hour
2. **MouseMove**: Update end hour while dragging (same day only)
3. **MouseUp**: Calculate time range, emit `create-event`, reset state

### Click vs Drag Behavior
- **Click** (same cell): Creates 1-hour event (`startHour = hour, endHour = hour + 1`)
- **Drag** (multiple cells): Creates multi-hour event (`startHour = min, endHour = max + 1`)

### CSS Styling
```css
.hour-cell.dragging {
  background: rgba(74, 144, 217, 0.2);
  border-color: var(--accent-color);
}
```

### TypeScript Notes
- Unused function parameters should be prefixed with underscore (`_date`, `_hour`)
- Remove unused functions to avoid TS6133 errors

## DayView.vue Drag-to-Create Implementation

### Pattern Adaptation from WeekView
- **Simplified State**: No `dragStartDay` needed (single day view)
- **Emit Signature**: `'create-event': [startHour: number, endHour: number]` (no date parameter)
- **Hour Cell Height**: 60px (vs WeekView's 48px)

### Key Differences from WeekView
1. **No day selection**: Always operates on `calendarStore.currentDate`
2. **Simpler drag state**: Only `isDragging`, `dragStartHour`, `dragEndHour`
3. **Template binding**: Direct hour values, no day.date parameter

### Implementation Pattern
```typescript
// 拖拽状态
const isDragging = ref(false)
const dragStartHour = ref(0)
const dragEndHour = ref(0)

// 处理函数
function handleMouseDown(hour: number, event: MouseEvent) { ... }
function handleMouseMove(hour: number, event: MouseEvent) { ... }
function handleMouseUp(_hour: number, event: MouseEvent) { ... }
```

### Template Pattern
```vue
<div
  v-for="hour in hours"
  :key="hour"
  class="hour-cell"
  :class="{ 'dragging': isDragging && hour >= Math.min(dragStartHour, dragEndHour) && hour <= Math.max(dragStartHour, dragEndHour) }"
  @mousedown="handleMouseDown(hour, $event)"
  @mousemove="handleMouseMove(hour, $event)"
  @mouseup="handleMouseUp(hour, $event)"
></div>
```

## Router Configuration

### Adding New Routes
- **Pattern**: Follow existing route structure in `router/index.ts`
- **Lazy Loading**: Use `() => import('../views/ViewName.vue')` for code splitting
- **Route Structure**: `{ path: '/path', name: 'name', component: () => import('../views/ViewName.vue') }`

### Route Naming Convention
- Path: `/schedules` (plural, lowercase)
- Name: `schedules` (matches path without slash)
- Component: `ScheduleView.vue` (PascalCase with View suffix)

### Placeholder Components
- Create minimal placeholder when view doesn't exist
- Include basic structure: template with header, script setup, scoped styles
- Use consistent styling with existing views (max-width, padding, colors)

## CalendarView.vue Event Handling

### Receiving Events from Child Components
- **WeekView**: `@create-event="openAddEventModalWithDateAndTime"` (date, startHour, endHour)
- **DayView**: `@create-event="openAddEventModalWithTime"` (startHour, endHour)

### Function Pattern for Opening Modal with Time
```typescript
// 打开新建事件弹窗（带日期和时间 - WeekView）
function openAddEventModalWithDateAndTime(date: Date, startHour: number, endHour: number) {
  isEditingEvent.value = false
  editingEventId.value = null
  const dateString = getDateString(date)
  const startTime = `${String(startHour).padStart(2, '0')}:00`
  const endTime = `${String(endHour).padStart(2, '0')}:00`
  eventFormData.value = {
    title: '',
    allDay: false,
    startDate: dateString,
    startTime,
    endDate: dateString,
    endTime,
    calendarId: 'default',
    description: ''
  }
  showEventModal.value = true
}

// 打开新建事件弹窗（带时间 - DayView）
function openAddEventModalWithTime(startHour: number, endHour: number) {
  openAddEventModalWithDateAndTime(calendarStore.currentDate, startHour, endHour)
}
```

### Key Implementation Details
1. **allDay: false**: Dragged events are always timed events
2. **Time formatting**: Use `padStart(2, '0')` for consistent time format
3. **DayView reuse**: DayView function calls WeekView function with currentDate

## ScheduleView.vue Implementation

### Page Structure
- **Header**: Title + event count
- **Filters Section**: Search, date range, calendar filter
- **Events List**: Grouped by date, sorted by start time
- **Edit Modal**: Reuse pattern from CalendarView

### Filter Implementation
```typescript
// 筛选逻辑
const filteredEvents = computed(() => {
  let events = calendarStore.events

  // 按日历筛选
  if (selectedCalendars.value.length > 0) {
    events = events.filter(e => selectedCalendars.value.includes(e.calendarId))
  }

  // 按日期范围筛选
  if (startDate.value) {
    const start = new Date(startDate.value).getTime()
    events = events.filter(e => e.startTime >= start)
  }
  if (endDate.value) {
    const end = new Date(endDate.value).getTime() + 86400000
    events = events.filter(e => e.startTime < end)
  }

  // 按搜索词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    events = events.filter(e =>
      e.title.toLowerCase().includes(query) ||
      (e.description && e.description.toLowerCase().includes(query))
    )
  }

  return [...events].sort((a, b) => a.startTime - b.startTime)
})
```

### Date Grouping Pattern
```typescript
interface EventGroup {
  date: string
  events: CalendarEvent[]
}

const groupedEvents = computed((): EventGroup[] => {
  const groups: Map<string, CalendarEvent[]> = new Map()

  for (const event of filteredEvents.value) {
    const dateKey = new Date(event.startTime).toISOString().split('T')[0]
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(event)
  }

  return Array.from(groups.entries()).map(([date, events]) => ({
    date,
    events
  }))
})
```

### Key Features
1. **Search**: Filter by title and description
2. **Date Range**: Start and end date filter with clear button
3. **Calendar Filter**: Multi-select calendar chips
4. **Grouping**: Events grouped by date with count
5. **Edit/Delete**: Inline actions with modal edit

## App.vue Navigation

### Navigation Item Pattern
```vue
<router-link to="/schedules" class="nav-item" :class="{ active: $route.path === '/schedules' }">
  <span class="nav-icon">📅</span>
  <span>日程</span>
</router-link>
```

### Navigation Order
1. 首页 (/) - 🏠
2. 日历 (/calendar) - 📆
3. 待办 (/todos) - ✅
4. 日程 (/schedules) - 📅
5. 设置 (/settings) - ⚙️

### Key Implementation Details
- Position: After "待办", before "设置"
- Icon: 📅 (calendar emoji)
- Active state: Uses `$route.path === '/schedules'` for exact match
