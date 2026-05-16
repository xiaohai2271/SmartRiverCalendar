import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { initHolidayCache } from './utils/lunar'
import { isTauri } from './utils/tauri'
import { initPlatform } from './platform/provider'

// 最早期全局错误捕获（在任何代码执行前注册）
window.addEventListener('error', (event) => {
  console.error('[全局] Error:', event.error || event.message, '| 文件:', event.filename, '| 行:', event.lineno)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[全局] Unhandled Rejection:', event.reason)
  if (event.reason instanceof Error) {
    console.error('[全局] Rejection Stack:', event.reason.stack)
  }
})

console.log('[main.ts] 开始初始化应用...')

async function initializeApp() {
  console.log('[main.ts] 0. 初始化平台 Provider...')
  try {
    if (isTauri()) {
      const { createTauriProvider } = await import('@/platform/tauri')
      initPlatform(createTauriProvider())
    } else {
      const { createWebProvider } = await import('@/platform/web')
      initPlatform(createWebProvider())
    }
    console.log('[main.ts] 0. 平台 Provider 初始化完成')
  } catch (e) {
    console.error('[main.ts] 0. 平台 Provider 初始化失败:', e)
  }

  console.log('[main.ts] 1. 迁移 localStorage 数据...')
  try {
    // 桌面端执行 localStorage → 数据库迁移（通过 settingsRepo）
    if (isTauri()) {
      const { usePlatform } = await import('@/platform/provider')
      const { settingsRepo } = usePlatform()
      await settingsRepo.migrateFromLocalStorage?.()
    }
    console.log('[main.ts] 1. localStorage 迁移完成')
  } catch (e) {
    console.error('[main.ts] 1. localStorage 迁移失败（非致命）:', e)
  }

  // 2. 创建应用并使用插件
  console.log('[main.ts] 2. 创建 Vue 应用...')
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // Global error handler - 捕获所有 Vue 错误
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue] Error:', err)
    console.error('[Vue] Error String:', String(err))
    if (err instanceof Error) {
      console.error('[Vue] Error Message:', err.message)
      console.error('[Vue] Error Stack:', err.stack)
    }
    console.error('[Vue] Info:', info)
  }

  // 3. 初始化节假日缓存后再挂载应用
  console.log('[main.ts] 3. 初始化节假日缓存...')
  try {
    await initHolidayCache()
    console.log('[main.ts] 3. 节假日缓存初始化完成')
  } catch (e) {
    console.error('[main.ts] 3. 节假日缓存初始化失败（非致命）:', e)
  }

  console.log('[main.ts] 4. 挂载应用...')
  app.mount('#app')
  console.log('[main.ts] 应用已挂载 - 小河日历 started')
}

initializeApp().catch((err) => {
  console.error('[main.ts] 应用初始化失败:', err)
  // 即使初始化失败，也尝试挂载一个最小化的错误提示
  try {
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  } catch (mountErr) {
    console.error('[main.ts] 挂载回退失败:', mountErr)
    document.getElementById('app')!.innerHTML = '<div style="color:red;padding:20px;">应用初始化失败</div>'
  }
})

// Try to get Tauri app info (will fail gracefully in browser)
import('@tauri-apps/api/core')
  .then(({ invoke }) => {
    invoke('get_app_info').then((info: any) => {
      console.log('Tauri App Info:', info)
    }).catch(() => {
      console.log('Running in browser mode')
    })
  })
  .catch(() => {
    console.log('Running in browser mode - Tauri API not available')
  })