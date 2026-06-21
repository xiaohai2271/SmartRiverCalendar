import type { Page, Route } from '@playwright/test'
import { userFixture, calendarsFixture, eventsFixture, todosFixture, syncStatusFixture } from '../fixtures'

export interface MockOptions {
  user?: typeof userFixture
  calendars?: typeof calendarsFixture
  events?: typeof eventsFixture
  todos?: typeof todosFixture
  syncStatus?: typeof syncStatusFixture
}

const API_BASE = '**/v1'

export async function mockAllApi(page: Page, options: MockOptions = {}) {
  const user = options.user ?? userFixture
  const calendars = options.calendars ?? calendarsFixture
  const events = options.events ?? eventsFixture
  const todos = options.todos ?? todosFixture
  const syncStatus = options.syncStatus ?? syncStatusFixture

  await mockAuthApi(page, user)
  await mockCalendarApi(page, calendars)
  await mockEventApi(page, events)
  await mockTodoApi(page, todos)
  await mockSyncApi(page, syncStatus)
}

export async function mockAuthApi(page: Page, user = userFixture) {
  await page.route(`${API_BASE}/user/profile`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: user }),
    })
  })

  await page.route(`${API_BASE}/auth/login`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user,
        },
      }),
    })
  })

  await page.route(`${API_BASE}/auth/register`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user,
        },
      }),
    })
  })

  await page.route(`${API_BASE}/auth/refresh`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        data: {
          access_token: 'new-mock-access-token',
          refresh_token: 'new-mock-refresh-token',
        },
      }),
    })
  })
}

export async function mockCalendarApi(page: Page, calendars = calendarsFixture) {
  await page.route(`${API_BASE}/calendars`, (route: Route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: calendars }),
      })
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          data: { id: Date.now(), ...body },
        }),
      })
    }
  })

  await page.route(`${API_BASE}/calendars/*`, (route: Route) => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: body }),
      })
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0 }),
      })
    }
  })
}

export async function mockEventApi(page: Page, events = eventsFixture) {
  await page.route(`${API_BASE}/events**`, (route: Route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: events }),
      })
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { id: `evt-${Date.now()}`, ...body } }),
      })
    } else if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: body }),
      })
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0 }),
      })
    }
  })
}

export async function mockTodoApi(page: Page, todos = todosFixture) {
  await page.route(`${API_BASE}/todos**`, (route: Route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: todos }),
      })
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: { id: `todo-${Date.now()}`, ...body } }),
      })
    } else if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, data: body }),
      })
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0 }),
      })
    }
  })
}

export async function mockSyncApi(page: Page, syncStatus = syncStatusFixture) {
  await page.route(`${API_BASE}/sync**`, (route: Route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, data: syncStatus }),
    })
  })
}

export async function mockUnauthorized(page: Page) {
  await page.route(`${API_BASE}/**`, (route: Route) => {
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 401, message: '未授权' }),
    })
  })
}

export async function mockNetworkError(page: Page) {
  await page.route(`${API_BASE}/**`, (route: Route) => {
    route.abort('failed')
  })
}

export async function mockServerError(page: Page) {
  await page.route(`${API_BASE}/**`, (route: Route) => {
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 500, message: '服务器内部错误' }),
    })
  })
}
