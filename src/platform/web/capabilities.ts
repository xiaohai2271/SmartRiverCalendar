import type { PlatformCapabilities } from '../capabilities'

/** Web 端能力声明 */
export const webCapabilities: PlatformCapabilities = {
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
}
