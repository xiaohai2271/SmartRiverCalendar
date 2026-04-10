<template>
  <div class="time-display">
    <!-- 时间区域 -->
    <div class="time-section">
      <div class="current-time">{{ formattedTime }}</div>
    </div>

    <!-- 日期区域 -->
    <div class="date-section">
      <div class="current-date">{{ formattedDate }}</div>
      <div class="weekday">{{ weekdayName }}</div>
    </div>

    <!-- 农历和节气区域 -->
    <div class="lunar-section">
      <span class="lunar-date">{{ lunarInfo.lunarDate }}</span>
      <span v-if="lunarInfo.solarTerm" class="solar-term">{{ lunarInfo.solarTerm }}</span>
    </div>

    <!-- 节假日标签 -->
    <div v-if="lunarInfo.holidayName" class="holiday-tag">
      <span class="holiday-icon">🎉</span>
      {{ lunarInfo.holidayName }}
    </div>

    <!-- 补休班提醒 -->
    <div v-if="lunarInfo.isWorkDay && lunarInfo.workDayName" class="workday-reminder">
      <span class="workday-icon">⚠️</span>
      今日调休上班（{{ lunarInfo.workDayName }}）
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
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);
  text-align: center;
}

/* 时间区域 - 作为主视觉焦点 */
.time-section {
  margin-bottom: 16px;
}

.current-time {
  font-size: 52px;
  font-weight: 600;
  font-family: 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif;
  letter-spacing: 2px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

/* 日期区域 - 紧凑布局 */
.date-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.current-date {
  font-size: 16px;
  color: var(--text-secondary);
  font-weight: 500;
}

.weekday {
  font-size: 14px;
  color: var(--accent-color);
  padding: 4px 12px;
  background: rgba(74, 144, 217, 0.1);
  border-radius: 12px;
  font-weight: 500;
}

/* 农历和节气区域 - 使用标签样式 */
.lunar-section {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.lunar-date {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 4px 10px;
  background: var(--bg-hover);
  border-radius: 8px;
}

.solar-term {
  font-size: 13px;
  color: var(--accent-color);
  padding: 4px 10px;
  background: rgba(74, 144, 217, 0.1);
  border-radius: 8px;
  font-weight: 500;
}

/* 节假日标签 */
.holiday-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.15), rgba(255, 159, 67, 0.15));
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  color: #e74c3c;
}

.holiday-icon {
  font-size: 16px;
}

/* 补休班提醒 */
.workday-reminder {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(241, 196, 15, 0.15), rgba(243, 156, 18, 0.15));
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: #e67e22;
  margin-top: 8px;
}

.workday-icon {
  font-size: 14px;
}

/* 响应式 */
@media (max-width: 600px) {
  .time-display {
    padding: 16px 20px;
  }

  .current-time {
    font-size: 40px;
  }

  .date-section {
    flex-direction: column;
    gap: 8px;
  }

  .lunar-section {
    flex-direction: column;
    gap: 6px;
  }
}

/* 深色模式适配 */
:root.dark .weekday {
  background: rgba(74, 144, 217, 0.2);
}

:root.dark .solar-term {
  background: rgba(74, 144, 217, 0.2);
}

:root.dark .holiday-tag {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 159, 67, 0.2));
}

:root.dark .workday-reminder {
  background: linear-gradient(135deg, rgba(241, 196, 15, 0.2), rgba(243, 156, 18, 0.2));
}
</style>
