<template>
  <div class="user-profile-card">
    <div class="profile-header">
      <!-- 用户头像 -->
      <div class="avatar-container">
        <img
          v-if="user?.avatarUrl"
          :src="user.avatarUrl"
          alt="用户头像"
          class="avatar"
        />
        <div v-else class="avatar avatar-placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
      </div>

      <!-- 用户基本信息 -->
      <div class="user-info">
        <h3 class="username">{{ user?.displayName || '未知用户' }}</h3>
        <p class="email">{{ user?.email || '未设置邮箱' }}</p>
        <p class="user-id-text">ID: {{ user?.id.slice(0, 8) || '-' }}</p>
        <div class="provider-badge">
          <span class="provider-icon">
            <svg v-if="provider === 'github'" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57
                     0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695
                     -.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99
                     .105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225
                     -.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405
                     c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605
                     -2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69
                     .825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53
                     4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
          </span>
          <span class="provider-text">{{ providerText }}</span>
        </div>
      </div>
    </div>



    <!-- 账户操作 -->
    <div class="profile-actions">
      <button class="action-btn" @click="handleEditProfile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        编辑资料
      </button>
      <button class="action-btn" @click="handleChangePassword">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        修改密码
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '../../types/auth'

// ==================== Props ====================
interface Props {
  user: User | null
}

const props = withDefaults(defineProps<Props>(), {
  user: null
})

// ==================== Computed ====================
/**
 * 认证提供商
 */
const provider = computed(() => {
  return props.user?.provider || 'local'
})

/**
 * 提供商显示文本
 */
const providerText = computed(() => {
  switch (provider.value) {
    case 'github':
      return 'GitHub 账号'
    case 'google':
      return 'Google 账号'
    case 'wechat':
      return '微信账号'
    default:
      return '本地账号'
  }
})

// ==================== Methods ====================
function handleEditProfile() {
  console.log('编辑资料 clicked')
  // 留出接口/后续可触发弹窗或导航
}

function handleChangePassword() {
  console.log('修改密码 clicked')
  // 留出接口/后续可触发弹窗或导航
}

</script>

<style scoped>
.user-profile-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.avatar-container {
  flex-shrink: 0;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--border-color);
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.avatar-placeholder svg {
  width: 40px;
  height: 40px;
  opacity: 0.5;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.username {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.email {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.provider-icon {
  display: flex;
  align-items: center;
}

.provider-icon svg {
  width: 14px;
  height: 14px;
}

.provider-text {
  font-weight: 500;
}

.user-id-text {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.7;
}

.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-secondary);
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.action-btn svg {
  width: 14px;
  height: 14px;
}
</style>
