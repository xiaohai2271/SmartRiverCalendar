<template>
  <div class="system-tab">
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

    <!-- 系统集成 -->
    <div class="settings-section">
      <h3>系统集成</h3>
      <div class="setting-item">
        <label>窗口大小</label>
        <select v-model="popupSettingsStore.settings.popupWindowSize" @change="handleWindowSizeChange">
          <option value="small">紧凑</option>
          <option value="medium">默认</option>
          <option value="large">宽松</option>
        </select>
      </div>
      <div class="setting-item">
        <label>点击系统时钟唤醒窗口</label>
        <input type="checkbox" v-model="settings.clockHookEnabled" @change="handleClockHookChange" />
      </div>
      <div v-if="settings.clockHookEnabled" class="setting-subsection">
        <div class="setting-item">
          <label>阻止系统日历弹窗</label>
          <input type="checkbox" v-model="settings.clockHookBlockPopup" @change="handleClockHookBlockPopupChange" />
        </div>
        <div class="setting-item">
          <label>当前检测方式</label>
          <span class="status-value">{{ clockHookDetectionMethod }}</span>
        </div>
      </div>
    </div>

    <!-- 网络代理 -->
    <div class="settings-section">
      <h3>网络代理</h3>
      <div class="setting-item">
        <label>代理模式</label>
        <select v-model="settings.proxyMode" @change="handleProxyModeChange">
          <option value="none">不走代理</option>
          <option value="system">系统代理</option>
          <option value="custom">自定义代理</option>
        </select>
      </div>
      <div v-if="settings.proxyMode === 'custom'" class="setting-subsection">
        <div class="setting-item">
          <label>代理地址</label>
          <input
            type="text"
            v-model="settings.proxyHost"
            @change="saveSettings"
            placeholder="例如：127.0.0.1"
            class="proxy-input"
          />
        </div>
        <div class="setting-item">
          <label>代理端口</label>
          <input
            type="number"
            v-model.number="settings.proxyPort"
            @change="saveSettings"
            placeholder="例如：7890"
            class="proxy-input proxy-port"
          />
        </div>
        <div class="setting-item">
          <label>认证用户名</label>
          <input
            type="text"
            v-model="settings.proxyUsername"
            @change="saveSettings"
            placeholder="可选"
            class="proxy-input"
          />
        </div>
        <div class="setting-item">
          <label>认证密码</label>
          <input
            type="password"
            v-model="settings.proxyPassword"
            @change="saveSettings"
            placeholder="可选"
            class="proxy-input"
          />
        </div>
      </div>
      <!-- 测试连接 -->
      <div class="setting-subsection proxy-test-section">
        <div class="setting-item">
          <label>测试地址</label>
          <input
            type="text"
            v-model="proxyTestUrl"
            placeholder="例如：https://www.baidu.com"
            class="proxy-input"
          />
        </div>
        <div class="setting-item proxy-test-row">
          <button
            class="proxy-test-btn"
            :disabled="isTestingProxy"
            @click="handleTestProxyConnection"
          >
            {{ isTestingProxy ? '测试中...' : '测试连接' }}
          </button>
          <span v-if="proxyTestResult" :class="['proxy-test-result', proxyTestResult.success ? 'success' : 'error']">
            {{ proxyTestResult.message }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 系统设置 Tab 内容组件
 * 包含系统设置、系统集成、时钟点击检测等功能
 */
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

// ==================== Store ====================
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

  // 保存到 localStorage (v-model 已经更新了 settings)
  popupSettingsStore.savePopupSettings()

  // 广播变更通知精简窗口
  broadcastSettingsChange('popupWindowSize', newSize)

  // 直接调用窗口调整函数，使弹出窗口实时生效
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
  // 切换模式时清空之前的测试结果
  proxyTestResult.value = null
}

/**
 * 测试代理连接
 * 先保存当前设置，再调用后端测试命令
 */
async function handleTestProxyConnection(): Promise<void> {
  if (!isTauri()) return

  const testUrl = proxyTestUrl.value.trim()
  if (!testUrl) {
    proxyTestResult.value = { success: false, message: '请输入测试地址', elapsedMs: 0 }
    return
  }

  // 先保存设置，确保后端能读取到最新配置
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
.system-tab {
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

/* 系统集成子设置区域 */
.setting-subsection {
  margin-top: 8px;
  padding-left: 16px;
  border-left: 2px solid var(--border-color);
}

.status-value {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 代理输入框样式 */
.proxy-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 150px;
  font-size: 14px;
}

.proxy-port {
  width: 100px;
  min-width: 80px;
}

/* 代理测试区域样式 */
.proxy-test-section {
  margin-top: 8px;
  padding-left: 16px;
  border-left: 2px solid var(--border-color);
}

.proxy-test-row {
  margin-top: 8px;
  gap: 12px;
}

.proxy-test-btn {
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.proxy-test-btn:hover:not(:disabled) {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.proxy-test-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.proxy-test-result {
  font-size: 13px;
  flex: 1;
}

.proxy-test-result.success {
  color: #107c10;
}

.proxy-test-result.error {
  color: #d13438;
}
</style>
