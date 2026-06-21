<template>
  <div class="oauth-login-container">
    <!-- Provider 按钮（idle 状态） -->
    <div v-if="oauthStatus === 'idle'" class="oauth-providers">
      <button
        v-for="p in providers"
        :key="p.id"
        type="button"
        class="oauth-login-btn"
        :disabled="isLoading"
        @click="handleLogin(p.id)"
      >
        <span class="oauth-icon" v-html="p.icon"></span>
        <span class="btn-text">使用 {{ p.name }} 登录</span>
      </button>
    </div>

    <!-- 进行中状态 -->
    <div v-else class="oauth-progress">
      <div class="progress-content">
        <span v-if="oauthStatus === 'pending'" class="status-text">等待打开浏览器...</span>
        <span v-else-if="oauthStatus === 'authorizing'" class="status-text">请在浏览器中完成登录</span>
        <span v-else-if="oauthStatus === 'failed'" class="status-text error">{{ oauthErrorMessage || '登录失败，请重试' }}</span>
        <span v-else-if="oauthStatus === 'expired' || oauthStatus === 'timeout'" class="status-text error">登录已超时，请重试</span>
        <span class="spinner" v-if="oauthStatus === 'pending' || oauthStatus === 'authorizing'"></span>
      </div>
      <button
        v-if="oauthStatus === 'pending' || oauthStatus === 'authorizing'"
        type="button"
        class="cancel-btn"
        @click="handleCancel"
      >
        取消
      </button>
      <button
        v-if="oauthStatus === 'failed' || oauthStatus === 'expired' || oauthStatus === 'timeout'"
        type="button"
        class="retry-btn"
        @click="resetStatus"
      >
        重试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '../../stores/auth'

// ==================== Store ====================
const authStore = useAuthStore()

// ==================== State ====================
type OAuthStatus = 'idle' | 'pending' | 'authorizing' | 'failed' | 'expired' | 'timeout'
const internalStatus = ref<OAuthStatus>('idle')
const errorMessage = ref('')
const isLoading = ref(false)
const oauthStatus = computed(() => internalStatus.value)
const oauthErrorMessage = computed(() => errorMessage.value)

// ==================== Provider 配置 ====================
const providers: { id: string; name: string; icon: string }[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
  },
]

// ==================== Methods ====================
async function handleLogin(provider: string): Promise<void> {
  if (isLoading.value) return
  isLoading.value = true
  internalStatus.value = 'pending'
  errorMessage.value = ''
  try {
    if (provider === 'github') {
      const success = await authStore.loginWithGithub(
        import.meta.env.VITE_GITHUB_CLIENT_ID || '',
        import.meta.env.VITE_GITHUB_REDIRECT_URI || ''
      )
      if (!success) {
        internalStatus.value = 'failed'
        errorMessage.value = '登录失败'
        return
      }
    }
    internalStatus.value = 'idle'
  } catch {
    internalStatus.value = 'failed'
    errorMessage.value = '登录异常'
  } finally {
    isLoading.value = false
  }
}

async function handleCancel(): Promise<void> {
  internalStatus.value = 'idle'
}

function resetStatus(): void {
  internalStatus.value = 'idle'
  errorMessage.value = ''
}
</script>

<style scoped>
.oauth-login-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oauth-providers {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oauth-login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 12px 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.1s ease;
}

.oauth-login-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--text-secondary);
}

.oauth-login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.oauth-login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.oauth-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.oauth-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.btn-text {
  display: flex;
  align-items: center;
}

/* 进行中状态 */
.oauth-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-text {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.status-text.error {
  color: var(--text-error, #e74c3c);
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.cancel-btn,
.retry-btn {
  padding: 8px 24px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.cancel-btn:hover,
.retry-btn:hover {
  background: var(--bg-secondary);
}
</style>
