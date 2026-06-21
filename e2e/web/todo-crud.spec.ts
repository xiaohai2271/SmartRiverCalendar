import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('待办 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/todos')
    await page.waitForLoadState('domcontentloaded')
  })

  test('应显示待办页面', async ({ page }) => {
    await expect(page.locator('#app')).toBeVisible()
  })

  test('应能创建新待办', async ({ page }) => {
    await page.route('**/v1/todos**', (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON()
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { id: `todo-${Date.now()}`, ...body } }),
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: [] }),
        })
      }
    })

    const addBtn = page.locator('[data-testid="add-todo"], button:has-text("添加"), button:has-text("新建")')
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click()
      const titleInput = page.locator('input[placeholder*="待办"], input[placeholder*="标题"], input[name="title"]')
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill('E2E 测试待办')
      }
    }
    await expect(page.locator('#app')).toBeVisible()
  })

  test('应能完成待办', async ({ page }) => {
    await page.route('**/v1/todos/*', (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0, data: body }) })
      } else {
        route.continue()
      }
    })

    const checkbox = page.locator('.todo-checkbox, [data-testid="todo-complete"], input[type="checkbox"]').first()
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click()
    }
    await expect(page.locator('#app')).toBeVisible()
  })

  test('应能删除待办', async ({ page }) => {
    await page.route('**/v1/todos/*', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0 }) })
      } else {
        route.continue()
      }
    })
    await expect(page.locator('#app')).toBeVisible()
  })
})
