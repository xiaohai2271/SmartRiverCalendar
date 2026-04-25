import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { sendNotification } from '@tauri-apps/plugin-notification'

// UpgradeLink 配置
// 请在 UpgradeLink 后台获取以下配置信息
// 1. 访问 https://www.toolsetlink.com 注册账户
// 2. 创建 Tauri 应用获取 tauriKey
// 3. 在密钥管理中获取 AccessKey 和 AccessSecret
const UPGRADE_CONFIG = {
  accessKey: 'jQuUu_dPgZgTaFyaTeVGBg', // 替换为您的 AccessKey
  tauriKey: 'VsD99h2Y0AHwh_gGf2iiJw',   // 替换为您的 Tauri Key
}

/**
 * 检查并安装更新
 * @param showNotification 是否显示系统通知
 */
export async function checkAndInstallUpdate(showNotification = true): Promise<void> {
  try {
    const currentVersion = await getVersion()
    console.log('当前版本:', currentVersion)

    const update = await check({
      timeout: 5000,
      headers: {
        'X-AccessKey': UPGRADE_CONFIG.accessKey,
      },
    })

    if (update) {
      console.log('发现新版本:', update.version)

      if (showNotification) {
        await sendNotification({
          title: '小河日历 - 发现新版本',
          body: `新版本 ${update.version} 可用，正在为您下载更新...`,
        })
      }

      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            console.log(`开始下载，总大小: ${contentLength} bytes`)
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            const percent = contentLength > 0
              ? (downloaded / contentLength * 100).toFixed(1)
              : '未知'
            console.log(`下载进度: ${percent}%`)
            break
          case 'Finished':
            console.log('下载完成')
            break
        }
      })

      console.log('安装完成，即将重启应用')

      if (showNotification) {
        await sendNotification({
          title: '小河日历 - 更新完成',
          body: '更新已安装，应用即将重启...',
        })
      }

      await relaunch()
    } else {
      console.log('当前已是最新版本')
    }
  } catch (error) {
    console.error('检查更新失败:', error)

    if (showNotification) {
      await sendNotification({
        title: '小河日历 - 更新失败',
        body: '检查更新时发生错误，请稍后重试',
      })
    }
  }
}

/**
 * 仅检查更新（不自动安装）
 * 返回是否有新版本可用
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const update = await check({
      timeout: 5000,
      headers: {
        'X-AccessKey': UPGRADE_CONFIG.accessKey,
      },
    })

    return update !== null
  } catch (error) {
    console.error('检查更新失败:', error)
    return false
  }
}

/**
 * 获取当前应用版本
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    return await getVersion()
  } catch (error) {
    console.error('获取版本失败:', error)
    return '0.0.0'
  }
}

// localStorage 存储键名
const SKIPPED_VERSION_KEY = 'skippedUpdateVersion'

/**
 * 获取跳过的版本
 * @returns 跳过的版本号，未跳过则返回 null
 */
export function getSkippedVersion(): string | null {
  const skipped = localStorage.getItem(SKIPPED_VERSION_KEY)
  return skipped
}

/**
 * 设置跳过的版本
 * @param version 要跳过的版本号
 */
export function setSkippedVersion(version: string): void {
  localStorage.setItem(SKIPPED_VERSION_KEY, version)
}

/**
 * 清除跳过的版本记录
 */
export function clearSkippedVersion(): void {
  localStorage.removeItem(SKIPPED_VERSION_KEY)
}

/**
 * 检查指定版本是否被跳过
 * @param version 要检查的版本号
 * @returns 是否已跳过该版本
 */
export function isVersionSkipped(version: string): boolean {
  const skipped = getSkippedVersion()
  return skipped === version
}

/**
 * 检查更新详情
 * @returns 更新信息，无更新或被跳过时返回 null
 */
export async function checkForUpdateDetails(): Promise<import('@/types').UpdateInfo | null> {
  try {
    const update = await check({
      timeout: 5000,
      headers: { 'X-AccessKey': UPGRADE_CONFIG.accessKey },
    })

    if (!update) return null

    // 检查是否被跳过
    if (isVersionSkipped(update.version)) return null

    return {
      version: update.version,
      body: update.body,
      date: update.date,
    }
  } catch (error) {
    console.error('检查更新失败:', error)
    return null // 静默返回 null
  }
}

/**
 * 开始下载并安装更新
 * @param updateInfo 更新信息
 */
export async function startUpdate(updateInfo: import('@/types').UpdateInfo): Promise<void> {
  // 重新获取 Update 对象
  const update = await check({
    timeout: 5000,
    headers: { 'X-AccessKey': UPGRADE_CONFIG.accessKey },
  })

  if (!update || update.version !== updateInfo.version) {
    throw new Error('无法获取更新信息')
  }

  await update.downloadAndInstall()
  // 不调用 relaunch()，Windows installer 会自动重启
}
