import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { initHolidayCache } from './utils/lunar'
import { migrateLocalStorageToDb } from './services/settings'

async function initializeApp() {
  // 1. 先迁移 localStorage 数据到数据库（在 Store 初始化前执行）
  await migrateLocalStorageToDb()

  // 2. 创建应用并使用插件
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)

  // Global error handler - 捕获所有 Vue 错误
  app.config.errorHandler = (err, instance, info) => {
    console.error('Vue Error:', err)
    console.error('Error Type:', typeof err)
    console.error('Error String:', String(err))
    if (err instanceof Error) {
      console.error('Error Message:', err.message)
      console.error('Error Stack:', err.stack)
    }
    console.error('Component:', instance)
    console.error('Info:', info)
  }

  // 捕获未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason)
    if (event.reason instanceof Error) {
      console.error('Rejection Stack:', event.reason.stack)
    }
  })

  // 捕获全局错误
  window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error || event.message)
  })

  // 3. 初始化节假日缓存后再挂载应用
  await initHolidayCache()
  app.mount('#app')
  console.log('小河日历 started')
}

initializeApp().catch((err) => {
  console.error('Failed to initialize application:', err)
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