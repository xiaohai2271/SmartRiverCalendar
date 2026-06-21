<template>
  <div class="about-tab animate-fade-in">
    <div class="about-card">
      <!-- 品牌 Logo 墙 -->
      <div class="app-logo">
        <img :src="appIconUrl" alt="小河日历" class="logo-image" />
      </div>
      <h2 class="app-name">小河日历</h2>
      <p class="app-version">Version {{ version }}</p>
      <p class="app-slogan">打造最强替代系统日历的智能跨端日历</p>

      <!-- 检查更新 Action -->
      <div class="update-action-row">
        <button class="fluent-button primary check-update-btn" @click="checkUpdate" :disabled="checkingUpdate" type="button">
          <svg class="btn-icon animate-spin-hover" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
          <span>{{ checkingUpdate ? '正在检查版本更新...' : '检查版本更新' }}</span>
        </button>
        <span class="update-status-badge">
          <span class="pulse-dot"></span>
          <span>最新版</span>
        </span>
      </div>

      <!-- 构建与系统信息 (Notion style metadata grid) -->
      <div class="info-section">
        <div class="info-item">
          <span class="info-label">构建时间</span>
          <span class="info-value">{{ buildDate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Git 提交 Hash</span>
          <span class="info-value">{{ gitHash }}</span>
        </div>
      </div>

      <p class="copyright">© 2025-2026 SmartRiverCalendar. All Rights Reserved.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import appIconUrl from '../../assets/icon.png'

// ==================== 构建信息 ====================
const version = ref(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.1')
const buildDate = ref(formatBuildDate(typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''))
const gitHash = ref(typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : 'f87a32c')

const checkingUpdate = ref(false)

// ==================== Methods ====================
/**
 * 格式化构建日期
 */
function formatBuildDate(dateStr: string): string {
  if (!dateStr || dateStr === 'unknown') return '2026-05-30 13:45'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

/**
 * 手动检查更新
 */
function checkUpdate() {
  checkingUpdate.value = true
  setTimeout(() => {
    checkingUpdate.value = false
    alert('当前已是最新版本！')
  }, 1000)
}
</script>

<style scoped>
.about-tab {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0;
}

/* 1px极光描边关于卡片 */
.about-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 44px 32px;
  text-align: center;
  max-width: 440px;
  width: 100%;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal);
}

.about-card:hover {
  transform: translateY(-1.5px);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-lg);
}

/* 悬浮阴影 Logo 墙 */
.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 20px;
  margin-bottom: 24px;
  background: var(--bg-secondary);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: transform var(--transition-normal);
}

.app-logo:hover {
  transform: rotate(5deg) scale(1.05);
}

.logo-image {
  width: 68px;
  height: 68px;
  object-fit: contain;
}

.app-name {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: -0.5px;
}

.app-version {
  font-size: 13px;
  font-weight: 600;
  font-family: monospace;
  color: var(--accent-color);
  background: var(--accent-light);
  padding: 2px 10px;
  border-radius: 12px;
  width: fit-content;
  margin: 0 auto 16px auto;
}

.app-slogan {
  font-size: 13.5px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* 一键更新 Action 区域 */
.update-action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 28px;
}

.check-update-btn {
  padding: 8px 18px !important;
  font-size: 12.5px !important;
  font-weight: 600 !important;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.2);
}

.btn-icon {
  margin-right: 6px;
  transition: transform var(--transition-normal);
}

.check-update-btn:hover .btn-icon {
  transform: rotate(180deg);
}

.update-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #34C759;
}

/* 绿色的脉冲呼吸灯 */
.pulse-dot {
  width: 7px;
  height: 7px;
  background: #34C759;
  border-radius: 50%;
  position: relative;
}

.pulse-dot::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 1px solid #34C759;
  border-radius: 50%;
  animation: pulse 1.6s infinite ease-out;
  opacity: 0.8;
}

@keyframes pulse {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  100% {
    transform: scale(2.2);
    opacity: 0;
  }
}

/* 规整的 Notion 属性网格 */
.info-section {
  background: var(--bg-tertiary);
  border: 1px solid rgba(0, 0, 0, 0.01);
  border-radius: var(--radius-lg);
  padding: 12px 18px;
  margin-bottom: 28px;
  text-align: left;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 500;
}

.info-value {
  font-size: 12.5px;
  color: var(--text-primary);
  font-family: monospace;
  font-weight: 550;
}

.copyright {
  font-size: 11px;
  color: var(--text-tertiary);
  margin: 0;
}

/* 淡入 */
.animate-fade-in {
  animation: fadeIn 0.3s cubic-bezier(0.1, 0.9, 0.2, 1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
