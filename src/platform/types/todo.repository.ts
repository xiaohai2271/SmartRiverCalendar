import type { Todo } from '@/types'

export interface ITodoRepository {
  /** 获取所有待办 */
  getAll(): Promise<Todo[]>

  /** 按日历 ID 获取待办 */
  getByCalendarId(calendarId: number): Promise<Todo[]>

  /** 创建待办 */
  create(params: {
    title: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId: number
  }): Promise<Todo>

  /** 更新待办 */
  update(params: {
    id: number
    title?: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId?: number
  }): Promise<Todo>

  /** 删除待办 */
  delete(id: number): Promise<void>
}
