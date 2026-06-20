import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端提醒弹窗', () => {
  it('主窗口应可导航到设置页', async () => {
    await browser.url('/settings')
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    const isDisplayed = await app.isDisplayed()
    expect(isDisplayed).toBe(true)
  })
})
