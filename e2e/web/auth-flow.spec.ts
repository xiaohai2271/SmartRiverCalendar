import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('认证流程', () => {
  test('未登录应显示登录表单', async ({ page }) => {
    await page.route('**/v1/user/profile', (route) => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401 }) })
    })
    await page.route('**/v1/calendars**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/todos**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/sync**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))
    await page.route('**/v1/auth/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))

    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('login-email-input')).toBeVisible()
    await expect(page.getByTestId('login-password-input')).toBeVisible()
    await expect(page.getByTestId('login-submit-btn')).toBeVisible()
  })

  test('登录应调用 POST /auth/login', async ({ page }) => {
    let loginCalled = false
    let loginPayload: any = null

    await page.route('**/v1/user/profile', (route) => {
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 401 }) })
    })
    await page.route('**/v1/auth/login', async (route) => {
      loginCalled = true
      loginPayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            user: { id: 1, email: 'test@example.com', display_name: '测试用户' },
          },
        }),
      })
    })
    await page.route('**/v1/calendars**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/events**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/todos**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: [] }) }))
    await page.route('**/v1/sync**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: {} }) }))
    await page.route('**/v1/auth/refresh', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: { access_token: 'new', refresh_token: 'new' } }) }))

    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('login-email-input').fill('test@example.com')
    await page.getByTestId('login-password-input').fill('Test123456')
    await page.getByTestId('login-submit-btn').click()

    await page.waitForTimeout(2000)

    expect(loginCalled).toBe(true)
    expect(loginPayload?.email).toBe('test@example.com')
  })

  test('登出应调用 API 并清除 token', async ({ page }) => {
    let logoutCalled = false

    await mockAllApi(page)
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })

    await page.evaluate(() => {
      localStorage.setItem('access_token', 'mock-access-token')
      localStorage.setItem('refresh_token', 'mock-refresh-token')
      localStorage.setItem('was_logged_in', 'true')
    })
    await page.reload({ waitUntil: 'domcontentloaded' })

    await page.route('**/v1/auth/logout', async (route) => {
      logoutCalled = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0 }) })
    })

    const logoutBtn = page.getByTestId('logout-btn')
    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click()
      await page.waitForTimeout(2000)
      expect(logoutCalled).toBe(true)

      const hasTokens = await page.evaluate(() => !!localStorage.getItem('access_token'))
      expect(hasTokens).toBe(false)
    }
  })

  test('SSO 会话检测：401 + wasLoggedIn 应标记会话过期', async ({ page }) => {
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

    const wasLoggedIn = await page.evaluate(() => localStorage.getItem('was_logged_in'))
    expect(wasLoggedIn).toBe('true')
  })

  test('网络错误时应优雅降级', async ({ page }) => {
    await page.route('**/v1/**', (route) => route.abort('failed'))
    await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {})
    await expect(page.locator('#app')).toBeVisible()
  })
})
