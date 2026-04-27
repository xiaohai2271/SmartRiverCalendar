<template>
  <div class="color-picker" :class="{ disabled }">
    <!-- 预设颜色区域 -->
    <div class="preset-colors">
      <button
        v-for="color in PRESET_COLORS"
        :key="color"
        type="button"
        class="color-option"
        :class="{ active: selectedColor === color && !isCustom }"
        :style="{ backgroundColor: color }"
        :disabled="disabled"
        @click="selectPresetColor(color)"
        :aria-label="`选择颜色 ${color}`"
      >
        <span v-if="selectedColor === color && !isCustom" class="check-mark">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 8L6.5 11.5L13 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>
    </div>

    <!-- 自定义颜色区域 -->
    <div class="custom-color-section">
      <label
        class="custom-color-label"
        :class="{ active: isCustom }"
        :style="{ backgroundColor: isCustom ? customColor : undefined }"
      >
        <input
          ref="colorInputRef"
          type="color"
          :value="customColor"
          :disabled="disabled"
          @input="onCustomColorInput"
          @change="onCustomColorChange"
        />
        <!-- 未选择自定义颜色时显示加号 -->
        <span v-if="!isCustom" class="plus-icon">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <!-- 选择自定义颜色后显示勾选 -->
        <span v-else class="check-mark">
          <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 8L6.5 11.5L13 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </label>
      <span class="custom-color-text">自定义</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

/**
 * 预设颜色列表 (10个)
 */
const PRESET_COLORS = [
  '#4A90D9', // 蓝
  '#7B68EE', // 紫
  '#E74C3C', // 红
  '#E67E22', // 橙
  '#F1C40F', // 黄
  '#2ECC71', // 绿
  '#1ABC9C', // 青
  '#E91E63', // 粉
  '#607D8B', // 灰蓝
  '#795548', // 棕
] as const

/**
 * 组件 Props 定义
 */
interface Props {
  /** 当前选中的颜色值 (HEX格式) */
  modelValue?: string
  /** 是否禁用 */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  disabled: false,
})

/**
 * 组件事件定义
 */
const emit = defineEmits<{
  /** 颜色值变化事件 */
  'update:modelValue': [value: string]
}>()

// 自定义颜色值 (内部状态，用于 input 的 v-model)
const customColor = ref('#4A90D9')

// 是否使用自定义颜色
const isCustom = ref(false)

// 当前选中的颜色 (可能是预设或自定义)
const selectedColor = computed(() => props.modelValue)

/**
 * 根据 modelValue 初始化状态
 * - 如果是预设颜色，标记为非自定义
 * - 如果是自定义颜色，设置自定义颜色值并标记为自定义
 */
watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue) {
      isCustom.value = false
      return
    }

    if (PRESET_COLORS.includes(newValue as typeof PRESET_COLORS[number])) {
      isCustom.value = false
    } else {
      isCustom.value = true
      customColor.value = newValue
    }
  },
  { immediate: true }
)

/**
 * 选择预设颜色
 * 选择预设颜色会取消自定义状态
 */
function selectPresetColor(color: string) {
  if (props.disabled) return
  isCustom.value = false
  emit('update:modelValue', color)
}

/**
 * 自定义颜色输入事件 (实时更新)
 */
function onCustomColorInput(event: Event) {
  const target = event.target as HTMLInputElement
  customColor.value = target.value
}

/**
 * 自定义颜色改变事件 (确认选择)
 * 切换到自定义模式并发送更新事件
 */
function onCustomColorChange(event: Event) {
  if (props.disabled) return
  const target = event.target as HTMLInputElement
  customColor.value = target.value
  isCustom.value = true
  emit('update:modelValue', target.value)
}
</script>

<style scoped>
/* 颜色选择器容器 */
.color-picker {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
}

/* 禁用状态 */
.color-picker.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* 预设颜色区域 */
.preset-colors {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

/* 颜色选项按钮 */
.color-option {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  padding: 0;
  position: relative;
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.color-option:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: var(--shadow-md);
}

.color-option:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* 选中状态的边框 */
.color-option.active {
  border-color: var(--text-primary);
}

/* 勾选图标 */
.check-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

.check-mark svg {
  width: 12px;
  height: 12px;
}

/* 自定义颜色区域 */
.custom-color-section {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-left: var(--space-sm);
  border-left: 1px solid var(--border-color);
  margin-left: var(--space-xs);
}

/* 自定义颜色标签 (按钮样式) */
.custom-color-label {
  width: 24px;
  height: 24px;
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all var(--transition-fast);
  background: var(--bg-tertiary);
}

.custom-color-label:hover {
  border-color: var(--accent-color);
  background: var(--bg-hover);
}

/* 选中自定义颜色时 */
.custom-color-label.active {
  border-style: solid;
  border-color: var(--text-primary);
}

/* 隐藏原生颜色输入框 */
.custom-color-label input[type='color'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
}

.custom-color-label input[type='color']:disabled {
  cursor: not-allowed;
}

/* 加号图标 */
.plus-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  pointer-events: none;
}

.plus-icon svg {
  width: 14px;
  height: 14px;
}

.custom-color-label:hover .plus-icon {
  color: var(--accent-color);
}

/* 自定义颜色文字 */
.custom-color-text {
  font-size: 12px;
  color: var(--text-secondary);
  user-select: none;
}

/* 深色主题适配 - 勾选图标阴影 */
.dark .check-mark {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
