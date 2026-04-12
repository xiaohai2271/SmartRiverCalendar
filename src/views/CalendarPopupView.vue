<script setup lang="ts">
/**
 * CalendarPopupView - 弹出窗口日历视图
 * 用于系统托盘点击后显示的简洁日历界面
 * 
 * 三段式布局：日期信息 + 月份导航 + 日历面板
 * 支持右键菜单、事件圆点点击、双击日期创建事件
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCalendarStore } from '@/stores/calendar'
import { usePopupSettingsStore } from '@/stores/popupSettings'
import { emit as tauriEmit } from '@tauri-apps/api/event'
import type { PopupNavigationPayload, CalendarEvent } from '@/types'

// 子组件
import PopupDateInfo from '@/components/popup/PopupDateInfo.vue'
import PopupMonthNav from '@/components/popup/PopupMonthNav.vue'
import PopupCalendarGrid from '@/components/popup/PopupCalendarGrid.vue'
import PopupYearMonthPicker from '@/components/popup/PopupYearMonthPicker.vue'
import PopupContextMenu from '@/components/popup/PopupContextMenu.vue'

// Store 实例
const calendarStore = useCalendarStore()
const popupSettings = usePopupSettingsStore()

// ==================== 状态管理 ====================

// 弹出窗口独立的当前日期状态（不使用 calendarStore.currentDate）
const currentDate = ref(new Date())

// 点击追踪：记录最近一次窗口内点击的时间戳
// 用于判断失焦是否由窗口内点击引起
let lastClickInWindow = 0
const CLICK_COOLDOWN = 500 // 点击后 500ms 内的失焦不隐藏窗口

// 选中的日期
const selectedDate = ref<Date | undefined>(undefined)

// 数据加载状态
const isLoading = ref(false)

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuDate = ref('')

// 年月选择器状态
const yearMonthPickerVisible = ref(false)

// 右键菜单是否打开（用于失焦隐藏控制）
const isContextMenuOpen = ref(false)

// ==================== 计算属性 ====================

// 当前日期是否有事件
const hasEventsOnSelectedDate = computed(() => {
  if (!contextMenuDate.value) return false
  const dateStr = contextMenuDate.value
  return calendarStore.events.some(event => {
    const eventDate = new Date(event.startTime)
    return formatDateToString(eventDate) === dateStr
  })
})

// 当前日期是否有待办
const hasTodosOnSelectedDate = computed(() => {
  if (!contextMenuDate.value) return false
  // 待办功能暂不支持（需要 todoStore 集成）
  return false
})

// ==================== 日期工具函数 ====================

// 格式化日期为字符串 YYYY-MM-DD
function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ==================== 月份导航 ====================

function handlePrevMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  currentDate.value = newDate
}

function handleNextMonth() {
  const newDate = new Date(currentDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  currentDate.value = newDate
}

// 返回今天（预留功能，未来可在月份导航栏添加"今天"按钮）
// @ts-expect-error 预留功能，未来使用
function handleGoToday() {
  currentDate.value = new Date()
  selectedDate.value = new Date()
}

function handleOpenPicker() {
  yearMonthPickerVisible.value = true
}

function handleYearMonthConfirm(year: number, month: number) {
  currentDate.value = new Date(year, month - 1, 1)
  yearMonthPickerVisible.value = false
}

// ==================== 日历面板事件 ====================

function handleSelectDate(date: Date) {
  selectedDate.value = date
}

function handleCreateEvent(date: Date) {
  // 双击日期 - 发送导航事件到主界面创建事件
  const payload: PopupNavigationPayload = {
    action: 'createEvent',
    date: formatDateToString(date)
  }
  navigateToMain(payload)
}

function handleContextMenu(payload: { date: Date; x: number; y: number }) {
  contextMenuDate.value = formatDateToString(payload.date)
  contextMenuPosition.value = { x: payload.x, y: payload.y }
  contextMenuVisible.value = true
}

function handleViewEvent(event: CalendarEvent) {
  // 点击事件圆点 - 发送导航事件到主界面查看事件详情
  const payload: PopupNavigationPayload = {
    action: 'viewEventDetail',
    date: formatDateToString(new Date(event.startTime)),
    eventId: event.id
  }
  navigateToMain(payload)
}

// ==================== 右键菜单事件 ====================

function handleContextMenuAction(payload: PopupNavigationPayload) {
  contextMenuVisible.value = false
  navigateToMain(payload)
}

function handleContextMenuVisibleChange(visible: boolean) {
  contextMenuVisible.value = visible
  isContextMenuOpen.value = visible
}

// ==================== 导航到主界面 ====================

async function navigateToMain(payload: PopupNavigationPayload) {
  try {
    // 发送事件到主窗口
    await tauriEmit('popup-navigate', payload)
    
    // 隐藏弹出窗口
    const window = getCurrentWindow()
    await window.hide()
  } catch (error) {
    console.error('[CalendarPopup] 导航到主界面失败:', error)
  }
}

// ==================== 失焦隐藏控制 ====================

/// 记录最近一次失焦时间，用于判断是否应该隐藏
let lastBlurTime = 0
/// 焦点恢复等待时间（毫秒）
const FOCUS_RECOVERY_WAIT = 300

/**
 * 处理窗口级失焦事件（Tauri 窗口焦点变化）
 * 仅当窗口真正失去焦点时隐藏（如点击了窗口外部）
 * 注意：在 Windows 上点击窗口内部某些元素可能会短暂触发失焦，
 * 所以需要等待一段时间确认窗口没有重新获得焦点
 */
