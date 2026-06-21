import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ISettingsRepository } from '@/platform/types/settings.repository'
import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'
import { _resetProvider } from '@/platform/provider'

// Mock settingsRepo
const mockSettingsRepo: ISettingsRepository = {
  loadAppSettings: vi.fn(),
  saveAppSettings: vi.fn(),
  loadPopupSettings: vi.fn(),
  savePopupSettings: vi.fn(),
  getUserHolidays: vi.fn(),
  addUserHoliday: vi.fn(),
  removeUserHoliday: vi.fn(),
  migrateFromLocalStorage: vi.fn(),
}

// Mock capabilities
const mockCapabilities = {
  hasLocalDatabase: true,
  hasOfflineMode: true,
  dataPriority: 'local-first' as const,
  hasReminderPopup: true,
  hasSystemNotification: true,
  hasSnoozeReminder: true,
  hasSystemTray: true,
  hasAutoStart: true,
  hasClockHook: true,
  hasMultiWindow: true,
  hasAutoUpdate: true,
  hasMinimizeToTray: true,
  hasProxySettings: true,
  hasOAuthCallback: true,
  hasSsoLogin: false,
  hasExchangeSupport: true,
  hasCalDavSupport: true,
  hasExternalSync: true,
  hasAlwaysOnTop: true,
  hasBackgroundSync: true,
  hasIncrementalSync: false,
  hasClientConflictResolution: true,
}

vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    capabilities: mockCapabilities,
    settingsRepo: mockSettingsRepo,
    authRepo: {},
    calendarRepo: {},
    eventRepo: {},
    todoRepo: {},
    syncRepo: {},
  }),
  useCapabilities: () => mockCapabilities,
  _resetProvider: vi.fn(),
}))

// Mock localStorage
let localStorageStore: Record<string, string> = {}

