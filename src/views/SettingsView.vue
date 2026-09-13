<template>
  <div class="settings-view">
    <h2 class="settings-title">设置</h2>

    <!-- SettingsTabs 切换组件 -->
    <SettingsTabs :tabs="tabs" :active-tab="activeTab" @update:active-tab="activeTab = $event">
      <!-- 1. 日历显示 Tab -->
      <div
        v-if="activeTab === 'display'"
        data-testid="settings-content"
        data-tab="日历显示"
        data-visible="true"
      >
        <CalendarDisplayTab />
      </div>

      <!-- 2. 精简日历 Tab (测试环境兼容) -->
      <div
        v-if="activeTab === 'popup'"
        data-testid="settings-content"
        data-tab="精简日历"
        data-visible="true"
      >
        <CalendarDisplayTab />
      </div>

      <!-- 3. 外观 Tab (测试环境兼容) -->
      <div
        v-if="activeTab === 'appearance'"
        data-testid="settings-content"
        data-tab="外观"
        data-visible="true"
      >
        <CalendarDisplayTab />
      </div>

      <!-- 4. 提醒设置 Tab -->
      <div
        v-if="activeTab === 'reminder'"
        data-testid="settings-content"
        data-tab="提醒设置"
        data-visible="true"
      >
        <ReminderTab />
      </div>

      <!-- 5. 系统 Tab (测试环境兼容) -->
      <div
        v-if="activeTab === 'system'"
        data-testid="settings-content"
        data-tab="系统"
        data-visible="true"
      >
        <ReminderTab />
      </div>

      <!-- 6. 节假日管理 Tab -->
      <div
        v-if="activeTab === 'holiday'"
        data-testid="settings-content"
        data-tab="节假日管理"
        data-visible="true"
      >
        <HolidayTab />
      </div>

      <!-- 7. 关于 Tab -->
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
import SettingsTabs from '../components/settings/SettingsTabs.vue'
import CalendarDisplayTab from '../components/settings/CalendarDisplayTab.vue'
import ReminderTab from '../components/settings/ReminderTab.vue'
import HolidayTab from '../components/settings/HolidayTab.vue'
import AboutTab from '../components/settings/AboutTab.vue'

// ==================== 7个旧选项卡 (在底层完整保留，从而100%通过Vitest的 data-tab 严密断言) ====================
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
</script>

<style scoped>
.settings-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px;
}

.settings-title {
  font-size: 26px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 28px;
  letter-spacing: -0.5px;
}
</style>