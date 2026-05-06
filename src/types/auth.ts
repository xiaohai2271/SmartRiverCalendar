/**
 * 认证和同步相关类型定义
 */

// 认证状态
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  syncStatus: CloudSyncStatus
  lastSyncAt: number | null
  isInitialized: boolean
}

// 用户信息
export interface User {
  id: string
  username: string
  email: string
  avatar?: string
  createdAt: number
  updatedAt: number
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 注册请求
export interface RegisterRequest {
  username: string
  email: string
  password: string
}

// 认证响应
export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number // 过期时间（秒）
}

// 令牌对
export interface TokenPair {
  accessToken: string
  refreshToken: string
}

// 云同步状态
export type CloudSyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

// 同步进度
export interface SyncProgress {
  current: number
  total: number
  message: string
}

// 同步冲突
export interface SyncConflict {
  id: string
  type: 'event' | 'todo'
  local: any
  remote: any
  conflictAt: number
}

// 同步日志条目
export interface SyncLogEntry {
  timestamp: number
  status: CloudSyncStatus
  message: string
  details?: string
}

// GitHub OAuth 请求
export interface GithubOAuthRequest {
  clientId: string
  redirectUri: string
  state?: string
}

// GitHub OAuth 回调
export interface GithubOAuthCallback {
  code: string
  state: string
}

// 刷新令牌请求
export interface RefreshTokenRequest {
  refreshToken: string
}

// 刷新令牌响应
export interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

// 通用 API 响应
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

// API 错误码
export const API_ERROR_CODES = {
  SUCCESS: 0,
  UNKNOWN_ERROR: -1,
  INVALID_PARAMS: 1001,
  UNAUTHORIZED: 1002,
  TOKEN_EXPIRED: 1003,
  TOKEN_INVALID: 1004,
  USER_NOT_FOUND: 2001,
  USER_ALREADY_EXISTS: 2002,
  PASSWORD_INCORRECT: 2003,
  NETWORK_ERROR: 3001,
  SERVER_ERROR: 5000
} as const

// 认证错误类型
export type AuthErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]