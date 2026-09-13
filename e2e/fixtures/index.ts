import type { MockOptions } from '../helpers/api-mock'

export const userFixture = {
  id: 1,
  email: 'test@example.com',
  display_name: '测试用户',
  avatar_url: null,
  provider: 'local',
} as const

export const calendarsFixture = [
  {
    id: 1,
    name: '默认日历',
    color: '#0078d4',
    type: 'local',
    visible: true,
    sync_enabled: false,
  },
  {
    id: 2,
    name: '工作日历',
    color: '#107c10',
    type: 'online',
    visible: true,
    sync_enabled: true,
  },
] as const

export const eventsFixture = [
  {
    id: 'evt-1',
    title: '团队会议',
    description: '每周团队同步会议',
    start_time: 1750550400000,
    end_time: 1750554000000,
    all_day: false,
    calendar_id: 1,
    color: '#0078d4',
    reminder: 15,
    location: '会议室A',
  },
  {
    id: 'evt-2',
    title: '产品评审',
    description: 'Q3 产品方案评审',
    start_time: 1750636800000,
    end_time: 1750640400000,
    all_day: false,
    calendar_id: 2,
    color: '#107c10',
  },
] as const

export const todosFixture = [
  {
    id: 'todo-1',
    title: '完成项目文档',
    description: '整理并提交项目文档',
    due_date: 1750636800000,
    completed: false,
    priority: 'high',
    calendar_id: 1,
  },
  {
    id: 'todo-2',
    title: '回复邮件',
    completed: true,
    priority: 'low',
    calendar_id: 1,
  },
] as const

export const syncStatusFixture = {
  status: 'idle',
  last_sync_at: 1750550400000,
  pending_changes: 0,
} as const
