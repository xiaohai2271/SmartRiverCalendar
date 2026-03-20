<template>
  <div class="calendar-view">
    <!-- Header -->
    <div class="calendar-header">
      <div class="header-left">
        <button class="today-btn" @click="calendarStore.goToToday()">今天</button>
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
      <MonthView v-if="calendarStore.currentView === 'month'" />
      <WeekView v-else-if="calendarStore.currentView === 'week'" />
      <DayView v-else-if="calendarStore.currentView === 'day'" />
      <YearView v-else-if="calendarStore.currentView === 'year'" />
    </div>

    <!-- Add Event Button -->
    <button class="add-event-btn" @click="showEventModal = true">+</button>

    <!-- Event Modal -->
    <div v-if="showEventModal" class="modal-overlay" @click.self="showEventModal = false">
      <div class="event-modal">
        <h3>新建事件</h3>
        <form @submit.prevent="handleCreateEvent">
          <div class="form-group">
            <label>标题</label>
            <input v-model="newEvent.title" type="text" placeholder="事件标题" required />
          </div>
          <div class="form-group">
            <label>全天</label>
            <input v-model="newEvent.allDay" type="checkbox" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始</label>
              <input v-model="newEvent.startDate" type="date" required />
              <input v-if="!newEvent.allDay" v-model="newEvent.startTime" type="time" />
            </div>
            <div class="form-group">
              <label>结束</label>
              <input v-model="newEvent.endDate" type="date" required />
              <input v-if="!newEvent.allDay" v-model="newEvent.endTime" type="time" />
            </div>
          </div>
          <div class="form-group">
            <label>日历</label>
            <select v-model="newEvent.calendarId">
              <option v-for="cal in calendarStore.calendars" :key="cal.id" :value="cal.id">
                {{ cal.name }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newEvent.description" placeholder="可选描述"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-cancel" @click="showEventModal = false">取消</button>
            <button type="submit" class="btn-submit">创建</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCalendarStore } from '../stores/calendar'
import MonthView from '../components/calendar/MonthView.vue'
import WeekView from '../components/calendar/WeekView.vue'
import DayView from '../components/calendar/DayView.vue'
import YearView from '../components/calendar/YearView.vue'
import { formatDateLocale } from '../utils/date'
import type { CalendarView } from '../types'

const calendarStore = useCalendarStore()

const views: { value: CalendarView; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' }
]

const formattedDate = computed(() => {
  return formatDateLocale(calendarStore.currentDate, 'zh-CN')
})

const showEventModal = ref(false)
const newEvent = ref({
  title: '',
  allDay: true,
  startDate: '',
  startTime: '09:00',
  endDate: '',
  endTime: '10:00',
  calendarId: 'default',
  description: ''
})

function handleCreateEvent() {
  const startDateTime = newEvent.value.allDay
    ? new Date(newEvent.value.startDate).getTime()
    : new Date(`${newEvent.value.startDate}T${newEvent.value.startTime}`).getTime()

  const endDateTime = newEvent.value.allDay
    ? new Date(newEvent.value.endDate).getTime() + 86400000
    : new Date(`${newEvent.value.endDate}T${newEvent.value.endTime}`).getTime()

  calendarStore.addEvent({
    title: newEvent.value.title,
    description: newEvent.value.description,
    startTime: startDateTime,
    endTime: endDateTime,
    allDay: newEvent.value.allDay,
    calendarId: newEvent.value.calendarId
  })

  showEventModal.value = false
  newEvent.value = {
    title: '',
    allDay: true,
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    calendarId: 'default',
    description: ''
  }
}
</script>

<style scoped>
.calendar-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

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
}

.today-btn {
  padding: 8px 16px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.today-btn:hover {
  opacity: 0.9;
}

.nav-buttons {
  display: flex;
  gap: 4px;
}

.nav-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
}

.nav-btn:hover {
  background: var(--bg-hover);
}

.current-date {
  font-size: 20px;
  font-weight: 600;
}

.view-switcher {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.view-btn {
  padding: 8px 16px;
  border: none;
  background: var(--bg-secondary);
  cursor: pointer;
  font-size: 14px;
}

.view-btn:not(:last-child) {
  border-right: 1px solid var(--border-color);
}

.view-btn.active {
  background: var(--accent-color);
  color: white;
}

.calendar-content {
  flex: 1;
  overflow: auto;
}

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
  font-size: 28px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(74, 144, 217, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-event-btn:hover {
  transform: scale(1.05);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-height: 80vh;
  overflow: auto;
}

.event-modal h3 {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.form-group input[type="text"],
.form-group input[type="date"],
.form-group input[type="time"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-cancel {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
}

.btn-submit {
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>