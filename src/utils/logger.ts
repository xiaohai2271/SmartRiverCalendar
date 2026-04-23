/**
 * 前端日志工具
 * 默认不捕获日志，只在调试页面打开时启用捕获
 * 避免影响正常运行的性能
 */

interface LogItem {
  time: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

const LOG_KEY = 'debug_logs'
const MAX_LOGS = 500 // 最多存储 500 条日志

// 保存原始 console 方法
let originalLog: typeof console.log | null = null
let originalInfo: typeof console.info | null = null
let originalWarn: typeof console.warn | null = null
let originalError: typeof console.error | null = null
let originalDebug: typeof console.debug | null = null

let isCapturing = false

/**
 * 获取存储的日志
 */
export function getStoredLogs(): LogItem[] {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // 忽略解析错误
  }
  return []
}

/**
 * 保存日志到 localStorage
 */
function saveLog(level: LogItem['level'], ...args: any[]) {
  if (!isCapturing) return
  
  try {
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

    const logItem: LogItem = {
      time: new Date().toISOString(),
      level,
      message
    }

    const logs = getStoredLogs()
    logs.push(logItem)
    
    // 超过最大数量时删除旧日志
    while (logs.length > MAX_LOGS) {
      logs.shift()
    }
    
    localStorage.setItem(LOG_KEY, JSON.stringify(logs))
  } catch {
    // localStorage 可能已满，忽略错误
  }
}

/**
 * 启用日志捕获（调试页面打开时调用）
 */
export function startLogCapture() {
  if (isCapturing) return
  
  // 保存原始方法
  originalLog = console.log
  originalInfo = console.info
  originalWarn = console.warn
  originalError = console.error
  originalDebug = console.debug

  // 替换 console 方法
  console.log = (...args: any[]) => {
    originalLog!.apply(console, args)
    saveLog('info', ...args)
  }

  console.info = (...args: any[]) => {
    originalInfo!.apply(console, args)
    saveLog('info', ...args)
  }

  console.warn = (...args: any[]) => {
    originalWarn!.apply(console, args)
    saveLog('warn', ...args)
  }

  console.error = (...args: any[]) => {
    originalError!.apply(console, args)
    saveLog('error', ...args)
  }

  console.debug = (...args: any[]) => {
    originalDebug!.apply(console, args)
    saveLog('debug', ...args)
  }

  isCapturing = true
  console.log('[Logger] 日志捕获已启用')
}

/**
 * 停用日志捕获（调试页面关闭时调用）
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
  console.log('[Logger] 日志捕获已停用')
}

/**
 * 清空存储的日志
 */
export function clearStoredLogs() {
  localStorage.removeItem(LOG_KEY)
}

/**
 * 导出日志为文本
 */
export function exportLogsAsString(): string {
  const logs = getStoredLogs()
  return logs.map(log => 
    `[${log.time}] [${log.level.toUpperCase()}] ${log.message}`
  ).join('\n')
}
