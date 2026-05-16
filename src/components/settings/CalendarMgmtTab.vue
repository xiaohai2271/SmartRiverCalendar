<template>
  <div class="calendar-mgmt-tab">
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
              <span v-else-if="cal.type === 'online'">在线</span>
              <span v-else class="external-type">{{ cal.type }}</span>
              <span v-if="cal.readOnly" class="readonly-badge">只读</span>
              <span v-if="cal.lastSync" class="sync-time">最后同步: {{ formatSyncTime(cal.lastSync) }}</span>
            </div>
            <div v-if="cal.syncStatus" class="sync-status" :class="cal.syncStatus">
              {{ getSyncStatusText(cal.syncStatus) }}
            </div>
          </div>
          <div class="cal-actions">
            <input type="checkbox" :checked="cal.visible" @change="toggleCalendar(cal.id)" />
            <button v-if="cal.type === 'exchange' || cal.type === 'caldav'" class="delete-btn" @click="confirmDeleteAccount(cal.id, cal.name)" aria-label="删除账号">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
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
  </div>
</template>

<script setup lang="ts">
/**
 * 日历管理 Tab 内容组件
 * 包含日历列表管理、外部日历添加、账号删除功能
 */
import { ref, reactive } from 'vue'
import { useCalendarStore } from '../../stores/calendar'
import {
  isTauri,
  invokeConnectExchange,
  invokeConnectCalDAV,
  invokeDeleteAccount,
} from '../../utils/tauri'
import { saveExternalAccount, getAccountByServerUrl } from '../../utils/database'

// ==================== Store ====================
const calendarStore = useCalendarStore()

// ==================== State ====================
// 添加外部日历对话框状态
const showAddCalendarDialog = ref(false)
const addCalendarForm = reactive({
  type: 'caldav' as 'exchange' | 'caldav',
  serverUrl: '',
  username: '',
  password: ''
})
const connecting = ref(false)
const connectionError = ref('')
const connectionSuccess = ref(false)
const discoveredCalendars = ref<Array<{ id: string; name: string }>>([])
const selectedCalendars = ref<string[]>([])

// 删除确认对话框状态
const showDeleteConfirm = ref(false)
const deleteTarget = reactive({ id: '', name: '' })

// ==================== Methods ====================
/**
 * 切换日历可见性
 */
function toggleCalendar(id: string): void {
  const cal = calendarStore.calendars.find(c => c.id === id)
  if (cal) {
    calendarStore.updateCalendar(id, { visible: !cal.visible })
  }
}

/**
 * 关闭添加日历对话框
 */
function closeAddCalendarDialog(): void {
  showAddCalendarDialog.value = false
  addCalendarForm.type = 'caldav'
  addCalendarForm.serverUrl = ''
  addCalendarForm.username = ''
  addCalendarForm.password = ''
  connectionError.value = ''
  connectionSuccess.value = false
  discoveredCalendars.value = []
  selectedCalendars.value = []
}

/**
 * 测试外部日历连接
 */
async function testConnection(): Promise<void> {
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
      const caldavResult = await invokeConnectCalDAV(
        addCalendarForm.serverUrl,
        addCalendarForm.username,
        addCalendarForm.password
      )

      // CalDAV 返回 ConnectResult 结构（account + calendars）
      result = caldavResult
    }

    if (result && result.success) {
      connectionSuccess.value = true
      discoveredCalendars.value = result.calendars || []
      selectedCalendars.value = discoveredCalendars.value.map(c => c.id)

      // 保存或更新账号到数据库
      if (result.account) {
        const existing = await getAccountByServerUrl(result.account.server_url, result.account.username)
        const accountToSave = {
          id: existing ? existing.id : result.account.id,
          type: result.account.account_type,
          serverUrl: result.account.server_url,
          username: result.account.username,
          encryptedPassword: result.account.encrypted_password,
          displayName: result.account.display_name,
          enabled: existing ? existing.enabled : true,
          createdAt: existing ? existing.createdAt : Date.now(),
          updatedAt: Date.now()
        }
        await saveExternalAccount(accountToSave)
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

/**
 * 添加选中的外部日历
 */
async function addExternalCalendars(): Promise<void> {
  if (selectedCalendars.value.length === 0) return

  // 刷新日历列表（从账号表读取账号，获取远程日历并添加）
  await calendarStore.loadExternalCalendars()
  closeAddCalendarDialog()
}

/**
 * 确认删除账号
 */
function confirmDeleteAccount(accountId: string, accountName: string): void {
  deleteTarget.id = accountId
  deleteTarget.name = accountName
  showDeleteConfirm.value = true
}

/**
 * 删除账号
 */
async function deleteAccount(): Promise<void> {
  if (!isTauri()) {
    showDeleteConfirm.value = false
    return
  }

  try {
    await invokeDeleteAccount(deleteTarget.id)
    // 从日历列表中移除
    calendarStore.deleteCalendar(deleteTarget.id)
    showDeleteConfirm.value = false
  } catch (error) {
    console.error('Delete failed:', error)
  }
}

/**
 * 格式化同步时间
 */
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

/**
 * 获取同步状态文本
 */
function getSyncStatusText(status: string): string {
  switch (status) {
    case 'syncing': return '同步中...'
    case 'success': return '同步成功'
    case 'error': return '同步失败'
    case 'idle': return '待同步'
    default: return ''
  }
}
</script>

<style scoped>
.calendar-mgmt-tab {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.settings-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.settings-section h3 {
  font-size: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
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

.delete-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
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

.readonly-badge {
  display: inline-block;
  padding: 2px 6px;
  background: var(--text-tertiary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 10px;
  margin-left: 4px;
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
</style>
