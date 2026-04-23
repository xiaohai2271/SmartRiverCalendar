import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // 环境变量判断是否在 Tauri 环境中
  envPrefix: ['VITE_', 'TAURI_'],
  clearScreen: false,
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: [
      "127.0.0.1",
      "10.0.0.100",
      "nav.menghuan.life"
    ]
  },
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // 代码分割优化配置
    rollupOptions: {
      output: {
        // 手动分割第三方库
        manualChunks(id: string) {
          // Vue 核心库单独打包
          if (id.includes('node_modules/vue/') || id.includes('node_modules/vue-router/') || id.includes('node_modules/pinia/')) {
            return 'vue-vendor'
          }
          // Tauri API 单独打包（按需加载）
          if (id.includes('@tauri-apps/api/')) {
            return 'tauri-api'
          }
          // 工具库单独打包
          if (id.includes('node_modules/tyme4ts/')) {
            return 'utils'
          }
          return undefined
        },
        // 优化 chunk 文件命名
        chunkFileNames(chunkInfo) {
          // 保持视图组件的可读命名
          if (chunkInfo.name?.includes('View')) {
            return `assets/views/${chunkInfo.name}-[hash].js`
          }
          return `assets/${chunkInfo.name}-[hash].js`
        }
      }
    },
    // 提高 chunk 大小警告阈值（500KB）
    chunkSizeWarningLimit: 500
  }
})
