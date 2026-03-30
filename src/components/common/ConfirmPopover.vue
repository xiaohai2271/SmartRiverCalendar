<script setup lang="ts">
/**
 * ConfirmPopover - 确认气泡组件
 * 用于删除等危险操作的二次确认
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

// Props 定义
const props = withDefaults(
  defineProps<{
    /** 控制气泡显示/隐藏 */
    visible: boolean
    /** 确认提示文案 */
    title?: string
    /** 确认按钮文本 */
    confirmText?: string
    /** 取消按钮文本 */
    cancelText?: string
    /** 触发元素（用于定位） */
    target?: HTMLElement | null
  }>(),
  {
    title: '确定要删除吗？',
    confirmText: '确认',
    cancelText: '取消',
    target: null
  }
)

// 事件定义
const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
  (e: 'update:visible', value: boolean): void
}>()

// 气泡位置
const popoverStyle = ref<Record<string, string>>({})
const popoverRef = ref<HTMLElement | null>(null)

/**
 * 计算气泡位置
 */
const calculatePosition = () => {
  if (!props.target || !popoverRef.value) return

  const targetRect = props.target.getBoundingClientRect()
  const popoverRect = popoverRef.value.getBoundingClientRect()
  const gap = 8 // 气泡与触发元素的间距

  let top = targetRect.bottom + gap
  let left = targetRect.left

  // 确保气泡不超出视口右侧
  if (left + popoverRect.width > window.innerWidth - 16) {
    left = window.innerWidth - popoverRect.width - 16
  }

  // 确保气泡不超出视口左侧
  if (left < 16) {
    left = 16
  }

  // 如果下方空间不足，尝试显示在上方
  if (top + popoverRect.height > window.innerHeight - 16) {
    top = targetRect.top - popoverRect.height - gap
  }

  // 确保不超出顶部
  if (top < 16) {
    top = 16
  }

  popoverStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: '9999'
  }
}

/**
 * 处理确认点击
 */
const handleConfirm = () => {
  emit('confirm')
  emit('update:visible', false)
}

/**
 * 处理取消点击
 */
const handleCancel = () => {
  emit('cancel')
  emit('update:visible', false)
}

/**
 * 处理点击外部关闭
 */
const handleClickOutside = (event: MouseEvent) => {
  if (!props.visible) return

  const target = event.target as HTMLElement

  // 点击的不是气泡内部，也不是触发元素
  if (
    popoverRef.value &&
    !popoverRef.value.contains(target) &&
    props.target &&
    !props.target.contains(target)
  ) {
    emit('cancel')
    emit('update:visible', false)
  }
}

// 监听 visible 变化，重新计算位置
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick()
      calculatePosition()
    }
  }
)

// 监听 target 变化，重新计算位置
watch(
  () => props.target,
  async () => {
    if (props.visible) {
      await nextTick()
      calculatePosition()
    }
  }
)

// 添加全局点击事件监听
onMounted(() => {
  document.addEventListener('click', handleClickOutside, true)
})

// 移除全局点击事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      class="confirm-popover"
      :style="popoverStyle"
      @click.stop
    >
      <!-- 提示文案 -->
      <div class="confirm-popover__title">
        {{ title }}
      </div>

      <!-- 按钮组 -->
      <div class="confirm-popover__actions">
        <button
          class="confirm-popover__btn confirm-popover__btn--cancel"
          @click="handleCancel"
        >
          {{ cancelText }}
        </button>
        <button
          class="confirm-popover__btn confirm-popover__btn--confirm"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-popover {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--space-md);
  min-width: 180px;
  max-width: 280px;
  animation: popoverFadeIn var(--transition-normal) ease-out;
}

.confirm-popover__title {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: var(--space-md);
}

.confirm-popover__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.confirm-popover__btn {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}

/* 取消按钮 - 默认样式 */
.confirm-popover__btn--cancel {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.confirm-popover__btn--cancel:hover {
  background: var(--bg-hover);
}

.confirm-popover__btn--cancel:active {
  background: var(--bg-active);
}

/* 确认按钮 - 危险色（红色） */
.confirm-popover__btn--confirm {
  background: #d13438;
  border-color: #d13438;
  color: white;
}

.confirm-popover__btn--confirm:hover {
  background: #a92b2e;
}

.confirm-popover__btn--confirm:active {
  background: #8e2426;
}

/* 深色模式下的危险色调整 */
@media (prefers-color-scheme: dark) {
  :root:not(.light) .confirm-popover__btn--confirm {
    background: #ff6b6b;
    border-color: #ff6b6b;
    color: #1a1a1a;
  }

  :root:not(.light) .confirm-popover__btn--confirm:hover {
    background: #ff5252;
  }

  :root:not(.light) .confirm-popover__btn--confirm:active {
    background: #ff3939;
  }
}

:root.dark .confirm-popover__btn--confirm {
  background: #ff6b6b;
  border-color: #ff6b6b;
  color: #1a1a1a;
}

:root.dark .confirm-popover__btn--confirm:hover {
  background: #ff5252;
}

:root.dark .confirm-popover__btn--confirm:active {
  background: #ff3939;
}

/* 弹出动画 */
@keyframes popoverFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
