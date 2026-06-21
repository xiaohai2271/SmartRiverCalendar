import type { ITodoRepository } from '../types/todo.repository'
import type { Todo } from '@/types'
import { WebApiClient } from './api-client'
import { transformWebTodo, type ApiResponse, type PageResponse, type WebTodo } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

/** Web 待办 Repository 实现 */
export class WebTodoRepository implements ITodoRepository {
  private readonly platform = 'web' as const
  private readonly apiClient: WebApiClient

  constructor(apiClient: WebApiClient) {
    this.apiClient = apiClient
  }

  async getAll(): Promise<Todo[]> {
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebTodo>>>('/todos')
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取待办列表',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebTodo)
  }

  async getByCalendarId(calendarId: number): Promise<Todo[]> {
    const response = await this.apiClient.get<ApiResponse<PageResponse<WebTodo>>>(`/todos?calendar_id=${calendarId}`)
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法获取日历待办',
        platform: this.platform,
      })
    }
    return response.data.items.map(transformWebTodo)
  }

  async create(params: {
    title: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId: number
  }): Promise<Todo> {
    const response = await this.apiClient.post<ApiResponse<WebTodo>>('/todos', {
      title: params.title,
      description: params.description ?? null,
      due_date: params.dueDate ?? null,
      completed: params.completed ?? null,
      priority: params.priority ?? null,
      calendar_id: params.calendarId,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法创建待办',
        platform: this.platform,
      })
    }
    return transformWebTodo(response.data)
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
    const response = await this.apiClient.put<ApiResponse<WebTodo>>(`/todos/${params.id}`, {
      title: params.title,
      description: params.description,
      due_date: params.dueDate,
      completed: params.completed,
      priority: params.priority,
    })
    if (response.code !== 0 || !response.data) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法更新待办',
        platform: this.platform,
      })
    }
    return transformWebTodo(response.data)
  }

  async delete(id: number): Promise<void> {
    const response = await this.apiClient.delete<ApiResponse<null>>(`/todos/${id}`)
    if (response.code !== 0) {
      throw new RepositoryError({
        code: RepoErrorCodes.NETWORK_ERROR,
        message: response.message || '无法删除待办',
        platform: this.platform,
      })
    }
  }
}
