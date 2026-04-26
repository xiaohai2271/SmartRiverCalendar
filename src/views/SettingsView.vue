<template>
  <div class="settings-view">
    <h2>设置</h2>

    <!-- SettingsTabs 组件 -->
    <SettingsTabs :tabs="tabs" :active-tab="activeTab" @update:active-tab="activeTab = $event">
      <!-- 日历显示 Tab -->
      <div
        v-if="activeTab === 'display'"
        data-testid="settings-content"
        data-tab="日历显示"
        data-visible="true"
      >
        <CalendarDisplayTab />
      </div>

      <!-- 精简日历 Tab -->
      <div
        v-if="activeTab === 'popup'"
        data-testid="settings-content"
        data-tab="精简日历"
        data-visible="true"
      >
        <PopupTab />
      </div>

      <!-- 外观 Tab -->
      <div
        v-if="activeTab === 'appearance'"
        data-testid="settings-content"
        data-tab="外观"
        data-visible="true"
      >
        <div class="settings-section">
          <h3>外观</h3>
          <div class="setting-item">
            <label>主题</label>
            <select v-model="settingsStore.settings.theme" @change="saveSettings">
              <option value="light">浅色</option>
              <option value="dark">深色</option>
              <option value="auto">跟随系统</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 提醒设置 Tab -->
      <div
        v-if="activeTab === 'reminder'"
        data-testid="settings-content"
        data-tab="提醒设置"
        data-visible="true"
      >
        <ReminderTab />
      </div>

      <!-- 系统 Tab -->
      <div
        v-if="activeTab === 'system'"
        data-testid="settings-content"
        data-tab="系统"
        data-visible="true"
      >
        <SystemTab />
      </div>

      <!-- 节假日管理 Tab -->
      <div
        v-if="activeTab === 'holiday'"
        data-testid="settings-content"
        data-tab="节假日管理"
        data-visible="true"
      >
        <HolidayTab />
      </div>

      <!-- 关于 Tab -->
      <div
        v-if="activeTab === 'about'"
        data-testid="settings-content"
        data-tab="关于"
        data-visible="true"
      >
        <AboutTab />
      </div>
    </SettingsTabs>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import SettingsTabs from '../components/settings/SettingsTabs.vue'
import CalendarDisplayTab from '../components/settings/CalendarDisplayTab.vue'
import PopupTab from '../components/settings/PopupTab.vue'
import ReminderTab from '../components/settings/ReminderTab.vue'
import SystemTab from '../components/settings/SystemTab.vue'
import HolidayTab from '../components/settings/HolidayTab.vue'
import AboutTab from '../components/settings/AboutTab.vue'

// ==================== Store ====================
const settingsStore = useSettingsStore()

// ==================== Tabs 配置 ====================
const tabs = [
  { key: 'display', label: '日历显示' },
  { key: 'popup', label: '精简日历' },
  { key: 'appearance', label: '外观' },
  { key: 'reminder', label: '提醒设置' },
  { key: 'system', label: '系统' },
  { key: 'holiday', label: '节假日管理' },
  { key: 'about', label: '关于' }
]
const activeTab = ref('display')

// ==================== Lifecycle ====================
// 初始化完成

// ==================== Methods ====================
/**
 * 保存设置
 */
async function saveSettings() {
  settingsStore.saveSettings()
}
</script>

<style scoped>
.settings-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

h2 {
  margin-bottom: 24px;
}

/* 设置项样式 */
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
</style>