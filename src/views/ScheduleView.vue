<template>
  <div class="schedules-view">
    <!-- Header -->
    <div class="schedules-header">
      <div class="header-left">
        <h2 class="page-title">日程管理</h2>
        <span class="event-count">{{ filteredEvents.length }} 个日程</span>
      </div>
    </div>

    <!-- Filters 看板 ── 升级为极细描边微磨砂面板 -->
    <div class="filters-section">
      <!-- Search -->
      <div class="search-wrapper">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索日程或描述..."
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Calendar Filter ── Notion 彩点药丸 -->
      <div class="calendar-filter">
        <button
          v-for="cal in calendarStore.calendars"
          :key="cal.id"
          :class="['calendar-chip', { active: selectedCalendars.includes(cal.id) }]"
          :style="{ 
            '--calendar-color': cal.color,
            '--calendar-active-bg': colorMixActiveBg(cal.color)
          }"
          @click="toggleCalendar(cal.id)"
        >
          <span class="calendar-dot" :style="{ background: cal.color }"></span>
          <span>{{ cal.name }}</span>
        </button>
      </div>
    </div>

    <!-- Events List ── 无边界空气流线 Timeline -->
    <div class="events-list">
      <template v-for="group in groupedEvents" :key="group.key">
        <div class="date-group">
          <!-- 莫兰迪时间徽标 -->
          <div class="date-header">
            <span class="date-label-badge">{{ group.title }}</span>
            <span class="date-count">{{ group.events.length }} 个日程</span>
          </div>
          <div class="date-events">
            <div
              v-for="event in group.events"
              :key="event.id"
              :class="['event-item', 'fluent-card', { 'all-day': event.allDay }]"
              @contextmenu.prevent="handleEventContextMenu($event, event)"
            >
              <!-- 专属日历 Ribbon 色条 -->
              <div class="event-color-ribbon" :style="{ '--calendar-color': getEventColor(event) }"></div>
              <div class="event-content" @click="openEditModal(event)">
                <div class="event-title-row">
                  <div class="event-title">{{ event.title }}</div>
                  <div v-if="event.allDay" class="all-day-badge">全天</div>
                </div>
                <div class="event-time">
                  <svg class="time-icon-svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span v-if="event.allDay">全天日程</span>
                  <span v-else>{{ formatEventTime(event) }}</span>
                </div>
                <div v-if="event.description" class="event-description">{{ event.description }}</div>
              </div>
              <div class="event-actions">
                <button class="action-btn edit-btn" @click="openEditModal(event)" title="编辑">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </button>
                <button class="action-btn delete-btn" @click="handleDeleteEvent(event.id)" title="删除">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                  </svg>
                </button>
                <!-- 快捷向右进入小箭头 (Hover Actions) -->
                <div class="hover-action-arrow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 极简线描空日程占位插画 -->
      <div v-if="filteredEvents.length === 0" class="empty-state">
        <svg class="empty-illustration" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <div class="empty-text">
          此日期范围内无日程安排，空气真好
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

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuPosition.x"
      :y="contextMenuPosition.y"
      :items="contextMenuItems"
      @update:visible="contextMenuVisible = $event"
    />

    <!-- 删除确认气泡 -->
    <ConfirmPopover
      :visible="confirmPopoverVisible"
      message="确定删除这个日程吗？"
      confirm-text="删除"
      cancel-text="取消"
      :target-rect="confirmTargetRect"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
      @update:visible="confirmPopoverVisible = $event"
    />

    <!-- 日程详情弹窗 -->
    <EventDetailModal
      :visible="eventDetailVisible"
      :event="selectedEvent"
      @close="eventDetailVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'
import { formatDate, formatTime, isEventOnDay } from '../utils/date'
import ContextMenu from '../components/common/ContextMenu.vue'
import ConfirmPopover from '../components/common/ConfirmPopover.vue'
import EventDetailModal from '../components/common/EventDetailModal.vue'
import type { CalendarEvent, MenuItem } from '../types'

const route = useRoute()
const calendarStore = useCalendarStore()

