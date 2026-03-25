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

    <!-- 提醒设置 -->
    <div class="settings-section">
      <h3>提醒设置</h3>
      <div class="setting-item">
        <label>全天事件提醒时间</label>
        <select v-model="settings.allDayReminderTime" @change="saveSettings">
          <option value="evening_before">前一天晚上</option>
          <option value="morning">当天早上</option>
        </select>
      </div>
      <div class="setting-item">
        <label>全天事件提醒小时</label>
        <select v-model="settings.allDayReminderHour" @change="saveSettings">
          <option v-for="h in 24" :key="h-1" :value="h-1">{{ h-1 }}:00</option>
        </select>
      </div>
      <div class="setting-item">
        <label>提醒强度</label>
        <select v-model="settings.reminderMode" @change="saveSettings">
          <option value="standard">标准</option>
          <option value="strong">强提醒</option>
          <option value="silent">静默</option>
        </select>
      </div>
      <div class="setting-item">
        <label>自定义通知标题模板</label>
        <input type="text" v-model="settings.customReminderTitle" @change="saveSettings" placeholder="例如：{title} - 提醒" />
      </div>
      <div class="setting-item">
        <label>自定义通知正文模板</label>
        <input type="text" v-model="settings.customReminderBody" @change="saveSettings" placeholder="例如：您有一个事件即将开始：{title}" />
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
      <div class="setting-item">
        <label>自动更新</label>
        <input type="checkbox" v-model="settings.autoUpdate" @change="saveSettings" />
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
            <div class="cal-type">
              <span v-if="cal.type === 'local'">本地</span>
              <span v-else class="external-type">{{ cal.type }}</span>
              <span v-if="cal.lastSync" class="sync-time">最后同步: {{ formatSyncTime(cal.lastSync) }}</span>
            </div>
            <div v-if="cal.syncStatus" class="sync-status" :class="cal.syncStatus">
              {{ getSyncStatusText(cal.syncStatus) }}
            </div>
          </div>
          <div class="cal-actions">
            <input type="checkbox" :checked="cal.visible" @change="toggleCalendar(cal.id)" />
            <button v-if="cal.type !== 'local'" class="sync-btn" @click="syncCalendar(cal.id)" :disabled="syncingIds.includes(cal.id)">
              {{ syncingIds.includes(cal.id) ? '同步中...' : '立即同步' }}
            </button>
            <button v-if="cal.type !== 'local'" class="delete-btn" @click="confirmDeleteAccount(cal.id, cal.name)">删除账号</button>
          </div>
        </div>
      </div>
      <button class="add-calendar-btn" @click="showAddCalendarDialog = true">+ 添加外部日历</button>
    </div>

    <!-- 添加外部日历对话框 -->
    <div v-if="showAddCalendarDialog" class="dialog-overlay" @click.self="closeAddCalendarDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h3>添加外部日历</h3>
          <button class="close-btn" @click="closeAddCalendarDialog">×</button>
        </div>
        <div class="dialog-body">
          <div class="form-group">
            <label>日历类型</label>
            <select v-model="addCalendarForm.type">
              <option value="exchange">Exchange</option>
              <option value="caldav">CalDAV</option>
            </select>
          </div>
          <div class="form-group">
            <label>服务器地址 <span v-if="addCalendarForm.type === 'exchange'" class="optional-label">(可选)</span></label>
            <input 
              type="text" 
              v-model="addCalendarForm.serverUrl" 
              :placeholder="addCalendarForm.type === 'exchange' ? '留空自动发现（适用于 Office 365）' : '例如: https://caldav.example.com'"
            />
            <p v-if="addCalendarForm.type === 'exchange'" class="help-text">
              对于 Office 365 / Outlook 邮箱，服务器地址会自动发现，无需填写
            </p>
          </div>
          <div class="form-group">
            <label>{{ addCalendarForm.type === 'exchange' ? '邮箱地址' : '用户名' }}</label>
            <input type="text" v-model="addCalendarForm.username" :placeholder="addCalendarForm.type === 'exchange' ? '例如: user@outlook.com' : '用户名'" />
          </div>
          <div class="form-group">
            <label>密码</label>
            <input type="password" v-model="addCalendarForm.password" placeholder="密码" />
          </div>
          <div v-if="connectionError" class="error-message">{{ connectionError }}</div>
          <div v-if="connectionSuccess" class="success-message">连接成功！</div>
          <div v-if="discoveredCalendars.length > 0" class="discovered-calendars">
            <h4>发现的日历</h4>
            <div v-for="cal in discoveredCalendars" :key="cal.id" class="discovered-item">
              <input type="checkbox" :id="'cal-' + cal.id" :value="cal.id" v-model="selectedCalendars" />
              <label :for="'cal-' + cal.id">{{ cal.name }}</label>
            </div>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="cancel-btn" @click="closeAddCalendarDialog">取消</button>
          <button v-if="!connectionSuccess" class="connect-btn" @click="testConnection" :disabled="connecting">
            {{ connecting ? '连接中...' : '连接' }}
          </button>
          <button v-if="connectionSuccess" class="confirm-btn" @click="addExternalCalendars" :disabled="selectedCalendars.length === 0">
            添加选中的日历
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <div v-if="showDeleteConfirm" class="dialog-overlay" @click.self="showDeleteConfirm = false">
      <div class="dialog confirm-dialog">
        <div class="dialog-header">
          <h3>确认删除</h3>
          <button class="close-btn" @click="showDeleteConfirm = false">×</button>
        </div>
        <div class="dialog-body">
          <p>确定要删除账号 "{{ deleteTarget.name }}" 吗？</p>
          <p class="warning-text">此操作将删除该账号下的所有日历数据，且无法恢复。</p>
        </div>
        <div class="dialog-footer">
          <button class="cancel-btn" @click="showDeleteConfirm = false">取消</button>
          <button class="delete-confirm-btn" @click="deleteAccount">确认删除</button>
        </div>
      </div>
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
import {
  setAutostart,
  getAutostartEnabled,
  isTauri,
  invokeConnectExchange,
  invokeConnectCalDAV,
  invokeSyncCalendar,
  invokeDeleteAccount,
  invokeGetSyncStatus
} from '../utils/tauri'
import { saveExternalAccount } from '../utils/database'

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

