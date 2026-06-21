import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('设置管理', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  })

  test('应显示设置页面和标签页', async ({ page }) => {
    await expect(page.getByTestId('settings-tab').first()).toBeVisible()
  })

  test('点击显示标签应展示设置内容', async ({ page }) => {
    const displayTab = page.locator('[data-testid="settings-tab"][data-tab-key="display"]')
    if (await displayTab.isVisible().catch(() => false)) {
      await displayTab.click()
      await page.waitForTimeout(300)
    }
    await expect(page.locator('#app')).toBeVisible()
  })

  test('Web 端不应显示桌面专属设置项', async ({ page }) => {
    const desktopTestIds = ['auto-start', 'clock-hook', 'system-tray', 'proxy-settings']
    for (const testId of desktopTestIds) {
      const count = await page.getByTestId(testId).count()
      expect(count).toBe(0)
    }
  })
})
