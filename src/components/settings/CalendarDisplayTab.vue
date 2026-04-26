<template>
  <div class="calendar-display-tab">
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
      <h3>显示选项</h3>
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
        <label>月视图事件显示</label>
        <select v-model="settings.monthEventDisplayStyle" @change="saveSettings">
          <option value="bar">横条</option>
          <option value="dot">圆点</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 日历显示 Tab 内容组件
 * 包含外观设置、显示选项、日历基础设置
 */
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

// ==================== Store ====================
const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.settings)

// ==================== Methods ====================
/**
 * 保存设置
 */
function saveSettings(): void {
  settingsStore.saveSettings()
}
</script>

<style scoped>
.calendar-display-tab {
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
</style>
