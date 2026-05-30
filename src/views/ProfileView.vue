<template>
  <div class="profile-view">
    <h2>我的</h2>

    <!-- 未登录状态：显示登录/注册表单 -->
    <div v-if="!authStore.isAuthenticated" class="auth-container">
      <div class="auth-card">
        <!-- 登录表单 -->
        <LoginForm
          v-if="currentForm === 'login'"
          @switch-to-register="currentForm = 'register'"
          @login-success="handleLoginSuccess"
        />

        <!-- 注册表单 -->
        <RegisterForm
          v-else
          @switch-to-login="currentForm = 'login'"
          @register-success="handleRegisterSuccess"
        />

        <!-- GitHub 登录按钮 -->
        <div class="divider">
          <span>或使用以下方式登录</span>
        </div>
        <GithubLoginButton @login-success="handleLoginSuccess" />
      </div>
    </div>

    <!-- 已登录状态：显示用户信息和同步状态 -->
    <div v-else class="profile-container">
      <!-- 用户信息卡片 -->
      <UserProfile :user="authStore.user" />

      <!-- 同步状态面板（仅当支持本地数据库时显示） -->
      <SyncStatusPanel
        v-if="capabilities.hasLocalDatabase"
        :sync-status="authStore.syncStatus"
        :last-sync-at="authStore.lastSyncAt"
        @sync="handleSync"
      />

      <!-- 快速链接面板 -->
      <ProfileLinkCard />

      <!-- 退出登录按钮 -->
      <div class="logout-section">
        <LogoutButton @logout="handleLogout" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import LoginForm from '../components/profile/LoginForm.vue'
import RegisterForm from '../components/profile/RegisterForm.vue'
import GithubLoginButton from '../components/profile/GithubLoginButton.vue'
import UserProfile from '../components/profile/UserProfile.vue'
import SyncStatusPanel from '../components/profile/SyncStatusPanel.vue'
import ProfileLinkCard from '../components/profile/ProfileLinkCard.vue'
import LogoutButton from '../components/profile/LogoutButton.vue'
import { useCapabilities } from '../platform/provider'

// ==================== Capabilities ====================
const capabilities = useCapabilities()

// ==================== Store ====================
const authStore = useAuthStore()

// ==================== State ====================
type FormType = 'login' | 'register'
const currentForm = ref<FormType>('login')

// ==================== Methods ====================
/**
 * 处理登录成功
 */
function handleLoginSuccess(): void {
  // 登录成功后，store 已更新，视图会自动切换
  console.log('[Profile] 登录成功')
}

/**
 * 处理注册成功
 */
function handleRegisterSuccess(): void {
  // 注册成功后，store 已更新，视图会自动切换
  console.log('[Profile] 注册成功')
}

/**
 * 处理立即同步
 */
async function handleSync(): Promise<void> {
  await authStore.startSync()
}

/**
 * 处理退出登录
 */
async function handleLogout(): Promise<void> {
  await authStore.logout()
  // 重置表单状态为登录
  currentForm.value = 'login'
}
</script>

<style scoped>
.profile-view {
  max-width: 480px;
  margin: 0 auto;
  padding: 20px;
}

h2 {
  margin-bottom: 24px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 认证容器样式 */
.auth-container {
  display: flex;
  justify-content: center;
}

.auth-card {
  width: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 32px;
  box-shadow: var(--shadow);
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
}

.divider span {
  padding: 0 16px;
  white-space: nowrap;
}

/* 个人资料容器样式 */
.profile-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.logout-section {
  margin-top: 8px;
}
</style>
