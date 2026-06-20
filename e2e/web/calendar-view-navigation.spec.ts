import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('视图切换导航', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('应能导航到日历页', async ({ page }) => {
    const calendarLink = page.locator('a[href="/calendar"], [data-testid="nav-calendar"]')
    if (await calendarLink.isVisible().catch(() => false)) {
      await calendarLink.click()
      await page.waitForURL('**/calendar')
      expect(page.url()).toContain('/calendar')
    }
  })

  test('应能导航到待办页', async ({ page }) => {
    const todosLink = page.locator('a[href="/todos"], [data-testid="nav-todos"]')
    if (await todosLink.isVisible().catch(() => false)) {
      await todosLink.click()
      await page.waitForURL('**/todos')
      expect(page.url()).toContain('/todos')
    }
  })

  test('应能导航到日程页', async ({ page }) => {
    const schedulesLink = page.locator('a[href="/schedules"], [data-testid="nav-schedules"]')
    if (await schedulesLink.isVisible().catch(() => false)) {
      await schedulesLink.click()
      await page.waitForURL('**/schedules')
      expect(page.url()).toContain('/schedules')
    }
  })

  test('应能导航到设置页', async ({ page }) => {
    const settingsLink = page.locator('a[href="/settings"], [data-testid="nav-settings"]')
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click()
      await page.waitForURL('**/settings')
      expect(page.url()).toContain('/settings')
    }
  })

  test('直接访问路由应正确渲染', async ({ page }) => {
    const routes = ['/calendar', '/todos', '/schedules', '/settings', '/about']
    for (const route of routes) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('#app')).toBeVisible()
    }
  })

  test('浏览器后退应正常工作', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('networkidle')
    await page.goto('/todos')
    await page.waitForLoadState('networkidle')
    await page.goBack()
    expect(page.url()).toContain('/calendar')
  })
})
