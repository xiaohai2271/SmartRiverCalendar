// E2E 测试模板 — Playwright Web 端
// 位置：e2e/web/<feature-name>.spec.ts

import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('<功能名称>', () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前 mock API 并导航到目标页面
    await mockAllApi(page)
    await page.goto('/<route>')
    await page.waitForLoadState('networkidle')
  })

  test('应 <预期行为>', async ({ page }) => {
    // 1. 定位元素
    // const element = page.locator('[data-testid="xxx"]')
    // 2. 执行操作
    // await element.click()
    // 3. 验证结果
    // await expect(element).toBeVisible()
  })

  test('API 错误时应优雅处理', async ({ page }) => {
    await page.route('**/v1/<endpoint>', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ code: 500, message: '错误' }),
      })
    })
    // 验证错误状态下的 UI 行为
    await expect(page.locator('#app')).toBeVisible()
  })
})

// ── 数据验证模式 ──
// 通过 window.__pinia__ 访问 Store 状态
//
// const state = await page.evaluate(() => {
//   const pinia = (window as any).__pinia__
//   return pinia?.state?.value?.<storeId> ?? null
// })
// expect(state).toBeTruthy()
//
// ── 使用自定义 Fixtures ──
// import { test, expect } from '../helpers/test-fixtures'
// test('认证流程', async ({ page, mockApi }) => {
//   await mockApi()
//   // ...
// })
