<template>
  <div class="time-display">
    <!-- 时间区域 - 首页主视觉 Hero 焦点 -->
    <div class="time-section">
      <div class="current-time">{{ formattedTime }}</div>
    </div>

    <!-- 日期区域 -->
    <div class="date-section">
      <div class="current-date">{{ formattedDate }}</div>
      <div class="weekday">{{ weekdayName }}</div>
    </div>

    <!-- 农历、节气、节假日、补休徽标（当日核心高可读性排列） -->
    <div class="lunar-section">
      <span class="lunar-badge lunar-date">
        <svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
        {{ lunarInfo.lunarMonth }}{{ lunarInfo.lunarDay }}
      </span>
      
      <span v-if="lunarInfo.solarTerm" class="lunar-badge solar-term">
        <svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2"/>
          <path d="M12 20v2"/>
          <path d="m4.93 4.93 1.41 1.41"/>
          <path d="m17.66 17.66 1.41 1.41"/>
          <path d="M2 12h2"/>
          <path d="M20 12h2"/>
          <path d="m6.34 17.66-1.41 1.41"/>
          <path d="m19.07 4.93-1.41 1.41"/>
        </svg>
        {{ lunarInfo.solarTerm }}
      </span>
      
      <span v-if="lunarInfo.lunarFestival" class="lunar-badge lunar-festival">
        <svg class="badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        {{ lunarInfo.lunarFestival }}
      </span>
      
      <span v-if="lunarInfo.holidayName && !lunarInfo.isWorkDay" class="lunar-badge holiday-badge">
        <span class="holiday-icon">🎉</span>
        {{ lunarInfo.holidayName }}
      </span>
      
      <span v-if="lunarInfo.isWorkDay && lunarInfo.workDayName" class="lunar-badge workday-badge">
        <span class="workday-icon">⚠️</span>
        补班/补休（{{ lunarInfo.workDayName }}）
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { getLunarInfo, type LunarInfo } from '@/utils/lunar'

// 当前时间（响应式）
const currentTime = ref(new Date())

// 时间更新定时器
let timeInterval: ReturnType<typeof setInterval> | null = null

// 格式化时间 HH:MM:SS
const formattedTime = computed(() => {
  const hours = String(currentTime.value.getHours()).padStart(2, '0')
  const minutes = String(currentTime.value.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.value.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
})

// 格式化日期 YYYY年MM月DD日
const formattedDate = computed(() => {
  const year = currentTime.value.getFullYear()
  const month = currentTime.value.getMonth() + 1
  const day = currentTime.value.getDate()
  return `${year}年${month}月${day}日`
})

// 星期名称
const weekdayName = computed(() => {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[currentTime.value.getDay()]
})

// 农历信息
const lunarInfo = computed<LunarInfo>(() => {
  return getLunarInfo(currentTime.value)
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
.time-display {
  background: var(--bg-secondary);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  padding: 32px 24px;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
  text-align: center;
  position: relative;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
}

/* 极淡的流沙旋转极光微光背景层 */
.time-display::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(0, 120, 212, 0.035) 0%,
    rgba(142, 68, 173, 0.02) 40%,
    transparent 75%
  );
  pointer-events: none;
  animation: auroraRotate 24s linear infinite;
  z-index: 0;
}

@keyframes auroraRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 保证内容在上层渲染 */
.time-section,
.date-section,
.lunar-section {
  position: relative;
  z-index: 1;
}

/* 时间区域 - 首页主视觉焦点 */
.time-section {
  margin-bottom: 12px;
}

.current-time {
  font-size: 72px;
  font-weight: 700;
  font-family: 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif;
  letter-spacing: -1px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.0;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

/* 日期区域 */
.date-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.current-date {
  font-size: 17px;
  color: var(--text-secondary);
  font-weight: 600;
}

.weekday {
  font-size: 13.5px;
  color: var(--accent-color);
  padding: 4px 12px;
  background: var(--accent-light);
  border: 1px solid rgba(0, 120, 212, 0.15);
  border-radius: 12px;
  font-weight: 600;
}

/* 农历、节假日徽标区域 */
.lunar-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 统一徽标基础样式 */
.lunar-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 8px;
  white-space: nowrap;
  border: 1px solid transparent;
  transition: all var(--transition-fast);
}

.badge-icon {
  opacity: 0.75;
  color: inherit;
}

/* 农历日期徽标 */
.lunar-badge.lunar-date {
  color: var(--text-secondary);
  background: var(--bg-hover);
  border-color: var(--border-light);
}

/* 节气徽标 */
.lunar-badge.solar-term {
  color: var(--accent-color);
  background: var(--accent-light);
  border-color: rgba(0, 120, 212, 0.15);
}

/* 农历节日徽标 */
.lunar-badge.lunar-festival {
  color: #8e44ad;
  background: rgba(142, 68, 173, 0.08);
  border-color: rgba(142, 68, 173, 0.15);
}

/* 法定节假日徽标 */
.lunar-badge.holiday-badge {
  color: #e74c3c;
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.08), rgba(255, 107, 107, 0.08));
  border: 1px solid rgba(231, 76, 60, 0.25);
  box-shadow: 0 2px 8px rgba(231, 76, 60, 0.03);
  animation: holidayGlow 3s ease-in-out infinite alternate;
}

@keyframes holidayGlow {
  0% {
    box-shadow: 0 2px 6px rgba(231, 76, 60, 0.03);
    border-color: rgba(231, 76, 60, 0.2);
  }
  100% {
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.1);
    border-color: rgba(231, 76, 60, 0.45);
  }
}

/* 补休补班徽标 */
.lunar-badge.workday-badge {
  color: #d35400;
  background: linear-gradient(135deg, rgba(230, 126, 34, 0.08), rgba(241, 196, 15, 0.08));
  border: 1px solid rgba(230, 126, 34, 0.25);
}

.holiday-icon,
.workday-icon {
  font-size: 11px;
}

/* 响应式 */
@media (max-width: 600px) {
  .time-display {
    padding: 24px 16px;
  }

  .current-time {
    font-size: 48px;
  }

  .date-section {
    flex-direction: column;
    gap: 8px;
  }

  .lunar-section {
    gap: 6px;
  }

  .lunar-badge {
    font-size: 12px;
    padding: 4px 10px;
  }
}

/* 深色模式适配 */
:root.dark .weekday {
  background: rgba(0, 120, 212, 0.2);
}

:root.dark .lunar-badge.solar-term {
  background: rgba(0, 120, 212, 0.2);
}

:root.dark .lunar-badge.lunar-festival {
  background: rgba(142, 68, 173, 0.12);
}

:root.dark .lunar-badge.holiday-badge {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.12), rgba(255, 107, 107, 0.12));
}

:root.dark .lunar-badge.workday-badge {
  background: linear-gradient(135deg, rgba(230, 126, 34, 0.12), rgba(241, 196, 15, 0.12));
}
</style>