// 混合激活背景色（Notion微光药丸）
function colorMixActiveBg(color: string): string {
  if (color && color.startsWith('#')) {
    return color + '18' // 9.5% 不透明度作为微光背景
  }
  return color || 'rgba(74, 144, 217, 0.1)'
}

// 筛选状态
const searchQuery = ref('')
// 默认时间范围：今天前后7天
const today = new Date()
const defaultStart = new Date(today.getTime() - 7 * 86400000)
const defaultEnd = new Date(today.getTime() + 7 * 86400000)
const startDate = ref(formatDate(defaultStart))
const endDate = ref(formatDate(defaultEnd))
const selectedCalendars = ref<string[]>([])

// 弹窗状态
const showModal = ref(false)
const editingEventId = ref<string | null>(null)
const titleInput = ref<HTMLInputElement | null>(null)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuItems = ref<MenuItem[]>([])
const selectedEvent = ref<CalendarEvent | null>(null)

// 确认弹窗状态
const confirmPopoverVisible = ref(false)
const confirmTargetRect = ref<DOMRect | null>(null)

// 详情弹窗状态
const eventDetailVisible = ref(false)

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
    const [year, month, day] = dateParam.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day, 0, 0, 0)
    startDate.value = formatDate(new Date(targetDate.getTime() - 7 * 86400000))
    endDate.value = formatDate(new Date(targetDate.getTime() + 7 * 86400000))
  }
}, { immediate: true })

// 筛选后的事件
const filteredEvents = computed(() => {
  let events = calendarStore.events

  // 按日历筛选
  if (selectedCalendars.value.length > 0) {
    events = events.filter(e => selectedCalendars.value.includes(e.calendarId))
  }

  // 辅助函数：将日期字符串解析为本地时间的 startOfDay
  function parseDateLocal(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }

  // 按日期范围筛选（时间交集匹配：事件与搜索范围有重叠即匹配）
  if (startDate.value) {
    const searchStart = parseDateLocal(startDate.value).getTime()
    if (endDate.value) {
      const searchEnd = parseDateLocal(endDate.value).getTime() + 86400000 // 包含结束日期当天
      // 重叠条件：event.startTime < searchEnd && event.endTime > searchStart
      events = events.filter(e => e.startTime < searchEnd && e.endTime > searchStart)
    } else {
      // 只有开始日期时，匹配 endTime > searchStart 的事件
      events = events.filter(e => e.endTime > searchStart)
    }
  } else if (endDate.value) {
    const searchEnd = parseDateLocal(endDate.value).getTime() + 86400000
    // 只有结束日期时，匹配 startTime < searchEnd 的事件
    events = events.filter(e => e.startTime < searchEnd)
  }

  // 按搜索词筛选
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    events = events.filter(e =>
      e.title.toLowerCase().includes(query) ||
      (e.description && e.description.toLowerCase().includes(query))
    )
  }

  // 按开始时间倒序排序（最新的在前）
  return [...events].sort((a, b) => b.startTime - a.startTime)
})

// 动态日程分组类型
interface EventGroup {
  key: string
  title: string
  events: CalendarEvent[]
}

