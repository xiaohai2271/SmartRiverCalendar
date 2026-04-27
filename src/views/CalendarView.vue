<template>
  <div class="calendar-view">
    <!-- Header -->
    <div class="calendar-header">
      <div class="header-left">
        <button class="fluent-button today-btn" @click="calendarStore.goToToday()">今天</button>
        <div class="nav-buttons">
          <button class="nav-btn" @click="calendarStore.prev()">‹</button>
          <button class="nav-btn" @click="calendarStore.next()">›</button>
        </div>
        <h2 class="current-date">{{ formattedDate }}</h2>
      </div>

      <div class="header-right">
        <div class="view-switcher">
          <button
            v-for="view in views"
            :key="view.value"
            :class="['view-btn', { active: calendarStore.currentView === view.value }]"
            @click="calendarStore.setView(view.value)"
          >
            {{ view.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Calendar Content -->
    <div class="calendar-content">
      <MonthView v-if="calendarStore.currentView === 'month'" @edit-event="openEditEventModal" @view-day-schedules="viewDaySchedules" />
      <WeekView v-else-if="calendarStore.currentView === 'week'" @edit-event="openEditEventModal" @create-event="openAddEventModalWithDateAndTime" />
      <DayView v-else-if="calendarStore.currentView === 'day'" @edit-event="openEditEventModal" @create-event="openAddEventModalWithTime" />
      <YearView v-else-if="calendarStore.currentView === 'year'" @edit-event="openEditEventModal" />
    </div>

    <!-- Add Event Button -->
    <button class="add-event-btn" @click="openAddEventModal">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Event Modal -->
    <Transition name="modal">
      <div v-if="showEventModal" class="modal-overlay" @click.self="closeEventModal">
        <div class="event-modal fluent-card" @keydown.escape="closeEventModal">
          <div class="modal-header">
            <h3>{{ isEditingEvent ? '编辑事件' : '新建事件' }}</h3>
            <button class="close-btn" @click="closeEventModal">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5L15 15M5 15L15 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <form @submit.prevent="handleEventSubmit" class="modal-body">
            <!-- Title Section -->
            <div class="form-section">
              <label class="section-label">标题</label>
              <input
                v-model="eventFormData.title"
                type="text"
                class="fluent-input"
                placeholder="输入事件标题..."
                required
                ref="eventTitleInput"
              />
            </div>

            <!-- Quick Actions Section -->
            <div class="form-section">
              <label class="section-label">快捷设置</label>
              <div class="quick-actions-row">
                <!-- All Day Toggle -->
                <label class="toggle-wrapper">
                  <input v-model="eventFormData.allDay" type="checkbox" class="toggle-input" />
                  <span class="toggle-slider"></span>
                  <span class="toggle-label">全天</span>
                </label>

                <div class="divider"></div>

                <!-- Quick Dates -->
                <div class="quick-dates">
                  <button
                    v-for="quick in filteredQuickDates"
                    :key="quick.label"
                    type="button"
                    class="quick-date-btn"
                    :class="{ active: isQuickDateActive(quick) }"
                    @click="applyQuickDate(quick)"
                  >
                    {{ quick.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Date & Time Section -->
            <div class="form-section">
              <label class="section-label">时间</label>
              <div class="datetime-section">
                <div class="datetime-row">
                  <div class="datetime-label">开始</div>
                  <div class="datetime-inputs">
                    <input
                      v-model="eventFormData.startDate"
                      type="date"
                      class="fluent-input date-input"
                      required
                    />
                    <input
                      v-if="!eventFormData.allDay"
                      v-model="eventFormData.startTime"
                      type="time"
                      class="fluent-input time-input"
                    />
                  </div>
                </div>

                <div class="datetime-row">
                  <div class="datetime-label">结束</div>
                  <div class="datetime-inputs">
                    <input
                      v-model="eventFormData.endDate"
                      type="date"
                      class="fluent-input date-input"
                      required
                    />
                    <input
                      v-if="!eventFormData.allDay"
                      v-model="eventFormData.endTime"
                      type="time"
                      class="fluent-input time-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Calendar & Color Section -->
            <div class="form-section">
              <label class="section-label">日历与颜色</label>
              <div class="calendar-color-section">
                <!-- Color Picker -->
                <div class="color-picker-row">
                  <ColorPicker
                    v-model="eventFormData.color"
                    :disabled="isReadOnlyCalendar"
                  />
                </div>

                <!-- Calendar Selector -->
                <div class="calendar-selector">
                  <template v-for="cal in calendarStore.calendars" :key="cal.id">
                    <button
                      v-if="!cal.readOnly"
                      type="button"
                      :class="['calendar-option', { active: eventFormData.calendarId === cal.id }]"
                      @click="eventFormData.calendarId = cal.id"
                    >
                      <span class="calendar-color" :style="{ background: cal.color }"></span>
                      <span>{{ cal.name }}</span>
                    </button>
                  </template>
                </div>
              </div>
            </div>

            <!-- Description Section -->
            <div class="form-section">
              <label class="section-label">描述</label>
              <input
                v-model="eventFormData.description"
                type="text"
                class="fluent-input"
                placeholder="添加描述..."
              />
            </div>

            <!-- Actions -->
            <div class="modal-actions">
              <button v-if="isEditingEvent" type="button" class="fluent-button danger" @click="handleDeleteEvent">
                删除
              </button>
              <div class="actions-right">
                <button type="button" class="fluent-button" @click="closeEventModal">
                  取消
                </button>
                <button type="submit" class="fluent-button primary" :disabled="!eventFormData.title.trim()">
                  {{ isEditingEvent ? '保存' : '创建' }}
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
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'
import MonthView from '../components/calendar/MonthView.vue'
import WeekView from '../components/calendar/WeekView.vue'
import DayView from '../components/calendar/DayView.vue'
import YearView from '../components/calendar/YearView.vue'
import ColorPicker from '../components/calendar/ColorPicker.vue'
import { formatDateLocale } from '../utils/date'
import type { CalendarView, CalendarEvent } from '../types'

const calendarStore = useCalendarStore()
const router = useRouter()
const eventTitleInput = ref<HTMLInputElement | null>(null)

const views: { value: CalendarView; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' }
]

const formattedDate = computed(() => {
  return formatDateLocale(calendarStore.currentDate, 'zh-CN')
})

// 判断当前选中的日历是否为只读

// 获取第一个可写日历的 ID
function getFirstWritableCalendarId(): string {
  const writableCal = calendarStore.calendars.find(cal => !cal.readOnly)
  return writableCal?.id || 'default'
}

// 获取指定日历的颜色
function getCalendarColor(calendarId: string): string {
  const calendar = calendarStore.calendars.find(cal => cal.id === calendarId)
  return calendar?.color || ''
}

const showEventModal = ref(false)
const isEditingEvent = ref(false)
const editingEventId = ref<string | null>(null)

const eventFormData = ref({
  title: '',
  allDay: true,
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  calendarId: getFirstWritableCalendarId(),
  description: '',
  color: ''
})

const isReadOnlyCalendar = computed(() => {
  const selectedCalendar = calendarStore.calendars.find(
    cal => cal.id === eventFormData.value.calendarId
  )
  return selectedCalendar?.readOnly ?? false
})

// 监听日历选择变化，自动更新默认颜色
watch(() => eventFormData.value.calendarId, (newCalendarId) => {
  // 只在新建事件时自动更新颜色（如果当前没有自定义颜色）
  if (!isEditingEvent.value && !eventFormData.value.color) {
    const selectedCalendar = calendarStore.calendars.find(cal => cal.id === newCalendarId)
    if (selectedCalendar) {
      eventFormData.value.color = selectedCalendar.color
    }
  }
})

// 监听全天事件切换，自动设置开始/结束时间
watch(() => eventFormData.value.allDay, (isAllDay) => {
  if (isAllDay) {
    eventFormData.value.startTime = '00:00'
    eventFormData.value.endTime = '23:59'
  }
  // 取消全天时保留当前时间值，因为回显时已正确设置
}, { immediate: true })

// 获取今天的日期字符串
function getTodayString(): string {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

// 获取指定日期的字符串
function getDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 获取本周五的日期
function getThisFriday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  const friday = new Date(today)
  friday.setDate(today.getDate() + daysUntilFriday)
  return friday
}

// 快捷日期选项
interface QuickDate {
  label: string
  date: string
  startTime?: string
  endTime?: string
  allDay?: boolean
  onlyDate?: boolean  // 只修改日期，不修改时间
  onlyTime?: boolean  // 只修改时间，不修改日期
}

const quickDates: QuickDate[] = [
  {
    label: '今天',
    date: getTodayString(),
    onlyDate: true
  },
  {
    label: '明天',
    date: getDateString(new Date(Date.now() + 86400000)),
    onlyDate: true
  },
  {
    label: '本周五',
    date: getDateString(getThisFriday()),
    onlyDate: true
  },
  {
    label: '上午',
    date: '',  // 不修改日期
    startTime: '09:00',
    endTime: '12:00',
    allDay: false,
    onlyTime: true  // 只修改时间
  },
  {
    label: '下午',
    date: '',  // 不修改日期
    startTime: '14:00',
    endTime: '18:00',
    allDay: false,
    onlyTime: true  // 只修改时间
  }
]

// 应用快捷日期
function applyQuickDate(quick: QuickDate) {
  if (quick.onlyDate) {
    // 只修改日期
    eventFormData.value.startDate = quick.date
    eventFormData.value.endDate = quick.date
  } else if (quick.onlyTime) {
    // 只修改时间
    eventFormData.value.startTime = quick.startTime!
    eventFormData.value.endTime = quick.endTime!
    eventFormData.value.allDay = false
  } else {
    // 修改日期和时间
    eventFormData.value.startDate = quick.date
    eventFormData.value.startTime = quick.startTime!
    eventFormData.value.endDate = quick.date
    eventFormData.value.endTime = quick.endTime!
    eventFormData.value.allDay = quick.allDay!
  }
}

// 过滤后的快捷日期（非全天时不显示上午/下午）
const filteredQuickDates = computed(() => {
  return quickDates.filter(quick => {
    // 上午和下午只在非全天事件时显示
    if ((quick.label === '上午' || quick.label === '下午') && eventFormData.value.allDay) {
      return false
    }
    return true
  })
})

// 判断快捷日期是否激活
function isQuickDateActive(quick: QuickDate): boolean {
  if (quick.onlyDate) {
    return eventFormData.value.startDate === quick.date
  } else if (quick.onlyTime) {
    return eventFormData.value.startTime === quick.startTime &&
      eventFormData.value.endTime === quick.endTime &&
      !eventFormData.value.allDay
  }
  return eventFormData.value.startDate === quick.date &&
    eventFormData.value.startTime === quick.startTime &&
    eventFormData.value.endTime === quick.endTime
}

// 格式化日期为 input[type=date] 格式（本地时间）
function formatDateString(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 格式化时间为 input[type=time] 格式（本地时间）
function formatTimeString(timestamp: number): string {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 打开新建事件弹窗
function openAddEventModal() {
  isEditingEvent.value = false
  editingEventId.value = null
  const today = getTodayString()
  const defaultCalendarId = getFirstWritableCalendarId()
  eventFormData.value = {
    title: '',
    allDay: true,
    startDate: today,
    startTime: '00:00',
    endDate: today,
    endTime: '23:59',
    calendarId: defaultCalendarId,
    description: '',
    color: getCalendarColor(defaultCalendarId)
  }
  showEventModal.value = true
}

// 打开新建事件弹窗（带日期和时间 - WeekView）
function openAddEventModalWithDateAndTime(date: Date, startHour: number, endHour: number) {
  isEditingEvent.value = false
  editingEventId.value = null
  const dateString = getDateString(date)
  const startTime = `${String(startHour).padStart(2, '0')}:00`
  const endTime = `${String(endHour).padStart(2, '0')}:00`
  const defaultCalendarId = getFirstWritableCalendarId()
  eventFormData.value = {
    title: '',
    allDay: false,
    startDate: dateString,
    startTime,
    endDate: dateString,
    endTime,
    calendarId: defaultCalendarId,
    description: '',
    color: getCalendarColor(defaultCalendarId)
  }
  showEventModal.value = true
}

// 打开新建事件弹窗（带时间 - DayView）
function openAddEventModalWithTime(startHour: number, endHour: number) {
  openAddEventModalWithDateAndTime(calendarStore.currentDate, startHour, endHour)
}

// 打开编辑事件弹窗
function openEditEventModal(event: CalendarEvent) {
  isEditingEvent.value = true
  editingEventId.value = event.id
  eventFormData.value = {
    title: event.title,
    allDay: event.allDay,
    startDate: formatDateString(event.startTime),
    startTime: formatTimeString(event.startTime),
    endDate: formatDateString(event.endTime),
    endTime: formatTimeString(event.endTime),
    calendarId: event.calendarId,
    description: event.description || '',
    color: event.color || ''
  }
  showEventModal.value = true
}

// 关闭弹窗
function closeEventModal() {
  showEventModal.value = false
  isEditingEvent.value = false
  editingEventId.value = null
}

// 自动聚焦标题输入框
watch(showEventModal, (show) => {
  if (show) {
    nextTick(() => {
      eventTitleInput.value?.focus()
    })
  }
})

// 提交表单
function handleEventSubmit() {
  const title = eventFormData.value.title.trim()
  if (!title) return

  const startDateTime = eventFormData.value.allDay
    ? new Date(eventFormData.value.startDate + 'T00:00:00').getTime()
    : new Date(`${eventFormData.value.startDate}T${eventFormData.value.startTime}`).getTime()

  const endDateTime = eventFormData.value.allDay
    ? new Date(eventFormData.value.endDate + 'T23:59:59').getTime()
    : new Date(`${eventFormData.value.endDate}T${eventFormData.value.endTime}`).getTime()

  if (isEditingEvent.value && editingEventId.value) {
    // 编辑模式
    calendarStore.updateEvent(editingEventId.value, {
      title,
      description: eventFormData.value.description,
      startTime: startDateTime,
      endTime: endDateTime,
      allDay: eventFormData.value.allDay,
      calendarId: eventFormData.value.calendarId,
      color: eventFormData.value.color
    })
  } else {
    // 新建模式
    calendarStore.addEvent({
      title,
      description: eventFormData.value.description,
      startTime: startDateTime,
      endTime: endDateTime,
      allDay: eventFormData.value.allDay,
      calendarId: eventFormData.value.calendarId,
      color: eventFormData.value.color
    })
  }

  closeEventModal()
}

// 删除事件
function handleDeleteEvent() {
  if (editingEventId.value) {
    calendarStore.deleteEvent(editingEventId.value)
    closeEventModal()
  }
}

// 查看某天的日程列表
function viewDaySchedules(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const dateString = `${year}-${month}-${day}`
  router.push({ path: '/schedules', query: { date: dateString } })
}
</script>

<style scoped>
.calendar-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Header */
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 16px;
}

.today-btn {
  padding: 8px 16px;
}

.nav-buttons {
  display: flex;
  gap: 4px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 18px;
  color: var(--text-primary);
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.current-date {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.5px;
}

.view-switcher {
  display: flex;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 4px;
}

.view-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.view-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.view-btn.active {
  background: var(--bg-secondary);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

.calendar-content {
  flex: 1;
  overflow: auto;
}

/* 月视图时隐藏滚动条 - 所有6行日期格子完整可见 */
.calendar-content:has(.month-view) {
  overflow: hidden;
}

/* Add Event Button */
.add-event-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-color);
  color: white;
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.add-event-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 120, 212, 0.4);
}

.add-event-btn:active {
  transform: scale(0.95);
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
  padding: var(--space-md);
  overflow-y: visible;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Form Section - 统一的区块样式 */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Section Label - 统一的标签样式 */
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Toggle Switch */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  width: 36px;
  height: 20px;
  background: var(--bg-secondary);
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

/* Quick Actions Row */
.quick-actions-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
}

/* Quick Dates */
.quick-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.quick-date-btn {
  padding: 5px 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-date-btn:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.quick-date-btn.active {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

/* Date Time Section */
.datetime-section {
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
}

.datetime-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.datetime-row:not(:last-child) {
  margin-bottom: var(--space-sm);
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

/* Calendar & Color Section */
.calendar-color-section {
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.color-picker-row {
  display: flex;
  align-items: center;
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
  background: var(--bg-secondary);
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
  margin-top: var(--space-md);
  padding-top: var(--space-md);
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
  box-shadow: var(--shadow-lg);
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

/* Form Group Compact */
.form-group.compact {
  margin-bottom: var(--space-md);
}
</style>
