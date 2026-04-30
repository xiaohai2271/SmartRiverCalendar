<template>
  <div class="settings-tabs">
    <div class="tabs-header">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :data-testid="'settings-tab'"
        :data-active="activeTab === tab.key"
        :class="['tab-btn', { active: activeTab === tab.key }]"
        @click="$emit('update:activeTab', tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tabs-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  key: string
  label: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'update:activeTab', tab: string): void
}>()
</script>

<style scoped>
.settings-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs-header {
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
  color: var(--text-primary);
}

.tab-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.tab-btn.active {
  background: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
}

.tabs-content {
  flex: 1;
  overflow-y: auto;
}
</style>
