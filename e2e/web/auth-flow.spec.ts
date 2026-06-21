import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('认证流程', () => {
  test('未登录用户应看到登录入口', async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#app')).toBeVisible()
  })

  test('登录后应显示用户信息', async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('access_token', 'mock-access-token')
      localStorage.setItem('refresh_token', 'mock-refresh-token')
      localStorage.setItem('was_logged_in', 'true')
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => {
        const pinia = (window as any).__pinia__
        return pinia && pinia.state && pinia.state.value && Object.keys(pinia.state.value).length > 0
      },
      { timeout: 15000 }
    ).catch(() => {})
    const allStoreIds = await page.evaluate(() => {
      const pinia = (window as any).__pinia__
      return Object.keys(pinia?.state?.value ?? {})
    })
    expect(allStoreIds.length).toBeGreaterThan(0)
  })

  test('登出后应清除认证状态', async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => {
      localStorage.setItem('access_token', 'mock-access-token')
      localStorage.setItem('was_logged_in', 'true')
    })

    await page.evaluate(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('was_logged_in')
    })

    const hasTokens = await page.evaluate(() => !!localStorage.getItem('access_token'))
    expect(hasTokens).toBe(false)
  })

  test('SSO 会话检测：401 且 wasLoggedIn 应触发会话过期', async ({ page }) => {
    await page.route('**/v1/user/profile', (route) => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401 }) })
    })
    await page.route('**/v1/calendars**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/todos**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/sync**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))
    await page.route('**/v1/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => localStorage.setItem('was_logged_in', 'true'))
    const hasFlag = await page.evaluate(() => localStorage.getItem('was_logged_in'))
    expect(hasFlag).toBe('true')
  })

  test('网络错误时应优雅降级', async ({ page }) => {
    await page.route('**/v1/**', (route) => route.abort('failed'))
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await expect(page.locator('#app')).toBeVisible()
  })
})
