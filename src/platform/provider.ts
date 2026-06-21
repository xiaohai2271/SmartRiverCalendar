import type { PlatformCapabilities } from './capabilities'
import type {
  ICalendarRepository,
  IEventRepository,
  ITodoRepository,
  ISettingsRepository,
  IAuthRepository,
  ISyncRepository,
  IReminderRepository,
} from './types'

/** 平台 Provider：聚合所有 Repository 实现和能力声明 */
export interface PlatformProvider {
  readonly capabilities: PlatformCapabilities
  readonly calendarRepo: ICalendarRepository
  readonly eventRepo: IEventRepository
  readonly todoRepo: ITodoRepository
  readonly settingsRepo: ISettingsRepository
  readonly authRepo: IAuthRepository
  readonly syncRepo: ISyncRepository
  readonly reminderRepo: IReminderRepository
}

// 全局单例
let _provider: PlatformProvider | null = null

/** 初始化平台 Provider（应用启动时调用一次） */
export function initPlatform(provider: PlatformProvider): void {
  if (_provider) {
    console.warn('[Platform] Provider 已初始化，忽略重复调用')
    return
  }
  _provider = provider
  console.info('[Platform] 平台初始化完成:', provider.capabilities.dataPriority)
}

/** 获取当前平台 Provider */
export function usePlatform(): PlatformProvider {
  if (!_provider) {
    throw new Error('[Platform] Provider 未初始化，请先调用 initPlatform()')
  }
  return _provider
}

/** 获取平台能力（快捷方式） */
export function useCapabilities(): PlatformCapabilities {
  return usePlatform().capabilities
}

/** 重置 Provider（仅供测试使用） */
export function _resetProvider(): void {
  _provider = null
}
