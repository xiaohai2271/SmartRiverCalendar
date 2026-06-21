import { describe, it, expect, vi } from 'vitest'
import {
  transformWebCalendar,
  transformWebEvent,
  transformWebTodo,
  transformWebAccount,
  transformWebUser,
} from '@/platform/web/transforms'
import type { WebCalendar, WebEvent, WebTodo, WebAccount, WebUserProfile } from '@/platform/web/transforms'

describe('Web 平台数据转换', () => {
  describe('transformWebCalendar', () => {
    it('应将 snake_case 字段转换为 camelCase', () => {
      const raw: WebCalendar = {
        id: 1,
        name: '我的日历',
        color: '#4A90D9',
        type: 'local',
        account_id: null,
        visible: true,
        sync_enabled: false,
      }
      const result = transformWebCalendar(raw)

      expect(result.id).toBe('1')
      expect(result.name).toBe('我的日历')
      expect(result.color).toBe('#4A90D9')
      expect(result.type).toBe('local')
      expect(result.accountId).toBeUndefined()
      expect(result.visible).toBe(true)
      expect(result.syncEnabled).toBe(false)
    })

    it('应处理 account_id 存在的情况', () => {
      const raw: WebCalendar = {
        id: 2,
        name: '工作日历',
        color: '#FF0000',
        type: 'exchange',
        account_id: 10,
        visible: true,
        sync_enabled: true,
      }
      const result = transformWebCalendar(raw)

      expect(result.accountId).toBe('10')
    })

    it('应处理字符串类型的 id', () => {
      const raw: WebCalendar = {
        id: 'abc-123',
        name: '字符串ID日历',
        color: '#000',
        type: 'caldav',
        account_id: 5,
        visible: false,
        sync_enabled: true,
      }
      const result = transformWebCalendar(raw)

      expect(result.id).toBe('abc-123')
      expect(result.accountId).toBe('5')
    })

    it('应处理 id 为 0 的情况', () => {
      const raw: WebCalendar = {
        id: 0,
        name: '零ID日历',
        color: '#000',
        type: 'local',
        account_id: null,
        visible: true,
        sync_enabled: false,
      }
      const result = transformWebCalendar(raw)

      expect(result.id).toBe('0')
    })
  })

  describe('transformWebEvent', () => {
    it('应正确转换事件数据', () => {
      const raw: WebEvent = {
        id: 1,
        title: '会议',
        description: '团队周会',
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: '#FF0000',
        reminder: 15,
        repeat_rule: null,
        location: '会议室A',
        external_id: 'ext-001',
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebEvent(raw)

      expect(result.id).toBe('1')
      expect(result.title).toBe('会议')
      expect(result.description).toBe('团队周会')
      expect(result.startTime).toBe(1700000000000)
      expect(result.endTime).toBe(1700003600000)
      expect(result.allDay).toBe(false)
      expect(result.calendarId).toBe('1')
      expect(result.color).toBe('#FF0000')
      expect(result.reminder).toBe(15)
      expect(result.repeatRule).toBeUndefined()
      expect(result.location).toBe('会议室A')
      expect(result.externalId).toBe('ext-001')
      expect(result.createdAt).toBe(1700000000)
      expect(result.updatedAt).toBe(1700000000)
    })

    it('应解析有效的 repeat_rule JSON', () => {
      const raw: WebEvent = {
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
      const result = transformWebEvent(raw)

      expect(result.repeatRule).toEqual({ frequency: 'weekly', interval: 1 })
    })

    it('repeat_rule 为无效 JSON 时应输出警告并设为 undefined', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const raw: WebEvent = {
        id: 1,
        title: '无效重复规则',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: 'not-valid-json{',
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebEvent(raw)

      expect(result.repeatRule).toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('repeat_rule 为 null 时应返回 undefined', () => {
      const raw: WebEvent = {
        id: 1,
        title: '无重复',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebEvent(raw)

      expect(result.repeatRule).toBeUndefined()
    })

    it('created_at/updated_at 缺失时应回退到 Date.now()', () => {
      const raw = {
        id: 1,
        title: '无时间戳',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: null,
        location: null,
        external_id: null,
      } as WebEvent

      const before = Date.now()
      const result = transformWebEvent(raw)
      const after = Date.now()

      expect(result.createdAt).toBeGreaterThanOrEqual(before)
      expect(result.createdAt).toBeLessThanOrEqual(after)
      expect(result.updatedAt).toBeGreaterThanOrEqual(before)
      expect(result.updatedAt).toBeLessThanOrEqual(after)
    })

    it('应将 null 字段转为 undefined', () => {
      const raw: WebEvent = {
        id: 1,
        title: '空字段事件',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebEvent(raw)

      expect(result.description).toBeUndefined()
      expect(result.color).toBeUndefined()
      expect(result.reminder).toBeUndefined()
      expect(result.location).toBeUndefined()
      expect(result.externalId).toBeUndefined()
    })

    it('应将字符串类型的数值字段转为数字', () => {
      const raw: WebEvent = {
        id: '5',
        title: '字符串数值',
        description: null,
        start_time: '1700000000000',
        end_time: '1700003600000',
        all_day: true,
        calendar_id: '3',
        color: null,
        reminder: '30',
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: '1700000000',
        updated_at: '1700000000',
      }
      const result = transformWebEvent(raw)

      expect(result.id).toBe('5')
      expect(result.startTime).toBe(1700000000000)
      expect(result.endTime).toBe(1700003600000)
      expect(result.reminder).toBe(30)
      expect(result.createdAt).toBe(1700000000)
      expect(typeof result.startTime).toBe('number')
    })

    it('reminder 为 0 时应正确转换', () => {
      const raw: WebEvent = {
        id: 1,
        title: '零提醒',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: 0,
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebEvent(raw)

      expect(result.reminder).toBe(0)
    })
  })

  describe('transformWebTodo', () => {
    it('应正确转换待办数据', () => {
      const raw: WebTodo = {
        id: 1,
        title: '买牛奶',
        description: '低脂牛奶',
        due_date: 1700000000000,
        completed: false,
        priority: 'medium',
        calendar_id: 1,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebTodo(raw)

      expect(result.id).toBe('1')
      expect(result.title).toBe('买牛奶')
      expect(result.description).toBe('低脂牛奶')
      expect(result.dueDate).toBe(1700000000000)
      expect(result.completed).toBe(false)
      expect(result.priority).toBe('medium')
      expect(result.calendarId).toBe('1')
      expect(result.externalId).toBeUndefined()
      expect(result.createdAt).toBe(1700000000)
      expect(result.updatedAt).toBe(1700000000)
    })

    it('应处理 null 字段', () => {
      const raw: WebTodo = {
        id: 2,
        title: '简单待办',
        description: null,
        due_date: null,
        completed: true,
        priority: 'high',
        calendar_id: 1,
        external_id: 'ext-todo-1',
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebTodo(raw)

      expect(result.description).toBeUndefined()
      expect(result.dueDate).toBeUndefined()
      expect(result.externalId).toBe('ext-todo-1')
      expect(result.completed).toBe(true)
    })

    it('应处理字符串类型的数值', () => {
      const raw: WebTodo = {
        id: '3',
        title: '字符串ID待办',
        description: null,
        due_date: '1700000000000',
        completed: false,
        priority: 'low',
        calendar_id: '2',
        external_id: null,
        created_at: '1700000000',
        updated_at: '1700000000',
      }
      const result = transformWebTodo(raw)

      expect(result.id).toBe('3')
      expect(result.dueDate).toBe(1700000000000)
      expect(result.calendarId).toBe('2')
      expect(typeof result.createdAt).toBe('number')
    })
  })

  describe('transformWebAccount', () => {
    it('应正确转换账号数据', () => {
      const raw: WebAccount = {
        id: 1,
        type: 'exchange',
        server_url: 'https://mail.example.com',
        username: 'user@example.com',
        encrypted_password: 'encrypted123',
        display_name: '工作邮箱',
        enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebAccount(raw)

      expect(result.id).toBe('1')
      expect(result.type).toBe('exchange')
      expect(result.serverUrl).toBe('https://mail.example.com')
      expect(result.username).toBe('user@example.com')
      expect(result.encryptedPassword).toBe('encrypted123')
      expect(result.displayName).toBe('工作邮箱')
      expect(result.enabled).toBe(true)
      expect(result.createdAt).toBe(1700000000)
      expect(result.updatedAt).toBe(1700000000)
    })

    it('created_at/updated_at 缺失时应回退到 Date.now()', () => {
      const raw = {
        id: 2,
        type: 'caldav',
        server_url: 'https://caldav.example.com',
        username: 'user2@example.com',
        encrypted_password: 'enc456',
        display_name: null,
        enabled: false,
      } as WebAccount

      const before = Date.now()
      const result = transformWebAccount(raw)
      const after = Date.now()

      expect(result.createdAt).toBeGreaterThanOrEqual(before)
      expect(result.createdAt).toBeLessThanOrEqual(after)
      expect(result.updatedAt).toBeGreaterThanOrEqual(before)
      expect(result.updatedAt).toBeLessThanOrEqual(after)
    })

    it('display_name 为 null 时应转为 undefined', () => {
      const raw: WebAccount = {
        id: 3,
        type: 'exchange',
        server_url: 'https://mail.example.com',
        username: 'user3@example.com',
        encrypted_password: 'enc789',
        display_name: null,
        enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformWebAccount(raw)

      expect(result.displayName).toBeUndefined()
    })
  })

  describe('transformWebUser', () => {
    it('应正确转换用户资料', () => {
      const raw: WebUserProfile = {
        id: 1,
        email: 'user@example.com',
        display_name: '张三',
        avatar_url: 'https://avatar.example.com/1.png',
        provider: 'github',
      }
      const result = transformWebUser(raw)

      expect(result.id).toBe('1')
      expect(result.email).toBe('user@example.com')
      expect(result.displayName).toBe('张三')
      expect(result.avatarUrl).toBe('https://avatar.example.com/1.png')
      expect(result.provider).toBe('github')
    })

    it('provider 缺失时应回退到 local', () => {
      const raw = {
        id: 2,
        email: 'local@example.com',
        display_name: '本地用户',
        avatar_url: null,
        provider: '',
      } as WebUserProfile
      const result = transformWebUser(raw)

      expect(result.provider).toBe('local')
    })

    it('avatar_url 为 null 时应转为 undefined', () => {
      const raw: WebUserProfile = {
        id: 3,
        email: 'noavatar@example.com',
        display_name: '无头像',
        avatar_url: null,
        provider: 'google',
      }
      const result = transformWebUser(raw)

      expect(result.avatarUrl).toBeUndefined()
    })
  })
})
