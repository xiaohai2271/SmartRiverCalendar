// 窗口切换事件监听 composable
// 监听 Rust 后端发射的 window-toggle-request 和 popup-toggle-request 事件
// 根据来源调度窗口显隐
// 防抖和竞态保护已内置在 toggleCalendarPopup 函数中

import { listen, emit } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { toggleCalendarPopup, type PopupRect } from './useCalendarPopup'

/// 窗口切换请求来源
interface WindowToggleRequest {
  source: 'ClockArea' | 'TrayIcon'
  monitorType?: 'Primary' | 'Secondary'
  clockRect?: PopupRect
}

/// 精简日历切换请求来源
interface PopupToggleRequest {
  source: 'TrayMenu'
}

/// 初始化窗口切换事件监听
export async function initWindowToggleListener() {
  // 监听窗口切换事件（时钟区域点击、托盘左键点击）
  await listen<WindowToggleRequest>('window-toggle-request', async (event) => {
    const { source, monitorType, clockRect } = event.payload

    // 根据来源决定行为
    // ClockArea: 切换日历弹出窗口（简化版日历视图）
    // TrayIcon: 切换主窗口（完整功能窗口）
    // 注意：toggleCalendarPopup 内置了防抖（300ms）和竞态保护
    if (source === 'ClockArea') {
      // 主窗口可见时也正常弹出弹出窗口
      await toggleCalendarPopup(monitorType, clockRect)
    } else {
      await toggleMainWindow()
    }
  })

  // 监听精简日历切换事件（托盘右键菜单）
  // 与时钟区域 Hook 不冲突：
  // - toggleCalendarPopup 通过实时查询窗口可见性决定切换方向
  // - 时钟区域唤醒的精简窗口，可被右键菜单切换隐藏
  await listen<PopupToggleRequest>('popup-toggle-request', async () => {
    await toggleCalendarPopup()
  })

  // 监听窗口隐藏事件（用户点击关闭按钮）
  // 当 Rust 端隐藏窗口时，更新菜单状态
  await listen('popup-hidden', async () => {
    console.log('[useWindowToggle] 收到 popup-hidden 事件，更新菜单状态')
    await emit('popup-visibility-changed', { visible: false })
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
