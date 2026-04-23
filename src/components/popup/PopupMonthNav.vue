<template>
  <div class="popup-month-nav" tabindex="0" @keydown="handleKeydown">
    <button class="nav-btn prev" @click="emit('prev-month')" title="上个月">
      <span class="arrow">‹</span>
    </button>
    <button class="month-label" @click="emit('open-picker')" title="选择月份">
      {{ monthLabel }}
    </button>
    <button class="nav-btn next" @click="emit('next-month')" title="下个月">
      <span class="arrow">›</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentDate: Date
}>()

const emit = defineEmits<{
  'prev-month': []
  'next-month': []
  'open-picker': []
}>()

const monthLabel = computed(() => {
  const year = props.currentDate.getFullYear()
  const month = props.currentDate.getMonth() + 1
  return `${year}年${month}月`
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    emit('prev-month')
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    emit('next-month')
  }
}
</script>

<style scoped>
.popup-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 var(--popup-space-sm);
  background: var(--popup-bg-secondary);
  border-radius: var(--popup-radius-lg);
  box-shadow: var(--popup-shadow-sm);
  user-select: none;
}

.popup-month-nav:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--popup-border-focus);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--popup-radius-md);
  transition: all var(--popup-transition-fast);
  color: var(--popup-text-primary);
}

.nav-btn:hover {
  background: var(--popup-bg-hover);
}

.nav-btn:active {
  background: var(--popup-bg-active);
  transform: scale(0.95);
}

.nav-btn:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--popup-border-focus);
}

.arrow {
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  color: inherit;
}

.month-label {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--popup-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: var(--popup-radius-md);
  transition: all var(--popup-transition-fast);
}

.month-label:hover {
  background: var(--popup-bg-hover);
  color: var(--popup-accent-color);
}

.month-label:active {
  transform: scale(0.98);
}

.month-label:focus {
  outline: none;
  box-shadow: 0 0 0 2px var(--popup-border-focus);
}
</style>
