import type { Page } from '@playwright/test'

interface StoreState {
  [key: string]: unknown
}

export async function getPiniaState(page: Page): Promise<StoreState> {
  return page.evaluate(() => {
    const pinia = (window as any).__pinia__
    if (!pinia) throw new Error('Pinia 未暴露，请确保 VITE_E2E=true')
    const state: StoreState = {}
    for (const [id, store] of Object.entries(pinia.state.value)) {
      state[id] = store
    }
    return state
  })
}

export async function getStoreState<S = StoreState>(page: Page, storeId: string): Promise<S> {
  return page.evaluate((id) => {
    const pinia = (window as any).__pinia__
    if (!pinia) throw new Error('Pinia 未暴露')
    const state = pinia.state.value[id]
    if (!state) throw new Error(`Store "${id}" 不存在`)
    return state
  }, storeId)
}

export async function resetStore(page: Page, storeId: string): Promise<void> {
  await page.evaluate((id) => {
    const pinia = (window as any).__pinia__
    if (!pinia) return
    const store = pinia._s?.get(id)
    if (store?.$reset) store.$reset()
  }, storeId)
}

export async function waitForStoreInit(page: Page, storeId: string, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    ({ id }) => {
      const pinia = (window as any).__pinia__
      return pinia && pinia.state.value[id]
    },
    { id: storeId },
    { timeout }
  )
}

export async function injectLocalStorage(page: Page, data: Record<string, string>): Promise<void> {
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value)
    }
  }, data)
}

export async function clearAllLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear())
}
