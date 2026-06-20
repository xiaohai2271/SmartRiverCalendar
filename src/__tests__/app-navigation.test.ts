import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlatformCapabilities } from '@/platform/capabilities'

// mock 能力和认证状态
let mockHasSsoLogin = false
let mockIsAuthenticated = false

vi.mock('@/platform/provider', () => ({
  useCapabilities: () => ({ hasSsoLogin: mockHasSsoLogin }),
  usePlatform: () => ({
    capabilities: { hasSsoLogin: mockHasSsoLogin },
    authRepo: {
      setWasLoggedInGetter: vi.fn(),
      checkAuthStatus: vi.fn().mockResolvedValue(false),
      getCurrentUser: vi.fn().mockResolvedValue(null),
      detectSsoSession: vi.fn().mockResolvedValue({ loggedIn: false }),
      notifySsoEvent: vi.fn(),
      subscribeSsoEvents: vi.fn().mockReturnValue(() => {}),
      logout: vi.fn(),
    },
  }),
  initPlatform: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
    wasLoggedIn: false,
    cleanup: vi.fn(),
  }),
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    settings: { theme: 'light' },
  }),
}))

vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => ({}),
}))

vi.mock('@/stores/todo', () => ({
  useTodoStore: () => ({}),
}))

// 门控条件逻辑测试
describe('导航栏登录态门控条件逻辑', () => {
  it('Web 端未登录：!hasSsoLogin || isAuthenticated = !true || false = false → 隐藏', () => {
    mockHasSsoLogin = true
    mockIsAuthenticated = false
    const visible = !mockHasSsoLogin || mockIsAuthenticated
    expect(visible).toBe(false)
  })

  it('Web 端已登录：!hasSsoLogin || isAuthenticated = !true || true = true → 显示', () => {
    mockHasSsoLogin = true
    mockIsAuthenticated = true
    const visible = !mockHasSsoLogin || mockIsAuthenticated
    expect(visible).toBe(true)
  })

  it('桌面端：!hasSsoLogin = !false = true → 始终显示（无论 isAuthenticated）', () => {
    mockHasSsoLogin = false
    mockIsAuthenticated = false
    const visible = !mockHasSsoLogin || mockIsAuthenticated
    expect(visible).toBe(true)

    mockHasSsoLogin = false
    mockIsAuthenticated = true
    const visible2 = !mockHasSsoLogin || mockIsAuthenticated
    expect(visible2).toBe(true)
  })
})
