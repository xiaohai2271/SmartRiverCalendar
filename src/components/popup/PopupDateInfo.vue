<template>
  <div class="popup-date-info" :class="{ 'popup-date-info--compact': isCompact }">
    <!-- 第一行：日期 + 星期 + 实时时间 -->
    <div class="date-section">
      <span class="realtime-clock">{{ formattedTime }}</span>
    </div>

    <!-- 第二行：农历月份 + 农历日期 + 节气 + 农历节日 + 节假日徽标 + 补休徽标（全部内联） -->
    <div v-if="popupSettings.settings.popupShowLunar" class="lunar-section">
      <span class="current-date">{{ formattedDate }}</span>
      <span class="weekday">{{ weekdayName }}</span>
      <span class="lunar-badge lunar-date">{{ lunarInfo.lunarMonth }}{{ lunarInfo.lunarDay }}</span>
      <span v-if="popupSettings.settings.popupShowSolarTerm && lunarInfo.solarTerm" class="lunar-badge solar-term">
        {{ lunarInfo.solarTerm }}
      </span>
      <span v-if="popupSettings.settings.popupShowLunarFestival && lunarInfo.lunarFestival" class="lunar-badge lunar-festival">
        {{ lunarInfo.lunarFestival }}
      </span>
      <span v-if="popupSettings.settings.popupShowHoliday && lunarInfo.holidayName && !lunarInfo.isWorkDay" class="lunar-badge holiday-badge">
        {{ lunarInfo.holidayName }}
      </span>
      <span v-if="popupSettings.settings.popupShowHoliday && lunarInfo.isWorkDay && lunarInfo.workDayName" class="lunar-badge workday-badge">
        补休（{{ lunarInfo.workDayName }}）
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePopupSettingsStore } from '@/stores/popupSettings'
import { getLunarInfo, type LunarInfo } from '@/utils/lunar'
import type { PopupWindowSize } from '@/types'

const props = defineProps<{
  date: Date
  size?: PopupWindowSize
}>()

const popupSettings = usePopupSettingsStore()

// 是否为紧凑模式
const isCompact = computed(() => props.size === 'small')
const isDefault = computed(() => props.size === 'medium')

// 实时时间（每秒更新）
const currentTime = ref(new Date())
let timeInterval: ReturnType<typeof setInterval> | null = null

// 格式化实时时间 HH:MM:SS
const formattedTime = computed(() => {
  const hours = String(currentTime.value.getHours()).padStart(2, '0')
  const minutes = String(currentTime.value.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.value.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
})

// 格式化日期：紧凑模式省去年份
const formattedDate = computed(() => {
  if (isCompact.value || isDefault.value) {
    const month = props.date.getMonth() + 1
    const day = props.date.getDate()
    return `${month}月${day}日`
  }
  const year = props.date.getFullYear()
  const month = props.date.getMonth() + 1
  const day = props.date.getDate()
  return `${year}年${month}月${day}日`
})

// 星期名称：紧凑模式用短格式
const weekdayName = computed(() => {
  if (isCompact.value) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return weekdays[props.date.getDay()]
  }
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[props.date.getDay()]
})

// 农历信息
const lunarInfo = computed<LunarInfo>(() => {
  return getLunarInfo(props.date)
})

// 启动时间更新
function startTimer(): void {
  timeInterval = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
}

// 停止时间更新
function stopTimer(): void {
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }
}

onMounted(() => {
  startTimer()
})

onUnmounted(() => {
  stopTimer()
})
</script>

<style scoped>
.popup-date-info {
  display: flex;
  flex-direction: column;
  gap: var(--popup-space-sm);
  padding: var(--popup-space-md);
  background: var(--popup-bg-secondary);
  border-radius: var(--popup-radius-lg);
  border: 1px solid var(--popup-border-color);
  box-shadow: var(--popup-shadow-sm);
}

/* ===== 紧凑模式（small）整体缩减 ===== */
.popup-date-info--compact {
  gap: 4px;
  padding: 8px 10px;
}

/* ===== 第一行：实时时间 ===== */
.date-section {
  display: flex;
  align-items: flex-end;
}

.realtime-clock {
  margin: 0;
  font-size: 30px;
  font-weight: 600;
  color: var(--popup-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

/* ===== 第二行：日期 + 星期 + 农历 + 节气 + 节假日 + 补休（单行，不换行） ===== */
.lunar-section {
  display: flex;
  align-items: center;
  gap: var(--popup-space-sm);
  flex-wrap: nowrap;
  overflow: hidden;
  min-height: 22px;
}

.popup-date-info--compact .lunar-section {
  gap: 4px;
  min-height: 18px;
}

/* 统一的徽标基础样式 */
.lunar-badge,
.current-date,
.weekday {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--popup-radius-md);
  transition: all var(--popup-transition-fast);
  white-space: nowrap;
}

.popup-date-info--compact .lunar-badge,
.popup-date-info--compact .current-date,
.popup-date-info--compact .weekday {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: var(--popup-radius-sm);
  line-height: 1.4;
}

/* 日期徽标 - 暖橙色，区别于星期徽标 */
.current-date {
  color: #c2410c;
  background: rgba(194, 65, 12, 0.1);
  border-radius: var(--popup-radius-full);
}

.popup-date-info--compact .current-date {
  font-size: 14px;
  text-align: end;
}

/* 深色模式 */
:global(.dark) .current-date {
  color: #fb923c;
  background: rgba(251, 146, 60, 0.15);
}

/* 星期徽标 */
.weekday {
  color: var(--popup-accent-color);
  background: var(--popup-accent-light);
  border-radius: var(--popup-radius-full);
}

.popup-date-info--compact .weekday {
  font-size: 12px;
  padding: 2px 8px;
}

/* 农历日期徽标 */
.lunar-date {
  color: var(--popup-text-secondary);
  background: var(--popup-bg-hover);
}

/* 节气徽标 */
.solar-term {
  color: var(--popup-solar-term-text);
  background: var(--popup-solar-term-bg);
}

/* 农历节日徽标 */
.lunar-festival {
  color: var(--popup-text-secondary);
  background: var(--popup-bg-hover);
}

/* 节假日徽标 */
.holiday-badge {
  color: var(--popup-holiday-text);
  background: var(--popup-holiday-bg);
  border: 1px solid var(--popup-holiday-border);
  font-weight: 600;
}

/* 补休徽标 */
.workday-badge {
  color: var(--popup-workday-text);
  background: var(--popup-workday-bg);
  border: 1px solid var(--popup-workday-border);
  font-weight: 600;
}
</style>
