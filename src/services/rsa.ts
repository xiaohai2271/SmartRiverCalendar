// RSA 密码加密服务
// 使用 Web Crypto API 的 RSA-OAEP (SHA-256) 加密密码

import { usePlatform } from '@/platform/provider'

// 缓存的公钥
let cachedPublicKey: CryptoKey | null = null

/**
 * 从后端获取 RSA 公钥并导入为 CryptoKey
 * 通过 authRepo 统一获取，自动适配平台
 * @returns CryptoKey 或 null
 */
async function fetchPublicKey(): Promise<CryptoKey | null> {
  try {
    const { authRepo } = usePlatform()
    const publicKeyBase64 = await authRepo.getPublicKey()

    if (!publicKeyBase64) return null

    // Base64 解码为二进制
    const binaryString = atob(publicKeyBase64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // 导入 SPKI 格式的 RSA 公钥
    return await crypto.subtle.importKey(
      'spki',
      bytes.buffer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    )
  } catch (error) {
    console.error('[RSA] 获取公钥失败:', error)
    return null
  }
}

/**
 * 使用 RSA-OAEP (SHA-256) 加密密码
 * @param password 明文密码
 * @returns Base64 编码的加密结果，失败返回 null
 */
export async function encryptPassword(password: string): Promise<string | null> {
  try {
    // 获取或使用缓存的公钥
    if (!cachedPublicKey) {
      cachedPublicKey = await fetchPublicKey()
    }
    if (!cachedPublicKey) return null

    // RSA-OAEP 加密
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      cachedPublicKey,
      new TextEncoder().encode(password)
    )

    // 转换为 Base64
    const encryptedArray = new Uint8Array(encrypted)
    let binary = ''
    for (let i = 0; i < encryptedArray.length; i++) {
      binary += String.fromCharCode(encryptedArray[i])
    }
    return btoa(binary)
  } catch (error) {
    console.error('[RSA] 密码加密失败:', error)
    // 加密失败时清除缓存，下次重试
    cachedPublicKey = null
    return null
  }
}

/**
 * 清除缓存的公钥
 * 用于登出或公钥失效时调用
 */
export function clearCachedPublicKey(): void {
  cachedPublicKey = null
}