const groupedEvents = computed((): EventGroup[] => {
  if (!filteredEvents.value.length) return []

  // 基于事件的本地开始日期进行动态聚合
  const groupsMap = new Map<string, CalendarEvent[]>()

  for (const event of filteredEvents.value) {
    const dateStr = formatDate(new Date(event.startTime))
    if (!groupsMap.has(dateStr)) {
      groupsMap.set(dateStr, [])
    }
    groupsMap.get(dateStr)!.push(event)
  }

  // 获取排好序的唯一日期（降序排列，最新的在前）
  const sortedDates = [...groupsMap.keys()].sort((a, b) => b.localeCompare(a))

  const todayStr = formatDate(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = formatDate(yesterday)

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = formatDate(tomorrow)

  const getWeekdayName = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[date.getDay()]
  }

  const getGroupTitle = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const weekday = getWeekdayName(dateStr)
    const formattedDate = `${m}月${d}日`
    
    if (dateStr === todayStr) {
      return `今天 (${formattedDate})`
    } else if (dateStr === yesterdayStr) {
      return `昨天 (${formattedDate})`
    } else if (dateStr === tomorrowStr) {
      return `明天 (${formattedDate})`
    } else {
      const currentYear = new Date().getFullYear()
      if (y !== currentYear) {
        return `${y}年${m}月${d}日 (${weekday})`
      }
      return `${formattedDate} (${weekday})`
    }
  }

  return sortedDates.map(dateStr => {
    const events = groupsMap.get(dateStr)!
    // 同一天内的日程，按开始时间正序（更早的排在上面）
    events.sort((a, b) => a.startTime - b.startTime)
    return {
      key: dateStr,
      title: getGroupTitle(dateStr),
      events
    }
  })
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

// 格式化事件时间
function formatEventTime(event: CalendarEvent): string {
  const start = formatTime(new Date(event.startTime))
  const end = formatTime(new Date(event.endTime))
  return `${start} - ${end}`
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

// 日程右键菜单
function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
  e.preventDefault()
  selectedEvent.value = event
  contextMenuItems.value = [
    { label: '编辑', icon: '✏️', action: () => { openEditModal(event); contextMenuVisible.value = false } },
    { label: '删除', icon: '🗑️', separator: true, action: () => showDeleteConfirm(e) },
    { label: '详情', icon: '📋', action: () => { eventDetailVisible.value = true; contextMenuVisible.value = false } }
  ]
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

function showDeleteConfirm(e: MouseEvent) {
  confirmTargetRect.value = (e.target as HTMLElement).getBoundingClientRect()
  confirmPopoverVisible.value = true
  contextMenuVisible.value = false
}

function handleConfirmDelete() {
  if (selectedEvent.value) {
    calendarStore.deleteEvent(selectedEvent.value.id)
  }
  confirmPopoverVisible.value = false
  selectedEvent.value = null
}

function handleCancelDelete() {
  confirmPopoverVisible.value = false
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

  // 解析日期字符串为本地时间（避免UTC偏移）
  function parseLocalDate(dateStr: string, timeStr?: string): number {
    const [year, month, day] = dateStr.split('-').map(Number)
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return new Date(year, month - 1, day, hours, minutes).getTime()
    }
    return new Date(year, month - 1, day).getTime()
  }

  const startDateTime = formData.value.allDay
    ? parseLocalDate(formData.value.startDate)
    : parseLocalDate(formData.value.startDate, formData.value.startTime)

  const endDateTime = formData.value.allDay
    ? parseLocalDate(formData.value.endDate) + 86400000 - 1  // 当天 23:59:59
    : parseLocalDate(formData.value.endDate, formData.value.endTime)

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
  padding: 32px 24px;
}

/* Header */
.schedules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
  letter-spacing: -0.8px;
}

.event-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 3px 10px;
  border-radius: 20px;
  border: 1px solid var(--border-color);
}

/* Filters 看板 ── 升级为极细描边微磨砂面板 */
.filters-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
  padding: 20px;
  background: var(--bg-secondary);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm), inset 0 1px 1px rgba(255, 255, 255, 0.05);
}

/* Search */
.search-wrapper {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  pointer-events: none;
  transition: color var(--transition-fast);
}

.search-input {
  width: 100%;
  padding: 11px 14px 11px 40px;
  background: var(--bg-tertiary);
  border: 1.2px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: all var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.search-input:focus + .search-icon {
  color: var(--accent-color);
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

/* Date Range Filter */
.date-range-filter {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-input {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1.2px solid var(--border-color);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--text-primary);
  font-size: 13.5px;
  outline: none;
  transition: all var(--transition-fast);
}

.date-input:focus {
  border-color: var(--accent-color);
  background: var(--bg-primary);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.date-separator {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.clear-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: scale(1.05);
}

/* Calendar Filter */
.calendar-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px dashed var(--border-color);
}

.calendar-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-tertiary);
  border: 1.2px solid var(--border-color);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.calendar-chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

.calendar-chip.active {
  background: var(--calendar-active-bg);
  border-color: var(--calendar-color);
  color: var(--calendar-color);
  font-weight: 600;
}

.calendar-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.calendar-chip:hover .calendar-dot {
  transform: scale(1.3);
}

/* Events List ── 空气感流线 Timeline */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.date-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 莫兰迪空气感时间标头（去下划线分割线） */
.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
  margin-bottom: 4px;
}

