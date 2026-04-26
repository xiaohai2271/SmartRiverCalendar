import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @tauri-apps/api/core
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
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

// Mock window.__TAURI__ for Tauri 环境检测
const originalWindow = global.window

describe('设置服务 (SettingsService)', () => {
  let settingsService: typeof import('../services/settings')

  beforeEach(async () => {
    // 设置 Tauri 环境标志
    Object.defineProperty(global, 'window', {
      value: { __TAURI__: {} },
      writable: true
    })
    // 动态导入以确保 mock 生效
    settingsService = await import('../services/settings')
    // 重置缓存
    // @ts-ignore - 访问私有变量重置缓存
    settingsService._resetDbCache?.()
  })

  afterEach(() => {
    // 恢复 window
    Object.defineProperty(global, 'window', {
      value: originalWindow,
      writable: true
    })
  })

  describe('getSetting', () => {
    it('应该调用 invoke("get_setting", { key }) 并返回值', async () => {
      mockInvoke.mockResolvedValueOnce('test-value')

      const result = await settingsService.getSetting('test-key')

      expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'test-key' })
      expect(result).toBe('test-value')
    })

    it('应该返回 null 当值不存在', async () => {
      mockInvoke.mockResolvedValueOnce(null)

      const result = await settingsService.getSetting('nonexistent-key')

      expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'nonexistent-key' })
      expect(result).toBeNull()
    })

    it('应该返回 null 当 Tauri 环境不可用', async () => {
      // 模拟非 Tauri 环境
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      // 重新导入服务
      vi.resetModules()
      const noTauriService = await import('../services/settings')

      const result = await noTauriService.getSetting('test-key')

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('setSetting', () => {
    it('应该调用 invoke("set_setting", { key, value })', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await settingsService.setSetting('test-key', 'test-value')

      expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'test-key', value: 'test-value' })
    })

    it('应该直接返回当 Tauri 环境不可用', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      vi.resetModules()
      const noTauriService = await import('../services/settings')

      await noTauriService.setSetting('test-key', 'test-value')

      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe('getAllSettings', () => {
    it('应该调用 invoke("get_all_settings", { prefix }) 并返回键值对数组', async () => {
      const mockSettings = [['app.theme', 'dark'], ['app.language', 'zh']]
      mockInvoke.mockResolvedValueOnce(mockSettings)

      const result = await settingsService.getAllSettings('app.')

      expect(mockInvoke).toHaveBeenCalledWith('get_all_settings', { prefix: 'app.' })
      expect(result).toEqual(mockSettings)
    })

    it('应该返回空数组当无匹配设置', async () => {
      mockInvoke.mockResolvedValueOnce([])

      const result = await settingsService.getAllSettings('nonexistent.')

      expect(result).toEqual([])
    })

    it('应该返回空数组当 Tauri 环境不可用', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      vi.resetModules()
      const noTauriService = await import('../services/settings')

      const result = await noTauriService.getAllSettings('app.')

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })

  describe('addUserHoliday', () => {
    it('应该调用 invoke("add_user_holiday", ...) 添加节假日', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await settingsService.addUserHoliday('2025-01-01', '元旦', 'holiday', 'custom')

      expect(mockInvoke).toHaveBeenCalledWith('add_user_holiday', {
        date: '2025-01-01',
        name: '元旦',
        category: 'holiday',
        source: 'custom'
      })
    })

    it('应该默认 source 为 undefined', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await settingsService.addUserHoliday('2025-02-01', '自定义假日', 'holiday')

      expect(mockInvoke).toHaveBeenCalledWith('add_user_holiday', {
        date: '2025-02-01',
        name: '自定义假日',
        category: 'holiday',
        source: undefined
      })
    })

    it('应该支持添加补休日', async () => {
      mockInvoke.mockResolvedValueOnce(undefined)

      await settingsService.addUserHoliday('2025-03-01', '补班日', 'makeup', 'api')

      expect(mockInvoke).toHaveBeenCalledWith('add_user_holiday', {
        date: '2025-03-01',
        name: '补班日',
        category: 'makeup',
        source: 'api'
      })
    })
  })

  describe('removeUserHoliday', () => {
    it('应该调用 invoke("remove_user_holiday", ...) 并返回 true', async () => {
      mockInvoke.mockResolvedValueOnce(true)

      const result = await settingsService.removeUserHoliday('2025-01-01', 'holiday')

      expect(mockInvoke).toHaveBeenCalledWith('remove_user_holiday', {
        date: '2025-01-01',
        category: 'holiday'
      })
      expect(result).toBe(true)
    })

    it('应该返回 false 当删除失败', async () => {
      mockInvoke.mockResolvedValueOnce(false)

      const result = await settingsService.removeUserHoliday('2025-01-01', 'holiday')

      expect(result).toBe(false)
    })

    it('应该返回 false 当 Tauri 环境不可用', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      vi.resetModules()
      const noTauriService = await import('../services/settings')

      const result = await noTauriService.removeUserHoliday('2025-01-01', 'holiday')

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })
  })

  describe('getAllUserHolidays', () => {
    it('应该调用 invoke("get_all_user_holidays") 并返回节假日数组', async () => {
      const mockHolidays = [
        { date: '2025-01-01', name: '元旦', category: 'holiday', source: 'custom', created_at: 1704067200000 },
        { date: '2025-02-10', name: '春节', category: 'holiday', source: 'api', created_at: 1704067200000 }
      ]
      mockInvoke.mockResolvedValueOnce(mockHolidays)

      const result = await settingsService.getAllUserHolidays()

      expect(mockInvoke).toHaveBeenCalledWith('get_all_user_holidays')
      expect(result).toEqual(mockHolidays)
    })

    it('应该返回空数组当无节假日', async () => {
      mockInvoke.mockResolvedValueOnce([])

      const result = await settingsService.getAllUserHolidays()

      expect(result).toEqual([])
    })

    it('应该返回空数组当 Tauri 环境不可用', async () => {
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      vi.resetModules()
      const noTauriService = await import('../services/settings')

      const result = await noTauriService.getAllUserHolidays()

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })

  describe('isDatabaseAvailable', () => {
    it('首次调用成功应该返回 true', async () => {
      mockInvoke.mockResolvedValueOnce(null)

      const result = await settingsService.isDatabaseAvailable()

      expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: '__db_test__' })
      expect(result).toBe(true)
    })

    it('首次调用失败应该返回 false 并输出 warn 日志', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockInvoke.mockRejectedValueOnce(new Error('DB error'))

      const result = await settingsService.isDatabaseAvailable()

      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith('[settings] 数据库不可用，降级到 localStorage')
      warnSpy.mockRestore()
    })

    it('应该缓存检测结果', async () => {
      mockInvoke.mockResolvedValueOnce(null)

      // 第一次调用
      const result1 = await settingsService.isDatabaseAvailable()
      expect(result1).toBe(true)
      expect(mockInvoke).toHaveBeenCalledTimes(1)

      // 第二次调用（应该不再次 invoke）
      const result2 = await settingsService.isDatabaseAvailable()
      expect(result2).toBe(true)
      expect(mockInvoke).toHaveBeenCalledTimes(1) // 仍然只有 1 次
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
    it('数据库不可用时应该跳过迁移', async () => {
      // 模拟数据库不可用
      mockInvoke.mockRejectedValueOnce(new Error('DB error'))

      await settingsService.migrateLocalStorageToDb()

      // 只应该调用一次检测（isDatabaseAvailable）
      expect(mockInvoke).toHaveBeenCalledTimes(1)
    })

    it('已有数据时应该跳过迁移（幂等）', async () => {
      // isDatabaseAvailable 成功
      mockInvoke.mockResolvedValueOnce(null)
      // getAllSettings 返回已有数据
      mockInvoke.mockResolvedValueOnce([['app.theme', '"dark"']])

      localStorageStore['app-settings'] = '{"theme":"light"}'

      await settingsService.migrateLocalStorageToDb()

      // 不应该调用 setSetting
      expect(mockInvoke).not.toHaveBeenCalledWith('set_setting', expect.anything())
    })

    it('应该成功迁移 app-settings', async () => {
      // isDatabaseAvailable 成功
      mockInvoke.mockResolvedValueOnce(null)
      // getAllSettings 返回空（无已有数据）
      mockInvoke.mockResolvedValueOnce([])
      // setSetting 调用
      mockInvoke.mockResolvedValue(undefined)

      localStorageStore['app-settings'] = '{"theme":"dark","defaultView":"week"}'

      await settingsService.migrateLocalStorageToDb()

      expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'app.theme', value: '"dark"' })
      expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'app.defaultView', value: '"week"' })
    })

    it('应该成功迁移 popup-settings', async () => {
      mockInvoke.mockResolvedValueOnce(null) // isDatabaseAvailable
      mockInvoke.mockResolvedValueOnce([]) // getAllSettings
      mockInvoke.mockResolvedValue(undefined) // setSetting

      localStorageStore['popup-settings'] = '{"popupWindowSize":"medium"}'

      await settingsService.migrateLocalStorageToDb()

      expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'popup.popupWindowSize', value: '"medium"' })
    })

    it('应该成功迁移 user-holidays', async () => {
      mockInvoke.mockResolvedValueOnce(null) // isDatabaseAvailable
      mockInvoke.mockResolvedValueOnce([]) // getAllSettings
      mockInvoke.mockResolvedValue(undefined) // addUserHoliday

      localStorageStore['user-holidays'] = '{"holidays":{"2025-01-01":"元旦"},"makeupDays":{"2025-01-26":"春节补班"}}'

      await settingsService.migrateLocalStorageToDb()

      expect(mockInvoke).toHaveBeenCalledWith('add_user_holiday', {
        date: '2025-01-01',
        name: '元旦',
        category: 'holiday',
        source: 'custom'
      })
      expect(mockInvoke).toHaveBeenCalledWith('add_user_holiday', {
        date: '2025-01-26',
        name: '春节补班',
        category: 'makeup',
        source: 'custom'
      })
    })

    it('迁移失败时应该静默继续', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      mockInvoke.mockResolvedValueOnce(null) // isDatabaseAvailable
      mockInvoke.mockResolvedValueOnce([]) // getAllSettings
      mockInvoke.mockRejectedValueOnce(new Error('DB write error')) // setSetting 失败

      localStorageStore['app-settings'] = '{"theme":"dark"}'

      // 不应该抛出异常
      await expect(settingsService.migrateLocalStorageToDb()).resolves.toBeUndefined()

      consoleErrorSpy.mockRestore()
    })

    it('不应该清除 localStorage 数据', async () => {
      mockInvoke.mockResolvedValueOnce(null) // isDatabaseAvailable
      mockInvoke.mockResolvedValueOnce([]) // getAllSettings
      mockInvoke.mockResolvedValue(undefined) // setSetting

      localStorageStore['app-settings'] = '{"theme":"dark"}'

      await settingsService.migrateLocalStorageToDb()

      // localStorage 数据应该仍然存在
      expect(localStorageStore['app-settings']).toBe('{"theme":"dark"}')
    })
  })
})