// Web API 客户端
// 从 src/services/webApi.ts 迁移，为 Web 平台 Repository 提供统一的 API 调用能力

import {
  getStoredAccessToken,
  getStoredRefreshToken,
  storeTokens as secureStoreTokens,
  clearStoredTokens as secureClearTokens,
} from './secure-storage'

const LS_KEY_API_URL = 'sr_api_url'
const LS_KEY_PLATFORM_URL = 'sr_platform_url'
const DEFAULT_API_URL = 'https://calendar.menghuan.life/api'
const DEFAULT_PLATFORM_URL = 'https://calendar.menghuan.life'

/** 获取当前 API 接口地址 */
function getApiUrl(): string {
  return localStorage.getItem(LS_KEY_API_URL) || import.meta.env.VITE_API_BASE_URL || DEFAULT_API_URL
}

/** 获取当前平台地址 */
function getPlatformUrl(): string {
  return localStorage.getItem(LS_KEY_PLATFORM_URL) || DEFAULT_PLATFORM_URL
}

let accessToken: string | null = null
let refreshTokenValue: string | null = null
let isRefreshing = false
let refreshWaiters: Array<(token: string) => void> = []

/** 从 sessionStorage 恢复令牌到内存 */
function getStoredTokens(): void {
  accessToken = getStoredAccessToken()
  refreshTokenValue = getStoredRefreshToken()
}

/** 存储令牌到内存和 sessionStorage */
function storeTokens(access: string, refresh: string): void {
  accessToken = access
  refreshTokenValue = refresh
  secureStoreTokens(access, refresh)
}

/** 清除令牌 */
function clearTokens(): void {
  accessToken = null
  refreshTokenValue = null
  secureClearTokens()
}

/** 刷新访问令牌 */
async function doRefreshToken(): Promise<string> {
  if (!refreshTokenValue) throw new Error('无可用的刷新令牌')
  const resp = await fetch(`${getApiUrl()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenValue }),
  })
  const data = await resp.json()
  if (data.code !== 0 || !data.data) throw new Error('刷新令牌失败')
  // 同时保存新的 access_token 和 refresh_token
  storeTokens(data.data.access_token, data.data.refresh_token)
  return data.data.access_token
}

/** 通用 API 请求函数（含自动刷新令牌） */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  getStoredTokens()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  const resp = await fetch(`${getApiUrl()}${path}`, { ...options, headers })

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
      await new Promise<string>(resolve => refreshWaiters.push(resolve))
    }
    headers['Authorization'] = `Bearer ${accessToken}`
    const retryResp = await fetch(`${getApiUrl()}${path}`, { ...options, headers })
    return retryResp.json()
  }

  return resp.json()
}

/** Web API 客户端类 */
export class WebApiClient {
  /** 获取当前访问令牌 */
  getAccessToken(): string | null {
    return accessToken
  }

  /** 获取当前刷新令牌 */
  getRefreshToken(): string | null {
    return refreshTokenValue
  }

  /** 存储令牌 */
  setTokens(access: string, refresh: string): void {
    storeTokens(access, refresh)
  }

  /** 清除令牌 */
  clearTokens(): void {
    clearTokens()
  }

  /** 通用 GET 请求 */
  async get<T>(path: string, options?: RequestInit): Promise<T> {
    return apiFetch<T>(path, options)
  }

  /** 通用 POST 请求 */
  async post<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /** 通用 PUT 请求 */
  async put<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /** 通用 DELETE 请求 */
  async delete<T>(path: string, body?: unknown): Promise<T> {
    return apiFetch<T>(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /** 设置 API 接口地址（存入 localStorage） */
  setApiUrl(url: string): void {
    localStorage.setItem(LS_KEY_API_URL, url)
  }

  /** 设置平台地址（存入 localStorage） */
  setPlatformUrl(url: string): void {
    localStorage.setItem(LS_KEY_PLATFORM_URL, url)
  }

  /** 获取 API 接口地址 */
  getApiUrl(): string {
    return getApiUrl()
  }

  /** 获取平台地址 */
  getPlatformUrl(): string {
    return getPlatformUrl()
  }
}
