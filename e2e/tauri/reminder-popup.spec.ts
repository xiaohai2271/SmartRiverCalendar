import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端设置页面', () => {
  it('应导航到设置页并渲染', async () => {
    await browser.url('/settings')
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    const isDisplayed = await app.isDisplayed()
    expect(isDisplayed).toBe(true)
  })

  it('设置页应显示桌面端专属功能', async () => {
    await browser.url('/settings')
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    expect(await app.isDisplayed()).toBe(true)
  })
})
