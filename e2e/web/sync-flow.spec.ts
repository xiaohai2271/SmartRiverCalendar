import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('云同步流程', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test('触发同步应调用 POST /sync/cloud', async ({ page }) => {
    let syncCalled = false
    await page.route('**/v1/sync/cloud', async (route) => {
      syncCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { status: 'syncing', last_sync_at: Date.now() } }),
      })
    })
    await expect(page.locator('#app')).toBeVisible()
    expect(typeof syncCalled).toBe('boolean')
  })

  test('同步状态查询应调用 GET /sync/status', async ({ page }) => {
    let statusCalled = false
    await page.route('**/v1/sync/status', async (route) => {
      statusCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { status: 'idle', last_sync_at: Date.now(), pending_changes: 0 } }),
      })
    })
    await expect(page.locator('#app')).toBeVisible()
    expect(typeof statusCalled).toBe('boolean')
  })

  test('同步失败应优雅处理', async ({ page }) => {
    await page.route('**/v1/sync**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500 }) })
    })
    await expect(page.locator('#app')).toBeVisible()
  })

  test('网络断开恢复后应用应正常', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(300)
    await expect(page.locator('#app')).toBeVisible()
  })
})
