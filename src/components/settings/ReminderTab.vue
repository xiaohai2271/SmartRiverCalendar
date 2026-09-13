<template>
  <div class="reminder-tab animate-fade-in">
    <!-- 卡片 1：提醒配置 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        <span>事件通知与提醒</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">默认提醒时间</span>
          <span class="item-desc">新建常规日程事件时，默认的触发提醒提前量</span>
        </div>
        <div class="item-control">
          <select v-model="settings.defaultReminder" @change="saveSettings" class="fluent-select">
            <option :value="5">5分钟前</option>
            <option :value="15">15分钟前</option>
            <option :value="30">30分钟前</option>
            <option :value="60">1小时前</option>
            <option :value="1440">1天前</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">全天事件提醒策略</span>
          <span class="item-desc">对于全天日程，何时触发通知提醒</span>
        </div>
        <div class="item-control">
          <select v-model="settings.allDayReminderTime" @change="saveSettings" class="fluent-select">
            <option value="evening_before">前一天晚上</option>
            <option value="morning">当天早上</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">全天事件提醒小时</span>
          <span class="item-desc">设定具体触发通知的整点时刻</span>
        </div>
        <div class="item-control">
          <select v-model="settings.allDayReminderHour" @change="saveSettings" class="fluent-select">
            <option v-for="h in 24" :key="h-1" :value="h-1">{{ h-1 }}:00</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">通知弹窗强度</span>
          <span class="item-desc">选择应用触发日程时的提醒弹窗及声音策略</span>
        </div>
        <div class="item-control">
          <select v-model="settings.reminderMode" @change="saveSettings" class="fluent-select">
            <option value="standard">标准 (居中提示)</option>
            <option value="strong">强提醒 (夺取焦点)</option>
            <option value="silent">静默 (仅通知中心)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 卡片 2：通知模板 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span>自定义通知模板</span>
      </h3>
      
      <div class="setting-item vertical-align">
        <div class="item-info">
          <span class="item-label">自定义通知标题模板</span>
          <span class="item-desc">输入通配字符，例如 {title} 将自动替换为日程标题</span>
        </div>
        <div class="zero-border-input-wrapper">
          <input 
            type="text" 
            v-model="settings.customReminderTitle" 
            @change="saveSettings" 
            placeholder="例如：{title} - 提醒" 
            class="zero-border-text-input"
          />
          <span class="focus-underline"></span>
        </div>
      </div>

      <div class="setting-item vertical-align">
        <div class="item-info">
          <span class="item-label">自定义通知正文模板</span>
          <span class="item-desc">设置提醒通知正文的具体模板信息</span>
        </div>
        <div class="zero-border-input-wrapper">
          <input 
            type="text" 
            v-model="settings.customReminderBody" 
            @change="saveSettings" 
            placeholder="例如：您有一个事件即将开始：{title}" 
            class="zero-border-text-input"
          />
          <span class="focus-underline"></span>
        </div>
      </div>
    </div>

    <!-- 卡片 3：系统基础设置 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
          <line x1="12" y1="2" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
        </svg>
        <span>系统选项</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">启动时最小化到托盘</span>
          <span class="item-desc">应用随系统或双击打开时，自动隐藏至托盘图标</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.startMinimized" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">开机自启动</span>
          <span class="item-desc">在系统加载完成后，自动在后台拉起小河日历</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.autoStart" @change="handleAutoStartChange" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">自动检查更新</span>
          <span class="item-desc">启动时自动连网查询是否有更高阶的版本发布</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.autoUpdate" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 卡片 4：系统集成与代理 (原 SystemTab 中级控制) -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <span>系统深度集成</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">挂件窗口尺寸</span>
          <span class="item-desc">精简悬浮挂件面板的整体比例模式</span>
        </div>
        <div class="item-control">
          <select v-model="popupSettingsStore.settings.popupWindowSize" @change="handleWindowSizeChange" class="fluent-select">
            <option value="small">紧凑模式</option>
            <option value="medium">默认大小</option>
            <option value="large">宽松视口</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">点击系统时钟唤醒窗口</span>
          <span class="item-desc">在 Windows 下点击右下角系统时钟时，拉起挂件</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.clockHookEnabled" @change="handleClockHookChange" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div v-if="settings.clockHookEnabled" class="setting-subsection animate-fade-in">
        <div class="setting-item compact">
          <div class="item-info">
            <span class="item-label small-label">阻止系统日历弹窗</span>
            <span class="item-desc">点击时钟时截获系统默认日历弹窗，进行平替</span>
          </div>
          <label class="toggle-wrapper">
            <input type="checkbox" v-model="settings.clockHookBlockPopup" @change="handleClockHookBlockPopupChange" class="toggle-input" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="setting-item compact">
          <div class="item-info">
            <span class="item-label small-label">当前时钟挂钩检测方式</span>
          </div>
          <span class="status-badge">{{ clockHookDetectionMethod }}</span>
        </div>
      </div>

      <!-- 网络代理设置 -->
      <div class="setting-item proxy-title-row">
        <div class="item-info">
          <span class="item-label">网络代理模式</span>
          <span class="item-desc">进行外部 CalDAV 同步时的网络代理配置</span>
        </div>
        <div class="item-control">
          <select v-model="settings.proxyMode" @change="handleProxyModeChange" class="fluent-select">
            <option value="none">不走代理</option>
            <option value="system">系统代理</option>
            <option value="custom">自定义代理</option>
          </select>
        </div>
      </div>

      <div v-if="settings.proxyMode === 'custom'" class="setting-subsection animate-fade-in">
        <div class="setting-item compact vertical-align">
          <div class="item-info">
            <span class="item-label small-label">代理主机地址</span>
          </div>
          <div class="zero-border-input-wrapper">
            <input type="text" v-model="settings.proxyHost" @change="saveSettings" placeholder="例如：127.0.0.1" class="zero-border-text-input" />
            <span class="focus-underline"></span>
          </div>
        </div>
        <div class="setting-item compact vertical-align">
          <div class="item-info">
            <span class="item-label small-label">代理端口</span>
          </div>
          <div class="zero-border-input-wrapper">
            <input type="number" v-model.number="settings.proxyPort" @change="saveSettings" placeholder="例如：7890" class="zero-border-text-input" />
            <span class="focus-underline"></span>
          </div>
        </div>
        <div class="setting-item compact vertical-align">
          <div class="item-info">
            <span class="item-label small-label">认证用户名</span>
          </div>
          <div class="zero-border-input-wrapper">
            <input type="text" v-model="settings.proxyUsername" @change="saveSettings" placeholder="可选" class="zero-border-text-input" />
            <span class="focus-underline"></span>
          </div>
        </div>
        <div class="setting-item compact vertical-align">
          <div class="item-info">
            <span class="item-label small-label">认证密码</span>
          </div>
          <div class="zero-border-input-wrapper">
            <input type="password" v-model="settings.proxyPassword" @change="saveSettings" placeholder="可选" class="zero-border-text-input" />
            <span class="focus-underline"></span>
          </div>
        </div>
      </div>

      <!-- 代理测试区域 -->
      <div v-if="settings.proxyMode !== 'none'" class="setting-subsection animate-fade-in proxy-test-section">
        <div class="setting-item compact vertical-align">
          <div class="item-info">
            <span class="item-label small-label">测试连接地址</span>
          </div>
          <div class="zero-border-input-wrapper">
            <input type="text" v-model="proxyTestUrl" placeholder="例如：https://www.baidu.com" class="zero-border-text-input" />
            <span class="focus-underline"></span>
          </div>
        </div>
        <div class="setting-item compact test-btn-row">
          <button
            class="fluent-button primary compact-btn"
            :disabled="isTestingProxy"
            @click="handleTestProxyConnection"
            type="button"
          >
            {{ isTestingProxy ? '网络测试中...' : '测试代理连通性' }}
          </button>
          <span v-if="proxyTestResult" :class="['status-result-badge', proxyTestResult.success ? 'success' : 'error']">
            {{ proxyTestResult.success ? `连接成功 (${proxyTestResult.elapsedMs}ms)` : `连接失败: ${proxyTestResult.message}` }}
          </span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useSettingsStore } from '../../stores/settings'
