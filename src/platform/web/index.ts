import type { PlatformProvider } from '../provider'
import { webCapabilities } from './capabilities'
import { WebApiClient } from './api-client'
import { WebCalendarRepository } from './calendar.repo'
import { WebEventRepository } from './event.repo'
import { WebTodoRepository } from './todo.repo'
import { WebSettingsRepository } from './settings.repo'
import { WebAuthRepository } from './auth.repo'
import { WebSyncRepository } from './sync.repo'

/** 创建 Web 平台 Provider */
export function createWebProvider(): PlatformProvider {
  const apiClient = new WebApiClient()
  return {
    capabilities: webCapabilities,
    calendarRepo: new WebCalendarRepository(apiClient),
    eventRepo: new WebEventRepository(apiClient),
    todoRepo: new WebTodoRepository(apiClient),
    settingsRepo: new WebSettingsRepository(apiClient),
    authRepo: new WebAuthRepository(apiClient),
    syncRepo: new WebSyncRepository(apiClient),
  }
}
