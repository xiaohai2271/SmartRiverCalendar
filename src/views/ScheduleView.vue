<template>
  <div class="schedules-view">
    <!-- Header -->
    <div class="schedules-header">
      <div class="header-left">
        <h2 class="page-title">日程管理</h2>
        <span class="event-count">{{ filteredEvents.length }} 个日程</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <!-- Search -->
      <div class="search-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M14 14L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索日程..."
        />
      </div>

      <!-- Date Range -->
      <div class="date-range-filter">
        <input
          v-model="startDate"
          type="date"
          class="fluent-input date-input"
          placeholder="开始日期"
        />
        <span class="date-separator">至</span>
        <input
          v-model="endDate"
          type="date"
          class="fluent-input date-input"
          placeholder="结束日期"
        />
        <button v-if="startDate || endDate" class="clear-btn" @click="clearDateRange" title="清除日期筛选">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M3 11L11 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Calendar Filter -->
      <div class="calendar-filter">
        <button
          v-for="cal in calendarStore.calendars"
          :key="cal.id"
          :class="['calendar-chip', { active: selectedCalendars.includes(cal.id) }]"
          @click="toggleCalendar(cal.id)"
        >
          <span class="calendar-dot" :style="{ background: cal.color }"></span>
          <span>{{ cal.name }}</span>
        </button>
      </div>
    </div>

    <!-- Events List -->
    <div class="events-list">
      <template v-for="group in groupedEvents" :key="group.date">
        <div class="date-group">
          <div class="date-header">
            <span class="date-label">{{ formatGroupDate(group.date) }}</span>
            <span class="date-count">{{ group.events.length }} 个日程</span>
          </div>
          <div class="date-events">
            <div
              v-for="event in group.events"
              :key="event.id"
              :class="['event-item', 'fluent-card', { 'all-day': event.allDay }]"
            >
              <div class="event-color-bar" :style="{ background: getEventColor(event) }"></div>
              <div class="event-content" @click="openEditModal(event)">
                <div class="event-title-row">
                  <div class="event-title">{{ event.title }}</div>
                  <div v-if="event.allDay" class="all-day-badge">全天</div>
                </div>
                <div class="event-time">
                  <span v-if="event.allDay">全天</span>
                  <span v-else>{{ formatEventTime(event) }}</span>
                </div>
                <div v-if="event.description" class="event-description">{{ event.description }}</div>
              </div>
              <div class="event-actions">
                <button class="action-btn edit-btn" @click="openEditModal(event)" title="编辑">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button class="action-btn delete-btn" @click="handleDeleteEvent(event.id)" title="删除">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4.5 3V1.5C4.5 1.22 4.72 1 5 1H11C11.28 1 11.5 1.22 11.5 1.5V3M2.5 4H13.5M12.5 4V14C12.5 14.28 12.28 14.5 12 14.5H4C3.72 14.5 3.5 14.28 3.5 14V4M6.5 7V11.5M9.5 7V11.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="10" width="32" height="30" rx="4" stroke="currentColor" stroke-width="2"/>
            <path d="M8 20H40" stroke="currentColor" stroke-width="2"/>
            <path d="M16 6V14M32 6V14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-text">
          {{ searchQuery || startDate || endDate ? '没有找到匹配的日程' : '暂无日程' }}
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="event-modal fluent-card" @keydown.escape="closeModal">
          <div class="modal-header">
            <h3>编辑日程</h3>
            <button class="close-btn" @click="closeModal">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-body">
            <!-- Title -->
            <div class="form-group">
              <label class="form-label">标题</label>
              <input
                v-model="formData.title"
                type="text"
                class="fluent-input"
                placeholder="输入事件标题..."
                required
                ref="titleInput"
              />
            </div>

            <!-- All Day Toggle -->
            <div class="form-group">
              <label class="toggle-wrapper">
                <input v-model="formData.allDay" type="checkbox" class="toggle-input" />
                <span class="toggle-slider"></span>
                <span class="toggle-label">全天事件</span>
              </label>
            </div>

            <!-- Date & Time -->
            <div class="datetime-section">
              <div class="datetime-row">
                <div class="datetime-label">开始</div>
                <div class="datetime-inputs">
                  <input
                    v-model="formData.startDate"
                    type="date"
                    class="fluent-input date-input"
                    required
                  />
                  <input
                    v-if="!formData.allDay"
                    v-model="formData.startTime"
                    type="time"
                    class="fluent-input time-input"
                  />
                </div>
              </div>

              <div class="datetime-row">
                <div class="datetime-label">结束</div>
                <div class="datetime-inputs">
                  <input
                    v-model="formData.endDate"
                    type="date"
                    class="fluent-input date-input"
                    required
                  />
                  <input
                    v-if="!formData.allDay"
                    v-model="formData.endTime"
                    type="time"
                    class="fluent-input time-input"
                  />
                </div>
              </div>
            </div>

            <!-- Calendar Selection -->
            <div class="form-group">
              <label class="form-label">日历</label>
              <div class="calendar-selector">
                <template v-for="cal in calendarStore.calendars" :key="cal.id">
                  <button
                    v-if="!cal.readOnly"
                    type="button"
                    :class="['calendar-option', { active: formData.calendarId === cal.id }]"
                    @click="formData.calendarId = cal.id"
                  >
                    <span class="calendar-color" :style="{ background: cal.color }"></span>
                    <span>{{ cal.name }}</span>
                  </button>
                </template>
              </div>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label">描述</label>
              <input
                v-model="formData.description"
                type="text"
                class="fluent-input"
                placeholder="添加描述..."
              />
            </div>

            <!-- Actions -->
            <div class="modal-actions">
              <button type="button" class="fluent-button danger" @click="handleDeleteEvent(editingEventId!)">
                删除
              </button>
              <div class="actions-right">
                <button type="button" class="fluent-button" @click="closeModal">
                  取消
                </button>
                <button type="submit" class="fluent-button primary" :disabled="!formData.title.trim()">
                  保存
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'
import { formatDate, formatTime } from '../utils/date'
import type { CalendarEvent } from '../types'

