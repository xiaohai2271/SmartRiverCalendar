import type { PlatformProvider } from '../provider'
import { tauriCapabilities } from './capabilities'
import { TauriCalendarRepository } from './calendar.repo'
import { TauriEventRepository } from './event.repo'
import { TauriTodoRepository } from './todo.repo'
import { TauriSettingsRepository } from './settings.repo'
import { TauriAuthRepository } from './auth.repo'
import { TauriSyncRepository } from './sync.repo'

/** 创建 Tauri 平台 Provider */
export function createTauriProvider(): PlatformProvider {
  return {
    capabilities: tauriCapabilities,
    calendarRepo: new TauriCalendarRepository(),
    eventRepo: new TauriEventRepository(),
    todoRepo: new TauriTodoRepository(),
    settingsRepo: new TauriSettingsRepository(),
    authRepo: new TauriAuthRepository(),
    syncRepo: new TauriSyncRepository(),
  }
}
