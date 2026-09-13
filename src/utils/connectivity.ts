// 连通性检查工具
// 双端共用（桌面端 + Web 端），检查 API 地址和平台地址的可达性

/** 连通性检查状态 */
export interface ConnectivityStatus {
  /** 是否可达 */
  reachable: boolean
  /** 响应延迟（毫秒） */
  latencyMs: number | null
  /** 错误信息 */
  error: string | null
  /** 是否检测到"小河日历"关键字（仅平台地址使用） */
  keywordFound: boolean | null
}

/** 连通性检查结果 */
export interface ConnectivityCheckResult {
  /** API 接口地址检查结果 */
  apiUrl: ConnectivityStatus
  /** 平台地址检查结果 */
  platformUrl: ConnectivityStatus
}

/** 检查超时（毫秒） */
const CHECK_TIMEOUT = 5000

/** 检查 API 地址连通性 */
async function checkApiUrl(url: string): Promise<ConnectivityStatus> {
  const start = performance.now()
  try {
    // 优先尝试 /health 端点
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT)
    try {
      const resp = await fetch(`${url}/health`, { signal: controller.signal })
      clearTimeout(timer)
      const latencyMs = Math.round(performance.now() - start)
      if (resp.ok) {
        return { reachable: true, latencyMs, error: null, keywordFound: null }
      }
      // /health 返回 404 等非成功状态，降级为 HEAD 请求
      const headController = new AbortController()
      const headTimer = setTimeout(() => headController.abort(), CHECK_TIMEOUT)
      try {
        const headResp = await fetch(url, { method: 'HEAD', signal: headController.signal })
        clearTimeout(headTimer)
        return {
          reachable: headResp.status < 500,
          latencyMs: Math.round(performance.now() - start),
          error: headResp.status >= 500 ? `服务端错误: ${headResp.status}` : null,
          keywordFound: null,
        }
      } catch {
        clearTimeout(headTimer)
        // HEAD 也失败，用 GET 检测
        const getController = new AbortController()
        const getTimer = setTimeout(() => getController.abort(), CHECK_TIMEOUT)
        try {
          const getResp = await fetch(url, { signal: getController.signal })
          clearTimeout(getTimer)
          return {
            reachable: getResp.status < 500,
            latencyMs: Math.round(performance.now() - start),
            error: null,
            keywordFound: null,
          }
        } catch (getErr) {
          clearTimeout(getTimer)
          throw getErr
        }
      }
    } catch {
      clearTimeout(timer)
      throw new Error('请求失败')
    }
  } catch (err) {
    const errorMsg = err instanceof DOMException && err.name === 'AbortError'
      ? '连接超时'
      : err instanceof TypeError && err.message.includes('CORS')
        ? 'CORS 限制，无法检查'
        : err instanceof TypeError
          ? '网络错误或 CORS 限制'
          : String(err)
    return { reachable: false, latencyMs: null, error: errorMsg, keywordFound: null }
  }
}

/** 检查平台地址连通性（含小河日历关键字验证） */
async function checkPlatformUrl(url: string): Promise<ConnectivityStatus> {
  const start = performance.now()
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT)
    try {
      const resp = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      const latencyMs = Math.round(performance.now() - start)
      if (!resp.ok) {
        return { reachable: false, latencyMs, error: `HTTP ${resp.status}`, keywordFound: null }
      }
      // 检查响应中是否包含"小河日历"关键字
      try {
        const text = await resp.text()
        const keywordFound = text.includes('小河日历')
        return { reachable: true, latencyMs, error: null, keywordFound }
      } catch {
        // 无法读取响应体（可能是 CORS 限制），只判断 HTTP 可达
        return { reachable: true, latencyMs, error: null, keywordFound: null }
      }
    } catch {
      clearTimeout(timer)
      throw new Error('请求失败')
    }
  } catch (err) {
    const errorMsg = err instanceof DOMException && err.name === 'AbortError'
      ? '连接超时'
      : err instanceof TypeError
        ? '网络错误或 CORS 限制'
        : String(err)
    return { reachable: false, latencyMs: null, error: errorMsg, keywordFound: null }
  }
}

/** 检查 API 地址和平台地址的连通性 */
export async function checkConnectivity(
  apiUrl: string,
  platformUrl: string
): Promise<ConnectivityCheckResult> {
  const [apiResult, platformResult] = await Promise.all([
    checkApiUrl(apiUrl),
    checkPlatformUrl(platformUrl),
  ])
  return { apiUrl: apiResult, platformUrl: platformResult }
}
