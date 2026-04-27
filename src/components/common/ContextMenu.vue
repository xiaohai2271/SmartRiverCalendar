<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        :style="menuStyle"
        @click.stop
      >
        <template v-for="(item, index) in items" :key="index">
          <!-- 分隔线 -->
          <div v-if="item.separator" class="context-menu-divider"></div>
          <!-- 菜单项 -->
          <div
            v-else
            class="context-menu-item"
            :class="{ disabled: item.disabled }"
            @click="handleItemClick(item)"
          >
            <span v-if="item.icon" class="menu-icon">{{ item.icon }}</span>
            <span class="menu-text">{{ item.label }}</span>
          </div>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import type { MenuItem } from '@/types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const menuRef = ref<HTMLElement | null>(null)

// 引用计数器管理 overflow
let overflowLockCount = 0

/** 锁定 body overflow */
function lockOverflow() {
  overflowLockCount++
  if (overflowLockCount === 1) {
    document.body.style.overflow = 'hidden'
  }
}

/** 解锁 body overflow */
function unlockOverflow() {
  overflowLockCount--
  if (overflowLockCount <= 0) {
    overflowLockCount = 0
    document.body.style.overflow = ''
  }
}

// 计算菜单位置，智能溢出调整
const menuStyle = computed(() => {
  const menuWidth = 180
  const menuHeight = 280
  const padding = 8

  let x = props.x
  let y = props.y

  // 右侧溢出：调整为 window.innerWidth - menuWidth
  if (x + menuWidth + padding > window.innerWidth) {
    x = window.innerWidth - menuWidth - padding
  }

  // 底部溢出：调整为 window.innerHeight - menuHeight
  if (y + menuHeight + padding > window.innerHeight) {
    y = window.innerHeight - menuHeight - padding
  }

  // 确保不超出左侧和顶部
  x = Math.max(padding, x)
  y = Math.max(padding, y)

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

// 处理菜单项点击
function handleItemClick(item: MenuItem) {
  if (item.disabled) return
  item.action?.()
  closeMenu()
}

// 关闭菜单
function closeMenu() {
  emit('update:visible', false)
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    closeMenu()
  }
}

// ESC 键关闭菜单
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    closeMenu()
  }
}

// 监听 visible 变化
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      lockOverflow()
      nextTick(() => {
        document.addEventListener('click', handleClickOutside, true)
        document.addEventListener('keydown', handleKeydown, true)
      })
    } else {
      document.removeEventListener('click', handleClickOutside, true)
      document.removeEventListener('keydown', handleKeydown, true)
      unlockOverflow()
    }
  },
  { immediate: true }
)

// 组件卸载时清理所有监听和 overflow
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
  document.removeEventListener('keydown', handleKeydown, true)
  if (overflowLockCount > 0) {
    overflowLockCount = 0
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 1000;
  min-width: 160px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 4px 0;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  user-select: none;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.context-menu-item:hover {
  background: var(--bg-hover);
}

.context-menu-item:active {
  transform: scale(0.98);
}

.context-menu-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.menu-icon {
  font-size: 16px;
  margin-right: 12px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 400;
}

.context-menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 8px;
}

/* 过渡动画 - 淡入+缩放 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all 150ms ease-out;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
