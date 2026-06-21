import { describe, it, expect } from 'vitest'
import type { PlatformCapabilities } from '@/platform/capabilities'

describe('PlatformCapabilities', () => {
  it('应包含数据存储相关能力', () => {
    const caps: PlatformCapabilities = {
      hasLocalDatabase: true,
      hasOfflineMode: true,
      dataPriority: 'local-first',
      hasReminderPopup: true,
      hasSystemNotification: true,
      hasSnoozeReminder: true,
      hasExchangeSupport: true,
      hasCalDavSupport: true,
      hasExternalSync: true,
      hasSystemTray: true,
      hasAutoStart: true,
      hasClockHook: true,
      hasMultiWindow: true,
      hasAutoUpdate: true,
      hasAlwaysOnTop: true,
      hasMinimizeToTray: true,
      hasProxySettings: true,
      hasOAuthCallback: true,
      hasSsoLogin: true,
      hasBackgroundSync: true,
      hasIncrementalSync: false,
      hasClientConflictResolution: true,
    }
    expect(caps.hasLocalDatabase).toBe(true)
    expect(caps.dataPriority).toBe('local-first')
  })

  it('Web 端能力应合理降级', () => {
    const caps: PlatformCapabilities = {
      hasLocalDatabase: false,
      hasOfflineMode: false,
      dataPriority: 'remote-first',
      hasReminderPopup: false,
      hasSystemNotification: true,
      hasSnoozeReminder: false,
      hasExchangeSupport: true,
      hasCalDavSupport: true,
      hasExternalSync: true,
      hasSystemTray: false,
      hasAutoStart: false,
      hasClockHook: false,
      hasMultiWindow: false,
      hasAutoUpdate: false,
      hasAlwaysOnTop: false,
      hasMinimizeToTray: false,
      hasProxySettings: false,
      hasOAuthCallback: false,
      hasSsoLogin: true,
      hasBackgroundSync: false,
      hasIncrementalSync: false,
      hasClientConflictResolution: false,
    }
    expect(caps.hasLocalDatabase).toBe(false)
    expect(caps.hasSystemNotification).toBe(true)
  })
})
