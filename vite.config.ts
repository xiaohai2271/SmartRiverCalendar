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
    sourcemap: !!process.env.TAURI_DEBUG
  }
})
