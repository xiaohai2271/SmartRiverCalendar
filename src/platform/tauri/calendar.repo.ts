import type { ICalendarRepository } from '../types/calendar.repository'
import type { Calendar } from '@/types'
import { safeInvoke } from '@/utils/tauri'
import { transformCalendar, type RawCalendar } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Tauri 日历 Repository 实现 */
export class TauriCalendarRepository implements ICalendarRepository {
  private readonly platform = 'tauri' as const

  async getAll(): Promise<Calendar[]> {
    const result = await safeInvoke<RawCalendar[]>('get_calendars')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取日历列表：Tauri 环境不可用',
        platform: this.platform,
      })
    }
    return result.map(transformCalendar)
  }

  async create(params: {
    name: string
    color: string
    type: string
    accountId?: number
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const result = await safeInvoke<RawCalendar>('create_calendar', {
      name: params.name,
      color: params.color,
      calendarType: params.type,
      accountId: params.accountId ?? null,
      visible: params.visible ?? true,
      syncEnabled: params.syncEnabled ?? false,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法创建日历',
        platform: this.platform,
      })
    }
    return transformCalendar(result)
  }

  async update(params: {
    id: number
    name?: string
    color?: string
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const result = await safeInvoke<RawCalendar>('update_calendar', {
      id: params.id,
      name: params.name ?? null,
      color: params.color ?? null,
      visible: params.visible ?? null,
      syncEnabled: params.syncEnabled ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法更新日历',
        platform: this.platform,
      })
    }
    return transformCalendar(result)
  }

  async delete(id: number): Promise<void> {
    const result = await safeInvoke<void>('delete_calendar', { id })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法删除日历',
        platform: this.platform,
      })
    }
  }
}
