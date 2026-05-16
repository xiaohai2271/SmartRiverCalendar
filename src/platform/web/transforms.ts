// Web 平台数据转换函数
// 将 Web API 响应（snake_case）转换为前端类型（camelCase）

import type { Calendar, CalendarEvent, Todo, ExternalAccount, UserHolidayEntry } from '@/types'
import type { User } from '@/types/auth'

/** Web API 响应格式 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

/** Web API 分页响应格式 */
export interface PageResponse<T> {
  items: T[]
  total: number | string
  page: number
  page_size: number
}

/** Web API 日历原始数据 */
export interface WebCalendar {
  id: number | string
  name: string
  color: string
  type: string
  account_id: number | string | null
  visible: boolean
  sync_enabled: boolean
}

/** Web API 事件原始数据 */
export interface WebEvent {
  id: number | string
  title: string
  description: string | null
  start_time: number | string
  end_time: number | string
  all_day: boolean
  calendar_id: number | string
  color: string | null
  reminder: number | string | null
  repeat_rule: string | null
  location: string | null
  external_id: string | null
}

/** Web API 待办原始数据 */
export interface WebTodo {
  id: number | string
  title: string
  description: string | null
  due_date: number | string | null
  completed: boolean
  priority: string
  calendar_id: number | string
  created_at: number | string
  updated_at: number | string
}

/** Web API 账号原始数据 */
export interface WebAccount {
  id: number | string
  type: string
  server_url: string
  username: string
  encrypted_password: string
  display_name: string | null
  enabled: boolean
}

/** Web API 用户资料原始数据 */
export interface WebUserProfile {
  id: number | string
  email: string
  display_name: string
  avatar_url: string | null
  provider: string
}

/** 转换 Web API 日历数据 */
export function transformWebCalendar(raw: WebCalendar): Calendar {
  return {
    id: String(raw.id),
    name: raw.name,
    color: raw.color,
    type: raw.type as Calendar['type'],
    accountId: raw.account_id != null ? String(raw.account_id) : undefined,
    visible: raw.visible,
    syncEnabled: raw.sync_enabled,
  }
}

/** 转换 Web API 事件数据 */
export function transformWebEvent(raw: WebEvent): CalendarEvent {
  let repeatRule = undefined
  if (raw.repeat_rule) {
    try {
      repeatRule = JSON.parse(raw.repeat_rule)
    } catch {
      console.warn('Failed to parse repeat_rule:', raw.repeat_rule)
    }
  }

  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    startTime: Number(raw.start_time),
    endTime: Number(raw.end_time),
    allDay: raw.all_day,
    calendarId: String(raw.calendar_id),
    color: raw.color ?? undefined,
    reminder: raw.reminder != null ? Number(raw.reminder) : undefined,
    repeatRule,
    location: raw.location ?? undefined,
    externalId: raw.external_id ?? undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** 转换 Web API 待办数据 */
export function transformWebTodo(raw: WebTodo): Todo {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    dueDate: raw.due_date != null ? Number(raw.due_date) : undefined,
    completed: raw.completed,
    priority: raw.priority as Todo['priority'],
    calendarId: String(raw.calendar_id),
    createdAt: Number(raw.created_at),
    updatedAt: Number(raw.updated_at),
  }
}

/** 转换 Web API 账号数据 */
export function transformWebAccount(raw: WebAccount): ExternalAccount {
  return {
    id: String(raw.id),
    type: raw.type as ExternalAccount['type'],
    serverUrl: raw.server_url,
    username: raw.username,
    encryptedPassword: raw.encrypted_password,
    displayName: raw.display_name ?? undefined,
    enabled: raw.enabled,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** 转换 Web API 用户资料 */
export function transformWebUser(raw: WebUserProfile): User {
  return {
    id: String(raw.id),
    email: raw.email,
    displayName: raw.display_name,
    avatarUrl: raw.avatar_url ?? undefined,
    provider: (raw.provider as User['provider']) || 'local',
  }
}
