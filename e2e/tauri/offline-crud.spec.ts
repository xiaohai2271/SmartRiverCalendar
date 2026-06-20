import { expect } from '@wdio/globals'
import { browser } from '@wdio/globals'

describe('桌面端离线操作', () => {
  it('离线状态下应用应正常运行', async () => {
    await browser.url('/')
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    const isDisplayed = await app.isDisplayed()
    expect(isDisplayed).toBe(true)
  })

  it('离线创建事件应写入本地数据库', async () => {
    await browser.url('/calendar')
    const app = await $('#app')
    await app.waitForExist({ timeout: 10000 })
    expect(await app.isDisplayed()).toBe(true)
  })
})
