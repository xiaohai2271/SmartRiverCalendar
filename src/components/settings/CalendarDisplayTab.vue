<template>
  <div class="calendar-display-tab animate-fade-in">
    <!-- 卡片 1：主题外观 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a10 10 0 0 0-10 10c0 5.52 4.48 10 10 10a1 1 0 0 0 1-1v-1.5a1 1 0 0 1 1-1h1.5a1 1 0 0 0 1-1 10 10 0 0 0-3-15.5z"/>
          <circle cx="9" cy="9" r="1"/>
          <circle cx="15" cy="9" r="1"/>
          <circle cx="12" cy="6" r="1"/>
        </svg>
        <span>外观主题</span>
      </h3>
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">应用主题</span>
          <span class="item-desc">选择契合您喜好的应用配色主题，支持跟随系统自适应</span>
        </div>
        <div class="item-control">
          <select :value="settingsStore.settings.theme" @change="handleThemeChange" class="fluent-select">
            <option value="light">浅色模式</option>
            <option value="dark">深色模式</option>
            <option value="auto">跟随系统</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 卡片 2：日历显示选项 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>主视图显示选项</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">显示农历</span>
          <span class="item-desc">在日历格中显示传统的农历日期</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showLunar" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">显示农历节日</span>
          <span class="item-desc">在日期下浮现传统的农历节日标注</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showLunarFestival" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">显示二十四节气</span>
          <span class="item-desc">在对应的日期格子中展示节气划分</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showSolarTerm" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">显示法定节假日</span>
          <span class="item-desc">高亮显示国家规定的法定放假日期</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showHoliday" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">显示调休/补班标识</span>
          <span class="item-desc">标注法定放假带来的周末调休和补班日期</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showMakeupDay" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">周末特别标识</span>
          <span class="item-desc">在周六和周日日期中施加弱对比着色</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="settings.showWeekend" @change="saveSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 卡片 3：日历参数设置 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>主日历行为</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">默认视图</span>
          <span class="item-desc">每次启动应用时展示的初始日历视图</span>
        </div>
        <div class="item-control">
          <select v-model="settings.defaultView" @change="saveSettings" class="fluent-select">
            <option value="day">日视图</option>
            <option value="week">周视图</option>
            <option value="month">月视图</option>
            <option value="year">年视图</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">每周起始日</span>
          <span class="item-desc">设置主日历月/周视图的左侧首列起始星期</span>
        </div>
        <div class="item-control">
          <select v-model="settings.firstDayOfWeek" @change="saveSettings" class="fluent-select">
            <option :value="0">星期日</option>
            <option :value="1">星期一</option>
          </select>
        </div>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">月视图日程显示样式</span>
          <span class="item-desc">选择日程在月网格中的排布效果（横条/圆点）</span>
        </div>
        <div class="item-control">
          <select v-model="settings.monthEventDisplayStyle" @change="saveSettings" class="fluent-select">
            <option value="bar">横条色带 (Bar)</option>
            <option value="dot">极简圆点 (Dot)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 卡片 4：精简面板（原 PopupTab）设置 -->
    <div class="settings-section">
      <h3 class="section-title">
        <svg class="section-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <span>精简挂件面板行为</span>
      </h3>
      
      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简日期详情显示农历</span>
          <span class="item-desc">系统托盘精简悬浮挂件的日期面板显示农历信息</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupShowLunar" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简面板显示农历节日</span>
          <span class="item-desc">悬浮挂件中显示中国传统农历节日</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupShowLunarFestival" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简面板显示二十四节气</span>
          <span class="item-desc">悬浮挂件日历网格中展示节气</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupShowSolarTerm" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简面板显示法定节假日/调休</span>
          <span class="item-desc">悬浮挂件日历中突出显示国家调休放假假标</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupShowHoliday" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简面板显示日程事件</span>
          <span class="item-desc">在悬浮挂件的日期详情下方平铺当日的事件安排</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupShowEvents" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>

      <div class="setting-item">
        <div class="item-info">
          <span class="item-label">精简挂件小月历显示农历</span>
          <span class="item-desc">在挂件下方的小月历格子中紧凑刻写农历日期</span>
        </div>
        <label class="toggle-wrapper">
          <input type="checkbox" v-model="popupSettingsStore.settings.popupCalendarShowLunar" @change="savePopupSettings" class="toggle-input" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { usePopupSettingsStore } from '../../stores/popupSettings'

// ==================== Stores ====================
const settingsStore = useSettingsStore()
const settings = computed(() => settingsStore.settings)

const popupSettingsStore = usePopupSettingsStore()

// ==================== Methods ====================
/**
 * 保存主设置
 */
function saveSettings(): void {
  settingsStore.saveSettings()
}

/**
 * 保存精简悬浮窗设置
 */
function savePopupSettings() {
  popupSettingsStore.savePopupSettings()
}

/**
 * 处理主题变更
 */
async function handleThemeChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const newTheme = select.value as 'light' | 'dark' | 'auto'
  await settingsStore.updateSettings({ theme: newTheme })
}
</script>

<style scoped>
.calendar-display-tab {
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

/* 无下划线设置组标题 */
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

/* 左侧信息与灰色辅助说明 */
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
