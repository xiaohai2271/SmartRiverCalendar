// 窗口切换事件监听 composable
// 监听 Rust 后端发射的 window-toggle-request 事件，根据来源调度窗口显隐

import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

/// 窗口切换请求来源
interface WindowToggleRequest {
  source: 'ClockArea' | 'TrayIcon'
}

/// 初始化窗口切换事件监听
export async function initWindowToggleListener() {
  await listen<WindowToggleRequest>('window-toggle-request', async (event) => {
    const { source: _source } = event.payload

    // 根据来源和用户设置决定行为
    // 后续扩展：_source === 'ClockArea' 时可选择显示简化版窗口
    // 目前统一切换主窗口显隐
    await toggleMainWindow()
  })
}

/// 切换主窗口显隐
async function toggleMainWindow() {
  const mainWindow = getCurrentWindow()
  const isVisible = await mainWindow.isVisible()
  if (isVisible) {
    await mainWindow.hide()
  } else {
    await mainWindow.show()
    await mainWindow.setFocus()
  }
}
