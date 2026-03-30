<template>
  <!-- 使用 teleport 将菜单渲染到 body -->
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="visible"
        class="context-menu-overlay"
        @click="handleOverlayClick"
        @contextmenu.prevent
      >
        <div
          class="context-menu fluent-card"
          :style="menuStyle"
          @click.stop
        >
          <div
            v-for="(item, index) in items"
            :key="index"
            :class="['menu-item', { divider: item.divider }]"
            @click="handleItemClick(item)"
          >
            <!-- 分隔线 -->
            <template v-if="item.divider">
              <div class="divider-line"></div>
            </template>
            <!-- 菜单项 -->
            <template v-else>
              <span v-if="item.icon" class="menu-icon">{{ item.icon }}</span>
              <span class="menu-label">{{ item.label }}</span>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'

/**
 * 菜单项接口定义
 * - 普通菜单项：必须包含 label，可选 icon 和 action
 * - 分隔线：只需设置 divider: true
 */
export interface MenuItem {
  label?: string      // 菜单项文本（分隔线时可选）
  icon?: string       // 可选图标（emoji 或图标类名）
  action?: () => void // 点击回调函数
  divider?: boolean   // 是否是分隔线
}

// Props 定义
const props = defineProps<{
  visible: boolean                          // 控制菜单显示/隐藏
  position: { x: number; y: number }        // 菜单显示位置（鼠标位置）
  items: MenuItem[]                         // 菜单项配置数组
}>()

// Emits 定义
const emit = defineEmits<{
  'update:visible': [value: boolean]        // 更新 visible 状态
  close: []                                  // 关闭菜单事件
}>()

/**
 * 计算菜单位置样式
 * 自动处理边界情况，确保菜单不超出视口
 */
const menuStyle = computed(() => {
  const { x, y } = props.position
  
  // 默认菜单宽度和偏移量
  const menuWidth = 180
  const offsetX = 4
  const offsetY = 4
  
  // 计算菜单位置，确保不超出视口
  let left = x + offsetX
  let top = y + offsetY
  
  // 获取视口尺寸
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  
  // 如果右侧空间不足，向左显示
  if (left + menuWidth > viewportWidth - 16) {
    left = x - menuWidth - offsetX
  }
  
  // 如果下方空间不足，向上显示（需要预估菜单高度）
  const estimatedMenuHeight = props.items.length * 36 + 16
  if (top + estimatedMenuHeight > viewportHeight - 16) {
    top = viewportHeight - estimatedMenuHeight - 16
  }
  
  // 确保最小边界
  left = Math.max(16, left)
  top = Math.max(16, top)
  
  return {
    left: `${left}px`,
    top: `${top}px`,
    minWidth: `${menuWidth}px`
  }
})

/**
 * 处理菜单项点击
 * 执行回调并关闭菜单
 */
function handleItemClick(item: MenuItem) {
  if (item.divider) return
  
  if (item.action) {
    item.action()
  }
  
  closeMenu()
}

/**
 * 处理遮罩层点击
 * 关闭菜单
 */
function handleOverlayClick() {
  closeMenu()
}

/**
 * 关闭菜单
 */
function closeMenu() {
  emit('update:visible', false)
  emit('close')
}

/**
 * 处理 Escape 键关闭菜单
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    closeMenu()
  }
}

// ============================================================
// 全局 overflow 管理器（引用计数）
// 解决多个页面独立使用 ContextMenu 组件时的 overflow 状态混乱问题
// ============================================================

// 全局锁计数器
let overflowLockCount = 0
// 保存原始 overflow 值
let savedOverflow = ''

/**
 * 锁定页面滚动（增加引用计数）
 * 只有第一个调用者会真正设置 overflow: hidden
 */
function lockOverflow() {
  if (overflowLockCount === 0) {
    savedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  overflowLockCount++
}

/**
 * 解锁页面滚动（减少引用计数）
 * 只有最后一个调用者才会真正恢复 overflow
 */
function unlockOverflow() {
  overflowLockCount--
  if (overflowLockCount <= 0) {
    overflowLockCount = 0
    document.body.style.overflow = savedOverflow
  }
}

// 监听键盘事件
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  // 组件卸载时，如果菜单是打开状态，确保解锁
  // 防止因组件销毁导致 overflow: hidden 未被清除
  if (props.visible) {
    unlockOverflow()
  }
})

// 监听 visible 变化，使用引用计数管理 overflow
watch(() => props.visible, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // 从关闭变为打开：锁定
    lockOverflow()
  } else if (!newVal && oldVal) {
    // 从打开变为关闭：解锁
    unlockOverflow()
  }
}, { immediate: true })
</script>

<style scoped>
/* 遮罩层 - 透明覆盖整个屏幕 */
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  /* 透明背景，用于捕获点击事件 */
}

/* 右键菜单容器 */
.context-menu {
  position: fixed;
  padding: 6px 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  max-width: 280px;
  z-index: 2001;
  animation: contextMenuIn var(--transition-fast) ease-out;
}

/* 菜单项 */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  user-select: none;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item:active {
  background: var(--bg-active);
}

/* 菜单项图标 */
.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  font-size: 14px;
  flex-shrink: 0;
}

/* 菜单项文本 */
.menu-label {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 分隔线样式 */
.menu-item.divider {
  padding: 4px 0;
  cursor: default;
}

.menu-item.divider:hover {
  background: transparent;
}

.divider-line {
  height: 1px;
  background: var(--border-color);
  margin: 0 12px;
}

/* 菜单进入动画 */
@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 过渡动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity var(--transition-fast);
}

.context-menu-enter-active .context-menu,
.context-menu-leave-active .context-menu {
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
}

.context-menu-enter-from .context-menu {
  transform: scale(0.95);
}

.context-menu-leave-to .context-menu {
  transform: scale(0.95);
}

/* Fluent Card 样式覆盖 */
.fluent-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
</style>
