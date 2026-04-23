<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        ref="menuRef"
        class="popup-context-menu"
        :style="menuStyle"
        tabindex="0"
        @keydown="handleKeydown"
        @click.stop
      >
        <div class="menu-item" :class="{ disabled: false }" @click="handleAction('createEvent')">
          <span class="menu-icon">📅</span>
          <span class="menu-text">创建日程</span>
        </div>
        <div
          class="menu-item"
          :class="{ hint: !hasEvents }"
          @click="handleAction('viewEvents')"
        >
          <span class="menu-icon">📋</span>
          <span class="menu-text">查看当日日程</span>
          <span v-if="!hasEvents" class="menu-hint">暂无日程</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" :class="{ hint: false }" @click="handleAction('createTodo')">
          <span class="menu-icon">✏️</span>
          <span class="menu-text">创建待办</span>
        </div>
        <div
          class="menu-item"
          :class="{ hint: !hasTodos }"
          @click="handleAction('viewTodos')"
        >
          <span class="menu-icon">📝</span>
          <span class="menu-text">查看待办</span>
          <span v-if="!hasTodos" class="menu-hint">暂无待办</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleAction('openMain')">
          <span class="menu-icon">🏠</span>
          <span class="menu-text">在主界面打开</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import type { PopupNavigationPayload, PopupContextMenuAction } from '@/types'

const props = defineProps<{
  visible: boolean
  position: { x: number; y: number }
  date: string
  hasEvents: boolean
  hasTodos: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  action: [payload: PopupNavigationPayload]
}>()

const menuRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(0)

// 菜单项配置
const menuItems = [
  { action: 'createEvent' as const, alwaysEnabled: true },
  { action: 'viewEvents' as const, alwaysEnabled: false },
  { action: 'createTodo' as const, alwaysEnabled: true },
  { action: 'viewTodos' as const, alwaysEnabled: false },
  { action: 'openMain' as const, alwaysEnabled: true },
]

// 计算菜单位置，确保不超出视口
const menuStyle = computed(() => {
  const menuWidth = 200
  const menuHeight = 280
  const padding = 8

  let x = props.position.x
  let y = props.position.y

  // 确保菜单不超出右侧边界
  if (x + menuWidth + padding > window.innerWidth) {
    x = window.innerWidth - menuWidth - padding
  }

  // 确保菜单不超出底部边界
  if (y + menuHeight + padding > window.innerHeight) {
    y = window.innerHeight - menuHeight - padding
  }

  // 确保菜单不超出左侧和顶部边界
  x = Math.max(padding, x)
  y = Math.max(padding, y)

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

// 处理菜单项点击
function handleAction(action: PopupContextMenuAction) {
  const payload: PopupNavigationPayload = {
    action,
    date: props.date,
  }
  emit('action', payload)
  closeMenu()
}

// 关闭菜单
function closeMenu() {
  emit('update:visible', false)
}

// 键盘导航
function handleKeydown(e: KeyboardEvent) {
  const enabledItems = getEnabledItems()
  if (enabledItems.length === 0) return

  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault()
      navigateMenu(-1, enabledItems)
      break
    case 'ArrowDown':
      e.preventDefault()
      navigateMenu(1, enabledItems)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      executeFocusedItem(enabledItems)
      break
    case 'Escape':
      e.preventDefault()
      closeMenu()
      break
  }
}

// 获取可用的菜单项索引
function getEnabledItems(): number[] {
  return menuItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (item.alwaysEnabled) return true
      if (item.action === 'viewEvents') return props.hasEvents
      if (item.action === 'viewTodos') return props.hasTodos
      return true
    })
    .map(({ index }) => index)
}

// 导航菜单
function navigateMenu(direction: number, enabledItems: number[]) {
  const currentIndex = enabledItems.indexOf(focusedIndex.value)
  let newIndex = currentIndex + direction

  if (newIndex < 0) {
    newIndex = enabledItems.length - 1
  } else if (newIndex >= enabledItems.length) {
    newIndex = 0
  }

  focusedIndex.value = enabledItems[newIndex]
  updateFocus()
}

// 执行聚焦的菜单项
function executeFocusedItem(enabledItems: number[]) {
  if (enabledItems.includes(focusedIndex.value)) {
    const action = menuItems[focusedIndex.value].action
    handleAction(action)
  }
}

// 更新焦点样式
function updateFocus() {
  if (!menuRef.value) return
  const items = menuRef.value.querySelectorAll('.menu-item')
  items.forEach((item, index) => {
    if (index === focusedIndex.value) {
      item.classList.add('focused')
    } else {
      item.classList.remove('focused')
    }
  })
}

// 点击外部关闭菜单
function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    closeMenu()
  }
}

// 监听可见性变化，自动聚焦
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      focusedIndex.value = 0
      nextTick(() => {
        menuRef.value?.focus()
        updateFocus()
      })
      document.addEventListener('click', handleClickOutside, true)
    } else {
      document.removeEventListener('click', handleClickOutside, true)
    }
  }
)

// 组件卸载时清理事件监听
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true)
})
</script>

<style scoped>
.popup-context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 260px;
  background: var(--popup-bg-secondary);
  border: 1px solid var(--popup-border-color);
  border-radius: var(--popup-radius-lg);
  box-shadow: var(--popup-shadow-menu);
  padding: var(--popup-space-xs) 0;
  outline: none;
  user-select: none;
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  transition: all var(--popup-transition-fast);
  position: relative;
}

.menu-item:hover,
.menu-item.focused {
  background: var(--popup-bg-hover);
}

.menu-item:active {
  transform: scale(0.98);
}

.menu-item.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.menu-item.hint {
  opacity: 0.7;
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
  color: var(--popup-text-primary);
  font-weight: 400;
}

.menu-hint {
  font-size: 11px;
  color: var(--popup-text-tertiary);
  margin-left: 8px;
  font-style: italic;
}

.menu-divider {
  height: 1px;
  background: var(--popup-border-color);
  margin: var(--popup-space-xs) var(--popup-space-sm);
}

/* 过渡动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: all var(--popup-transition-fast);
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* 深色模式适配 */
:global(.dark) .popup-context-menu {
  box-shadow: var(--popup-shadow-menu);
}
</style>