const route = useRoute()
const calendarStore = useCalendarStore()

// 筛选状态
const searchQuery = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedCalendars = ref<string[]>([])

// 弹窗状态
const showModal = ref(false)
const editingEventId = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

const formData = ref({
  title: '',
  allDay: false,
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  calendarId: 'default',
  description: ''
})

// 初始化时选中所有日历
watch(() => calendarStore.calendars, (cals) => {
  if (selectedCalendars.value.length === 0 && cals.length > 0) {
    selectedCalendars.value = cals.map(c => c.id)
  }
}, { immediate: true })

// 从路由查询参数中获取日期并填充筛选
watch(() => route.query.date, (dateParam) => {
  if (dateParam && typeof dateParam === 'string') {
    startDate.value = dateParam
    endDate.value = dateParam
  }
}, { immediate: true })

// 筛选后的事件
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
    const end = new Date(endDate.value).getTime() + 86400000 // 包含结束日期当天
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

  // 按结束时间倒序排序（最新的在前）
  return [...events].sort((a, b) => b.endTime - a.endTime)
})

// 按日期分组的事件
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

// 切换日历筛选
function toggleCalendar(calendarId: string) {
  const index = selectedCalendars.value.indexOf(calendarId)
  if (index === -1) {
    selectedCalendars.value.push(calendarId)
  } else {
    selectedCalendars.value.splice(index, 1)
  }
}

// 清除日期范围
function clearDateRange() {
  startDate.value = ''
  endDate.value = ''
}

// 获取事件颜色
function getEventColor(event: CalendarEvent): string {
  const calendar = calendarStore.calendars.find(c => c.id === event.calendarId)
  return calendar?.color || '#4A90D9'
}

// 格式化分组日期
function formatGroupDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const targetDate = new Date(date)
  targetDate.setHours(0, 0, 0, 0)

  if (targetDate.getTime() === today.getTime()) {
    return '今天'
  } else if (targetDate.getTime() === tomorrow.getTime()) {
    return '明天'
  } else {
    return formatDate(date)
  }
}

// 格式化事件时间
function formatEventTime(event: CalendarEvent): string {
  const start = formatTime(new Date(event.startTime))
  const end = formatTime(new Date(event.endTime))
  return `${start} - ${end}`
}

// 格式化日期为 input[type=date] 格式
function formatDateString(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toISOString().split('T')[0]
}

// 格式化时间为 input[type=time] 格式
function formatTimeString(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toTimeString().slice(0, 5)
}

// 打开编辑弹窗
function openEditModal(event: CalendarEvent) {
  editingEventId.value = event.id
  formData.value = {
    title: event.title,
    allDay: event.allDay,
    startDate: formatDateString(event.startTime),
    startTime: formatTimeString(event.startTime),
    endDate: formatDateString(event.endTime - (event.allDay ? 86400000 : 0)),
    endTime: formatTimeString(event.endTime),
    calendarId: event.calendarId,
    description: event.description || ''
  }
  showModal.value = true
}

// 关闭弹窗
function closeModal() {
  showModal.value = false
  editingEventId.value = null
}

