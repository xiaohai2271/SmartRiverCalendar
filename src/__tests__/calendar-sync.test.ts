import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock 平台依赖
vi.mock('@/platform/provider', () => ({
  usePlatform: () => ({
    syncRepo: {
      syncCalendarsFromServer: vi.fn().mockResolvedValue(true),
      triggerCloudSync: vi.fn().mockResolvedValue(true),
    },
    calendarRepo: {
      getAll: vi.fn().mockResolvedValue([
        { id: '1', name: '本地日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false },
        { id: '2', name: '在线日历', color: '#FF5733', type: 'online', visible: true, syncEnabled: true },
      ]),
      create: vi.fn().mockResolvedValue({ id: '1', name: '本地日历', color: '#4A90D9', type: 'local', visible: true, syncEnabled: false }),
    },
    eventRepo: {
      getAll: vi.fn().mockResolvedValue([]),
    },
    authRepo: {
      login: vi.fn().mockResolvedValue({ userId: 1, accessToken: 'token', refreshToken: 'refresh', expiresIn: 3600 }),
      getCurrentUser: vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com', displayName: '测试用户' }),
      getPublicKey: vi.fn().mockResolvedValue('mock-public-key'),
    },
  }),
}))

// Mock RSA 加密服务
vi.mock('@/services/rsa', () => ({
  encryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  clearCachedPublicKey: vi.fn(),
}))

describe('Calendar Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should sync calendars after login', async () => {
    // 动态导入以避免循环依赖
    const { useAuthStore } = await import('@/stores/auth')
    const { useCalendarStore } = await import('@/stores/calendar')

    const authStore = useAuthStore()
    const calendarStore = useCalendarStore()

    // 模拟登录成功
    await authStore.login({ username: 'test@example.com', password: 'password' })

    // 验证日历同步触发
    expect(calendarStore.calendars.length).toBeGreaterThan(1)

    // 验证本地日历保留
    const localCalendar = calendarStore.calendars.find(c => c.type === 'local')
    expect(localCalendar).toBeDefined()

    // 验证服务端日历同步
    const serverCalendars = calendarStore.calendars.filter(c => c.type === 'online')
    expect(serverCalendars.length).toBeGreaterThan(0)
  })

  it('should return valid calendar ID', async () => {
    const { useCalendarStore } = await import('@/stores/calendar')
    const calendarStore = useCalendarStore()

    // 初始化日历
    await calendarStore.initialize()

    // 测试 getValidCalendarId
    const validId = calendarStore.getValidCalendarId(undefined)
    expect(validId).toBeGreaterThan(0)
  })

  it('should return specific calendar ID when provided', async () => {
    const { useCalendarStore } = await import('@/stores/calendar')
    const calendarStore = useCalendarStore()

    // 初始化日历
    await calendarStore.initialize()

    // 测试 getValidCalendarId with specific ID
    const validId = calendarStore.getValidCalendarId('2')
    expect(validId).toBe(2)
  })
})
