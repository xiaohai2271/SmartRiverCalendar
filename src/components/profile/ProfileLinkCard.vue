<template>
  <div class="profile-links-card">
    <div class="card-header">
      <h3 class="card-title">快速访问</h3>
    </div>
    
    <div class="links-list">
      <a href="https://web.calendar.menghuan.life/" target="_blank" class="link-item">
        <div class="link-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <div class="link-content">
          <span class="link-title">Web端在线日历</span>
          <span class="link-desc">免安装，随时随地管理日程</span>
        </div>
        <div class="link-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </a>

      <a href="https://calendar.menghuan.life/" target="_blank" class="link-item">
        <div class="link-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div class="link-content">
          <span class="link-title">官网首页</span>
          <span class="link-desc">了解小河日历最新动态</span>
        </div>
        <div class="link-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </a>

      <a href="https://calendar.menghuan.life/console" target="_blank" class="link-item">
        <div class="link-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </div>
        <div class="link-content">
          <span class="link-title">管理平台</span>
          <span class="link-desc">高级设置与账号管理</span>
        </div>
        <div class="link-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
// 该组件仅包含静态链接跳转，符合国内应用"我的"界面的典型列表卡片风格
</script>

<style scoped>
.profile-links-card {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  box-shadow: var(--shadow);
}

.card-header {
  margin-bottom: 12px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.link-item {
  display: flex;
  align-items: center;
  padding: 12px 8px;
  border-radius: var(--radius-md);
  text-decoration: none;
  transition: background-color var(--transition-fast);
  color: inherit;
}

.link-item:hover {
  background-color: var(--bg-primary);
}

.link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: rgba(0, 120, 212, 0.1);
  color: var(--accent-color);
  margin-right: 12px;
  flex-shrink: 0;
}

.link-icon svg {
  width: 20px;
  height: 20px;
}

.link-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.link-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.link-arrow {
  display: flex;
  align-items: center;
  color: var(--text-secondary);
  opacity: 0.5;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.link-item:hover .link-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.link-arrow svg {
  width: 16px;
  height: 16px;
}
</style>