// 自动聚焦标题输入框
watch(showModal, (show) => {
  if (show) {
    nextTick(() => {
      titleInput.value?.focus()
    })
  }
})

// 提交表单
function handleSubmit() {
  const title = formData.value.title.trim()
  if (!title || !editingEventId.value) return

  const startDateTime = formData.value.allDay
    ? new Date(formData.value.startDate).getTime()
    : new Date(`${formData.value.startDate}T${formData.value.startTime}`).getTime()

  const endDateTime = formData.value.allDay
    ? new Date(formData.value.endDate).getTime() + 86400000
    : new Date(`${formData.value.endDate}T${formData.value.endTime}`).getTime()

  calendarStore.updateEvent(editingEventId.value, {
    title,
    description: formData.value.description,
    startTime: startDateTime,
    endTime: endDateTime,
    allDay: formData.value.allDay,
    calendarId: formData.value.calendarId
  })

  closeModal()
}

// 删除事件
function handleDeleteEvent(id: string) {
  calendarStore.deleteEvent(id)
  closeModal()
}
</script>

<style scoped>
.schedules-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}

/* Header */
.schedules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.5px;
}

.event-count {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Filters Section */
.filters-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
}

/* Search */
.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

/* Date Range Filter */
.date-range-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  flex: 1;
}

.date-separator {
  color: var(--text-secondary);
  font-size: 14px;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Calendar Filter */
.calendar-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.calendar-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.calendar-chip:hover {
  background: var(--bg-hover);
}

.calendar-chip.active {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.calendar-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Events List */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.date-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.date-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.date-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.date-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.date-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Event Item */
.event-item {
  display: flex;
  align-items: stretch;
  background: var(--bg-secondary);
  overflow: hidden;
  transition: all var(--transition-fast);
}

.event-item:hover {
  box-shadow: var(--shadow-md);
}

.event-item.all-day {
  background: var(--accent-light);
  border-left: 3px solid var(--accent-color);
}

.event-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.all-day-badge {
  background: var(--accent-color);
  color: white;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.event-color-bar {
  width: 4px;
  flex-shrink: 0;
}

.event-content {
  flex: 1;
  padding: 12px 16px;
  cursor: pointer;
  min-width: 0;
}

.event-content:hover {
  background: var(--bg-hover);
}

.event-title {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.event-time {
  font-size: 13px;
  color: var(--text-secondary);
}

.event-description {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
}

.event-item:hover .action-btn {
  opacity: 1;
}

.edit-btn:hover {
  background: var(--accent-light);
  color: var(--accent-color);
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: var(--text-secondary);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-modal {
  width: 480px;
  max-width: 90vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 16px 18px;
}

/* Form */
.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

/* Toggle Switch */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  width: 36px;
  height: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  position: relative;
  transition: all var(--transition-fast);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.toggle-input:checked + .toggle-slider {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.toggle-input:checked + .toggle-slider::after {
  transform: translateX(16px);
}

.toggle-label {
  font-size: 13px;
  color: var(--text-primary);
}

/* Date Time Section */
.datetime-section {
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  margin-bottom: 16px;
}

.datetime-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.datetime-row:not(:last-child) {
  margin-bottom: 10px;
}

.datetime-label {
  width: 40px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: right;
}

.datetime-inputs {
  flex: 1;
  display: flex;
  gap: 8px;
}

.date-input {
  flex: 1;
}

.time-input {
  width: 110px;
}

/* Calendar Selector */
.calendar-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.calendar-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 12px;
  color: var(--text-primary);
}

.calendar-option:hover {
  background: var(--bg-hover);
}

.calendar-option.active {
  border-color: var(--accent-color);
  background: var(--accent-light);
}

.calendar-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.actions-right {
  display: flex;
  gap: 10px;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .event-modal,
.modal-leave-active .event-modal {
  transition: transform 0.25s cubic-bezier(0.1, 0.9, 0.2, 1), opacity 0.2s ease;
}

.modal-enter-from .event-modal {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .event-modal {
  opacity: 0;
  transform: scale(0.95);
}

/* Fluent Components */
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 500;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-button:hover {
  background: var(--bg-hover);
}

.fluent-button:active {
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

.fluent-button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fluent-button.danger {
  background: transparent;
  border-color: #fecaca;
  color: #dc2626;
}

.fluent-button.danger:hover {
  background: #fee2e2;
  border-color: #fca5a5;
}

.fluent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.fluent-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.fluent-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

.fluent-input::placeholder {
  color: var(--text-tertiary);
}
</style>
