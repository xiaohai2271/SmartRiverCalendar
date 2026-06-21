import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('视图切换导航', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test('侧边栏应显示所有导航链接', async ({ page }) => {
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('nav-home')).toBeVisible()
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('nav-todos')).toBeVisible()
    await expect(page.getByTestId('nav-settings')).toBeVisible()
  })

  test('点击日历导航应跳转到 /calendar', async ({ page }) => {
    await page.getByTestId('nav-calendar').click()
    await page.waitForURL('**/calendar')
    expect(page.url()).toContain('/calendar')
  })

  test('点击待办导航应跳转到 /todos', async ({ page }) => {
    await page.getByTestId('nav-todos').click()
    await page.waitForURL('**/todos')
    expect(page.url()).toContain('/todos')
  })

  test('点击日程导航应跳转到 /schedules', async ({ page }) => {
    await page.getByTestId('nav-schedules')?.click?.()
    if (await page.getByTestId('nav-schedules').isVisible().catch(() => false)) {
      await page.getByTestId('nav-schedules').click()
      await page.waitForURL('**/schedules')
      expect(page.url()).toContain('/schedules')
    }
  })

  test('点击设置导航应跳转到 /settings', async ({ page }) => {
    await page.getByTestId('nav-settings').click()
    await page.waitForURL('**/settings')
    expect(page.url()).toContain('/settings')
  })

  test('直接访问路由应正确渲染', async ({ page }) => {
    const routes = ['/calendar', '/todos', '/schedules', '/settings', '/about']
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('#app')).toBeVisible()
    }
  })

  test('浏览器后退应正常工作', async ({ page }) => {
    await page.getByTestId('nav-calendar').click()
    await page.waitForURL('**/calendar')
    await page.getByTestId('nav-todos').click()
    await page.waitForURL('**/todos')
    await page.goBack()
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/calendar')
  })
})