beforeEach(() => {
  vi.clearAllMocks()
  localStorageStore = {}
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => localStorageStore[key] ?? null)
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
    localStorageStore[key] = value
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('设置服务 (SettingsService)', () => {
  let settingsService: typeof import('../services/settings')

  beforeEach(async () => {
    vi.resetModules()
    settingsService = await import('../services/settings')
  })

  describe('loadAppSettings', () => {
    it('应该委托给 settingsRepo.loadAppSettings', async () => {
      const mockSettings: AppSettings = {
        theme: 'dark',
        defaultView: 'month',
        firstDayOfWeek: 1,
        defaultReminder: 15,
        startMinimized: false,
        autoStart: false,
        autoUpdate: true,
        showLunar: true,
        showLunarFestival: true,
        showSolarTerm: true,
        showHoliday: true,
        showMakeupDay: true,
        showWeekend: true,
        monthEventDisplayStyle: 'dot',
        allDayReminderTime: 'morning',
        allDayReminderHour: 9,
        reminderMode: 'standard',
        customReminderTitle: '',
        customReminderBody: '',
        clockHookEnabled: false,
        clockHookBlockPopup: false,
        proxyMode: 'none',
        proxyHost: '',
        proxyPort: 0,
        proxyUsername: '',
        proxyPassword: '',
      }
      vi.mocked(mockSettingsRepo.loadAppSettings).mockResolvedValueOnce(mockSettings)

      const result = await settingsService.loadAppSettings()

      expect(mockSettingsRepo.loadAppSettings).toHaveBeenCalled()
      expect(result).toEqual(mockSettings)
    })
  })

  describe('saveAppSettings', () => {
    it('应该委托给 settingsRepo.saveAppSettings', async () => {
      vi.mocked(mockSettingsRepo.saveAppSettings).mockResolvedValueOnce(undefined)
      const settings = {} as AppSettings

      await settingsService.saveAppSettings(settings)

      expect(mockSettingsRepo.saveAppSettings).toHaveBeenCalledWith(settings)
    })
  })

  describe('loadPopupSettings', () => {
    it('应该委托给 settingsRepo.loadPopupSettings', async () => {
      const mockPopup: PopupSettings = {
        popupShowLunar: true,
        popupShowLunarFestival: true,
        popupShowSolarTerm: true,
        popupShowHoliday: true,
        popupShowEvents: true,
        popupCalendarShowLunar: true,
        popupWindowSize: 'medium',
      }
      vi.mocked(mockSettingsRepo.loadPopupSettings).mockResolvedValueOnce(mockPopup)

      const result = await settingsService.loadPopupSettings()

      expect(mockSettingsRepo.loadPopupSettings).toHaveBeenCalled()
      expect(result).toEqual(mockPopup)
    })
  })

  describe('savePopupSettings', () => {
    it('应该委托给 settingsRepo.savePopupSettings', async () => {
      vi.mocked(mockSettingsRepo.savePopupSettings).mockResolvedValueOnce(undefined)
      const settings = {} as PopupSettings

      await settingsService.savePopupSettings(settings)

      expect(mockSettingsRepo.savePopupSettings).toHaveBeenCalledWith(settings)
    })
  })

  describe('getUserHolidays', () => {
    it('应该委托给 settingsRepo.getUserHolidays', async () => {
      const mockHolidays: UserHolidayEntry[] = [
        { date: '2025-01-01', name: '元旦', category: 'holiday', source: 'custom', createdAt: 1704067200000 },
      ]
      vi.mocked(mockSettingsRepo.getUserHolidays).mockResolvedValueOnce(mockHolidays)

      const result = await settingsService.getUserHolidays()

      expect(mockSettingsRepo.getUserHolidays).toHaveBeenCalled()
      expect(result).toEqual(mockHolidays)
    })
  })

  describe('addUserHoliday', () => {
    it('应该委托给 settingsRepo.addUserHoliday', async () => {
      vi.mocked(mockSettingsRepo.addUserHoliday).mockResolvedValueOnce(undefined)

      await settingsService.addUserHoliday('2025-01-01', '元旦', 'holiday', 'custom')

      expect(mockSettingsRepo.addUserHoliday).toHaveBeenCalledWith('2025-01-01', '元旦', 'holiday', 'custom')
    })

    it('应该默认 source 为 undefined', async () => {
      vi.mocked(mockSettingsRepo.addUserHoliday).mockResolvedValueOnce(undefined)

      await settingsService.addUserHoliday('2025-02-01', '自定义假日', 'holiday')

      expect(mockSettingsRepo.addUserHoliday).toHaveBeenCalledWith('2025-02-01', '自定义假日', 'holiday', undefined)
    })
  })

  describe('removeUserHoliday', () => {
    it('应该委托给 settingsRepo.removeUserHoliday', async () => {
      vi.mocked(mockSettingsRepo.removeUserHoliday).mockResolvedValueOnce(true)

      const result = await settingsService.removeUserHoliday('2025-01-01', 'holiday')

      expect(mockSettingsRepo.removeUserHoliday).toHaveBeenCalledWith('2025-01-01', 'holiday')
      expect(result).toBe(true)
    })

    it('应该返回 false 当删除失败', async () => {
      vi.mocked(mockSettingsRepo.removeUserHoliday).mockResolvedValueOnce(false)

      const result = await settingsService.removeUserHoliday('2025-01-01', 'holiday')

      expect(result).toBe(false)
    })
  })

  describe('isDatabaseAvailable', () => {
    it('有本地数据库时应该返回 true', () => {
      mockCapabilities.hasLocalDatabase = true

      const result = settingsService.isDatabaseAvailable()

      expect(result).toBe(true)
    })

    it('无本地数据库时应该返回 false', () => {
      mockCapabilities.hasLocalDatabase = false

      const result = settingsService.isDatabaseAvailable()

      expect(result).toBe(false)
    })

    it('重置后应反映最新能力', () => {
      mockCapabilities.hasLocalDatabase = true
      expect(settingsService.isDatabaseAvailable()).toBe(true)
      mockCapabilities.hasLocalDatabase = false
      expect(settingsService.isDatabaseAvailable()).toBe(false)
      // 还原
      mockCapabilities.hasLocalDatabase = true
    })
  })

  describe('loadFromLocalStorage', () => {
    it('应该从 localStorage 读取值', () => {
      localStorageStore['app-settings'] = '{"theme":"dark"}'

      const result = settingsService.loadFromLocalStorage('app-settings')

      expect(result).toBe('{"theme":"dark"}')
    })

    it('应该返回 null 当键不存在', () => {
      const result = settingsService.loadFromLocalStorage('nonexistent-key')

      expect(result).toBeNull()
    })

    it('应该捕获 localStorage 错误并返回 null', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

      const result = settingsService.loadFromLocalStorage('test-key')

      expect(result).toBeNull()
    })
  })

  describe('migrateLocalStorageToDb', () => {
    it('有 migrateFromLocalStorage 时应该委托', async () => {
      vi.mocked(mockSettingsRepo.migrateFromLocalStorage).mockResolvedValueOnce(undefined)

      await settingsService.migrateLocalStorageToDb()

      expect(mockSettingsRepo.migrateFromLocalStorage).toHaveBeenCalled()
    })

    it('没有 migrateFromLocalStorage 时不报错', async () => {
      const repoWithoutMigrate = { ...mockSettingsRepo, migrateFromLocalStorage: undefined }

      vi.doMock('@/platform/provider', () => ({
        usePlatform: () => ({
          capabilities: mockCapabilities,
          settingsRepo: repoWithoutMigrate,
          authRepo: {},
          calendarRepo: {},
          eventRepo: {},
          todoRepo: {},
          syncRepo: {},
        }),
        useCapabilities: () => mockCapabilities,
        _resetProvider: vi.fn(),
      }))

      vi.resetModules()
      const service = await import('../services/settings')

      await expect(service.migrateLocalStorageToDb()).resolves.toBeUndefined()
    })
  })
})
