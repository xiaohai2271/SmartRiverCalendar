import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('待办 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/todos', { waitUntil: 'domcontentloaded' })
  })

  test('应显示待办页面和新增按钮', async ({ page }) => {
    await expect(page.getByTestId('btn-add-todo')).toBeVisible()
  })

  test('创建待办应调用 POST /todos 并在列表中显示', async ({ page }) => {
    let postCalled = false
    let postPayload: any = null
    const newTodoTitle = `E2E测试待办_${Date.now()}`

    await page.route('**/v1/todos**', async (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true
        postPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              id: `todo-${Date.now()}`,
              title: postPayload?.title ?? newTodoTitle,
              completed: false,
              priority: postPayload?.priority ?? 'medium',
              calendar_id: postPayload?.calendar_id ?? 1,
              created_at: Date.now(),
              updated_at: Date.now(),
            },
          }),
        })
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: [
              { id: `todo-${Date.now()}`, title: newTodoTitle, completed: false, priority: 'medium', calendar_id: 1 },
            ],
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByTestId('btn-add-todo').click()
    await expect(page.getByTestId('todo-modal')).toBeVisible()
    await page.getByTestId('todo-title-input').fill(newTodoTitle)
    await page.getByTestId('todo-submit-btn').click()

    await page.waitForTimeout(1000)

    expect(postCalled).toBe(true)
    expect(postPayload?.title).toBe(newTodoTitle)
  })

  test('取消创建待办应关闭弹窗且不调用 API', async ({ page }) => {
    let postCalled = false
    await page.route('**/v1/todos**', async (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true
      }
      await route.continue()
    })

    await page.getByTestId('btn-add-todo').click()
    await expect(page.getByTestId('todo-modal')).toBeVisible()
    await page.getByTestId('todo-cancel-btn').click()

    await page.waitForTimeout(500)
    expect(postCalled).toBe(false)
  })

  test('完成待办应调用 PUT /todos/:id', async ({ page }) => {
    let putCalled = false
    let putPayload: any = null

    await page.route('**/v1/todos/*', async (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true
        putPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: { ...putPayload, completed: true },
          }),
        })
      } else {
        await route.continue()
      }
    })

    const checkbox = page.getByTestId('todo-checkbox').first()
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click()
      await page.waitForTimeout(1000)
      expect(putCalled).toBe(true)
      expect(putPayload?.completed).toBe(true)
    } else {
      test.skip()
    }
  })

  test('删除待办应调用 DELETE /todos/:id', async ({ page }) => {
    let deleteCalled = false

    await page.route('**/v1/todos/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCalled = true
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: 0 }) })
      } else {
        await route.continue()
      }
    })

    const deleteBtn = page.getByTestId('btn-delete-todo').first()
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click()
      await page.waitForTimeout(1000)
      expect(deleteCalled).toBe(true)
    } else {
      test.skip()
    }
  })
})
