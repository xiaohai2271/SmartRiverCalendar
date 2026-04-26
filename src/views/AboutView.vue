<template>
  <div class="about-view">
    <div class="about-card">
      <!-- Logo 和标题 -->
      <div class="logo-section">
        <div class="logo">📅</div>
        <h1>小河日历</h1>
      </div>

      <!-- 版本信息 -->
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">版本号</span>
          <span class="info-value version">{{ appVersion }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">编译日期</span>
          <span class="info-value build-date">{{ buildDate }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Git Hash</span>
          <span class="info-value git-hash">{{ gitHash }}</span>
        </div>
      </div>

      <!-- 版权信息 -->
      <div class="copyright">
        © 2024-2025 小河日历
      </div>

      <!-- 返回设置按钮 -->
      <router-link to="/settings" class="back-link fluent-button">
        ← 返回设置
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 从全局变量读取应用信息
const appVersion = computed(() => {
  return (window as any).__APP_VERSION__ || 'unknown'
})

const buildDate = computed(() => {
  const date = (window as any).__BUILD_DATE__
  if (!date || date === 'unknown') return 'unknown'
  // 如果已经是格式化好的字符串，直接返回
  if (typeof date === 'string') return date
  // 如果是时间戳，格式化
  try {
    const d = new Date(date)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '-')
  } catch {
    return String(date)
  }
})

const gitHash = computed(() => {
  const hash = (window as any).__GIT_HASH__
  return hash || 'unknown'
})
</script>

<style scoped>
.about-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: var(--bg-primary);
}

.about-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-fluent);
  padding: 48px 56px;
  text-align: center;
  max-width: 420px;
  width: 100%;
  animation: scaleIn var(--transition-smooth) forwards;
}

.logo-section {
  margin-bottom: 32px;
}

.logo {
  font-size: 64px;
  margin-bottom: 16px;
  line-height: 1;
}

h1 {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.info-section {
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 20px 24px;
  margin-bottom: 24px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
}

.copyright {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 24px;
}

.back-link {
  display: inline-flex;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: none;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
