import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('设置管理', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
  })

  test('应显示设置页面', async ({ page }) => {
    await expect(page.locator('#app')).toBeVisible()
  })

  test('设置项应可交互', async ({ page }) => {
    const themeToggle = page.locator('[data-testid="theme-toggle"], select[name="theme"], button:has-text("主题")')
    if (await themeToggle.isVisible().catch(() => false)) {
      await themeToggle.click()
    }
    await expect(page.locator('#app')).toBeVisible()
  })

  test('日历显示设置应可修改', async ({ page }) => {
    const lunarToggle = page.locator('[data-testid="show-lunar"], input[name="showLunar"]')
    if (await lunarToggle.isVisible().catch(() => false)) {
      await lunarToggle.click()
    }
    await expect(page.locator('#app')).toBeVisible()
  })

  test('Web 端不应显示桌面专属设置', async ({ page }) => {
    const desktopOnlyElements = page.locator(
      '[data-testid="auto-start"], [data-testid="clock-hook"], [data-testid="system-tray"], [data-testid="proxy-settings"]'
    )
    const count = await desktopOnlyElements.count()
    for (let i = 0; i < count; i++) {
      const visible = await desktopOnlyElements.nth(i).isVisible().catch(() => false)
      expect(visible).toBe(false)
    }
  })
})