.date-label-badge {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 4px 14px;
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
}

.date-count {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.date-events {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 日程卡片 ── 升级为物理悬浮气泡卡片 */
.event-item {
  display: flex;
  align-items: stretch;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

/* Hover 时所属日历色彩柔和微光与位移 */
.event-item:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--calendar-color, var(--accent-color)) 4%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--calendar-color, var(--accent-color)) 25%, var(--border-color));
  box-shadow: var(--shadow-md), 0 4px 12px color-mix(in srgb, var(--calendar-color, var(--accent-color)) 6%, transparent);
}

/* 专属日历 Ribbon 色条 */
.event-color-ribbon {
  width: 4px;
  flex-shrink: 0;
  background: var(--calendar-color);
  transition: width var(--transition-fast);
}

.event-item:hover .event-color-ribbon {
  width: 6px;
}

.event-content {
  flex: 1;
  padding: 14px 20px;
  cursor: pointer;
  min-width: 0;
}

.event-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.event-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
}

.all-day-badge {
  background: var(--accent-color);
  color: white;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 20px;
  font-weight: 600;
  flex-shrink: 0;
}

.event-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.time-icon-svg {
  color: var(--text-tertiary);
}

.event-description {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 2px;
}

/* 操作区域 */
.event-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  position: relative;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9) translateX(10px);
  transition: all var(--transition-fast);
}

/* Hover 时淡入操作按钮，淡出向右箭头 */
.event-item:hover .action-btn {
  opacity: 1;
  transform: scale(1) translateX(0);
}

/* 操作按钮悬停效果 */
.edit-btn:hover {
  background: var(--accent-light);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.delete-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

/* 快捷向右进入小箭头 */
.hover-action-arrow {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  opacity: 1;
  transition: all var(--transition-fast);
  pointer-events: none;
}

.event-item:hover .hover-action-arrow {
  opacity: 0;
  transform: translateY(-50%) translateX(15px);
}

/* 空日程占位插画 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border-color);
  border-radius: 16px;
}

.empty-illustration {
  color: var(--text-tertiary);
  margin-bottom: 16px;
  opacity: 0.8;
  transition: transform var(--transition-fast);
}

.empty-state:hover .empty-illustration {
  transform: translateY(-4px) rotate(3deg);
}

.empty-text {
  font-size: 14.5px;
  font-weight: 500;
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
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-modal {
  width: 480px;
  max-width: 92vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

/* Form */
.form-group {
  margin-bottom: 18px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Toggle Switch */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  display: none;
}

.toggle-slider {
  width: 40px;
  height: 22px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  position: relative;
  transition: all var(--transition-fast);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.toggle-input:checked + .toggle-slider {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.toggle-input:checked + .toggle-slider::after {
  transform: translateX(18px);
}

.toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

/* Date Time Section */
.datetime-section {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 18px;
}

.datetime-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.datetime-row:not(:last-child) {
  margin-bottom: 12px;
}

.datetime-label {
  width: 40px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: right;
}

.datetime-inputs {
  flex: 1;
  display: flex;
  gap: 10px;
}

/* Calendar Selector */
.calendar-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.calendar-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-tertiary);
  border: 1.2px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.calendar-option:hover {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.calendar-option.active {
  border-color: var(--accent-color);
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.calendar-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Modal Actions */
.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding-top: 20px;
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
  transform: scale(0.96) translateY(12px);
}

.modal-leave-to .event-modal {
  opacity: 0;
  transform: scale(0.96);
}

/* Fluent Components */
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 18px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-button:hover {
  background: var(--bg-hover);
  transform: translateY(-1px);
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
  transform: none;
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

.fluent-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1.2px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  outline: none;
  font-size: 13.5px;
  transition: all var(--transition-fast);
}

.fluent-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.fluent-input::placeholder {
  color: var(--text-tertiary);
}
</style>
