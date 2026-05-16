import type { Calendar } from '@/types'

export interface ICalendarRepository {
  /** 获取所有日历 */
  getAll(): Promise<Calendar[]>

  /** 创建日历 */
  create(params: {
    name: string
    color: string
    type: string
    accountId?: number
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar>

  /** 更新日历 */
  update(params: {
    id: number
    name?: string
    color?: string
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar>

  /** 删除日历 */
  delete(id: number): Promise<void>
}
