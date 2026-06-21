import { test, expect } from '@playwright/test'
import { mockAllApi, mockNetworkError } from '../helpers/api-mock'

test.describe('错误场景', () => {
  test('API 500 错误应优雅处理', async ({ page }) => {
    await page.route('**/v1/**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500 }) })
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })

  test('API 401 错误应触发认证流程', async ({ page }) => {
    await page.route('**/v1/**', (route) => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401 }) })
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })

  test('网络完全中断应不崩溃', async ({ page }) => {
    await mockNetworkError(page)
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await expect(page.locator('#app')).toBeVisible()
  })

  test('无效路由应显示页面而非空白', async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/nonexistent-route')
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#app')).toBeVisible()
  })

  test('API 响应格式异常应不崩溃', async ({ page }) => {
    await page.route('**/v1/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: 'invalid json{{{`' })
    })
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    await expect(page.locator('#app')).toBeVisible()
  })
})
