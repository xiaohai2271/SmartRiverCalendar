<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    message: string
    confirmText?: string
    cancelText?: string
    targetRect: DOMRect | null
  }>(),
  {
    confirmText: '确认',
    cancelText: '取消'
  }
)

const emit = defineEmits<{
  confirm: []
  cancel: []
  'update:visible': [value: boolean]
}>()

const popoverRef = ref<HTMLElement | null>(null)

// 计算气泡位置：紧贴目标元素下方
const popoverStyle = computed(() => {
  if (!props.targetRect) return {}

  const rect = props.targetRect
  const popoverMinWidth = 200
  const padding = 8

  // 兼容 DOMRect 和普通对象
  const rectLeft = rect.left ?? rect.x
  const rectTop = rect.top ?? rect.y
  const rectBottom = rect.bottom ?? (rect.y + rect.height)

  // 默认放在目标元素下方
  let left = rectLeft
  let top = rectBottom + padding

  // 确保不超出右侧边界
  if (left + popoverMinWidth + padding > window.innerWidth) {
    left = window.innerWidth - popoverMinWidth - padding
  }

  // 确保不超出底部边界：如果下方放不下，放到上方
  if (top + 120 + padding > window.innerHeight) {
    top = rectTop - 120 - padding
  }

  // 确保不超出左侧边界
  left = Math.max(padding, left)
  top = Math.max(padding, top)

  return {
    position: 'fixed' as const,
    left: `${left}px`,
    top: `${top}px`
  }
})

// 确认操作
function handleConfirm() {
  emit('confirm')
  emit('update:visible', false)
}

// 取消操作
function handleCancel() {
  emit('cancel')
  emit('update:visible', false)
}

// ESC 键处理
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    handleCancel()
  }
}

// 点击外部关闭（capture 阶段，与 PopupContextMenu 模式一致）
function handleClickOutside(e: MouseEvent) {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    handleCancel()
  }
}

// 监听可见性，注册/移除事件
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        popoverRef.value?.focus()
      })
      document.addEventListener('click', handleClickOutside, true)
    } else {
      document.removeEventListener('click', handleClickOutside, true)
    }
  },
  { immediate: true }
)

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-popover">
      <div
        v-if="visible && targetRect"
        ref="popoverRef"
        class="confirm-popover"
        :style="popoverStyle"
        tabindex="-1"
        @keydown="handleKeydown"
        @click.stop
      >
        <div class="confirm-popover-message">{{ message }}</div>
        <div class="confirm-popover-buttons">
          <button
            class="confirm-popover-btn confirm-popover-btn-cancel"
            @click="handleCancel"
          >
            {{ cancelText }}
          </button>
          <button
            class="confirm-popover-btn confirm-popover-btn-confirm"
            @click="handleConfirm"
          >
            {{ confirmText }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-popover {
  position: fixed;
  z-index: 1001;
  min-width: 200px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  padding: 12px 16px;
  outline: none;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.confirm-popover-message {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.confirm-popover-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.confirm-popover-btn {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  border: none;
  transition: all var(--transition-fast);
}

.confirm-popover-btn-confirm {
  background: var(--accent-color);
  color: white;
}

.confirm-popover-btn-confirm:hover {
  opacity: 0.9;
}

.confirm-popover-btn-cancel {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.confirm-popover-btn-cancel:hover {
  opacity: 0.8;
}

/* 过渡动画 */
.confirm-popover-enter-active,
.confirm-popover-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.confirm-popover-enter-from,
.confirm-popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
