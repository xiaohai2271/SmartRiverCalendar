<template>
  <div class="about-tab">
    <div class="about-card">
      <div class="app-logo">
        <img :src="appIconUrl" alt="小河日历" width="96" height="96" />
      </div>
      <h2 class="app-name">小河日历</h2>
      <p class="app-version">版本 {{ version }}</p>
      <p class="app-slogan">打造最强替代系统日历的智能日历软件</p>

      <div class="info-section">
        <div class="info-item">
          <span class="info-label">构建时间</span>
          <span class="info-value">{{ buildDate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Git 提交</span>
          <span class="info-value">{{ gitHash }}</span>
        </div>
      </div>

      <!-- <div class="links-section">
        <a href="https://github.com/xiaohai2271/SmartRiverCalender" target="_blank" class="link-item">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
          </svg>
          GitHub 仓库
        </a>
      </div> -->

      <p class="copyright">© 2025-2026 小河日历</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 关于 Tab 组件
 * 显示应用版本、构建信息等
 */
import { ref } from 'vue'
import appIconUrl from '../../assets/icon.png'

// ==================== 构建信息（由 Vite define 在编译时注入） ====================
// 使用 typeof 守卫：Vite 编译后 __XXX__ 被替换为字面量，typeof 永远为 string
// 在测试环境（未经 Vite define 处理）中，typeof 检查返回 undefined 走 fallback
const version = ref(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0')
const buildDate = ref(formatBuildDate(typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : ''))
const gitHash = ref(typeof __GIT_HASH__ !== 'undefined' ? __GIT_HASH__ : '-')

// ==================== Methods ====================
/**
 * 格式化构建日期
 */
function formatBuildDate(dateStr: string): string {
  if (!dateStr || dateStr === 'unknown') return '-'
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
</script>

<style scoped>
.about-tab {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.about-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 40px;
  text-align: center;
  max-width: 480px;
  width: 100%;
}

.app-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: var(--radius-xl);
  margin-bottom: 20px;
}

.app-name {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.app-version {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.app-slogan {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.info-section {
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  margin-bottom: 24px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 13px;
  color: var(--text-primary);
  font-family: monospace;
}

.links-section {
  margin-bottom: 24px;
}

.link-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 14px;
  transition: all 0.2s ease;
}

.link-item:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.copyright {
  font-size: 12px;
  color: var(--text-tertiary);
}
</style>
