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

  /**
   * 更新日历类型（登录/退出身份切换）
   *
   * 将日历 type 从 'local' 切换为 'online'，或反向切换。
   * 仅修改 type 和 sync_enabled 字段。
   *
   * 注意：此方法不处理数据同步，同步由 syncRepo 负责。
   * 调用顺序：先同步 → 再切换 type → 再 reloadFromDatabase()
   */
  updateType(params: {
    id: number
    type: 'local' | 'online'
    syncEnabled: boolean
  }): Promise<Calendar>
}
