<template>
  <div :class="['profile-view', { 'authenticated': authStore.isAuthenticated }]">
    <h2 class="page-title">我的</h2>

    <!-- 未登录状态：显示登录/注册表单（保持小而美的窄版居中限制） -->
    <div v-if="!authStore.isAuthenticated" class="auth-container">
      <div class="auth-card" data-testid="auth-card">
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

    <!-- 已登录状态：双列 Premium Dashboard 宽屏网格布局 -->
    <div v-else class="profile-container" data-testid="profile-logged-in">
      <!-- 左列：用户信息看板 -->
      <div class="dashboard-left">
        <UserProfile :user="authStore.user" />
      </div>

      <!-- 右列：同步状态面板与快速卡片 -->
      <div class="dashboard-right">
        <!-- 同步状态面板（仅当支持本地数据库时显示） -->
        <SyncStatusPanel
          v-if="capabilities.hasLocalDatabase"
          :sync-status="authStore.syncStatus"
          :last-sync-at="authStore.lastSyncAt"
          @sync="handleSync"
        />

        <!-- 快速链接面板 -->
        <ProfileLinkCard />
      </div>

      <!-- 底部操作区：退出登录 -->
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
  max-width: 480px; /* 未登录状态下限制窄版，精致小巧 */
  margin: 0 auto;
  padding: 32px 24px;
  transition: max-width var(--transition-fast);
}

/* 已登录状态下自适应变宽，撑满 900px 黄金尺寸 */
.profile-view.authenticated {
  max-width: 900px;
}

.page-title {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 28px;
  color: var(--text-primary);
  letter-spacing: -0.8px;
}

/* 认证容器样式 */
.auth-container {
  display: flex;
  justify-content: center;
}

.auth-card {
  width: 100%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-md);
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
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

/* 个人资料容器样式 ── 升级为双列响应式 Dashboard */
.profile-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-left,
.dashboard-right {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.logout-section {
  margin-top: 12px;
}

/* 黄金双列网格断点 */
@media (min-width: 768px) {
  .profile-container {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr; /* 左右黄金比例 */
    align-items: stretch; /* 强制两列等高拉伸 */
  }

  .dashboard-left {
    display: flex;
  }

  /* 让左列卡片高度撑满 */
  .dashboard-left > * {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* 让右列的快速链接卡片弹性向下填充，顶到最底端 */
  .dashboard-right > :last-child {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .logout-section {
    grid-column: span 2;
  }
}
</style>
