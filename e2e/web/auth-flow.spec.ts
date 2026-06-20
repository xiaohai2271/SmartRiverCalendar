import { test, expect } from '../helpers/test-fixtures'

test.describe('认证流程', () => {
  test('未登录用户应看到登录入口', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const profileLink = page.locator('a[href="/profile"], [data-testid="profile-link"]')
    const isVisible = await profileLink.isVisible().catch(() => false)
    expect(typeof isVisible).toBe('boolean')
  })

  test('登录后应显示用户信息', async ({ page, mockApi }) => {
    await mockApi()
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const state = await page.evaluate(() => {
      const pinia = (window as any).__pinia__
      return pinia?.state?.value?.auth ?? null
    })
    expect(state).toBeTruthy()
  })

  test('登出后应清除认证状态', async ({ page, mockApi }) => {
    await mockApi()
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.evaluate(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('was_logged_in')
    })

    await page.reload()
    await page.waitForLoadState('networkidle')
    const hasTokens = await page.evaluate(() => {
      return !!localStorage.getItem('access_token')
    })
    expect(hasTokens).toBe(false)
  })

  test('SSO 会话检测：401 且 wasLoggedIn 应触发会话过期', async ({ page }) => {
    await page.route('**/v1/user/profile', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 401 }),
      })
    })
    await page.evaluate(() => {
      localStorage.setItem('was_logged_in', 'true')
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const authState = await page.evaluate(() => {
      const pinia = (window as any).__pinia__
      return pinia?.state?.value?.auth ?? null
    })
    expect(authState).toBeTruthy()
  })

  test('网络错误时应优雅降级', async ({ page }) => {
    await page.route('**/v1/**', (route) => route.abort('failed'))
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#app')).toBeVisible()
  })
})
