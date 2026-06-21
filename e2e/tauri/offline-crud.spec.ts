import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端页面导航', () => {
  it('应在各页面间正常导航', async () => {
    const routes = ['/calendar', '/todos', '/settings']
    for (const route of routes) {
      await browser.url(route)
      const app = await $('#app')
      await app.waitForExist({ timeout: 10000 })
      expect(await app.isDisplayed()).toBe(true)
    }
  })
})