// 添加外部日历对话框状态
const showAddCalendarDialog = ref(false)
const addCalendarForm = reactive({
  type: 'exchange' as 'exchange' | 'caldav',
  serverUrl: '',
  username: '',
  password: ''
})
const connecting = ref(false)
const connectionError = ref('')
const connectionSuccess = ref(false)
const discoveredCalendars = ref<Array<{ id: string; name: string }>>([])
const selectedCalendars = ref<string[]>([])

// 同步状态
const syncingIds = ref<string[]>([])

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const deleteTarget = reactive({ id: '', name: '' })

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

// 关闭添加日历对话框
function closeAddCalendarDialog() {
  showAddCalendarDialog.value = false
  addCalendarForm.type = 'exchange'
  addCalendarForm.serverUrl = ''
  addCalendarForm.username = ''
  addCalendarForm.password = ''
  connectionError.value = ''
  connectionSuccess.value = false
  discoveredCalendars.value = []
  selectedCalendars.value = []
}

// 测试连接
async function testConnection() {
  // 对于 Exchange，服务器地址是可选的
  if (addCalendarForm.type === 'exchange') {
    if (!addCalendarForm.username || !addCalendarForm.password) {
      connectionError.value = '请填写邮箱地址和密码'
      return
    }
  } else {
    if (!addCalendarForm.serverUrl || !addCalendarForm.username || !addCalendarForm.password) {
      connectionError.value = '请填写所有必填字段'
      return
    }
  }

  connecting.value = true
  connectionError.value = ''
  connectionSuccess.value = false

  try {
    let result
    if (addCalendarForm.type === 'exchange') {
      result = await invokeConnectExchange(
        addCalendarForm.serverUrl || null,  // 允许为空，将自动发现
        addCalendarForm.username,
        addCalendarForm.password
      )
    } else {
      result = await invokeConnectCalDAV(
        addCalendarForm.serverUrl,
        addCalendarForm.username,
        addCalendarForm.password
      )
    }

    if (result && result.success) {
      connectionSuccess.value = true
      discoveredCalendars.value = result.data?.calendars || []
      selectedCalendars.value = discoveredCalendars.value.map(c => c.id)
      
      // 保存账号到数据库
      if (result.data) {
        await saveExternalAccount({
          id: result.data.id,
          type: result.data.account_type,
          serverUrl: result.data.server_url,
          username: result.data.username,
          encryptedPassword: result.data.encrypted_password,
          displayName: result.data.display_name,
          enabled: result.data.enabled,
          createdAt: Date.now()
        })
      }
    } else {
      connectionError.value = result?.error || '连接失败，请检查服务器地址和凭据'
    }
  } catch (error) {
    connectionError.value = '连接失败：' + (error instanceof Error ? error.message : '未知错误')
  } finally {
    connecting.value = false
  }
}

