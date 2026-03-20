<template>
  <div class="settings-view">
    <h2>设置</h2>

    <!-- 外观设置 -->
    <div class="settings-section">
      <h3>外观</h3>
      <div class="setting-item">
        <label>主题</label>
        <select v-model="settings.theme" @change="saveSettings">
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="auto">跟随系统</option>
        </select>
      </div>
    </div>

    <!-- 日历显示设置 -->
    <div class="settings-section">
      <h3>日历显示</h3>
      <div class="setting-item">
        <label>显示农历</label>
        <input type="checkbox" v-model="settings.showLunar" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>显示农历节日</label>
        <input type="checkbox" v-model="settings.showLunarFestival" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>显示节气</label>
        <input type="checkbox" v-model="settings.showSolarTerm" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>显示法定节假日</label>
        <input type="checkbox" v-model="settings.showHoliday" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>显示补休/调休</label>
        <input type="checkbox" v-model="settings.showMakeupDay" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>周末标识</label>
        <input type="checkbox" v-model="settings.showWeekend" @change="saveSettings" />
      </div>
    </div>

    <!-- 节假日管理 -->
    <div class="settings-section">
      <h3>节假日管理</h3>
      <p class="section-desc">添加或调整法定节假日、补休日期</p>

      <div class="holiday-tabs">
        <button
          :class="['tab-btn', { active: holidayTab === 'holidays' }]"
          @click="holidayTab = 'holidays'"
        >
          节假日 ({{ Object.keys(holidays).length }})
        </button>
        <button
          :class="['tab-btn', { active: holidayTab === 'makeup' }]"
          @click="holidayTab = 'makeup'"
        >
          调休 ({{ Object.keys(makeupDays).length }})
        </button>
      </div>

      <!-- 节假日列表 -->
      <div v-if="holidayTab === 'holidays'" class="holiday-list">
        <div v-for="(name, date) in holidays" :key="date" class="holiday-item">
          <span class="holiday-date">{{ date }}</span>
          <span class="holiday-name">{{ name }}</span>
          <button class="delete-btn" @click="removeHoliday(date as string)">×</button>
        </div>
        <div class="add-holiday-form">
          <input v-model="newHoliday.date" type="date" placeholder="日期" />
          <input v-model="newHoliday.name" type="text" placeholder="节日名称" />
          <button @click="addNewHoliday">添加</button>
        </div>
      </div>

      <!-- 调休列表 -->
      <div v-if="holidayTab === 'makeup'" class="holiday-list">
        <div v-for="(name, date) in makeupDays" :key="date" class="holiday-item makeup">
          <span class="holiday-date">{{ date }}</span>
          <span class="holiday-name">{{ name }}</span>
          <button class="delete-btn" @click="removeMakeupDay(date as string)">×</button>
        </div>
        <div class="add-holiday-form">
          <input v-model="newMakeup.date" type="date" placeholder="日期" />
          <input v-model="newMakeup.name" type="text" placeholder="调休原因" />
          <button @click="addNewMakeupDay">添加</button>
        </div>
      </div>
    </div>

    <!-- 日历基础设置 -->
    <div class="settings-section">
      <h3>日历</h3>
      <div class="setting-item">
        <label>默认视图</label>
        <select v-model="settings.defaultView" @change="saveSettings">
          <option value="day">日视图</option>
          <option value="week">周视图</option>
          <option value="month">月视图</option>
          <option value="year">年视图</option>
        </select>
      </div>
      <div class="setting-item">
        <label>每周起始日</label>
        <select v-model="settings.firstDayOfWeek" @change="saveSettings">
          <option :value="0">周日</option>
          <option :value="1">周一</option>
        </select>
      </div>
      <div class="setting-item">
        <label>默认提醒时间</label>
        <select v-model="settings.defaultReminder" @change="saveSettings">
          <option :value="5">5分钟前</option>
          <option :value="15">15分钟前</option>
          <option :value="30">30分钟前</option>
          <option :value="60">1小时前</option>
          <option :value="1440">1天前</option>
        </select>
      </div>
    </div>

    <!-- 系统设置 -->
    <div class="settings-section">
      <h3>系统</h3>
      <div class="setting-item">
        <label>启动时最小化</label>
        <input type="checkbox" v-model="settings.startMinimized" @change="saveSettings" />
      </div>
      <div class="setting-item">
        <label>开机自启</label>
        <input type="checkbox" v-model="settings.autoStart" @change="handleAutoStartChange" />
      </div>
    </div>

    <!-- 日历账户管理 -->
    <div class="settings-section">
      <h3>日历管理</h3>
      <div class="calendars-list">
        <div v-for="cal in calendarStore.calendars" :key="cal.id" class="calendar-item">
          <div class="cal-color" :style="{ background: cal.color }"></div>
          <div class="cal-info">
            <div class="cal-name">{{ cal.name }}</div>
            <div class="cal-type">{{ cal.type === 'local' ? '本地' : cal.type }}</div>
          </div>
          <div class="cal-actions">
            <input type="checkbox" :checked="cal.visible" @change="toggleCalendar(cal.id)" />
          </div>
        </div>
      </div>
      <button class="add-calendar-btn" @click="addCalendar">+ 添加日历</button>
    </div>

    <!-- 关于 -->
    <div class="settings-section">
      <h3>关于</h3>
      <div class="about-info">
        <p>小河日历</p>
        <p>版本: 0.1.0</p>
        <p class="copyright">打造最强替代系统日历的智能日历软件</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useCalendarStore } from '../stores/calendar'
