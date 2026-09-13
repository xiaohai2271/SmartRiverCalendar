// RSA 密码加密服务
// 使用 Web Crypto API 的 RSA-OAEP (SHA-256) 加密密码

import { usePlatform } from '@/platform/provider'

let cachedPublicKey: CryptoKey | null = null

/**
 * 从后端获取 RSA 公钥并导入为 CryptoKey
 * 通过 authRepo 统一获取，自动适配平台
 * @returns CryptoKey，失败抛出错误
 */
async function fetchPublicKey(): Promise<CryptoKey> {
  const { authRepo } = usePlatform()
  const publicKeyBase64 = await authRepo.getPublicKey()

  const binaryString = atob(publicKeyBase64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return await crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
}

/**
 * 使用 RSA-OAEP (SHA-256) 加密密码
 * @param password 明文密码
 * @returns Base64 编码的加密结果，失败抛出错误
 */
export async function encryptPassword(password: string): Promise<string> {
  if (!cachedPublicKey) {
    cachedPublicKey = await fetchPublicKey()
  }

  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cachedPublicKey,
    new TextEncoder().encode(password)
  )

  const encryptedArray = new Uint8Array(encrypted)
  let binary = ''
  for (let i = 0; i < encryptedArray.length; i++) {
    binary += String.fromCharCode(encryptedArray[i])
  }
  return btoa(binary)
}

/**
 * 清除缓存的公钥
 * 用于登出或公钥失效时调用
 */
export function clearCachedPublicKey(): void {
  cachedPublicKey = null
}