async function handleWindowFocusLost() {
  const now = Date.now()
  lastBlurTime = now

  console.log('[CalendarPopup] handleWindowFocusLost 触发', {
    isContextMenuOpen: isContextMenuOpen.value,
    yearMonthPickerVisible: yearMonthPickerVisible.value,
    timestamp: new Date().toISOString(),
    timeSinceLastClick: now - lastClickInWindow
  })

  // 如果最近有窗口内点击（500ms 内），不隐藏窗口
  // 这是为了处理 Windows 上点击窗口内部元素导致焦点短暂丢失的问题
  if (now - lastClickInWindow < CLICK_COOLDOWN) {
    console.log('[CalendarPopup] 最近有窗口内点击，跳过隐藏')
    // 尝试重新获取焦点
    try {
      const win = getCurrentWindow()
      await win.setFocus()
      console.log('[CalendarPopup] 已重新获取焦点')
    } catch (e) {
      console.error('[CalendarPopup] 重新获取焦点失败:', e)
    }
    return
  }

  // 如果右键菜单打开，不隐藏窗口
  if (isContextMenuOpen.value) {
    console.log('[CalendarPopup] 右键菜单打开，不隐藏窗口')
    return
  }

  // 如果年月选择器打开，不隐藏窗口
  if (yearMonthPickerVisible.value) {
    console.log('[CalendarPopup] 年月选择器打开，不隐藏窗口')
    return
  }

  // 等待一段时间，看窗口是否会重新获得焦点
  // Windows 上点击窗口内部元素可能会短暂触发失焦再获焦
  await new Promise(resolve => setTimeout(resolve, FOCUS_RECOVERY_WAIT))

  // 检查是否在等待期间重新获得了焦点
  const win = getCurrentWindow()
  const isFocused = await win.isFocused()

  console.log('[CalendarPopup] 等待后检查焦点状态', {
    isFocused,
    blurDuration: Date.now() - now
  })

  // 如果已经重新获得焦点，不隐藏
  if (isFocused) {
    console.log('[CalendarPopup] 窗口已重新获得焦点，不隐藏')
    return
  }

  // 如果在等待期间又有新的失焦事件，跳过本次处理
  if (lastBlurTime !== now) {
    console.log('[CalendarPopup] 有新的失焦事件，跳过本次处理')
    return
  }

  // 延迟检查：给子组件（菜单等）关闭事件处理时间
  setTimeout(async () => {
    console.log('[CalendarPopup] 延迟检查开始', {
      isContextMenuOpen: isContextMenuOpen.value,
      yearMonthPickerVisible: yearMonthPickerVisible.value
    })

    if (isContextMenuOpen.value || yearMonthPickerVisible.value) {
      console.log('[CalendarPopup] 延迟检查：菜单/选择器打开，取消隐藏')
      return
    }

    try {
      // 最终确认窗口确实没有焦点
      const focused = await win.isFocused()
      console.log('[CalendarPopup] 延迟检查：窗口焦点状态', { focused })
      if (!focused) {
        console.log('[CalendarPopup] 延迟检查：窗口无焦点，执行隐藏')
        await win.hide()
      } else {
        console.log('[CalendarPopup] 延迟检查：窗口有焦点，不隐藏')
      }
    } catch (error) {
      console.error('[CalendarPopup] 隐藏窗口失败:', error)
    }
  }, 200)
}

