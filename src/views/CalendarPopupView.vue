<script setup lang="ts">
/**
 * CalendarPopupView - 弹出窗口日历视图
 * 用于系统托盘点击后显示的简洁日历界面
 * 
 * 三段式布局：日期信息 + 月份导航 + 日历面板
 * 支持右键菜单、事件圆点点击、双击日期创建事件
 * 
 * 注意：窗口显示和隐藏由外部（系统托盘/主窗口）手动控制
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useCalendarStore } from '@/stores/calendar'
import { usePopupSettingsStore } from '@/stores/popupSettings'
import { useSettingsStore } from '@/stores/settings'
import * as settingsService from '@/services/settings'
import { emit as tauriEmit } from '@tauri-apps/api/event'
import { setPopupWindowSize } from '@/composables/useCalendarPopup'
import { onSettingsChange } from '@/utils/broadcast'
import type { PopupNavigationPayload, CalendarEvent, PopupWindowSize } from '@/types'

// 子组件
import PopupDateInfo from '@/components/popup/PopupDateInfo.vue'
import PopupMonthNav from '@/components/popup/PopupMonthNav.vue'
import PopupCalendarGrid from '@/components/popup/PopupCalendarGrid.vue'
import PopupYearMonthPicker from '@/components/popup/PopupYearMonthPicker.vue'
import PopupContextMenu from '@/components/popup/PopupContextMenu.vue'

// Store 实例
const calendarStore = useCalendarStore()
const popupSettings = usePopupSettingsStore()
const settingsStore = useSettingsStore()

// ==================== 状态管理 ====================

// 弹出窗口独立的当前日期状态（不使用 calendarStore.currentDate）
const currentDate = ref(new Date())

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

// 当前窗口尺寸（用于设置 data-size 属性）
const currentSize = ref(popupSettings.settings.popupWindowSize)

// ==================== 计算属性 ====================

// 今天日期（固定显示今天的信息，不受月份导航影响）
const today = computed(() => new Date())

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

// ==================== 尺寸响应 ====================

/**
 * 应用窗口尺寸设置
 * 设置 data-size 属性触发 CSS 变量切换
 * 调用 Tauri API 调整实际窗口大小
 * @param size 可选的尺寸值，如果不提供则从设置中读取
 */
async function applyWindowSize(size?: PopupWindowSize): Promise<void> {
  const targetSize = size || popupSettings.settings.popupWindowSize || 'medium'
  currentSize.value = targetSize

  try {
    await setPopupWindowSize(targetSize)
    // key 属性会自动触发组件重新渲染，无需额外强制重绘
    console.log(`[CalendarPopup] 已应用窗口尺寸: ${targetSize}`)
  } catch (error) {
    console.error('[CalendarPopup] 应用窗口尺寸失败:', error)
  }
}

// 监听 popupWindowSize 设置变更，实时响应
watch(
  () => popupSettings.settings.popupWindowSize,
  async (newSize) => {
    if (newSize !== currentSize.value) {
      console.log(`[CalendarPopup] 窗口尺寸设置变更: ${newSize}`)
      await applyWindowSize()
    }
  }
)

// ==================== 主题同步 ====================

// 应用主题到弹窗根元素
// 优先使用传入的 theme 参数，否则从数据库读取最新主题设置
async function applyPopupTheme(theme?: 'light' | 'dark' | 'auto') {
  let targetTheme: 'light' | 'dark' | 'auto' | undefined = theme
  if (!targetTheme) {
    // 从数据库读取最新的主题设置（不依赖 settingsStore 内存状态）
    try {
      const dbValue = await settingsService.getSetting('app.theme')
      targetTheme = dbValue ? (JSON.parse(dbValue) as 'light' | 'dark' | 'auto') : 'light'
    } catch {
      // 数据库读取失败，使用 settingsStore 作为降级
      targetTheme = settingsStore.settings.theme
    }
  }

  const root = document.documentElement
  root.classList.remove('dark', 'light')

  if (targetTheme === 'dark') {
    root.classList.add('dark')
  } else if (targetTheme === 'light') {
    root.classList.add('light')
  }
  // 'auto' 模式依赖 CSS 媒体查询，不添加额外 class

  // 同步更新 settingsStore（保持内存状态一致）
  if (targetTheme !== settingsStore.settings.theme) {
    settingsStore.settings.theme = targetTheme
  }
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
}

// ==================== 导航到主界面 ====================

async function navigateToMain(payload: PopupNavigationPayload) {
  try {
    // 发送事件到主窗口
    await tauriEmit('popup-navigate', payload)

    // 隐藏弹出窗口
    const window = getCurrentWebviewWindow()
    await window.hide()
  } catch (error) {
    console.error('[CalendarPopup] 导航到主界面失败:', error)
  }
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
      getCurrentWebviewWindow().hide()
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

// 焦点变化监听器清理函数
let unlistenFocus: (() => void) | null = null

// 设置变更监听器清理函数
let unlistenSettings: (() => void) | null = null

onMounted(async () => {
  // 加载数据
  await loadData()

  // 应用初始主题
  await applyPopupTheme()

  // 应用初始窗口尺寸
  await applyWindowSize()

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeydown)

  // 每次显示时重置为当前月（确保信息时效性）
  currentDate.value = new Date()

  // 监听窗口焦点变化事件，用于在获得焦点时刷新数据和应用尺寸
  const win = getCurrentWebviewWindow()
  unlistenFocus = await win.onFocusChanged(async ({ payload: focused }) => {
    if (focused) {
      // 确保窗口正确聚焦
      await win.setFocus()
      // 窗口获得焦点时，重新加载数据和应用尺寸设置
      loadData()
      // 同步最新主题（响应主窗口可能的设置变更）
      await applyPopupTheme()
      // 应用最新尺寸设置（响应主窗口可能的设置变更）
      applyWindowSize()
    }
  })

  // 监听设置变更广播（实时响应主窗口的设置修改）
  unlistenSettings = onSettingsChange((key, value) => {
    console.log(`[CalendarPopup] 收到设置变更广播: ${key} =`, value)
    
    // 处理主题变更
    if (key === 'theme' && typeof value === 'string') {
      applyPopupTheme(value as 'light' | 'dark' | 'auto')
    }

    // 处理窗口尺寸变更
    if (key === 'popupWindowSize' && typeof value === 'string') {
      // 同步更新 store 中的设置，避免后续 loadPopupSettings() 覆盖
      popupSettings.settings.popupWindowSize = value as PopupWindowSize
      // 应用窗口尺寸
      applyWindowSize(value as PopupWindowSize)
    }
  })
})

onUnmounted(() => {
  // 移除事件监听
  window.removeEventListener('keydown', handleKeydown)

  // 清理焦点监听器
  if (unlistenFocus) {
    unlistenFocus()
    unlistenFocus = null
  }

  // 清理设置变更监听器
  if (unlistenSettings) {
    unlistenSettings()
    unlistenSettings = null
  }
})
</script>

<template>
  <div class="popup-container" :class="'popup-container-'+currentSize" :data-size="currentSize">

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <span class="loading-text">加载中...</span>
    </div>
    
    <!-- 主内容 -->
    <template v-else>
      <!-- 日期信息区域 -->
      <div class="popup-section date-info-section">
        <PopupDateInfo :date="today" />
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
          :key="currentSize"
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
  /* padding 由 popup.scss 的 CSS 变量系统控制 */
}

.month-nav-section {
  /* padding 由 popup.scss 的 CSS 变量系统控制 */
}

.calendar-grid-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  /* padding 由 popup.scss 的 CSS 变量系统控制 */
}
</style>
