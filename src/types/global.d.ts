// 全局变量类型声明
// 声明由 Vite define 注入的构建时变量

declare global {
  const __BUILD_DATE__: string
  const __GIT_HASH__: string
  const __APP_VERSION__: string
}

export {}