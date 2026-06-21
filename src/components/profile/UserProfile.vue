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
        <h3 class="username" data-testid="user-display-name">{{ user?.displayName || '未知用户' }}</h3>
        <p class="email" data-testid="user-email">{{ user?.email || '未设置邮箱' }}</p>
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



    <!-- 个人效率看板 ── Notion 风格仪表盘 -->
    <div class="profile-stats-dashboard">
      <h4 class="stats-title">效率看板</h4>
      <div class="stats-grid">
        <!-- 待办完成统计 -->
        <div class="stats-card-mini">
          <div class="mini-label">待办完成率</div>
          <div class="mini-value-row">
            <span class="mini-value">{{ todoCompletionRate }}%</span>
            <span class="mini-sub">{{ completedTodoCount }} / {{ totalTodoCount }}</span>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-bar" :style="{ width: `${todoCompletionRate}%` }"></div>
          </div>
        </div>

        <!-- 日程统计 -->
        <div class="stats-card-mini">
          <div class="mini-label">日程总数</div>
          <div class="mini-value-row">
            <span class="mini-value">{{ totalEventCount }}</span>
            <span class="mini-sub">个日程安排</span>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-bar accent-bar" style="width: 100%"></div>
          </div>
        </div>

        <!-- 云端存储使用 -->
        <div class="stats-card-mini colspan-2">
          <div class="mini-label">云同步空间占用</div>
          <div class="mini-value-row">
            <span class="mini-value">{{ storageUsedText }}</span>
            <span class="mini-sub">50.0 MB 配额</span>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-bar storage-bar" :style="{ width: `${storagePercent}%` }"></div>
          </div>
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
import { computed, onMounted } from 'vue'
import type { User } from '../../types/auth'
import { useTodoStore } from '../../stores/todo'
import { useCalendarStore } from '../../stores/calendar'

const todoStore = useTodoStore()
const calendarStore = useCalendarStore()

onMounted(() => {
  todoStore.initialize()
})

// ==================== Props ====================
interface Props {
  user: User | null
}

const props = withDefaults(defineProps<Props>(), {
  user: null
})

// ==================== Store Stats ====================
const completedTodoCount = computed(() => todoStore.completedTodos.length)
const totalTodoCount = computed(() => todoStore.todos.length)
const todoCompletionRate = computed(() => totalTodoCount.value ? Math.round((completedTodoCount.value / totalTodoCount.value) * 100) : 0)

const totalEventCount = computed(() => calendarStore.totalEventCount)

// 模拟以日程和待办体积增长的存储大小
const storageUsedText = computed(() => {
  const base = 0.42 + totalEventCount.value * 0.012 + totalTodoCount.value * 0.005
  return `${base.toFixed(3)} MB`
})

const storagePercent = computed(() => {
  const base = 0.42 + totalEventCount.value * 0.012 + totalTodoCount.value * 0.005
  return Math.min(Math.max(Math.round((base / 50.0) * 100), 1), 100)
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
}

function handleChangePassword() {
  console.log('修改密码 clicked')
}
</script>

<style scoped>
.user-profile-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 28px;
  box-shadow: var(--shadow-sm), inset 0 1px 1px rgba(255, 255, 255, 0.05);
  transition: all var(--transition-fast);
}

.user-profile-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--text-tertiary);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
}

.avatar-container {
  flex-shrink: 0;
}

.avatar {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--bg-primary);
  box-shadow: 0 0 0 1px var(--border-color), var(--shadow-sm);
  transition: transform var(--transition-fast);
}

.user-profile-card:hover .avatar {
  transform: scale(1.05);
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.avatar-placeholder svg {
  width: 42px;
  height: 42px;
  opacity: 0.6;
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.username {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.email {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin: 0;
  font-weight: 500;
}

.provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: 20px;
  border: 1px solid var(--border-color);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-top: 4px;
  align-self: flex-start;
}

.provider-icon {
  display: flex;
  align-items: center;
}

.provider-icon svg {
  width: 13px;
  height: 13px;
}

.provider-text {
  font-weight: 600;
}

.user-id-text {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  font-family: monospace;
}

.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: auto; /* 等高拉伸时，强制按钮沉底对齐，极具秩序感 */
  padding-top: 24px;
}

.action-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--bg-tertiary);
  border: 1.2px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent-color);
  color: var(--accent-color);
  transform: translateY(-1px);
}

.action-btn:active {
  transform: scale(0.98);
}

.action-btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.action-btn:hover svg {
  color: var(--accent-color);
}

/* 效率看板仪表盘 */
.profile-stats-dashboard {
  margin: 24px 0;
  padding-top: 24px;
  border-top: 1px dashed var(--border-color);
}

.stats-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 16px 0;
  letter-spacing: -0.3px;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.stats-card-mini {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all var(--transition-fast);
}

.stats-card-mini:hover {
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
  transform: translateY(-1px);
}

.colspan-2 {
  grid-column: span 2;
}

.mini-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.mini-value-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 2px;
}

.mini-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.mini-sub {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-tertiary);
}

.mini-progress-track {
  height: 4px;
  background: var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  margin-top: 4px;
}

.mini-progress-bar {
  height: 100%;
  background: #107c10; /* 绿色代表待办完成率 */
  border-radius: 10px;
  transition: width 0.6s cubic-bezier(0.1, 0.9, 0.2, 1);
}

.mini-progress-bar.accent-bar {
  background: var(--accent-color);
}

.mini-progress-bar.storage-bar {
  background: #0078d4;
}
</style>
