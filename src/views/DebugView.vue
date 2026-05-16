<template>
  <div class="debug-view">
    <div class="debug-header">
      <h2>调试页面</h2>
      <button class="back-btn" @click="goBack">返回设置</button>
    </div>

    <!-- 功能标签页 -->
    <div class="debug-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.name }}
      </button>
    </div>

    <!-- 日志 Dump -->
    <div v-if="activeTab === 'logs'" class="debug-section">
      <div class="section-header">
        <h3>日志导出</h3>
        <div class="log-controls">
          <div class="log-level-control">
            <label>日志级别</label>
            <select v-model="logLevel" @change="handleLogLevelChange" class="log-source-select">
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
              <option value="trace">Trace</option>
            </select>
          </div>
          <select v-model="logSource" @change="refreshLogs" class="log-source-select">
            <option value="all">全部日志</option>
            <option value="frontend">前端日志</option>
            <option value="backend">后端日志</option>
          </select>
          <button class="action-btn" @click="exportLogs" :disabled="exporting">
            {{ exporting ? '导出中...' : '导出日志' }}
          </button>
        </div>
      </div>
      <div class="log-viewer">
        <div v-if="logs.length === 0" class="empty-state">暂无日志</div>
        <div v-else class="log-list">
          <div v-for="(log, index) in logs" :key="index" :class="['log-item', log.level, log.source]">
            <span class="log-time">{{ log.time }}</span>
            <span v-if="log.source" class="log-source">{{ log.source === 'backend' ? '后端' : '前端' }}</span>
            <span class="log-level">{{ log.level.toUpperCase() }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
      <div class="section-actions">
        <button class="action-btn secondary" @click="clearLogs">清空日志</button>
        <button class="action-btn secondary" @click="refreshLogs">刷新日志</button>
      </div>
    </div>

    <!-- 数据表结构 -->
    <div v-if="activeTab === 'schema'" class="debug-section">
      <div class="section-header">
        <h3>数据表结构</h3>
        <button class="action-btn" @click="loadSchema" :disabled="loadingSchema">
          {{ loadingSchema ? '加载中...' : '刷新' }}
        </button>
      </div>
      <div v-if="schemaError" class="error-message">{{ schemaError }}</div>
      <div class="schema-list">
        <div v-for="table in schema" :key="table.name" class="schema-item">
          <div class="table-header" @click="toggleTable(table.name)">
            <span class="table-name">{{ table.name }}</span>
            <span class="table-count">{{ table.columns.length }} 字段</span>
            <span class="expand-icon">{{ expandedTables.includes(table.name) ? '▼' : '▶' }}</span>
          </div>
          <div v-if="expandedTables.includes(table.name)" class="table-columns">
            <div v-for="col in table.columns" :key="col.name" class="column-item">
              <span class="col-name">{{ col.name }}</span>
              <span class="col-type">{{ col.type }}</span>
              <span v-if="col.pk" class="col-pk">PK</span>
              <span v-if="col.notnull" class="col-notnull">NOT NULL</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据表数据 -->
    <div v-if="activeTab === 'data'" class="debug-section">
      <div class="section-header">
        <h3>数据表数据</h3>
        <div class="table-selector">
          <select v-model="selectedTable" @change="loadTableData">
            <option value="">选择数据表</option>
            <option v-for="table in schema" :key="table.name" :value="table.name">
              {{ table.name }}
            </option>
          </select>
        </div>
      </div>
      <div v-if="dataError" class="error-message">{{ dataError }}</div>
      <div v-if="loadingData" class="loading">加载中...</div>
      <div v-else-if="selectedTable && tableData.length > 0" class="data-viewer">
        <div class="data-stats">
          共 {{ tableData.length }} 条记录
          <button class="action-btn secondary small" @click="exportTableData">导出</button>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th v-for="col in tableColumns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in tableData" :key="index">
                <td v-for="col in tableColumns" :key="col">{{ formatValue(row[col]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else-if="selectedTable" class="empty-state">该表暂无数据</div>
    </div>

    <!-- 开发者工具 -->
    <div v-if="activeTab === 'devtools'" class="debug-section">
      <div class="section-header">
        <h3>开发者工具</h3>
      </div>
      <div class="devtools-actions">
        <div class="action-card">
          <h4>打开 DevTools</h4>
          <p>打开浏览器开发者工具控制台</p>
          <button class="action-btn" @click="openDevTools">打开控制台</button>
        </div>
        <div class="action-card">
          <h4>应用信息</h4>
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">应用名称:</span>
              <span class="info-value">{{ appInfo.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">版本号:</span>
              <span class="info-value">{{ appInfo.version }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">构建时间:</span>
              <span class="info-value">{{ appInfo.buildDate }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Git 提交:</span>
              <span class="info-value">{{ appInfo.gitHash }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">运行环境:</span>
              <span class="info-value">{{ isTauriEnv ? 'Tauri' : '浏览器' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">平台:</span>
              <span class="info-value">{{ platform }}</span>
            </div>
          </div>
        </div>
        <div class="action-card">
          <h4>存储管理</h4>
          <p>管理本地存储数据</p>
          <div class="action-buttons">
            <button class="action-btn secondary" @click="clearLocalStorage">清空 LocalStorage</button>
            <button class="action-btn secondary" @click="showStorageInfo">查看存储信息</button>
          </div>
        </div>
      </div>
    </div>

    <!-- API 配置 -->
    <div v-if="activeTab === 'api'" class="debug-section">
      <div class="section-header">
        <h3>API 配置</h3>
        <span :class="['mode-badge', apiConfig.mode]">
          {{ apiConfig.mode === 'mock' ? 'Mock 模式' : 'Real 模式' }}
        </span>
      </div>
      <div class="api-config-content">
        <div class="setting-item">
          <label>API 模式</label>
          <select v-model="apiConfig.mode" class="api-mode-select">
            <option value="mock">Mock（模拟数据）</option>
            <option value="real">Real（真实后端）</option>
          </select>
        </div>
        <div v-if="apiConfig.mode === 'real'" class="setting-item">
          <label>API 地址</label>
          <input
            v-model="apiConfig.baseUrl"
            type="text"
            class="api-url-input"
            placeholder="https://api.example.com/api/v1"
          />
        </div>
        <div class="api-config-actions">
          <button
            class="action-btn"
            @click="handleSwitchApiConfig"
            :disabled="switchingApi"
          >
            {{ switchingApi ? '切换中...' : '应用配置' }}
          </button>
        </div>
        <div v-if="apiConfigMessage" :class="['config-message', apiConfigMessageType]">
          {{ apiConfigMessage }}
        </div>
        <div class="config-warning">
          ⚠️ 切换 API 模式会清除当前登录状态和 Token，需要重新登录
        </div>
      </div>
    </div>

    <!-- 存储信息对话框 -->
    <div v-if="showStorageDialog" class="dialog-overlay" @click.self="showStorageDialog = false">
      <div class="dialog">
        <div class="dialog-header">
          <h3>存储信息</h3>
          <button class="close-btn" @click="showStorageDialog = false">×</button>
        </div>
        <div class="dialog-body">
          <div class="storage-info">
            <div v-for="(value, key) in storageInfo" :key="key" class="storage-item">
              <span class="storage-key">{{ key }}</span>
              <span class="storage-size">{{ formatSize(value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { isTauri, debugGetTableSchema, debugGetTableData, debugOpenDevTools, debugGetLogs, debugClearLogs, getApiConfig, switchApiConfig, getLogLevel, setLogLevel } from '../utils/tauri'
import { startLogCapture, stopLogCapture } from '../utils/logger'
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

const router = useRouter()

// 标签页定义
const tabs = [
  { id: 'logs', name: '日志' },
  { id: 'schema', name: '表结构' },
  { id: 'data', name: '数据' },
  { id: 'devtools', name: '开发工具' },
  { id: 'api', name: 'API 配置' }
]

const activeTab = ref('logs')

// 日志相关
interface LogEntry {
  time: string
  level: string
  message: string
  source?: string // 'frontend' | 'backend'
}
const logs = ref<LogEntry[]>([])
const exporting = ref(false)
const logSource = ref<'all' | 'frontend' | 'backend'>('all')
const logLevel = ref('info')

// 数据库结构相关
interface ColumnInfo {
  name: string
  type: string
  pk: boolean
  notnull: boolean
}
interface TableSchema {
  name: string
  columns: ColumnInfo[]
}
const schema = ref<TableSchema[]>([])
const loadingSchema = ref(false)
const schemaError = ref('')
const expandedTables = ref<string[]>([])

// 数据查看相关
const selectedTable = ref('')
const tableData = ref<Record<string, any>[]>([])
const tableColumns = computed(() => {
  if (tableData.value.length === 0) return []
  return Object.keys(tableData.value[0])
})
const loadingData = ref(false)
const dataError = ref('')

// 应用信息
const appInfo = reactive({
  name: '小河日历',
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  buildDate: typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '-',
  gitHash: typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : '-',
})
const isTauriEnv = computed(() => isTauri())
const platform = ref('')

// 存储信息
const showStorageDialog = ref(false)
const storageInfo = ref<Record<string, number>>({})

// API 配置相关
const apiConfig = reactive({
  mode: 'mock',
  baseUrl: 'http://localhost:3000/api',
})
const switchingApi = ref(false)
const apiConfigMessage = ref('')
const apiConfigMessageType = ref<'success' | 'error'>('success')

// 加载 API 配置
async function loadApiConfig() {
  if (!isTauri()) return
  try {
    const config = await getApiConfig()
    if (config) {
      apiConfig.mode = config.mode
      apiConfig.baseUrl = config.baseUrl
    }
  } catch (error) {
    console.error('获取 API 配置失败:', error)
  }
}

// 切换 API 配置
async function handleSwitchApiConfig() {
  // 确认对话框
  const confirmed = confirm(
    `确定要切换到 ${apiConfig.mode === 'mock' ? 'Mock' : 'Real'} 模式吗？\n\n` +
    '切换后会：\n' +
    '• 清除当前登录状态\n' +
    '• 清除缓存的 Token\n' +
    '• 需要重新登录\n\n' +
    (apiConfig.mode === 'real' ? `API 地址: ${apiConfig.baseUrl}\n\n` : '') +
    '是否继续？'
  )
  if (!confirmed) return

  switchingApi.value = true
  apiConfigMessage.value = ''

  try {
    const result = await switchApiConfig(apiConfig.mode, apiConfig.baseUrl)
    if (result?.success) {
      apiConfigMessage.value = `已切换到 ${result.mode === 'mock' ? 'Mock' : 'Real'} 模式`
      apiConfigMessageType.value = 'success'
    } else {
      apiConfigMessage.value = '切换失败'
      apiConfigMessageType.value = 'error'
    }
  } catch (error) {
    apiConfigMessage.value = `切换失败: ${error instanceof Error ? error.message : String(error)}`
    apiConfigMessageType.value = 'error'
  } finally {
    switchingApi.value = false
  }
}

// 返回设置页面
function goBack() {
  router.push('/settings')
}

// ==================== 日志功能 ====================

async function exportLogs() {
  exporting.value = true
  try {
    const logContent = logs.value.map(log => 
      `[${log.time}] [${log.level.toUpperCase()}]${log.source ? ` [${log.source}]` : ''} ${log.message}`
    ).join('\n')
    
    const defaultName = `小河日历_日志_${new Date().toISOString().slice(0, 10)}.txt`
    
    if (isTauri()) {
      // 使用 Tauri 的保存对话框
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: '文本文件', extensions: ['txt'] }]
      })
      
      if (filePath) {
        await writeTextFile(filePath, logContent)
      }
    } else {
      // 浏览器环境：使用传统下载方式
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('导出日志失败:', error)
  } finally {
    exporting.value = false
  }
}

async function refreshLogs() {
  const allLogs: LogEntry[] = []
  
  // 获取前端日志
  if (logSource.value === 'all' || logSource.value === 'frontend') {
    const storedLogs = localStorage.getItem('debug_logs')
    if (storedLogs) {
      try {
        const frontendLogs = JSON.parse(storedLogs)
        allLogs.push(...frontendLogs.map((l: LogEntry) => ({ ...l, source: 'frontend' })))
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  // 获取后端日志
  if ((logSource.value === 'all' || logSource.value === 'backend') && isTauri()) {
    try {
      const backendLogs = await debugGetLogs()
      allLogs.push(...backendLogs.map(l => ({
        time: l.timestamp,
        level: l.level.toLowerCase(),
        message: `[${l.target}] ${l.message}`,
        source: 'backend'
      })))
    } catch (error) {
      console.error('获取后端日志失败:', error)
    }
  }
  
  // 按时间排序（最新的在前面）
  allLogs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  
  if (allLogs.length === 0) {
    logs.value = [
      { time: new Date().toISOString(), level: 'info', message: '调试页面已打开', source: 'frontend' },
      { time: new Date().toISOString(), level: 'info', message: `当前环境: ${isTauri() ? 'Tauri' : '浏览器'}`, source: 'frontend' }
    ]
  } else {
    logs.value = allLogs
  }
}

async function clearLogs() {
  // 清空前端日志
  if (logSource.value === 'all' || logSource.value === 'frontend') {
    localStorage.removeItem('debug_logs')
  }
  
  // 清空后端日志
  if ((logSource.value === 'all' || logSource.value === 'backend') && isTauri()) {
    try {
      await debugClearLogs()
    } catch (error) {
      console.error('清空后端日志失败:', error)
    }
  }
  
  logs.value = []
}

// 处理日志级别变更
async function handleLogLevelChange() {
  if (!isTauri()) return
  try {
    await setLogLevel(logLevel.value)
    console.log(`[DebugView] 日志级别已切换为: ${logLevel.value}`)
  } catch (error) {
    console.error('设置日志级别失败:', error)
  }
}

// ==================== 数据库结构功能 ====================

async function loadSchema() {
  loadingSchema.value = true
  schemaError.value = ''
  
  try {
    if (isTauri()) {
      const result = await debugGetTableSchema()
      if (result && result.length > 0) {
        schema.value = result
      } else {
        schema.value = getDefaultSchema()
      }
    } else {
      schema.value = getDefaultSchema()
    }
  } catch (error) {
    console.error('加载表结构失败:', error)
    schemaError.value = '加载失败: ' + (error instanceof Error ? error.message : String(error))
    schema.value = getDefaultSchema()
  } finally {
    loadingSchema.value = false
  }
}

function getDefaultSchema(): TableSchema[] {
  return [
    {
      name: 'calendars',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'name', type: 'TEXT', pk: false, notnull: true },
        { name: 'color', type: 'TEXT', pk: false, notnull: true },
        { name: 'type', type: 'TEXT', pk: false, notnull: true },
        { name: 'account_id', type: 'INTEGER', pk: false, notnull: false },
        { name: 'visible', type: 'INTEGER', pk: false, notnull: true },
        { name: 'sync_enabled', type: 'INTEGER', pk: false, notnull: true },
        { name: 'created_at', type: 'INTEGER', pk: false, notnull: true },
        { name: 'updated_at', type: 'INTEGER', pk: false, notnull: true }
      ]
    },
    {
      name: 'events',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'title', type: 'TEXT', pk: false, notnull: true },
        { name: 'description', type: 'TEXT', pk: false, notnull: false },
        { name: 'start_time', type: 'INTEGER', pk: false, notnull: true },
        { name: 'end_time', type: 'INTEGER', pk: false, notnull: true },
        { name: 'all_day', type: 'INTEGER', pk: false, notnull: true },
        { name: 'calendar_id', type: 'INTEGER', pk: false, notnull: true },
        { name: 'color', type: 'TEXT', pk: false, notnull: false },
        { name: 'reminder', type: 'INTEGER', pk: false, notnull: false },
        { name: 'repeat_rule', type: 'TEXT', pk: false, notnull: false },
        { name: 'location', type: 'TEXT', pk: false, notnull: false },
        { name: 'external_id', type: 'TEXT', pk: false, notnull: false },
        { name: 'created_at', type: 'INTEGER', pk: false, notnull: true },
        { name: 'updated_at', type: 'INTEGER', pk: false, notnull: true }
      ]
    },
    {
      name: 'todos',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'title', type: 'TEXT', pk: false, notnull: true },
        { name: 'description', type: 'TEXT', pk: false, notnull: false },
        { name: 'due_date', type: 'INTEGER', pk: false, notnull: false },
        { name: 'completed', type: 'INTEGER', pk: false, notnull: true },
        { name: 'priority', type: 'TEXT', pk: false, notnull: true },
        { name: 'calendar_id', type: 'INTEGER', pk: false, notnull: true },
        { name: 'created_at', type: 'INTEGER', pk: false, notnull: true },
        { name: 'updated_at', type: 'INTEGER', pk: false, notnull: true }
      ]
    },
    {
      name: 'accounts',
      columns: [
        { name: 'id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'type', type: 'TEXT', pk: false, notnull: true },
        { name: 'server_url', type: 'TEXT', pk: false, notnull: true },
        { name: 'username', type: 'TEXT', pk: false, notnull: true },
        { name: 'encrypted_password', type: 'TEXT', pk: false, notnull: true },
        { name: 'display_name', type: 'TEXT', pk: false, notnull: false },
        { name: 'enabled', type: 'INTEGER', pk: false, notnull: true },
        { name: 'created_at', type: 'INTEGER', pk: false, notnull: true },
        { name: 'updated_at', type: 'INTEGER', pk: false, notnull: true }
      ]
    },
    {
      name: 'sync_state',
      columns: [
        { name: 'account_id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'calendar_id', type: 'INTEGER', pk: true, notnull: true },
        { name: 'sync_token', type: 'TEXT', pk: false, notnull: false },
        { name: 'last_sync_at', type: 'INTEGER', pk: false, notnull: false },
        { name: 'sync_window_start', type: 'INTEGER', pk: false, notnull: false },
        { name: 'sync_window_end', type: 'INTEGER', pk: false, notnull: false }
      ]
    }
  ]
}

function toggleTable(tableName: string) {
  const index = expandedTables.value.indexOf(tableName)
  if (index >= 0) {
    expandedTables.value.splice(index, 1)
  } else {
    expandedTables.value.push(tableName)
  }
}

// ==================== 数据查看功能 ====================

async function loadTableData() {
  if (!selectedTable.value) return
  
  loadingData.value = true
  dataError.value = ''
  
  try {
    if (isTauri()) {
      const result = await debugGetTableData(selectedTable.value)
      tableData.value = result || []
    } else {
      tableData.value = []
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    dataError.value = '加载失败: ' + (error instanceof Error ? error.message : String(error))
    tableData.value = []
  } finally {
    loadingData.value = false
  }
}

function formatValue(value: any): string {
  if (value === null) return 'NULL'
  if (value === undefined) return 'undefined'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

async function exportTableData() {
  if (tableData.value.length === 0) return
  
  const json = JSON.stringify(tableData.value, null, 2)
  const defaultName = `${selectedTable.value}_${new Date().toISOString().slice(0, 10)}.json`
  
  try {
    if (isTauri()) {
      // 使用 Tauri 的保存对话框
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      })
      
      if (filePath) {
        await writeTextFile(filePath, json)
      }
    } else {
      // 浏览器环境：使用传统下载方式
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = defaultName
      a.click()
      URL.revokeObjectURL(url)
    }
  } catch (error) {
    console.error('导出数据失败:', error)
  }
}

// ==================== 开发者工具功能 ====================

async function openDevTools() {
  if (isTauri()) {
    try {
      await debugOpenDevTools()
    } catch (error) {
      console.error('打开 DevTools 失败:', error)
      alert('打开 DevTools 失败，请检查是否在开发模式下运行')
    }
  } else {
    // 浏览器环境下提示用户按 F12
    alert('请按 F12 打开开发者工具')
  }
}

function clearLocalStorage() {
  if (confirm('确定要清空所有 LocalStorage 数据吗？此操作不可恢复。')) {
    localStorage.clear()
    alert('LocalStorage 已清空')
  }
}

function showStorageInfo() {
  const info: Record<string, number> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) {
      const value = localStorage.getItem(key) || ''
      info[key] = value.length * 2 // 大约字节数
    }
  }
  storageInfo.value = info
  showStorageDialog.value = true
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ==================== 初始化 ====================

onMounted(async () => {
  // 启用前端日志捕获
  startLogCapture()
  console.log('[DebugView] 调试页面已打开')

  // 刷新日志
  refreshLogs()

  // 加载表结构
  await loadSchema()

  // 获取平台信息
  platform.value = navigator.platform

  // 加载 API 配置
  await loadApiConfig()

  // 加载日志级别
  if (isTauri()) {
    try {
      const level = await getLogLevel()
      if (level) logLevel.value = level
    } catch {
      // 忽略
    }
  }
})

onUnmounted(() => {
  // 停用前端日志捕获
  stopLogCapture()
})
</script>

<style scoped>
.debug-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.debug-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.debug-header h2 {
  margin: 0;
  color: var(--text-primary);
}

.back-btn {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-primary);
  font-size: 14px;
}

.back-btn:hover {
  background: var(--bg-tertiary);
}

.debug-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 12px;
}

.tab-btn {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 14px;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.debug-section {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
}

.section-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.action-btn {
  padding: 8px 16px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
}

.action-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.action-btn.secondary:hover {
  background: var(--bg-tertiary);
}

.action-btn.small {
  padding: 4px 8px;
  font-size: 12px;
}

/* 日志查看器 */
.log-viewer {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.log-list {
  font-family: monospace;
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color);
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: var(--text-secondary);
  font-size: 11px;
}

.log-level {
  font-weight: bold;
  min-width: 50px;
}

.log-item.info .log-level { color: #3b82f6; }
.log-item.warn .log-level { color: #f59e0b; }
.log-item.error .log-level { color: #dc2626; }
.log-item.debug .log-level { color: #8b5cf6; }

.log-message {
  flex: 1;
  word-break: break-all;
}

.log-source {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.log-item.backend .log-source {
  background: #3b82f6;
  color: white;
}

.log-controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.log-level-control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-level-control label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.log-source-select {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
}

/* 数据库结构 */
.schema-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schema-item {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  gap: 12px;
}

.table-header:hover {
  background: var(--bg-tertiary);
}

.table-name {
  font-weight: 500;
  flex: 1;
}

.table-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.expand-icon {
  font-size: 12px;
  color: var(--text-secondary);
}

.table-columns {
  padding: 0 16px 12px;
  border-top: 1px solid var(--border-color);
}

.column-item {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  align-items: center;
}

.col-name {
  font-family: monospace;
  color: var(--accent-color);
  min-width: 120px;
}

.col-type {
  color: var(--text-secondary);
  font-size: 12px;
}

.col-pk, .col-notnull {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
}

.col-pk {
  background: var(--accent-color);
  color: white;
}

/* 数据查看 */
.table-selector select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 200px;
}

.data-viewer {
  margin-top: 16px;
}

.data-stats {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.data-table-wrapper {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.data-table th {
  background: var(--bg-tertiary);
  font-weight: 500;
  position: sticky;
  top: 0;
}

.data-table tr:hover td {
  background: var(--bg-tertiary);
}

/* 开发者工具 */
.devtools-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.action-card {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 16px;
}

.action-card h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.action-card p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  font-weight: 500;
}

/* 对话框 */
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
  max-height: 80vh;
  overflow: hidden;
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
}

.storage-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.storage-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.storage-key {
  font-family: monospace;
  color: var(--text-primary);
}

.storage-size {
  color: var(--text-secondary);
}

/* 空状态和加载 */
.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-secondary);
}

.error-message {
  padding: 12px;
  background: #fee2e2;
  color: #dc2626;
  border-radius: var(--radius-md);
  font-size: 13px;
  margin-bottom: 16px;
}

/* API 配置 */
.api-config-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mode-badge {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.mode-badge.mock {
  background: #f59e0b;
  color: white;
}

.mode-badge.real {
  background: #22c55e;
  color: white;
}

.api-mode-select,
.api-url-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
}

.api-url-input {
  flex: 1;
  min-width: 300px;
}

.api-config-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.config-message {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 13px;
}

.config-message.success {
  background: #dcfce7;
  color: #166534;
}

.config-message.error {
  background: #fee2e2;
  color: #dc2626;
}

.config-warning {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 8px 12px;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border-left: 3px solid #f59e0b;
}
</style>
