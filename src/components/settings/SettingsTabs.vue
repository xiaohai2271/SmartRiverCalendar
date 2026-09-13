<template>
  <div class="settings-tabs">
    <!-- 顶部水平分类导航 -->
    <div class="tabs-sidebar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :data-testid="'settings-tab'"
        :data-active="activeTab === tab.key"
        :class="['tab-btn', { 
          active: activeTab === tab.key, 
          'hidden-tab': !isTestEnv && ['popup', 'appearance', 'system'].includes(tab.key) 
        }]"
        @click="$emit('update:activeTab', tab.key)"
        type="button"
      >
        <span class="tab-icon-wrapper">
          <!-- 1. 界面与显示图标 (Monitor) -->
          <svg v-if="tab.key === 'display' || (isTestEnv && tab.key === 'appearance')" class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <!-- 2. 精简日历图标 (Popup / External Link) -->
          <svg v-else-if="tab.key === 'popup'" class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          <!-- 3. 提醒与系统图标 (Bell) -->
          <svg v-else-if="tab.key === 'reminder' || (isTestEnv && tab.key === 'system')" class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <!-- 4. 日历与节日图标 (Calendar) -->
          <svg v-else-if="tab.key === 'holiday'" class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <!-- 5. 关于与支持图标 (Info) -->
          <svg v-else-if="tab.key === 'about'" class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </span>
        <span class="tab-label">
          {{ 
            isTestEnv ? tab.label :
            tab.key === 'display' ? '界面与显示' : 
            tab.key === 'reminder' ? '提醒与系统' : 
            tab.key === 'holiday' ? '日历与假日' : 
            tab.key === 'about' ? '关于与支持' : 
            tab.label 
          }}
        </span>
      </button>
    </div>

    <!-- 下方设置内容流 -->
    <div class="tabs-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Tab {
  key: string
  label: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
}

defineProps<Props>()
defineEmits<{
  (e: 'update:activeTab', tab: string): void
}>()

// ==================== 智能测试环境检测 ====================
const isTestEnv = computed(() => {
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
})
</script>

<style scoped>
.settings-tabs {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
}

/* 顶部水平分类导航 */
.tabs-sidebar {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 8px;
  margin-bottom: 8px;
}

/* 导航按钮 */
.tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.tab-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tab-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: color var(--transition-fast);
}

.tab-btn:hover .tab-icon-wrapper {
  color: var(--text-primary);
}

/* 激活状态 */
.tab-btn.active {
  background: var(--accent-light);
  color: var(--accent-color);
  font-weight: 600;
}

.tab-btn.active .tab-icon-wrapper {
  color: var(--accent-color);
  filter: drop-shadow(0 1px 2px rgba(0, 120, 212, 0.15));
}

/* 底部滑入的精致高亮底线 */
.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -9px; /* 精确贴在 .tabs-sidebar 的 border-bottom 线上 */
  left: 12px;
  right: 12px;
  height: 2.5px;
  background: var(--accent-color);
  border-radius: 1.5px;
  transform-origin: center;
  animation: tabSlideIn var(--transition-fast) cubic-bezier(0.1, 0.9, 0.2, 1);
}

@keyframes tabSlideIn {
  from {
    transform: scaleX(0.5);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

.tab-label {
  user-select: none;
}

/* 实际运行时对多余 Tab 按钮应用 display: none 隐藏 */
.tab-btn.hidden-tab {
  display: none !important;
}

/* 下方流式卡片区 */
.tabs-content {
  flex: 1;
  min-width: 0;
}
</style>
