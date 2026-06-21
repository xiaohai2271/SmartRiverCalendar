<template>
  <button
    type="button"
    class="github-login-btn"
    :disabled="isLoading"
    @click="handleLogin"
  >
    <svg
      class="github-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
           0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015
           1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925
           0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27
           1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84
           1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22
           0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
      />
    </svg>
    <span v-if="isLoading" class="btn-content">
      <span class="spinner"></span>
      登录中...
    </span>
    <span v-else class="btn-content">使用 GitHub 登录</span>
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'

// ==================== Emits ====================
const emit = defineEmits<{
  'login-success': []
}>()

// ==================== Store ====================
const authStore = useAuthStore()

// ==================== State ====================
const isLoading = ref(false)
const errorMessage = ref('')

// ==================== Methods ====================
/**
 * 处理 GitHub 登录
 */
async function handleLogin(): Promise<void> {
  if (isLoading.value) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    // 从环境变量或配置中获取 GitHub OAuth 配置
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || ''
    const redirectUri = import.meta.env.VITE_GITHUB_REDIRECT_URI || `${window.location.origin}/auth/callback`

    if (!clientId) {
      console.warn('[GithubLoginButton] GitHub Client ID 未配置')
      // 使用模拟登录进行开发测试
      const success = await mockGithubLogin()
      if (success) {
        emit('login-success')
      }
      return
    }

    const success = await authStore.loginWithGithub(clientId, redirectUri)

    if (success) {
      emit('login-success')
    } else {
      errorMessage.value = 'GitHub 登录失败'
    }
  } catch (error) {
    console.error('GitHub 登录失败:', error)
    errorMessage.value = 'GitHub 登录失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

/**
 * 模拟 GitHub 登录（用于开发测试）
 */
async function mockGithubLogin(): Promise<boolean> {
  // 模拟 API 调用延迟
  await new Promise(resolve => setTimeout(resolve, 1000))

  // 创建模拟用户数据
  const mockUser = {
    id: `github_${Date.now()}`,
    username: `github_user_${Math.floor(Math.random() * 10000)}`,
    email: `user${Math.floor(Math.random() * 10000)}@example.com`,
    avatar: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 10000000)}`,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  // 直接设置 store 状态
  authStore.user = mockUser as any
  authStore.isAuthenticated = true

  return true
}
</script>

<style scoped>
.github-login-btn {
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

.github-login-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--text-secondary);
}

.github-login-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.github-login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.github-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
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
