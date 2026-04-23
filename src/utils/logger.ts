/**
 * 前端日志工具
 * 使用内存缓冲区存储日志，性能影响极小
 * 应用启动时就开始捕获，调试页面可查看所有历史日志
 */

interface LogItem {
  time: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

const MAX_LOGS = 500 // 最多存储 500 条日志

// 内存缓冲区（极快，几乎无性能影响）
const logBuffer: LogItem[] = []

// 保存原始 console 方法
let originalLog: typeof console.log | null = null
let originalInfo: typeof console.info | null = null
let originalWarn: typeof console.warn | null = null
let originalError: typeof console.error | null = null
let originalDebug: typeof console.debug | null = null

let isCapturing = false

/**
 * 添加日志到内存缓冲区
 */
function addLog(level: LogItem['level'], ...args: any[]) {
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 0)
      } catch {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')

  logBuffer.push({
    time: new Date().toISOString(),
    level,
    message
  })

  // 超过最大数量时删除旧日志
  while (logBuffer.length > MAX_LOGS) {
    logBuffer.shift()
  }
}

/**
 * 启用日志捕获（应用启动时调用）
 */
export function startLogCapture() {
  if (isCapturing) return

  // 保存原始方法
  originalLog = console.log
  originalInfo = console.info
  originalWarn = console.warn
  originalError = console.error
  originalDebug = console.debug

  // 替换 console 方法（内存操作，性能影响极小）
  console.log = (...args: any[]) => {
    originalLog!.apply(console, args)
    addLog('info', ...args)
  }

  console.info = (...args: any[]) => {
    originalInfo!.apply(console, args)
    addLog('info', ...args)
  }

  console.warn = (...args: any[]) => {
    originalWarn!.apply(console, args)
    addLog('warn', ...args)
  }

  console.error = (...args: any[]) => {
    originalError!.apply(console, args)
    addLog('error', ...args)
  }

  console.debug = (...args: any[]) => {
    originalDebug!.apply(console, args)
    addLog('debug', ...args)
  }

  isCapturing = true
  console.log('[Logger] 日志捕获已启用（内存模式）')
}

/**
 * 停用日志捕获
 */
export function stopLogCapture() {
  if (!isCapturing) return

  // 恢复原始方法
  if (originalLog) console.log = originalLog
  if (originalInfo) console.info = originalInfo
  if (originalWarn) console.warn = originalWarn
  if (originalError) console.error = originalError
  if (originalDebug) console.debug = originalDebug

  isCapturing = false
}

/**
 * 获取所有日志（从内存读取，极快）
 */
export function getStoredLogs(): LogItem[] {
  return [...logBuffer] // 返回副本，避免外部修改
}

/**
 * 清空日志
 */
export function clearStoredLogs() {
  logBuffer.length = 0
}

/**
 * 导出日志为文本
 */
export function exportLogsAsString(): string {
  return logBuffer.map(log =>
    `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
  ).join('\n')
}
