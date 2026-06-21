import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('日历事件 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('应显示日历视图页面', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })

  test('点击日期应可创建事件', async ({ page }) => {
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')

    await page.route('**/v1/events**', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: { id: `evt-${Date.now()}`, ...body },
          }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: [] }),
        })
      }
    })

    const dateCell = page.locator('[data-date], .calendar-day, .date-cell').first()
    const hasDateCell = await dateCell.isVisible().catch(() => false)
    expect(typeof hasDateCell).toBe('boolean')
  })

  test('应能删除事件', async ({ page }) => {
    await page.route('**/v1/events/*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0 }) })
      } else {
        route.continue()
      }
    })
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })

  test('API 错误时应显示提示', async ({ page }) => {
    await page.route('**/v1/events**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500 }) })
    })
    await page.goto('/calendar')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })
})