// 添加外部日历
async function addExternalCalendars() {
  if (selectedCalendars.value.length === 0) return

  // 将选中的日历添加到 calendarStore
  for (const calId of selectedCalendars.value) {
    const cal = discoveredCalendars.value.find(c => c.id === calId)
    if (cal) {
      calendarStore.addCalendar({
        name: cal.name,
        color: '#6B7280',
        type: addCalendarForm.type,
        accountId: calId, // 使用日历 ID 作为账号 ID
        visible: true,
        syncEnabled: true
      })
    }
  }

  // 刷新日历列表
  await calendarStore.loadExternalCalendars()
  closeAddCalendarDialog()
}

// 同步单个日历
async function syncCalendar(accountId: string) {
  if (syncingIds.value.includes(accountId)) return

  syncingIds.value.push(accountId)

  try {
    await invokeSyncCalendar(accountId)
    // 更新同步状态
    const status = await invokeGetSyncStatus(accountId)
    if (status) {
      const cal = calendarStore.calendars.find(c => c.id === accountId)
      if (cal) {
        calendarStore.updateCalendar(accountId, {
          syncStatus: status.status,
          lastSync: status.lastSync
        })
      }
    }
  } catch (error) {
    console.error('Sync failed:', error)
  } finally {
    syncingIds.value = syncingIds.value.filter(id => id !== accountId)
  }
}

// 确认删除账号
function confirmDeleteAccount(accountId: string, accountName: string) {
  deleteTarget.id = accountId
  deleteTarget.name = accountName
  showDeleteConfirm.value = true
}

// 删除账号
async function deleteAccount() {
  try {
    await invokeDeleteAccount(deleteTarget.id)
    // 从日历列表中移除
    calendarStore.deleteCalendar(deleteTarget.id)
    showDeleteConfirm.value = false
  } catch (error) {
    console.error('Delete failed:', error)
  }
}

// 格式化同步时间
function formatSyncTime(timestamp: string | number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return date.toLocaleDateString()
}

// 获取同步状态文本
function getSyncStatusText(status: string): string {
  switch (status) {
    case 'syncing': return '同步中...'
    case 'success': return '同步成功'
    case 'error': return '同步失败'
    case 'idle': return '待同步'
    default: return ''
  }
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

.setting-item input[type="text"] {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 200px;
  font-size: 13px;
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

/* 日历操作按钮 */
.cal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-btn {
  padding: 6px 12px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
}

.sync-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.sync-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-btn {
  padding: 6px 12px;
  background: transparent;
  color: #dc2626;
  border: 1px solid #dc2626;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #fee2e2;
}

/* 外部日历类型标识 */
.external-type {
  display: inline-block;
  padding: 2px 6px;
  background: var(--accent-color);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 10px;
  margin-left: 8px;
}

.sync-time {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 8px;
}

.sync-status {
  font-size: 11px;
  margin-top: 4px;
}

.sync-status.syncing {
  color: #f59e0b;
}

.sync-status.success {
  color: #10b981;
}

.sync-status.error {
  color: #dc2626;
}

.sync-status.idle {
  color: var(--text-secondary);
}

/* 对话框样式 */
.dialog-overlay {
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

.dialog {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.dialog-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.close-btn:hover {
  background: var(--bg-secondary);
}

.dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent-color);
}

.optional-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: normal;
  margin-left: 4px;
}

.help-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.5;
}

.error-message {
  padding: 12px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: var(--radius-md);
  font-size: 13px;
  margin-bottom: 16px;
}

.success-message {
  padding: 12px;
  background: #d1fae5;
  color: #059669;
  border-radius: var(--radius-md);
  font-size: 13px;
  margin-bottom: 16px;
}

.discovered-calendars {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.discovered-calendars h4 {
  font-size: 14px;
  margin-bottom: 12px;
}

.discovered-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.discovered-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.discovered-item label {
  font-size: 14px;
  cursor: pointer;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
}

.cancel-btn {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
}

.cancel-btn:hover {
  background: var(--bg-secondary);
}

.connect-btn,
.confirm-btn {
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
}

.connect-btn:hover:not(:disabled),
.confirm-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.connect-btn:disabled,
.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-confirm-btn {
  padding: 10px 20px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
}

.delete-confirm-btn:hover {
  background: #b91c1c;
}

.confirm-dialog {
  max-width: 400px;
}

.confirm-dialog .dialog-body p {
  margin: 0 0 12px 0;
}

.warning-text {
  color: #dc2626;
  font-size: 13px;
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