// ==================== 键盘事件 ====================

function handleKeydown(e: KeyboardEvent) {
  // 如果年月选择器或右键菜单打开，只处理 Escape
  if (yearMonthPickerVisible.value || contextMenuVisible.value) {
    if (e.key === 'Escape') {
      contextMenuVisible.value = false
      yearMonthPickerVisible.value = false
    }
    return
  }

  switch (e.key) {
    case 'Escape':
      // Escape 键关闭弹出窗口
      getCurrentWindow().hide()
      break
    
    case 'ArrowLeft':
      // 左箭头：选中日期减一天
      e.preventDefault()
      navigateSelectedDate(-1)
      break
    
    case 'ArrowRight':
      // 右箭头：选中日期加一天
      e.preventDefault()
      navigateSelectedDate(1)
      break
    
    case 'ArrowUp':
      // 上箭头：选中日期减一周
      e.preventDefault()
      navigateSelectedDate(-7)
      break
    
    case 'ArrowDown':
      // 下箭头：选中日期加一周
      e.preventDefault()
      navigateSelectedDate(7)
      break
    
    case 'Enter':
      // Enter 键：确认日期选择
      e.preventDefault()
      confirmSelectedDate()
      break
  }
}

// 导航选中日期
function navigateSelectedDate(deltaDays: number) {
  // 如果没有选中日期，默认选中今天
  if (!selectedDate.value) {
    selectedDate.value = new Date()
    return
  }

  // 计算新日期
  const newDate = new Date(selectedDate.value)
  newDate.setDate(newDate.getDate() + deltaDays)
  selectedDate.value = newDate

  // 如果新日期不在当前月份，更新当前月份
  if (newDate.getMonth() !== currentDate.value.getMonth() ||
      newDate.getFullYear() !== currentDate.value.getFullYear()) {
    currentDate.value = new Date(newDate.getFullYear(), newDate.getMonth(), 1)
  }
}

// 确认选中日期
function confirmSelectedDate() {
  if (!selectedDate.value) {
    // 如果没有选中日期，选中今天并确认
    selectedDate.value = new Date()
  }

  // 触发创建事件（与双击日期相同的行为）
  handleCreateEvent(selectedDate.value)
}

// ==================== 数据加载 ====================

async function loadData() {
  // 如果 calendarStore 未初始化，显示加载状态
  if (!calendarStore.isInitialized) {
    isLoading.value = true
    try {
      await calendarStore.initialize()
    } catch (error) {
      console.error('[CalendarPopup] 初始化日历数据失败:', error)
    } finally {
      isLoading.value = false
    }
  } else {
    // 已初始化，后台刷新数据
    isLoading.value = false
    // 可以在这里调用增量刷新方法（如果有的话）
  }
  
  // 重新加载 popupSettings（响应主窗口设置变更）
  popupSettings.loadPopupSettings()
}

