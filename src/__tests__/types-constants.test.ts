/**
 * 类型定义和常量测试
 */

import { describe, it, expect } from 'vitest'
import type {
  DateCellMenuAction,
  EventBlockMenuAction,
  RestBadgeType
} from '@/types'
import { REST_BADGE_CONFIG } from '@/types'

describe('类型定义测试', () => {
  describe('DateCellMenuAction', () => {
    it('应该包含所有预期的菜单动作', () => {
      const actions: DateCellMenuAction[] = [
        'viewEvents',
        'createEvent',
        'viewTodos',
        'createTodo',
        'switchToDayView',
        'switchToWeekView'
      ]

      expect(actions).toHaveLength(6)
      expect(actions).toContain('viewEvents')
      expect(actions).toContain('createEvent')
      expect(actions).toContain('viewTodos')
      expect(actions).toContain('createTodo')
      expect(actions).toContain('switchToDayView')
      expect(actions).toContain('switchToWeekView')
    })

    it('应该正确分配给变量', () => {
      const action: DateCellMenuAction = 'viewEvents'
      expect(action).toBe('viewEvents')
    })
  })

  describe('EventBlockMenuAction', () => {
    it('应该包含所有预期的菜单动作', () => {
      const actions: EventBlockMenuAction[] = ['edit', 'detail', 'delete']

      expect(actions).toHaveLength(3)
      expect(actions).toContain('edit')
      expect(actions).toContain('detail')
      expect(actions).toContain('delete')
    })

    it('应该正确分配给变量', () => {
      const action: EventBlockMenuAction = 'edit'
      expect(action).toBe('edit')
    })
  })

  describe('RestBadgeType', () => {
    it('应该包含所有预期的徽标类型', () => {
      const types: RestBadgeType[] = ['rest', 'makeup']

      expect(types).toHaveLength(2)
      expect(types).toContain('rest')
      expect(types).toContain('makeup')
    })

    it('应该正确分配给变量', () => {
      const type: RestBadgeType = 'rest'
      expect(type).toBe('rest')
    })
  })
})

describe('常量测试', () => {
  describe('REST_BADGE_CONFIG', () => {
    it('应该包含所有徽标类型配置', () => {
      expect(REST_BADGE_CONFIG).toHaveProperty('rest')
      expect(REST_BADGE_CONFIG).toHaveProperty('makeup')
    })

    it('rest 配置应该包含正确的文本和 CSS 类', () => {
      expect(REST_BADGE_CONFIG.rest.text).toBe('休')
      expect(REST_BADGE_CONFIG.rest.cssClass).toBe('badge-rest')
    })

    it('makeup 配置应该包含正确的文本和 CSS 类', () => {
      expect(REST_BADGE_CONFIG.makeup.text).toBe('补')
      expect(REST_BADGE_CONFIG.makeup.cssClass).toBe('badge-makeup')
    })

    it('所有徽标应该具有相同的优先级 1', () => {
      expect(REST_BADGE_CONFIG.rest.priority).toBe(1)
      expect(REST_BADGE_CONFIG.makeup.priority).toBe(1)
    })

    it('应该正确导出类型', () => {
      const restConfig = REST_BADGE_CONFIG['rest']
      expect(restConfig).toHaveProperty('text')
      expect(restConfig).toHaveProperty('cssClass')
      expect(restConfig).toHaveProperty('priority')
    })
  })
})