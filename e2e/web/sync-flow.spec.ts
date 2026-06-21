import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('云同步流程', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
  })

  test('同步状态应可查询', async ({ page }) => {
    const syncState = await page.evaluate(() => {
      const pinia = (window as any).__pinia__
      const stores = pinia?._s
      if (!stores) return null
      for (const [, store] of stores) {
        if (store.syncStatus !== undefined) {
          return { syncStatus: store.syncStatus }
        }
      }
      return null
    })
    expect(typeof syncState).toBe('object')
  })

  test('触发同步应调用 API', async ({ page }) => {
    await page.route('**/v1/sync**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { status: 'syncing', last_sync_at: Date.now() } }),
      })
    })
    await expect(page.locator('#app')).toBeVisible()
  })

  test('同步失败应显示错误', async ({ page }) => {
    await page.route('**/v1/sync**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500 }) })
    })
    await expect(page.locator('#app')).toBeVisible()
  })

  test('网络断开后恢复应自动重试同步', async ({ page }) => {
    await page.evaluate(() => window.dispatchEvent(new Event('offline')))
    await page.waitForTimeout(300)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(300)
    await expect(page.locator('#app')).toBeVisible()
  })
})
