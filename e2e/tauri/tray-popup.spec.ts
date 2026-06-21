import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端应用启动', () => {
  it('应用启动后应渲染主窗口', async () => {
    const title = await browser.getTitle()
    expect(title.length).toBeGreaterThan(0)
  })

  it('应渲染 Vue 应用根节点', async () => {
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    const isDisplayed = await app.isDisplayed()
    expect(isDisplayed).toBe(true)
  })

  it('应显示侧边栏导航', async () => {
    const sidebar = await $('[data-testid="sidebar"]')
    await sidebar.waitForExist({ timeout: 10000 })
    const isDisplayed = await sidebar.isDisplayed()
    expect(isDisplayed).toBe(true)
  })
})
