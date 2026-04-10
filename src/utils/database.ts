// 本地数据库工具函数（用于前端缓存外部账号信息）
// 注意：主要的账号数据存储在 Rust 后端的 SQLite 数据库中

import { invokeGetAllDbAccounts, invokeDeleteAccount } from './tauri'
import type { ExternalAccount } from '../types'

// 内存中的账号缓存
let accountsCache: ExternalAccount[] = []
let cacheInitialized = false

/**
 * 初始化账号缓存（从后端加载）
 */
async function initAccountsCache(): Promise<void> {
  if (cacheInitialized) return
  
  try {
    const accounts = await invokeGetAllDbAccounts()
    accountsCache = accounts || []
    cacheInitialized = true
  } catch (error) {
    console.error('初始化账号缓存失败:', error)
    accountsCache = []
    cacheInitialized = true
  }
}

/**
 * 保存外部账号信息到后端数据库
 * 注意：实际的保存操作在连接时由 Rust 后端完成
 * 这里只是更新前端缓存
 */
export async function saveExternalAccount(account: ExternalAccount): Promise<void> {
  await initAccountsCache()
  
  // 检查是否已存在
  const existingIndex = accountsCache.findIndex(
    a => a.serverUrl === account.serverUrl && a.username === account.username
  )
  
  if (existingIndex >= 0) {
    accountsCache[existingIndex] = account
  } else {
    accountsCache.push(account)
  }
}

/**
 * 根据服务器 URL 和用户名获取账号信息
 */
export async function getAccountByServerUrl(
  serverUrl: string,
  username: string
): Promise<ExternalAccount | null> {
  await initAccountsCache()
  
  return accountsCache.find(
    a => a.serverUrl === serverUrl && a.username === username
  ) || null
}

/**
 * 获取所有外部账号
 */
export async function getAllExternalAccounts(): Promise<ExternalAccount[]> {
  await initAccountsCache()
  return [...accountsCache]
}

/**
 * 删除外部账号
 */
export async function deleteExternalAccount(accountId: string): Promise<boolean> {
  try {
    await invokeDeleteAccount(accountId)
    
    // 更新缓存
    accountsCache = accountsCache.filter(a => a.id !== accountId)
    
    return true
  } catch (error) {
    console.error('删除账号失败:', error)
    return false
  }
}

/**
 * 刷新账号缓存（从后端重新加载）
 */
export async function refreshAccountsCache(): Promise<void> {
  cacheInitialized = false
  await initAccountsCache()
}
