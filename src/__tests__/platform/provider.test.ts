import { describe, it, expect, beforeEach } from 'vitest'
import { initPlatform, usePlatform, useCapabilities, _resetProvider } from '@/platform/provider'
import type { PlatformProvider } from '@/platform/provider'
import type { PlatformCapabilities } from '@/platform/capabilities'
import type {
  ICalendarRepository,
  IEventRepository,
  ITodoRepository,
  ISettingsRepository,
  IAuthRepository,
  ISyncRepository,
  IReminderRepository,
} from '@/platform/types'

// 测试用 mock
const mockCaps: PlatformCapabilities = {
  hasLocalDatabase: false,
  hasOfflineMode: false,
  dataPriority: 'remote-first',
  hasReminderPopup: false,
  hasSystemNotification: true,
  hasSnoozeReminder: false,
  hasExchangeSupport: false,
  hasCalDavSupport: false,
  hasExternalSync: false,
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasAlwaysOnTop: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,
  hasSsoLogin: false,
  hasBackgroundSync: false,
  hasIncrementalSync: false,
  hasClientConflictResolution: false,
}

const mockProvider: PlatformProvider = {
  capabilities: mockCaps,
  calendarRepo: {} as ICalendarRepository,
  eventRepo: {} as IEventRepository,
  todoRepo: {} as ITodoRepository,
  settingsRepo: {} as ISettingsRepository,
  authRepo: {} as IAuthRepository,
  syncRepo: {} as ISyncRepository,
  reminderRepo: {} as IReminderRepository,
}

describe('PlatformProvider', () => {
  beforeEach(() => {
    _resetProvider()
  })

  it('usePlatform 在未初始化时应抛出错误', () => {
    expect(() => usePlatform()).toThrow('[Platform] Provider 未初始化')
  })

  it('initPlatform 应正确初始化', () => {
    initPlatform(mockProvider)
    const provider = usePlatform()
    expect(provider.capabilities.dataPriority).toBe('remote-first')
  })

  it('useCapabilities 应返回能力声明', () => {
    initPlatform(mockProvider)
    const caps = useCapabilities()
    expect(caps.hasLocalDatabase).toBe(false)
    expect(caps.hasSystemNotification).toBe(true)
  })

  it('重复初始化应被忽略', () => {
    initPlatform(mockProvider)
    const caps2: PlatformCapabilities = { ...mockCaps, dataPriority: 'local-first' }
    const provider2: PlatformProvider = { ...mockProvider, capabilities: caps2 }
    initPlatform(provider2)
    // 仍然是第一次初始化的值
    expect(useCapabilities().dataPriority).toBe('remote-first')
  })
})
