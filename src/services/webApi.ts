// Web API 客户端
// 在非 Tauri 环境下直接调用后端 API

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1188/v1'

let accessToken: string | null = null
let refreshTokenValue: string | null = null
let isRefreshing = false
let refreshWaiters: Array<(token: string) => void> = []

// 从 localStorage 恢复令牌
function getStoredTokens(): void {
  accessToken = localStorage.getItem('access_token')
  refreshTokenValue = localStorage.getItem('refresh_token')
}

// 存储令牌到内存和 localStorage
function storeTokens(access: string, refresh: string): void {
  accessToken = access
  refreshTokenValue = refresh
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

// 清除令牌
function clearTokens(): void {
  accessToken = null
  refreshTokenValue = null
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

// 刷新访问令牌
async function doRefreshToken(): Promise<string> {
  if (!refreshTokenValue) throw new Error('无可用的刷新令牌')
  const resp = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenValue })
  })
  const data = await resp.json()
  if (data.code !== 0 || !data.data) throw new Error('刷新令牌失败')
  accessToken = data.data.access_token
  localStorage.setItem('access_token', accessToken!)
  return accessToken!
}

// 通用 API 请求函数（含自动刷新令牌）
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  getStoredTokens()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // 401 时尝试刷新令牌后重试
  if (resp.status === 401 && refreshTokenValue) {
    if (!isRefreshing) {
      isRefreshing = true
      try {
        await doRefreshToken()
        refreshWaiters.forEach(cb => cb(accessToken!))
        refreshWaiters = []
      } finally {
        isRefreshing = false
      }
    } else {
      // 其他请求等待刷新完成
      await new Promise<string>(resolve => refreshWaiters.push(resolve))
    }
    headers['Authorization'] = `Bearer ${accessToken}`
    const retryResp = await fetch(`${BASE_URL}${path}`, { ...options, headers })
    return retryResp.json()
  }

  return resp.json()
}

export const webApi = {
  storeTokens,
  clearTokens,
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshTokenValue,

  // 获取 RSA 公钥
  async getPublicKey() {
    return apiFetch<{ code: number; data: { public_key: string } | null }>('/auth/public-key')
  },

  // 用户登录
  async login(email: string, password: string) {
    const data = await apiFetch<{ code: number; data: { user_id: number; access_token: string; refresh_token: string; expires_in: number } | null; message?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
    if (data.code === 0 && data.data) {
      storeTokens(data.data.access_token, data.data.refresh_token)
    }
    return data
  },

  // 用户注册
  async register(email: string, password: string, displayName: string) {
    const data = await apiFetch<{ code: number; data: { user_id: number; access_token: string; refresh_token: string; expires_in: number } | null; message?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName })
    })
    if (data.code === 0 && data.data) {
      storeTokens(data.data.access_token, data.data.refresh_token)
    }
    return data
  },

  // 获取用户资料
  async getProfile() {
    return apiFetch<{ code: number; data: { id: number; email: string; display_name: string; avatar_url: string | null; provider: string } | null }>('/user/profile')
  },

  // 用户登出
  async logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } finally {
      clearTokens()
    }
  },

  // 刷新令牌
  async refreshToken() {
    const data = await apiFetch<{ code: number; data: { access_token: string; refresh_token: string; expires_in: number } | null }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshTokenValue })
    })
    if (data.code === 0 && data.data) {
      storeTokens(data.data.access_token, data.data.refresh_token)
    }
    return data
  },

  // 检查认证状态（使用 /user/profile 代替不存在的 /auth/check-status）
  async checkStatus() {
    return apiFetch<{ code: number; data: { id: number; email: string; display_name: string } | null }>('/user/profile')
  }
}
