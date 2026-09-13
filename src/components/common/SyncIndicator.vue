<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const showPopover = ref(false)

// 状态映射配置
const statusConfig = {
  idle: { icon: '☁️', text: '已就绪', class: 'status-idle' },
  syncing: { icon: '🔄', text: '同步中...', class: 'status-syncing' },
  success: { icon: '✅', text: '同步成功', class: 'status-success' },
  error: { icon: '⚠️', text: '同步失败', class: 'status-error' },
  offline: { icon: '🔴', text: '离线', class: 'status-offline' }
}

// 计算属性
const statusIcon = computed(() => statusConfig[authStore.syncStatus]?.icon || '☁️')
const statusText = computed(() => statusConfig[authStore.syncStatus]?.text || '已就绪')
const statusClass = computed(() => statusConfig[authStore.syncStatus]?.class || 'status-idle')

// 切换弹窗显示
function togglePopover() {
  showPopover.value = !showPopover.value
}

// 触发同步
async function triggerSync() {
  if (authStore.syncStatus === 'syncing') return
  await authStore.startSync()
}

// 格式化时间
function formatTime(timestamp: number | null): string {
  if (!timestamp) return '从未'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // 小于1分钟
  if (diff < 60000) return '刚刚'
  // 小于1小时
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  // 小于24小时
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
  // 昨天
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div v-if="authStore.isAuthenticated" class="sync-indicator" @click="togglePopover">
    <span class="sync-icon" :class="statusClass">{{ statusIcon }}</span>
    <div v-if="showPopover" class="sync-popover">
      <div class="sync-status-text">{{ statusText }}</div>
      <div v-if="authStore.lastSyncAt" class="sync-time">
        上次同步: {{ formatTime(authStore.lastSyncAt) }}
      </div>
      <button class="sync-button" @click.stop="triggerSync" :disabled="authStore.syncStatus === 'syncing'">
        立即同步
      </button>
    </div>
  </div>
</template>

<style scoped>
.sync-indicator {
  position: relative;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  transition: background var(--transition-fast);
}

.sync-indicator:hover {
  background: var(--bg-hover);
}

.sync-icon {
  font-size: 16px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-syncing {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-idle {
  opacity: 0.7;
}

.status-success {
  color: var(--success-color);
}

.status-error {
  color: var(--warning-color);
}

.status-offline {
  opacity: 0.5;
}

.sync-popover {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-md);
  min-width: 200px;
  z-index: 100;
  margin-top: var(--space-xs);
}

.sync-status-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.sync-time {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: var(--space-md);
}

.sync-button {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sync-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.sync-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
