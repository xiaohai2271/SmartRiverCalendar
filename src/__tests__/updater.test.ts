import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSkippedVersion,
  setSkippedVersion,
  clearSkippedVersion,
  isVersionSkipped,
  checkForUpdateDetails,
  startUpdate,
} from '@/services/updater'
import type { UpdateInfo } from '@/types'

// Mock capabilities — 默认支持自动更新
const mockCapabilities = {
  hasAutoUpdate: true,
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
  useCapabilities: () => mockCapabilities,
}))

// Mock @tauri-apps/plugin-updater
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}))

describe('跳过版本工具函数', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getSkippedVersion', () => {
    it('当没有跳过版本时，应该返回 null', () => {
      const result = getSkippedVersion()
      expect(result).toBeNull()
    })

    it('当有跳过版本时，应该返回版本号字符串', () => {
      localStorage.setItem('skippedUpdateVersion', '1.2.3')
      const result = getSkippedVersion()
      expect(result).toBe('1.2.3')
    })
  })

  describe('setSkippedVersion', () => {
    it('应该能够设置跳过的版本', () => {
      setSkippedVersion('2.0.0')
      expect(localStorage.getItem('skippedUpdateVersion')).toBe('2.0.0')
    })

    it('应该能够覆盖已存在的版本', () => {
      setSkippedVersion('1.0.0')
      setSkippedVersion('2.0.0')
      expect(localStorage.getItem('skippedUpdateVersion')).toBe('2.0.0')
    })
  })

  describe('clearSkippedVersion', () => {
    it('应该能够清除跳过的版本记录', () => {
      localStorage.setItem('skippedUpdateVersion', '1.0.0')
      clearSkippedVersion()
      expect(localStorage.getItem('skippedUpdateVersion')).toBeNull()
    })

    it('当没有跳过版本时，调用 clear 应该不报错', () => {
      expect(() => {
        clearSkippedVersion()
      }).not.toThrow()
    })
  })

  describe('isVersionSkipped', () => {
    it('当版本被跳过时，应该返回 true', () => {
      localStorage.setItem('skippedUpdateVersion', '1.5.0')
      expect(isVersionSkipped('1.5.0')).toBe(true)
    })

    it('当版本未被跳过时，应该返回 false', () => {
      localStorage.setItem('skippedUpdateVersion', '1.5.0')
      expect(isVersionSkipped('1.6.0')).toBe(false)
    })

    it('当没有跳过任何版本时，应该返回 false', () => {
      expect(isVersionSkipped('1.0.0')).toBe(false)
    })
  })
})

describe('checkForUpdateDetails', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockCapabilities.hasAutoUpdate = true
  })

  it('有更新时应该返回 UpdateInfo 对象', async () => {
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce({
      version: '2.0.0',
      date: '2024-01-15',
      body: '修复了一些问题',
      downloadAndInstall: vi.fn(),
    } as any)

    const result = await checkForUpdateDetails()

    expect(result).toEqual({
      version: '2.0.0',
      date: '2024-01-15',
      body: '修复了一些问题',
    })
  })

  it('无更新时应该返回 null', async () => {
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce(null)

    const result = await checkForUpdateDetails()

    expect(result).toBeNull()
  })

  it('被跳过的版本应该返回 null', async () => {
    localStorage.setItem('skippedUpdateVersion', '2.0.0')
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce({
      version: '2.0.0',
      date: '2024-01-15',
      body: '修复了一些问题',
      downloadAndInstall: vi.fn(),
    } as any)

    const result = await checkForUpdateDetails()

    expect(result).toBeNull()
  })

  it('网络错误时应该静默返回 null', async () => {
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockRejectedValueOnce(new Error('网络错误'))

    const result = await checkForUpdateDetails()

    expect(result).toBeNull()
  })

  it('不支持自动更新时应该返回 null', async () => {
    mockCapabilities.hasAutoUpdate = false

    const result = await checkForUpdateDetails()

    expect(result).toBeNull()
    // 还原
    mockCapabilities.hasAutoUpdate = true
  })
})

describe('startUpdate', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockCapabilities.hasAutoUpdate = true
  })

  it('成功下载并安装更新', async () => {
    const mockDownloadAndInstall = vi.fn()
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce({
      version: '2.0.0',
      date: '2024-01-15',
      body: '修复了一些问题',
      downloadAndInstall: mockDownloadAndInstall,
    } as any)

    const updateInfo: UpdateInfo = {
      version: '2.0.0',
      date: '2024-01-15',
      body: '修复了一些问题',
    }

    await startUpdate(updateInfo)

    expect(mockDownloadAndInstall).toHaveBeenCalled()
  })

  it('无法获取更新信息时应该抛出错误', async () => {
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce(null)

    const updateInfo: UpdateInfo = {
      version: '2.0.0',
    }

    await expect(startUpdate(updateInfo)).rejects.toThrow('无法获取更新信息')
  })

  it('版本不匹配时应该抛出错误', async () => {
    const { check } = await import('@tauri-apps/plugin-updater')
    vi.mocked(check).mockResolvedValueOnce({
      version: '3.0.0',
      downloadAndInstall: vi.fn(),
    } as any)

    const updateInfo: UpdateInfo = {
      version: '2.0.0',
    }

    await expect(startUpdate(updateInfo)).rejects.toThrow('无法获取更新信息')
  })

  it('不支持自动更新时应该抛出错误', async () => {
    mockCapabilities.hasAutoUpdate = false

    const updateInfo: UpdateInfo = {
      version: '2.0.0',
    }

    await expect(startUpdate(updateInfo)).rejects.toThrow('当前平台不支持自动更新')

    // 还原
    mockCapabilities.hasAutoUpdate = true
  })
})
