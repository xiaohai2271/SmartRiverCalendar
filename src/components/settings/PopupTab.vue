<template>
  <div class="popup-tab">
    <div class="settings-section">
      <h3>精简面板设置</h3>

      <!-- 显示农历 -->
      <div class="setting-item">
        <label>显示农历</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupShowLunar"
          @change="savePopupSettings"
        />
      </div>

      <!-- 显示农历节日 -->
      <div class="setting-item">
        <label>显示农历节日</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupShowLunarFestival"
          @change="savePopupSettings"
        />
      </div>

      <!-- 显示节气 -->
      <div class="setting-item">
        <label>显示节气</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupShowSolarTerm"
          @change="savePopupSettings"
        />
      </div>

      <!-- 显示节假日/调休 -->
      <div class="setting-item">
        <label>显示节假日/调休</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupShowHoliday"
          @change="savePopupSettings"
        />
      </div>

      <!-- 显示日程事件 -->
      <div class="setting-item">
        <label>显示日程事件</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupShowEvents"
          @change="savePopupSettings"
        />
      </div>

      <!-- 日历面板显示农历 -->
      <div class="setting-item">
        <label>日历面板显示农历</label>
        <input
          type="checkbox"
          v-model="popupSettingsStore.settings.popupCalendarShowLunar"
          @change="savePopupSettings"
        />
      </div>

      <!-- 日历面板节假日颜色 -->
      <div class="setting-item">
        <label>日历面板节假日颜色</label>
        <select
          v-model="popupSettingsStore.settings.popupCalendarHolidayColor"
          @change="savePopupSettings"
        >
          <option value="default">默认</option>
          <option value="soft">柔和</option>
          <option value="high-contrast">高对比</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePopupSettingsStore } from '../../stores/popupSettings'

// 获取精简面板设置 store
const popupSettingsStore = usePopupSettingsStore()

/**
 * 保存精简面板设置
 */
function savePopupSettings() {
  popupSettingsStore.savePopupSettings()
}
</script>

<style scoped>
.popup-tab {
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
