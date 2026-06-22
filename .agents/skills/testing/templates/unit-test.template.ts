// 单元测试模板 — 用于业务逻辑、工具函数、Store 测试
// 位置：src/__tests__/<module-name>.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('<模块名>', () => {
  beforeEach(() => {
    // 每个测试前的初始化
  })

  afterEach(() => {
    // 每个测试后的清理
    vi.clearAllMocks()
  })

  describe('<功能分组>', () => {
    it('应 <预期行为>', () => {
      // Arrange — 准备测试数据
      // Act — 执行被测逻辑
      // Assert — 验证结果
      expect(true).toBe(true)
    })

    it('边界条件：应处理 <边界情况>', () => {
      // 测试边界值、空值、极端情况
    })

    it('错误处理：应抛出 <预期错误>', () => {
      // 验证错误处理逻辑
      expect(() => {
        // 触发错误的操作
      }).toThrow()
    })
  })
})

// ── Store 测试模式 ──
// Store 测试通过 mock Repository 接口，不依赖平台环境
//
// ⚠️ 重要：Store 模块必须使用动态导入，确保 mock 在 store 加载前生效
// 正确：
// const { useXxxStore } = await import('../stores/xxx')
// 错误（mock 可能失效）：
// import { useXxxStore } from '../stores/xxx'
//
// 完整 mock 示例：
// import { usePlatform } from '@/platform/provider'
// vi.mock('@/platform/provider', () => ({
//   usePlatform: () => ({
//     authRepo: {
//       login: vi.fn(),
//       register: vi.fn(),
//       logout: vi.fn(),
//       getCurrentUser: vi.fn(),
//       checkAuthStatus: vi.fn(),
//       refreshToken: vi.fn(),
//       getPublicKey: vi.fn(),
//       detectSsoSession: vi.fn(),
//       notifySsoEvent: vi.fn(),
//       subscribeSsoEvents: vi.fn(),
//       loginWithOAuth: vi.fn(),
//     },
//     calendarRepo: {
//       getAll: vi.fn(),
//       create: vi.fn(),
//       update: vi.fn(),
//       delete: vi.fn(),
//       updateType: vi.fn(),
//     },
//     eventRepo: {
//       getAll: vi.fn(),
//       getByCalendarId: vi.fn(),
//       getByTimeRange: vi.fn(),
//       create: vi.fn(),
//       update: vi.fn(),
//       delete: vi.fn(),
//     },
//     todoRepo: {
//       getAll: vi.fn(),
//       getByCalendarId: vi.fn(),
//       create: vi.fn(),
//       update: vi.fn(),
//       delete: vi.fn(),
//     },
//     settingsRepo: {
//       loadAppSettings: vi.fn(),
//       saveAppSettings: vi.fn(),
//       loadPopupSettings: vi.fn(),
//       savePopupSettings: vi.fn(),
//       getUserHolidays: vi.fn(),
//       addUserHoliday: vi.fn(),
//       removeUserHoliday: vi.fn(),
//       migrateFromLocalStorage: vi.fn(),
//     },
//     syncRepo: {
//       connectExchange: vi.fn(),
//       connectCalDAV: vi.fn(),
//       getAllAccounts: vi.fn(),
//       deleteAccount: vi.fn(),
//       getExternalCalendars: vi.fn(),
//       getExternalEvents: vi.fn(),
//       createExternalEvent: vi.fn(),
//       updateExternalEvent: vi.fn(),
//       deleteExternalEvent: vi.fn(),
//       triggerCloudSync: vi.fn(),
//       syncCalendarsFromServer: vi.fn(),
//       getSyncStatus: vi.fn(),
//       startAutoSync: vi.fn(),
//       stopAutoSync: vi.fn(),
//       recordPendingChange: vi.fn(),
//       pushPendingChanges: vi.fn(),
//     },
//   }),
//   useCapabilities: () => ({
//     hasLocalDatabase: false,
//     hasOfflineMode: false,
//     dataPriority: 'remote-first' as const,
//     hasReminderPopup: false,
//     hasSystemNotification: true,
//     hasSnoozeReminder: false,
//     hasExchangeSupport: false,
//     hasCalDavSupport: false,
//     hasExternalSync: false,
//     hasSystemTray: false,
//     hasAutoStart: false,
//     hasClockHook: false,
//     hasMultiWindow: false,
//     hasAutoUpdate: false,
//     hasAlwaysOnTop: false,
//     hasMinimizeToTray: false,
//     hasProxySettings: false,
//     hasOAuthCallback: false,
//     hasSsoLogin: false,
//     hasBackgroundSync: false,
//     hasIncrementalSync: false,
//     hasClientConflictResolution: false,
//   }),
// }))
//
// Store 测试断言示例：
// - 状态变更：expect(store.isAuthenticated).toBe(true)
// - Repository 调用：expect(mockAuthRepo.login).toHaveBeenCalledWith(...)
// - 错误处理：try { await store.login(...) } catch (e) { expect(e)... }
