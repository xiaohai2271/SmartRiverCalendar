<template>
  <button
    type="button"
    class="logout-btn"
    data-testid="logout-btn"
    :disabled="isLoading"
    @click="handleLogout"
  >
    <span v-if="isLoading" class="btn-content">
      <span class="spinner"></span>
      退出中...
    </span>
    <span v-else class="btn-content">
      <svg class="icon" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
      </svg>
      退出登录
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

// ==================== Emits ====================
const emit = defineEmits<{
  logout: []
}>()

// ==================== Store ====================
const authStore = useAuthStore()

// ==================== State ====================
const isLoading = ref(false)

// ==================== Methods ====================
/**
 * 处理退出登录
 */
async function handleLogout(): Promise<void> {
  if (isLoading.value) return

  isLoading.value = true

  try {
    await authStore.logout()
    emit('logout')
  } catch (error) {
    console.error('退出登录失败:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  max-width: 240px;
  margin: 0 auto;
  padding: 11px 24px;
  border: 1.2px solid rgba(216, 59, 1, 0.25);
  border-radius: 10px;
  background: var(--bg-secondary);
  color: #d83b01;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.logout-btn:hover:not(:disabled) {
  background: rgba(216, 59, 1, 0.08);
  border-color: #d83b01;
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.logout-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.logout-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon {
  width: 16px;
  height: 16px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(216, 59, 1, 0.2);
  border-top-color: #d83b01;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.logout-btn:hover:not(:disabled) .spinner {
  border-color: rgba(216, 59, 1, 0.4);
  border-top-color: #d83b01;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
