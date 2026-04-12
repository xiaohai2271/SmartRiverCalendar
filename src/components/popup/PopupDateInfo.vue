<template>
  <div class="popup-date-info">
    <!-- 日期和星期区域 -->
    <div class="date-section">
      <span class="current-date">{{ formattedDate }}</span>
      <span class="weekday">{{ weekdayName }}</span>
    </div>

    <!-- 农历信息区域 -->
    <div v-if="popupSettings.settings.popupShowLunar" class="lunar-section">
      <span class="lunar-date">{{ lunarInfo.lunarDate }}</span>
      <span v-if="popupSettings.settings.popupShowSolarTerm && lunarInfo.solarTerm" class="solar-term">
        {{ lunarInfo.solarTerm }}
      </span>
      <span v-if="popupSettings.settings.popupShowLunarFestival && lunarInfo.lunarFestival" class="lunar-festival">
        {{ lunarInfo.lunarFestival }}
      </span>
    </div>

    <!-- 节假日标签 -->
    <div v-if="popupSettings.settings.popupShowHoliday && lunarInfo.holidayName && !lunarInfo.isWorkDay" class="holiday-tag">
      {{ lunarInfo.holidayName }}
    </div>

    <!-- 补休班标签 -->
    <div v-if="popupSettings.settings.popupShowHoliday && lunarInfo.isWorkDay && lunarInfo.workDayName" class="workday-tag">
      补休（{{ lunarInfo.workDayName }}）
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePopupSettingsStore } from '@/stores/popupSettings'
import { getLunarInfo, type LunarInfo } from '@/utils/lunar'

const props = defineProps<{
  date: Date
}>()

const popupSettings = usePopupSettingsStore()

// 格式化日期 YYYY年M月D日
const formattedDate = computed(() => {
  const year = props.date.getFullYear()
  const month = props.date.getMonth() + 1
  const day = props.date.getDate()
  return `${year}年${month}月${day}日`
})

// 星期名称
const weekdayName = computed(() => {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return weekdays[props.date.getDay()]
})

// 农历信息
const lunarInfo = computed<LunarInfo>(() => {
  return getLunarInfo(props.date)
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

.date-section {
  display: flex;
  align-items: center;
  gap: var(--popup-space-sm);
}

.current-date {
  font-size: 18px;
  font-weight: 600;
  color: var(--popup-text-primary);
  letter-spacing: -0.2px;
}

.weekday {
  font-size: 13px;
  font-weight: 500;
  color: var(--popup-accent-color);
  padding: 3px 10px;
  background: var(--popup-accent-light);
  border-radius: var(--popup-radius-full);
  transition: all var(--popup-transition-fast);
}

.lunar-section {
  display: flex;
  align-items: center;
  gap: var(--popup-space-sm);
  flex-wrap: wrap;
}

.lunar-date {
  font-size: 13px;
  color: var(--popup-text-secondary);
}

.solar-term {
  font-size: 12px;
  font-weight: 500;
  color: var(--popup-solar-term-text);
  padding: 2px 8px;
  background: var(--popup-solar-term-bg);
  border-radius: var(--popup-radius-md);
  transition: all var(--popup-transition-fast);
}

.lunar-festival {
  font-size: 12px;
  font-weight: 500;
  color: var(--popup-text-secondary);
  padding: 2px 8px;
  background: var(--popup-bg-hover);
  border-radius: var(--popup-radius-md);
}

.holiday-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--popup-holiday-bg);
  border-radius: var(--popup-radius-full);
  font-size: 12px;
  font-weight: 600;
  color: var(--popup-holiday-text);
  border: 1px solid var(--popup-holiday-border);
  transition: all var(--popup-transition-fast);
}

.workday-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: var(--popup-workday-bg);
  border-radius: var(--popup-radius-full);
  font-size: 12px;
  font-weight: 600;
  color: var(--popup-workday-text);
  border: 1px solid var(--popup-workday-border);
  transition: all var(--popup-transition-fast);
}
</style>