import { usePopupSettingsStore } from '../../stores/popupSettings'
import {
  setAutostart,
  getAutostartEnabled,
  isTauri,
  enableClockHook,
  disableClockHook,
  setClockHookBlockPopup,
  getClockHookStatus,
} from '../../utils/tauri'
import { setPopupWindowSize } from '../../composables/useCalendarPopup'
import { broadcastSettingsChange } from '../../utils/broadcast'
import type { PopupWindowSize } from '../../types'

// ==================== Stores ====================
const settingsStore = useSettingsStore()
const popupSettingsStore = usePopupSettingsStore()
const settings = computed(() => settingsStore.settings)

// ==================== State ====================
// 时钟点击检测状态
const clockHookDetectionMethod = ref('未启用')
// 代理测试状态
const isTestingProxy = ref(false)
interface ProxyTestResult {
  success: boolean
  message: string
  elapsedMs: number
}
const proxyTestResult = ref<ProxyTestResult | null>(null)
// 代理测试地址
const proxyTestUrl = ref('https://www.baidu.com')

// ==================== Lifecycle ====================
// 初始化自启动状态
onMounted(async () => {
  if (isTauri()) {
    const enabled = await getAutostartEnabled()
    settingsStore.updateSettings({ autoStart: enabled })

    // 查询时钟点击检测状态
    if (settings.value.clockHookEnabled) {
      clockHookDetectionMethod.value = await getClockHookStatus()
    }

    // 监听检测方式变化事件
    const unlistenDetection = await listen<string>('clock-hook-detection-changed', (event) => {
      if (event.payload) {
        clockHookDetectionMethod.value = event.payload
      }
    })
    onUnmounted(() => {
      unlistenDetection()
    })
  }
})