// ==================== 生命周期 ====================

/**
 * 处理窗口内点击事件
 * 记录点击时间，用于失焦判断
 */
function handleWindowClick(event: MouseEvent) {
  lastClickInWindow = Date.now()
  console.log('[CalendarPopup] 窗口内点击', {
    timestamp: new Date().toISOString(),
    target: (event.target as HTMLElement)?.tagName
  })
}

onMounted(async () => {
  // 加载数据
  await loadData()

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)

  // 添加点击事件监听（捕获阶段，确保在所有元素之前触发）
  document.addEventListener('click', handleWindowClick, true)

  // 每次显示时重置为当前月（确保信息时效性）
  currentDate.value = new Date()
})

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleWindowClick, true)
})

// 监听窗口焦点变化事件（Tauri 窗口级，比 DOM blur 更可靠）
const currentWindow = getCurrentWindow()
currentWindow.onFocusChanged(({ payload: focused }) => {
  console.log('[CalendarPopup] onFocusChanged 事件触发', {
    focused,
    timestamp: new Date().toISOString(),
    isContextMenuOpen: isContextMenuOpen.value,
    yearMonthPickerVisible: yearMonthPickerVisible.value
  })

  if (focused) {
    // 窗口获得焦点时，重置失焦时间（取消任何待处理的隐藏操作）
    lastBlurTime = 0
    console.log('[CalendarPopup] 窗口获得焦点，重新加载数据，重置失焦时间')
    loadData()
  } else {
    // 窗口失去焦点时，延迟检查是否需要隐藏
    console.log('[CalendarPopup] 窗口失去焦点，调用 handleWindowFocusLost')
    handleWindowFocusLost()
  }
})
</script>

<template>
  <div class="popup-container">
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <span class="loading-text">加载中...</span>
    </div>
    
    <!-- 主内容 -->
    <template v-else>
      <!-- 日期信息区域 -->
      <div class="popup-section date-info-section">
        <PopupDateInfo :date="currentDate" />
      </div>
      
      <!-- 月份导航区域 -->
      <div class="popup-section month-nav-section">
        <PopupMonthNav
          :current-date="currentDate"
          @prev-month="handlePrevMonth"
          @next-month="handleNextMonth"
          @open-picker="handleOpenPicker"
        />
      </div>
      
      <!-- 日历面板区域 -->
      <div class="popup-section calendar-grid-section">
        <PopupCalendarGrid
          :current-date="currentDate"
          :selected-date="selectedDate"
          @select-date="handleSelectDate"
          @create-event="handleCreateEvent"
          @context-menu="handleContextMenu"
          @view-event="handleViewEvent"
        />
      </div>
    </template>
    
    <!-- 年月选择器 -->
    <PopupYearMonthPicker
      v-model="yearMonthPickerVisible"
      :current-date="currentDate"
      @confirm="handleYearMonthConfirm"
    />
    
    <!-- 右键菜单 -->
    <PopupContextMenu
      :visible="contextMenuVisible"
      :position="contextMenuPosition"
      :date="contextMenuDate"
      :has-events="hasEventsOnSelectedDate"
      :has-todos="hasTodosOnSelectedDate"
      @update:visible="handleContextMenuVisibleChange"
      @action="handleContextMenuAction"
    />
  </div>
</template>

<style src="@/styles/popup.scss"></style>

<style scoped>
.popup-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  background: var(--bg-primary);
  overflow: hidden;
  position: relative;
}

.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
}

.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.popup-section {
  flex-shrink: 0;
}

.date-info-section {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
}

.month-nav-section {
  padding: 4px 10px;
  border-bottom: 1px solid var(--border-color, rgba(128, 128, 128, 0.2));
}

.calendar-grid-section {
  flex: 1;
  padding: 6px 10px 8px;
  overflow: hidden;
}
</style>
