import type { PlatformCapabilities } from '../capabilities'

/** 桌面端能力声明 */
export const tauriCapabilities: PlatformCapabilities = {
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
}
