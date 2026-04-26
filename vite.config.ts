import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

// 获取构建时变量
const getBuildDate = () => new Date().toISOString()
const getGitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch (error) {
    return 'unknown'
  }
}
const getAppVersion = () => {
  try {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
    return pkg.version || '0.0.0'
  } catch (error) {
    return '0.0.0'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  define: {
    __BUILD_DATE__: JSON.stringify(getBuildDate()),
    __GIT_HASH__: JSON.stringify(getGitHash()),
    __APP_VERSION__: JSON.stringify(getAppVersion())
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
    ],
    // 开发模式性能优化
    warmup: {
      clientFiles: ['src/main.ts'] // 预热入口文件
    }
  },
  // 优化依赖预编译
  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      '@tauri-apps/api/core',
      '@tauri-apps/api/window',
      '@tauri-apps/api/webviewWindow',
      '@tauri-apps/api/event'
    ],
    // 排除不需要预编译的大型库
    exclude: []
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
        }
      }
    },
    // 提高 chunk 大小警告阈值（500KB）
    chunkSizeWarningLimit: 500
  }
})
