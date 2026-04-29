<template>
  <ContextMenu
    :visible="visible"
    :x="x"
    :y="y"
    :items="menuItems"
    @update:visible="emit('update:visible', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ContextMenu from '../common/ContextMenu.vue'
import type { MenuItem, DateCellMenuAction } from '../../types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  /** 当天的事件数量（用于禁用"查看事件"） */
  eventCount?: number
  /** 当天的待办数量（用于禁用"查看待办"） */
  todoCount?: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'action': [action: DateCellMenuAction]
}>()

// 菜单项配置
const actionConfig: Record<DateCellMenuAction, { label: string; icon: string }> = {
  viewEvents: { label: '查看事件', icon: '📋' },
  createEvent: { label: '创建事件', icon: '➕' },
  viewTodos: { label: '查看待办', icon: '✅' },
  createTodo: { label: '创建待办', icon: '📝' },
  switchToDayView: { label: '切换到日视图', icon: '📅' },
  switchToWeekView: { label: '切换到周视图', icon: '📆' },
}

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    {
      label: actionConfig.viewEvents.label,
      icon: actionConfig.viewEvents.icon,
      disabled: (props.eventCount ?? 0) === 0,
      action: () => emit('action', 'viewEvents'),
    },
    {
      label: actionConfig.createEvent.label,
      icon: actionConfig.createEvent.icon,
      action: () => emit('action', 'createEvent'),
    },
    {
      label: actionConfig.viewTodos.label,
      icon: actionConfig.viewTodos.icon,
      disabled: (props.todoCount ?? 0) === 0,
      action: () => emit('action', 'viewTodos'),
    },
    {
      label: actionConfig.createTodo.label,
      icon: actionConfig.createTodo.icon,
      action: () => emit('action', 'createTodo'),
    },
    { separator: true },
    {
      label: actionConfig.switchToDayView.label,
      icon: actionConfig.switchToDayView.icon,
      action: () => emit('action', 'switchToDayView'),
    },
    {
      label: actionConfig.switchToWeekView.label,
      icon: actionConfig.switchToWeekView.icon,
      action: () => emit('action', 'switchToWeekView'),
    },
  ]
  return items
})
</script>