import {
  getAllHolidays,
  getAllMakeupDays,
  addHoliday as addHolidayFn,
  addMakeupDay as addMakeupDayFn,
  removeHoliday as removeHolidayFn,
  removeMakeupDay as removeMakeupDayFn
} from '../utils/lunar'
import { setAutostart, getAutostartEnabled, isTauri } from '../utils/tauri'

const settingsStore = useSettingsStore()
const calendarStore = useCalendarStore()

const settings = computed(() => settingsStore.settings)

// 节假日数据
const holidays = ref<Record<string, string>>(getAllHolidays())
const makeupDays = ref<Record<string, string>>(getAllMakeupDays())
const holidayTab = ref<'holidays' | 'makeup'>('holidays')

// 新增节假日表单
const newHoliday = reactive({ date: '', name: '' })
const newMakeup = reactive({ date: '', name: '' })

// 初始化自启动状态
onMounted(async () => {
  if (isTauri()) {
    const enabled = await getAutostartEnabled()
    settingsStore.updateSettings({ autoStart: enabled })
  }
})

async function saveSettings() {
  settingsStore.saveSettings()
}

// 处理自启动设置变化
async function handleAutoStartChange() {
  if (isTauri()) {
    const success = await setAutostart(settings.value.autoStart)
    if (!success) {
      // 如果设置失败，恢复原状态
      settingsStore.updateSettings({ autoStart: !settings.value.autoStart })
    }
  }
  saveSettings()
}

function toggleCalendar(id: string) {
  const cal = calendarStore.calendars.find(c => c.id === id)
  if (cal) {
    calendarStore.updateCalendar(id, { visible: !cal.visible })
  }
}

function addCalendar() {
  console.log('Add calendar')
}

// 添加节假日
function addNewHoliday() {
  if (newHoliday.date && newHoliday.name) {
    addHolidayFn(newHoliday.date, newHoliday.name)
    holidays.value = getAllHolidays()
    newHoliday.date = ''
    newHoliday.name = ''
  }
}

// 移除节假日
function removeHoliday(date: string) {
  removeHolidayFn(date)
  holidays.value = getAllHolidays()
}

// 添加调休
function addNewMakeupDay() {
  if (newMakeup.date && newMakeup.name) {
    addMakeupDayFn(newMakeup.date, newMakeup.name)
    makeupDays.value = getAllMakeupDays()
    newMakeup.date = ''
    newMakeup.name = ''
  }
}

// 移除调休
function removeMakeupDay(date: string) {
  removeMakeupDayFn(date)
  makeupDays.value = getAllMakeupDays()
}
</script>

<style scoped>
.settings-view {
  max-width: 600px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 24px;
}

.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 20px;
}

.settings-section h3 {
  font-size: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.setting-item label {
  font-size: 14px;
}

.setting-item select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 150px;
}

.setting-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

/* 节假日管理样式 */
.holiday-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
}

.tab-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.holiday-list {
  max-height: 300px;
  overflow-y: auto;
}

.holiday-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.holiday-item:last-of-type {
  border-bottom: none;
}

.holiday-date {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 100px;
}

.holiday-name {
  flex: 1;
  font-size: 14px;
}

.holiday-item.makeup .holiday-name {
  color: #2563eb;
}

.delete-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 18px;
  border-radius: var(--radius-sm);
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

.add-holiday-form {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.add-holiday-form input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

.add-holiday-form button {
  padding: 8px 16px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
}

.calendars-list {
  margin-bottom: 16px;
}

.calendar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.calendar-item:last-child {
  border-bottom: none;
}

.cal-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

.cal-info {
  flex: 1;
}

.cal-name {
  font-weight: 500;
}

.cal-type {
  font-size: 12px;
  color: var(--text-secondary);
}

.add-calendar-btn {
  width: 100%;
  padding: 12px;
  border: 1px dashed var(--border-color);
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
}

.add-calendar-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.about-info {
  text-align: center;
  color: var(--text-secondary);
}

.about-info p {
  margin: 8px 0;
}

.copyright {
  font-size: 13px;
  margin-top: 16px !important;
}
</style>