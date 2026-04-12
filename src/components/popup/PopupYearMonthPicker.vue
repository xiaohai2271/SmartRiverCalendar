<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 组件属性定义
const props = defineProps<{
  modelValue: boolean // 控制组件显示/隐藏
  currentDate: Date // 当前日期，用于初始化年月选择
}>()

// 组件事件定义
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [year: number, month: number]
}>()

// 选中的年份
const selectedYear = ref(props.currentDate.getFullYear())
// 选中的月份
const selectedMonth = ref(props.currentDate.getMonth() + 1)

// 年份选项范围：当前年份 ±10年
const yearOptions = computed(() => {
  const currentYear = props.currentDate.getFullYear()
  const years: number[] = []
  for (let i = currentYear - 10; i <= currentYear + 10; i++) {
    years.push(i)
  }
  return years
})

// 月份选项：1-12
const monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// 监听 currentDate 变化，重置选中的年月
watch(
  () => props.currentDate,
  (newDate) => {
    selectedYear.value = newDate.getFullYear()
    selectedMonth.value = newDate.getMonth() + 1
  }
)

// 关闭弹窗
const close = () => {
  emit('update:modelValue', false)
}

// 确认选择
const confirm = () => {
  emit('confirm', selectedYear.value, selectedMonth.value)
  close()
}

// 取消选择
const cancel = () => {
  close()
}

// 键盘事件处理：Escape 键取消
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.modelValue) {
    cancel()
  }
}

// 组件挂载时添加键盘监听
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

// 组件卸载时移除键盘监听
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="modelValue" class="year-month-picker">
    <div class="picker-header">
      <span class="picker-title">跳转到指定年月</span>
    </div>

    <div class="picker-body">
      <!-- 年份选择 -->
      <div class="picker-field">
        <label class="field-label">年份</label>
        <select v-model="selectedYear" class="field-select">
          <option v-for="year in yearOptions" :key="year" :value="year">
            {{ year }} 年
          </option>
        </select>
      </div>

      <!-- 月份选择 -->
      <div class="picker-field">
        <label class="field-label">月份</label>
        <select v-model="selectedMonth" class="field-select">
          <option v-for="month in monthOptions" :key="month" :value="month">
            {{ month }} 月
          </option>
        </select>
      </div>
    </div>

    <div class="picker-footer">
      <button class="btn btn-cancel" @click="cancel">取消</button>
      <button class="btn btn-confirm" @click="confirm">确认</button>
    </div>
  </div>
</template>

<style scoped>
.year-month-picker {
  position: fixed;
  z-index: 1000;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 280px;
  max-width: 90vw;
  background: var(--popup-bg-secondary);
  border: 1px solid var(--popup-border-color);
  border-radius: var(--popup-radius-lg);
  box-shadow: var(--popup-shadow-lg);
  padding: var(--popup-space-md);
  font-size: 14px;
  animation: pickerEnter var(--popup-transition-smooth);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

@keyframes pickerEnter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.picker-header {
  padding-bottom: var(--popup-space-sm);
  border-bottom: 1px solid var(--popup-border-color);
  margin-bottom: var(--popup-space-md);
}

.picker-title {
  font-weight: 600;
  color: var(--popup-text-primary);
  font-size: 15px;
}

.picker-body {
  display: flex;
  flex-direction: column;
  gap: var(--popup-space-md);
  margin-bottom: var(--popup-space-md);
}

.picker-field {
  display: flex;
  align-items: center;
  gap: var(--popup-space-sm);
}

.field-label {
  flex-shrink: 0;
  width: 40px;
  color: var(--popup-text-secondary);
  font-size: 14px;
}

.field-select {
  flex: 1;
  height: 36px;
  padding: 0 var(--popup-space-sm);
  border: 1px solid var(--popup-border-color);
  border-radius: var(--popup-radius-md);
  background: var(--popup-bg-tertiary);
  color: var(--popup-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--popup-transition-fast);
  outline: none;
}

.field-select:hover {
  border-color: var(--popup-accent-color);
}

.field-select:focus {
  border-color: var(--popup-accent-color);
  box-shadow: 0 0 0 2px var(--popup-border-focus);
}

.picker-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--popup-space-sm);
  padding-top: var(--popup-space-md);
  border-top: 1px solid var(--popup-border-color);
}

.btn {
  height: 36px;
  padding: 0 var(--popup-space-lg);
  border: none;
  border-radius: var(--popup-radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--popup-transition-fast);
  outline: none;
}

.btn:focus {
  box-shadow: 0 0 0 2px var(--popup-border-focus);
}

.btn-cancel {
  background: var(--popup-bg-tertiary);
  color: var(--popup-text-secondary);
}

.btn-cancel:hover {
  background: var(--popup-bg-hover);
  color: var(--popup-text-primary);
}

.btn-confirm {
  background: var(--popup-accent-color);
  color: white;
}

.btn-confirm:hover {
  background: var(--popup-accent-hover);
}
</style>
