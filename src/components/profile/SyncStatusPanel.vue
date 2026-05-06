<template>
  <div class="sync-status-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <svg class="icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        云端同步
      </h3>
      <span
        class="status-badge"
        :class="`status-${syncStatus}`"
      >
        <span class="status-dot"></span>
        {{ statusText }}
      </span>
    </div>

    <div class="panel-content">
      <!-- 同步状态信息 -->
      <div class="sync-info">
        <div class="info-row">
          <span class="info-label">上次同步:</span>
          <span class="info-value">{{ lastSyncTimeText }}</span>
        </div>
        <div v-if="syncStatus === 'error'" class="info-row error-row">
          <span class="info-label">同步失败:</span>
          <span class="info-value error-text">请检查网络连接后重试</span>
        </div>
        <div v-if="syncStatus === 'offline'" class="info-row offline-row">
          <span class="info-label">当前状态:</span>
          <span class="info-value offline-text">设备处于离线状态</span>
        </div>
      </div>

      <!-- 立即同步按钮 -->
      <button
        type="button"
        class="sync-btn"
        :disabled="isSyncing"
        @click="handleSync"
      >
        <span v-if="isSyncing" class="btn-content">
          <span class="spinner"></span>
          同步中...
        </span>
        <span v-else class="btn-content">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          立即同步
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CloudSyncStatus } from '../../types/auth'

// ==================== Props ====================
interface Props {
  syncStatus: CloudSyncStatus
  lastSyncAt: number | null
}

const props = defineProps<Props>()

// ==================== Emits ====================
const emit = defineEmits<{
  sync: []
}>()

// ==================== Computed ====================
/**
 * 是否正在同步
 */
const isSyncing = computed(() => props.syncStatus === 'syncing')

/**
 * 状态文本
 */
const statusText = computed(() => {
  switch (props.syncStatus) {
    case 'idle':
      return '等待同步'
    case 'syncing':
      return '同步中'
    case 'success':
      return '同步成功'
    case 'error':
      return '同步失败'
    case 'offline':
      return '离线状态'
    default:
      return '未知状态'
  }
})

/**
 * 上次同步时间文本
 */
const lastSyncTimeText = computed(() => {
  if (!props.lastSyncAt) {
    return '从未同步'
  }

  const now = Date.now()
  const diff = now - props.lastSyncAt
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes} 分钟前`
  } else if (hours < 24) {
    return `${hours} 小时前`
  } else if (days < 7) {
    return `${days} 天前`
  } else {
    const date = new Date(props.lastSyncAt)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
})

// ==================== Methods ====================
/**
 * 处理同步按钮点击
 */
function handleSync(): void {
  if (isSyncing.value) return
  emit('sync')
}
</script>

<style scoped>
.sync-status-panel {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.icon {
  width: 20px;
  height: 20px;
  color: var(--accent-color);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* 等待同步状态 */
.status-idle {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary);
}

.status-idle .status-dot {
  background: var(--text-secondary);
}

/* 同步中状态 */
.status-syncing {
  background: rgba(0, 120, 212, 0.1);
  color: var(--accent-color);
}

.status-syncing .status-dot {
  background: var(--accent-color);
  animation: pulse 1.5s ease-in-out infinite;
}

/* 同步成功状态 */
.status-success {
  background: rgba(16, 124, 16, 0.1);
  color: #107c10;
}

.status-success .status-dot {
  background: #107c10;
}

/* 同步失败状态 */
.status-error {
  background: rgba(216, 59, 1, 0.1);
  color: #d83b01;
}

.status-error .status-dot {
  background: #d83b01;
}

/* 离线状态 */
.status-offline {
  background: rgba(96, 94, 92, 0.1);
  color: #605e5c;
}

.status-offline .status-dot {
  background: #605e5c;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.1);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sync-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.info-label {
  color: var(--text-secondary);
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;
}

.error-row .info-label,
.error-text {
  color: #d83b01;
}

.offline-row .info-label,
.offline-text {
  color: #605e5c;
}

.sync-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
}

.sync-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
}

.sync-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.sync-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