// ==================== Methods ====================
/**
 * 保存设置
 */
function saveSettings(): void {
  settingsStore.saveSettings()
}

/**
 * 处理自启动设置变化
 */
async function handleAutoStartChange(): Promise<void> {
  if (isTauri()) {
    const success = await setAutostart(settings.value.autoStart)
    if (!success) {
      // 如果设置失败，恢复原状态
      settingsStore.updateSettings({ autoStart: !settings.value.autoStart })
    }
  }
  saveSettings()
}

/**
 * 处理窗口大小变更
 */
async function handleWindowSizeChange(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement
  const newSize = select.value as PopupWindowSize

  // 保存到 localStorage
  popupSettingsStore.savePopupSettings()

  // 广播变更通知精简窗口
  broadcastSettingsChange('popupWindowSize', newSize)

  // 直接调用窗口调整函数
  try {
    await setPopupWindowSize(newSize)
  } catch (error) {
    console.error('[Settings] 设置窗口大小失败:', error)
  }
}

/**
 * 处理时钟点击检测开关变化
 */
async function handleClockHookChange(): Promise<void> {
  saveSettings()
  if (isTauri()) {
    if (settings.value.clockHookEnabled) {
      try {
        const method = await enableClockHook()
        clockHookDetectionMethod.value = method || '等待中'
      } catch (e) {
        // 启用失败，恢复设置
        settingsStore.updateSettings({ clockHookEnabled: false })
        clockHookDetectionMethod.value = '未启用'
      }
    } else {
      await disableClockHook()
      clockHookDetectionMethod.value = '未启用'
    }
  }
}

