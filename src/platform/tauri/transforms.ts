// Tauri 平台数据转换函数
// 从 src/utils/tauri.ts 迁移，将后端 snake_case 转换为前端 camelCase

import type { Calendar, CalendarEvent, Todo, ExternalAccount } from '@/types'

/** 后端返回的日历原始数据 */
export interface RawCalendar {
  id: number
  name: string
  color: string
  type: string
  account_id: number | null
  visible: boolean
  sync_enabled: boolean
  created_at: number
  updated_at: number
}

/** 后端返回的事件原始数据 */
export interface RawEvent {
  id: number
  title: string
  description: string | null
  start_time: number
  end_time: number
  all_day: boolean
  calendar_id: number
  color: string | null
  reminder: number | null
  repeat_rule: string | null
  location: string | null
  external_id: string | null
  created_at: number
  updated_at: number
}

/** 后端返回的待办原始数据 */
export interface RawTodo {
  id: number
  title: string
  description: string | null
  due_date: number | null
  completed: boolean
  priority: string
  calendar_id: number
  created_at: number
  updated_at: number
}

/** 后端返回的账号原始数据 */
export interface RawAccount {
  id: number
  type: string
  server_url: string
  username: string
  encrypted_password: string
  display_name: string | null
  enabled: boolean
  created_at: number
  updated_at: number
}

/** 将后端日历数据转换为前端格式 */
export function transformCalendar(raw: RawCalendar): Calendar {
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

/** 将后端事件数据转换为前端格式 */
export function transformEvent(raw: RawEvent): CalendarEvent {
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
    startTime: raw.start_time,
    endTime: raw.end_time,
    allDay: raw.all_day,
    calendarId: String(raw.calendar_id),
    color: raw.color ?? undefined,
    reminder: raw.reminder ?? undefined,
    repeatRule,
    location: raw.location ?? undefined,
    externalId: raw.external_id ?? undefined,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

/** 将后端待办数据转换为前端格式 */
export function transformTodo(raw: RawTodo): Todo {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    dueDate: raw.due_date ?? undefined,
    completed: raw.completed,
    priority: raw.priority as Todo['priority'],
    calendarId: String(raw.calendar_id),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}

/** 将后端账号数据转换为前端格式 */
export function transformAccount(raw: RawAccount): ExternalAccount {
  return {
    id: String(raw.id),
    type: raw.type as ExternalAccount['type'],
    serverUrl: raw.server_url,
    username: raw.username,
    encryptedPassword: raw.encrypted_password,
    displayName: raw.display_name ?? undefined,
    enabled: raw.enabled,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  }
}
