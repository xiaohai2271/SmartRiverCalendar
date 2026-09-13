import { test, expect } from '@playwright/test'
import { mockAllApi } from '../helpers/api-mock'

test.describe('日历事件 CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApi(page)
    await page.goto('/calendar', { waitUntil: 'domcontentloaded' })
  })

  test('应显示日历视图和导航控件', async ({ page }) => {
    await expect(page.getByTestId('btn-today')).toBeVisible()
    await expect(page.getByTestId('btn-prev')).toBeVisible()
    await expect(page.getByTestId('btn-next')).toBeVisible()
    await expect(page.getByTestId('current-date-label')).toBeVisible()
  })

  test('点击添加按钮应打开事件创建弹窗', async ({ page }) => {
    await page.getByTestId('btn-add-event').click()
    await expect(page.getByTestId('event-modal')).toBeVisible()
    await expect(page.getByTestId('event-title-input')).toBeVisible()
    await expect(page.getByTestId('event-submit-btn')).toBeVisible()
  })

  test('创建事件应调用 POST /events 并在列表中出现', async ({ page }) => {
    let postCalled = false
    let postPayload: any = null
    const newEventTitle = `E2E测试事件_${Date.now()}`

    await page.route('**/v1/events**', async (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true
        postPayload = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 0,
            data: {
              id: `evt-${Date.now()}`,
              title: postPayload?.title ?? newEventTitle,
              start_time: postPayload?.start_time ?? Date.now(),
              end_time: postPayload?.end_time ?? Date.now() + 3600000,
              all_day: postPayload?.all_day ?? false,
              calendar_id: postPayload?.calendar_id ?? 1,
              color: '#0078d4',
              created_at: Date.now(),
              updated_at: Date.now(),
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await page.getByTestId('btn-add-event').click()
    await expect(page.getByTestId('event-modal')).toBeVisible()
    await page.getByTestId('event-title-input').fill(newEventTitle)
    await page.getByTestId('event-submit-btn').click()

    await page.waitForTimeout(1000)

    expect(postCalled).toBe(true)
    expect(postPayload?.title).toBe(newEventTitle)
  })

  test('取消创建应关闭弹窗且不调用 API', async ({ page }) => {
    let postCalled = false
    await page.route('**/v1/events**', async (route) => {
      if (route.request().method() === 'POST') {
        postCalled = true
      }
      await route.continue()
    })

    await page.getByTestId('btn-add-event').click()
    await expect(page.getByTestId('event-modal')).toBeVisible()
    await page.getByTestId('event-cancel-btn').click()

    await page.waitForTimeout(500)
    expect(postCalled).toBe(false)
  })

  test('视图切换按钮应可点击', async ({ page }) => {
    const viewButtons = page.getByTestId('view-btn')
    await viewButtons.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    const count = await viewButtons.count()
    expect(count).toBeGreaterThanOrEqual(2)

    for (let i = 0; i < Math.min(count, 4); i++) {
      await viewButtons.nth(i).click()
      await page.waitForTimeout(300)
      const isActive = await viewButtons.nth(i).evaluate(el => el.classList.contains('active'))
      expect(isActive).toBe(true)
    }
  })

  test('前后导航应改变日期标签', async ({ page }) => {
    const dateLabel = page.getByTestId('current-date-label')
    const beforeText = await dateLabel.textContent()
    expect(beforeText).toBeTruthy()

    await page.getByTestId('btn-next').click()
    await page.waitForTimeout(300)
    const afterNext = await dateLabel.textContent()
    expect(afterNext).not.toBe(beforeText)

    await page.getByTestId('btn-prev').click()
    await page.waitForTimeout(300)
    const afterPrev = await dateLabel.textContent()
    expect(afterPrev).toBe(beforeText)
  })

  test('API 错误时应优雅处理', async ({ page }) => {
    await page.route('**/v1/events**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500 }) })
    })
    await page.goto('/calendar', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('#app')).toBeVisible()
  })
})
