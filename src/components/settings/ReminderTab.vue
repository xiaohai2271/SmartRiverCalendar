<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.settings)

function saveSettings() {
  settingsStore.saveSettings()
}
</script>

<template>
  <div class="reminder-tab">
    <!-- 默认提醒时间 -->
    <div class="settings-section">
      <h3>提醒时间</h3>
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
    </div>

    <!-- 提醒强度 -->
    <div class="settings-section">
      <h3>提醒方式</h3>
      <div class="setting-item">
        <label>提醒强度</label>
        <select v-model="settings.reminderMode" @change="saveSettings">
          <option value="standard">标准</option>
          <option value="strong">强提醒</option>
          <option value="silent">静默</option>
        </select>
      </div>
    </div>

    <!-- 自定义模板 -->
    <div class="settings-section">
      <h3>自定义通知模板</h3>
      <div class="setting-item">
        <label>自定义通知标题模板</label>
        <input 
          type="text" 
          v-model="settings.customReminderTitle" 
          @change="saveSettings" 
          placeholder="例如：{title} - 提醒" 
        />
      </div>
      <div class="setting-item">
        <label>自定义通知正文模板</label>
        <input 
          type="text" 
          v-model="settings.customReminderBody" 
          @change="saveSettings" 
          placeholder="例如：您有一个事件即将开始：{title}" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.reminder-tab {
  padding: 0;
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

.setting-item input[type="text"] {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  min-width: 200px;
  font-size: 13px;
}

.setting-item input[type="text"]::placeholder {
  color: var(--text-tertiary);
}
</style>
