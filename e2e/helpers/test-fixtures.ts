import { test as base, expect } from '@playwright/test'
import { mockAllApi, mockAuthApi } from '../helpers/api-mock'
import { injectLocalStorage, clearAllLocalStorage, getStoreState } from '../helpers/data-verify'
import { userFixture } from '../fixtures'

type AuthMode = 'authenticated' | 'anonymous' | 'sso'

interface TestFixtures {
  authMode: AuthMode
  mockApi: () => Promise<void>
}

export const test = base.extend<TestFixtures>({
  authMode: ['authenticated', { option: true }],

  mockApi: async ({ page, authMode }, use) => {
    await use(async () => {
      if (authMode === 'authenticated') {
        await mockAllApi(page)
        await injectLocalStorage(page, {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          was_logged_in: 'true',
        })
      } else if (authMode === 'sso') {
        await mockAllApi(page)
        await injectLocalStorage(page, {
          was_logged_in: 'true',
        })
      } else {
        await mockAuthApi(page, userFixture)
        await clearAllLocalStorage(page)
      }
    })
  },
})

export { expect }

export async function loginViaUI(page: import('@playwright/test').Page) {
  await page.goto('/profile')
  await page.getByPlaceholder(/邮箱|email/i).fill('test@example.com')
  await page.getByPlaceholder(/密码|password/i).fill('Test123456')
  await page.getByRole('button', { name: /登录|login/i }).click()
  await page.waitForURL('**/')
}

export async function verifyAuthenticated(page: import('@playwright/test').Page) {
  const authState = await getStoreState(page, 'auth')
  expect(authState).toBeTruthy()
}
