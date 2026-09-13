import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5173'
const results = []

async function step(page, name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`PASS  ${name}`)
  } catch (e) {
    results.push({ name, ok: false, err: String(e).slice(0, 400) })
    console.log(`FAIL  ${name}`)
    console.log(String(e).slice(0, 500))
  }
}

function okJson(data) {
  return JSON.stringify({ code: 0, data })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()

  const pageErrors = []
  page.on('pageerror', (err) => {
    pageErrors.push(String(err))
    console.log('PAGEERROR', String(err).slice(0, 250))
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      // 忽略 mock 无关的网络噪声以外的真实错误仍打印
      if (!t.includes('net::ERR') && !t.includes('Failed to load resource')) {
        console.log('CONSOLE-ERR', t.slice(0, 250))
      }
    }
  })

  // 按 API 形状 mock（与 e2e/helpers/api-mock 对齐）
  await page.route('**/v1/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes('/auth/login') || url.includes('/auth/register')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: okJson({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: { id: 1, email: 'a@b.com', name: 'Tester' },
        }),
      })
    }
    if (url.includes('/auth/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: okJson({}) })
    }
    if (url.includes('/user/profile')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: okJson({ id: 1, email: 'a@b.com', name: 'Tester' }),
      })
    }
    if (url.includes('/settings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: okJson([]) })
    }
    if (url.includes('/calendars')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: okJson([
          { id: 1, name: '本地日历', color: '#4A90D9', type: 'local', visible: true, readOnly: false },
        ]),
      })
    }
    if (url.includes('/events')) {
      const now = Date.now()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: okJson({
          items: [
            {
              id: 'e1',
              title: '冒烟测试事件',
              startTime: now,
              endTime: now + 3600000,
              allDay: false,
              calendarId: 1,
            },
          ],
          total: 1,
        }),
      })
    }
    if (url.includes('/todos')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: okJson({
          items: [
            { id: 't1', title: '冒烟待办', completed: false, priority: 'medium', calendarId: 1 },
          ],
          total: 1,
        }),
      })
    }
    if (url.includes('/sync')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: okJson({ status: 'idle' }) })
    }
    if (method === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: okJson([]) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: okJson({}) })
  })

  const routes = [
    ['首页 /', '/'],
    ['日历 /calendar', '/calendar'],
    ['日程 /schedules', '/schedules'],
    ['待办 /todos', '/todos'],
    ['设置 /settings', '/settings'],
    ['我的 /profile', '/profile'],
  ]

  for (const [name, path] of routes) {
    await step(page, `打开 ${name}`, async () => {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500)
      const app = page.locator('#app')
      await app.waitFor({ state: 'attached', timeout: 10000 })
      const html = await page.content()
      if (html.includes('id="app"') && html.trim().length < 500) {
        throw new Error('页面疑似空白')
      }
      const text = (await page.locator('body').innerText()).trim()
      if (!text) throw new Error('页面无文本内容')
      await page.screenshot({ path: `smoke-${path.replace(/\//g, '_') || 'home'}.png`, fullPage: true })
    })
  }

  await step(page, '日程页无 TDZ/初始化错误', async () => {
    await page.goto(BASE + '/schedules', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    const bad = pageErrors.filter((e) => /before initialization|TDZ/i.test(e))
    if (bad.length) throw new Error(bad[0])
  })

  await step(page, '日历页可见导航与视图控件', async () => {
    await page.goto(BASE + '/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    const body = await page.locator('body').innerText()
    if (!/日历|今天|月|周|日|年/.test(body)) {
      throw new Error('日历页缺少核心导航文案')
    }
  })

  await step(page, '待办页可见新增/列表区域', async () => {
    await page.goto(BASE + '/todos', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    const body = await page.locator('body').innerText()
    if (!/待办|想做|添加|新增/.test(body)) {
      throw new Error('待办页缺少核心文案')
    }
  })

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log('\n=== SMOKE SUMMARY ===')
  console.log(`total=${results.length} pass=${results.length - failed.length} fail=${failed.length}`)
  if (pageErrors.length) {
    console.log(`pageErrors=${pageErrors.length}`)
  }
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
