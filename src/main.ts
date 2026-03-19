import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', instance)
  console.error('Info:', info)
}

// Log app startup
console.log('小河日历 started')

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