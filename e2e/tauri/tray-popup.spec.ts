import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端托盘弹出面板', () => {
  it('应用启动后应可见主窗口', async () => {
    const title = await browser.getTitle()
    expect(typeof title).toBe('string')
  })

  it('应渲染 Vue 应用根节点', async () => {
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    const isDisplayed = await app.isDisplayed()
    expect(isDisplayed).toBe(true)
  })
})