/**
 * 处理阻止系统弹窗开关变化
 */
async function handleClockHookBlockPopupChange(): Promise<void> {
  saveSettings()
  if (isTauri()) {
    await setClockHookBlockPopup(settings.value.clockHookBlockPopup)
  }
}

/**
 * 处理代理模式变更
 */
function handleProxyModeChange(): void {
  saveSettings()
  proxyTestResult.value = null
}

/**
 * 测试代理连接
 */
async function handleTestProxyConnection(): Promise<void> {
  if (!isTauri()) return

  const testUrl = proxyTestUrl.value.trim()
  if (!testUrl) {
    proxyTestResult.value = { success: false, message: '请输入测试地址', elapsedMs: 0 }
    return
  }

  await settingsStore.saveSettings()

  isTestingProxy.value = true
  proxyTestResult.value = null

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const result = await invoke<ProxyTestResult>('test_proxy_connection', { testUrl })
    proxyTestResult.value = result
  } catch (e) {
    proxyTestResult.value = {
      success: false,
      message: `调用失败: ${e}`,
      elapsedMs: 0,
    }
  } finally {
    isTestingProxy.value = false
  }
}
</script>

<style scoped>
.reminder-tab {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 极精细亚克力极光卡片 */
.settings-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-normal);
}

.settings-section:hover {
  transform: translateY(-1px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

/* 选项卡内部大标题 */
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 0;
  margin-bottom: 20px;
}

.section-icon {
  color: var(--accent-color);
}

/* 设置条目 */
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.02);
}

.setting-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* 纵向对齐 - 专用于输入框设置项 */
.setting-item.vertical-align {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.setting-item.compact {
  padding: 10px 0;
}

.proxy-title-row {
  margin-top: 14px;
  border-top: 1px dashed var(--border-color);
  padding-top: 18px !important;
}

/* 左侧信息与辅助小字 */
.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-right: 16px;
}

.item-label {
  font-size: 14px;
  font-weight: 550;
  color: var(--text-primary);
}

.item-label.small-label {
  font-size: 13px;
  font-weight: 500;
}

.item-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* 扁平 Fluent 下拉框 */
.fluent-select {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 140px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-select:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-light);
}

/* Zero-border Text Input */
.zero-border-input-wrapper {
  position: relative;
  width: 100%;
}

.zero-border-text-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
  padding: 6px 0;
  outline: none;
}

.zero-border-text-input::placeholder {
  color: var(--text-tertiary);
  opacity: 0.8;
}

.focus-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background: var(--border-color);
  transition: background var(--transition-normal);
}

.zero-border-text-input:focus ~ .focus-underline {
  background: var(--accent-color);
  height: 1.5px;
}

/* Toggle Switch 滑块 */
.toggle-wrapper {
  display: flex;
  align-items: center;
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
  box-shadow: 0 1px 2.5px rgba(0, 0, 0, 0.15);
}

.toggle-input:checked + .toggle-slider {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.toggle-input:checked + .toggle-slider::after {
  transform: translateX(16px);
}

/* 子设置配置面板 (Subsection) */
.setting-subsection {
  margin-top: 4px;
  margin-bottom: 4px;
  padding-left: 16px;
  border-left: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.proxy-test-section {
  border-left-color: var(--accent-color);
  margin-top: 14px;
}

.test-btn-row {
  flex-direction: row;
  justify-content: flex-start;
  gap: 16px;
  align-items: center;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.status-result-badge {
  font-size: 12.5px;
  font-weight: 500;
}

.status-result-badge.success {
  color: #107c10;
}

.status-result-badge.error {
  color: #d13438;
}

/* Fluent 按钮 */
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-weight: 550;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fluent-button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.fluent-button.primary {
  background: var(--accent-color);
  border-color: var(--accent-color);
  color: white;
}

.fluent-button.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.fluent-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 淡入动画 */
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
