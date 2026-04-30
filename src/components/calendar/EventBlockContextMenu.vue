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
import type { MenuItem, EventBlockMenuAction } from '../../types'

const props = defineProps<{
  visible: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'action': [action: EventBlockMenuAction]
}>()

// 菜单项配置
const actionConfig: Record<EventBlockMenuAction, { label: string; icon: string }> = {
  edit: { label: '编辑事件', icon: '✏️' },
  detail: { label: '事件详情', icon: 'ℹ️' },
  delete: { label: '删除事件', icon: '🗑️' },
}

const menuItems = computed<MenuItem[]>(() => {
  const items: MenuItem[] = [
    {
      label: actionConfig.edit.label,
      icon: actionConfig.edit.icon,
      action: () => emit('action', 'edit'),
    },
    {
      label: actionConfig.detail.label,
      icon: actionConfig.detail.icon,
      action: () => emit('action', 'detail'),
    },
    { separator: true },
    {
      label: actionConfig.delete.label,
      icon: actionConfig.delete.icon,
      action: () => emit('action', 'delete'),
    },
  ]
  return items
})
</script>
