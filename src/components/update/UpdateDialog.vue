<template>
  <!-- 使用 Teleport 将对话框渲染到 body -->
  <Teleport to="body">
    <!-- 使用 Transition 实现动画效果 -->
    <Transition name="dialog">
      <!-- 遮罩层和对话框容器 -->
      <div
        v-if="visible"
        class="dialog-overlay"
        @click.self="emit('close')"
      >
        <!-- 更新对话框主体 -->
        <div class="update-dialog">
          <!-- 对话框头部 -->
          <div class="dialog-header">
            <h3>
              发现新版本
              <span class="version">{{ updateInfo?.version || '' }}</span>
            </h3>
            <button
              class="close-btn"
              @click="emit('close')"
              :disabled="loading"
              title="关闭"
            >
              ×
            </button>
          </div>

          <!-- 对话框内容区域 -->
          <div class="dialog-body">
            <!-- 更新日志内容 -->
            <div
              v-if="updateInfo?.body"
              class="update-log"
              v-html="updateInfo.body"
            ></div>
            <!-- 空日志提示 -->
            <div v-else class="empty-log">
              暂无更新日志
            </div>
          </div>

          <!-- 对话框底部按钮区域 -->
          <div class="dialog-footer">
            <!-- 现在升级按钮（主操作） -->
            <button
              class="btn-accent"
              @click="emit('upgrade')"
              :disabled="loading"
            >
              {{ loading ? '下载中...' : '现在升级' }}
            </button>
            <!-- 稍后按钮 -->
            <button
              class="btn-secondary"
              @click="emit('later')"
              :disabled="loading"
            >
              稍后
            </button>
            <!-- 不再提示按钮 -->
            <button
              class="btn-secondary"
              @click="emit('skip')"
              :disabled="loading"
            >
              不再提示
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 软件更新对话框组件
 * 用于显示新版本信息和更新选项
 */

import type { UpdateInfo } from '@/types'

/**
 * 组件 Props 定义
 */
interface Props {
  /** 控制对话框显示/隐藏 */
  visible: boolean
  /** 更新信息，包含版本号、更新日志等 */
  updateInfo: UpdateInfo | null
  /** 是否处于下载/安装中状态 */
  loading?: boolean
}

/**
 * 默认值定义
 */
withDefaults(defineProps<Props>(), {
  loading: false
})

/**
 * 组件事件定义
 */
interface Emits {
  /** 用户点击"现在升级"按钮 */
  (e: 'upgrade'): void
  /** 用户点击"稍后"按钮 */
  (e: 'later'): void
  /** 用户点击"不再提示"按钮 */
  (e: 'skip'): void
  /** 用户关闭对话框（点击关闭按钮或遮罩层） */
  (e: 'close'): void
}

const emit = defineEmits<Emits>()
</script>

<style scoped>
/**
 * 遮罩层样式
 * 固定定位覆盖整个视口，半透明黑色背景
 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001; /* 高于 ReminderPopup 的 10000 */
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

/**
 * 更新对话框主体样式
 * 使用 Fluent Design 设计语言
 */
.update-dialog {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

/**
 * 对话框头部样式
 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* 版本号样式 */
.version {
  color: var(--accent-color);
  font-weight: 700;
  margin-left: var(--space-xs);
}

/* 关闭按钮样式 */
.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 24px;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.close-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/**
 * 对话框内容区域样式
 */
.dialog-body {
  padding: var(--space-lg);
  overflow-y: auto;
  flex: 1;
  min-height: 120px;
  max-height: 400px;
}

/* 更新日志内容样式 */
.update-log {
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 14px;
}

.update-log :deep(h1),
.update-log :deep(h2),
.update-log :deep(h3),
.update-log :deep(h4) {
  margin-top: 0;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}

.update-log :deep(ul),
.update-log :deep(ol) {
  margin: var(--space-sm) 0;
  padding-left: var(--space-lg);
}

.update-log :deep(li) {
  margin-bottom: var(--space-xs);
}

.update-log :deep(p) {
  margin: var(--space-sm) 0;
}

.update-log :deep(a) {
  color: var(--accent-color);
  text-decoration: none;
}

.update-log :deep(a:hover) {
  text-decoration: underline;
}

/* 空日志提示样式 */
.empty-log {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  padding: var(--space-xl) 0;
}

/**
 * 对话框底部按钮区域样式
 */
.dialog-footer {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  justify-content: flex-end;
}

/* 主操作按钮（现在升级）样式 */
.btn-accent {
  padding: 10px 20px;
  background: var(--accent-color);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 100px;
}

.btn-accent:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-accent:active:not(:disabled) {
  background: var(--accent-active);
  transform: scale(0.98);
}

.btn-accent:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 次要操作按钮（稍后、不再提示）样式 */
.btn-secondary {
  padding: 10px 20px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 80px;
}

.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--accent-color);
}

.btn-secondary:active:not(:disabled) {
  background: var(--bg-active);
  transform: scale(0.98);
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/**
 * 对话框显示/隐藏过渡动画
 */
.dialog-enter-active {
  transition: opacity var(--transition-normal);
}

.dialog-leave-active {
  transition: opacity var(--transition-fast);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .update-dialog {
  animation: dialog-scale-in var(--transition-normal) ease-out;
}

.dialog-leave-active .update-dialog {
  animation: dialog-scale-out var(--transition-fast) ease-in;
}

@keyframes dialog-scale-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dialog-scale-out {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
}

/**
 * 响应式适配
 */
@media (max-width: 480px) {
  .update-dialog {
    width: 95%;
    max-height: 90vh;
  }

  .dialog-footer {
    flex-wrap: wrap;
  }

  .btn-accent,
  .btn-secondary {
    flex: 1;
    min-width: unset;
  }
}
</style>
