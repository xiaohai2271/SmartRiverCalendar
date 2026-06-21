// Web 端安全存储模块
// 使用 sessionStorage 替代 localStorage 存储 Token
// 关闭标签页后 Token 自动清除，降低 XSS 窃取风险

const ACCESS_TOKEN_KEY = 'src_access_token'
const REFRESH_TOKEN_KEY = 'src_refresh_token'

// 旧 localStorage key，用于一次性清理
const OLD_ACCESS_TOKEN_KEY = 'access_token'
const OLD_REFRESH_TOKEN_KEY = 'refresh_token'

/** 一次性清理旧 localStorage 中的 Token 数据 */
function cleanupOldStorage(): void {
  try {
    if (localStorage.getItem(OLD_ACCESS_TOKEN_KEY) !== null || localStorage.getItem(OLD_REFRESH_TOKEN_KEY) !== null) {
      localStorage.removeItem(OLD_ACCESS_TOKEN_KEY)
      localStorage.removeItem(OLD_REFRESH_TOKEN_KEY)
    }
  } catch {
    // 忽略
  }
}

// 模块初始化时清理旧数据
cleanupOldStorage()

export function getStoredAccessToken(): string | null {
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredRefreshToken(): string | null {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeTokens(access: string, refresh: string): void {
  try {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, access)
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  } catch {
    console.warn('[SecureStorage] 无法存储 Token')
  }
}

export function clearStoredTokens(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // 忽略
  }
}

export function getRefreshToken(): string | null {
  return getStoredRefreshToken()
}
