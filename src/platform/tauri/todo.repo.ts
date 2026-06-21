import type { ITodoRepository } from '../types/todo.repository'
import type { Todo } from '@/types'
import { safeInvoke } from '@/utils/tauri'
import { transformTodo, type RawTodo } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Tauri 待办 Repository 实现 */
export class TauriTodoRepository implements ITodoRepository {
  private readonly platform = 'tauri' as const

  async getAll(): Promise<Todo[]> {
    const result = await safeInvoke<RawTodo[]>('get_todos')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取待办列表：Tauri 环境不可用',
        platform: this.platform,
      })
    }
    return result.map(transformTodo)
  }

  async getByCalendarId(calendarId: number): Promise<Todo[]> {
    const result = await safeInvoke<RawTodo[]>('get_todos_by_calendar', { calendarId })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取日历待办',
        platform: this.platform,
      })
    }
    return result.map(transformTodo)
  }

  async create(params: {
    title: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId: number
  }): Promise<Todo> {
    const result = await safeInvoke<RawTodo>('create_todo', {
      title: params.title,
      description: params.description ?? null,
      dueDate: params.dueDate ?? null,
      completed: params.completed ?? null,
      priority: params.priority ?? null,
      calendarId: params.calendarId,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法创建待办',
        platform: this.platform,
      })
    }
    return transformTodo(result)
  }

  async update(params: {
    id: number
    title?: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId?: number
  }): Promise<Todo> {
    const result = await safeInvoke<RawTodo>('update_todo', {
      id: params.id,
      title: params.title ?? null,
      description: params.description ?? null,
      dueDate: params.dueDate ?? null,
      completed: params.completed ?? null,
      priority: params.priority ?? null,
      calendarId: params.calendarId ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法更新待办',
        platform: this.platform,
      })
    }
    return transformTodo(result)
  }

  async delete(id: number): Promise<void> {
    const result = await safeInvoke<boolean>('delete_todo', { id })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法删除待办',
        platform: this.platform,
      })
    }
  }
}
