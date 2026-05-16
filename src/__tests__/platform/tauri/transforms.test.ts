import { describe, it, expect } from 'vitest'
import { transformCalendar, transformEvent, transformTodo, transformAccount } from '@/platform/tauri/transforms'

describe('Tauri 数据转换', () => {
  describe('transformCalendar', () => {
    it('应将 snake_case 原始数据转换为 camelCase', () => {
      const raw = {
        id: 1,
        name: '我的日历',
        color: '#4A90D9',
        type: 'local',
        account_id: null,
        visible: true,
        sync_enabled: false,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformCalendar(raw)
      expect(result.id).toBe('1')
      expect(result.name).toBe('我的日历')
      expect(result.color).toBe('#4A90D9')
      expect(result.type).toBe('local')
      expect(result.accountId).toBeUndefined()
      expect(result.visible).toBe(true)
      expect(result.syncEnabled).toBe(false)
    })

    it('应处理 account_id 存在的情况', () => {
      const raw = {
        id: 2,
        name: '工作日历',
        color: '#FF0000',
        type: 'exchange',
        account_id: 10,
        visible: true,
        sync_enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformCalendar(raw)
      expect(result.accountId).toBe('10')
    })
  })

  describe('transformEvent', () => {
    it('应正确转换事件数据', () => {
      const raw = {
        id: 1,
        title: '会议',
        description: '团队周会',
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: 15,
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformEvent(raw)
      expect(result.id).toBe('1')
      expect(result.title).toBe('会议')
      expect(result.description).toBe('团队周会')
      expect(result.startTime).toBe(1700000000000)
      expect(result.allDay).toBe(false)
      expect(result.calendarId).toBe('1')
      expect(result.color).toBeUndefined()
      expect(result.reminder).toBe(15)
    })

    it('应解析 repeat_rule JSON', () => {
      const raw = {
        id: 1,
        title: '重复事件',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: '{"frequency":"weekly","interval":1}',
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformEvent(raw)
      expect(result.repeatRule).toEqual({ frequency: 'weekly', interval: 1 })
    })
  })

  describe('transformTodo', () => {
    it('应正确转换待办数据', () => {
      const raw = {
        id: 1,
        title: '买牛奶',
        description: null,
        due_date: 1700000000000,
        completed: false,
        priority: 'medium',
        calendar_id: 1,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformTodo(raw)
      expect(result.id).toBe('1')
      expect(result.title).toBe('买牛奶')
      expect(result.dueDate).toBe(1700000000000)
      expect(result.completed).toBe(false)
      expect(result.priority).toBe('medium')
    })
  })

  describe('transformAccount', () => {
    it('应正确转换账号数据', () => {
      const raw = {
        id: 1,
        type: 'exchange',
        server_url: 'https://mail.example.com',
        username: 'user@example.com',
        encrypted_password: 'encrypted123',
        display_name: null,
        enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformAccount(raw)
      expect(result.id).toBe('1')
      expect(result.type).toBe('exchange')
      expect(result.serverUrl).toBe('https://mail.example.com')
    })
  })
})
