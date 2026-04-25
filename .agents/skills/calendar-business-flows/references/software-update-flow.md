# 软件更新流程

## 目录
1. [概述](#概述)
2. [更新流程图](#更新流程图)
3. [配置说明](#配置说明)
4. [核心代码逻辑](#核心代码逻辑)
5. [用户交互](#用户交互)
6. [常见问题](#常见问题)

## 概述

小河日历使用[UpgradeLink](https://www.toolsetlink.com/)平台进行应用分发和更新管理。UpgradeLink是一个全端应用升级与分发平台，支持Android、iOS、Mac、Windows、Linux、Tauri、Electron等多种应用类型。

### 升级流程
- **版本管理**: 在UpgradeLink后台管理应用版本和升级策略
- **版本检查**: 通过UpgradeLink API检查是否有新版本
- **自动更新**: 使用Tauri官方updater组件执行更新
- **增量更新**: 支持差分升级，减少下载流量

### 参考资源
- [Tauri应用接入指南](https://www.toolsetlink.com/upgrade/example/tauri/tauri-example.html)
- [GitHub Actions自动化部署](https://www.toolsetlink.com/upgrade/example/tauri/tauri-action-example.html)
- [UpgradeLink SDK文档](https://www.toolsetlink.com/upgrade/sdk/sdk)

## 更新流程图

### 旧流程（直接更新）
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  用户触发   │───▶│  检查更新   │───▶│  下载更新   │───▶│  安装更新   │
│  或自动检查 │    │  (服务器)   │    │  (签名验证) │    │  (installer │
└─────────────┘    └─────────────┘    └─────────────┘    │自动重启)    │
                                                       └─────────────┘
```

### 新流程（前端驱动弹窗）
```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│     应用启动        │    │     系统托盘        │    │     用户交互        │
│      或             │    │     点击检查        │    │     弹窗选项        │
│     定时检查        │    │     更新            │    │                     │
└─────────┬───────────┘    └─────────┬───────────┘    └─────────┬───────────┘
          │                          │                          │
          └───────┬──────────────────┘                          │
                  │                                             │
          ┌───────▼───────────┐                                │
          │ 检查更新详情       │                                │
          │ (过滤已跳过版本)   │                                │
          └───────┬───────────┘                                │
                  │                                             │
          ┌───────▼───────────┐                                │
          │ 有可用更新？       │                                │
          └───────┬───────────┘                                │
                  │                                             │
                  ├───────────── 否 ──────────▶ 结束           │
                  │                                             │
                  │ 是                                         │
                  │                                             │
          ┌───────▼───────────┐                                │
          │ 显示更新弹窗       │◀───────────────┐              │
          │ (UpdateDialog)     │                │              │
          └───────┬───────────┘                │              │
                  │                             │              │
          ┌───────▼───────────┐    ┌───────────▼───────────┐  │
          │ 用户选择           │    │ 稍后                  │  │
          │                    │    │ (关闭弹窗，           │  │
          │ 现在升级           │    │  下次启动再提示)      │  │
          │                    │    │                       │  │
          │ 稍后               │    │ 不再提示              │  │
          │                    │    │ (设置跳过版本，       │  │
          │ 不再提示           │    │  关闭弹窗)           │  │
          └───────┬───────────┘    └───────────────────────┘  │
                  │                                             │
          ┌───────▼───────────┐                                │
          │ 执行下载安装       │                                │
          │ (startUpdate)      │                                │
          └───────┬───────────┘                                │
                  │                                             │
          ┌───────▼───────────┐                                │
          │ installer          │                                │
          │ 自动重启应用       │                                │
          └────────────────────┘                                │
                                                                 │
          ┌──────────────────────────────────────────────────────┘
          │
          └─▶ Windows installer 会自动重启应用（通过 `/R` flag 或 `AUTOLAUNCHAPP=True`）
```

> **Windows 流程**: 安装进程会自动关闭应用并重启（通过 `/R` flag 或 `AUTOLAUNCHAPP=True`）。**不要手动调用 restart()**。

## 配置说明

### UpgradeLink平台配置

在UpgradeLink平台注册并创建Tauri应用后，会获得以下配置信息：

| 参数 | 说明 | 获取方式 |
|------|------|----------|
| `tauriKey` | UpgradeLink平台分配的应用唯一标识 | UpgradeLink后台 → 应用管理 |
| `pubkey` | Tauri应用签名公钥 | Tauri构建时生成 |
| `X-AccessKey` | API访问密钥 | UpgradeLink后台 → 应用设置 |

### 更新服务器配置 (`tauri.conf.json`)

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      },
      "nsis": {
        "installMode": "currentUser"
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDlDNTA0OTRDRjY2Q0QzNjEKUldSaDAyejJURWxRbkQyWUYzM3VFUFowNzFabHBTWktkUEsyOVNMZ1ZhVE5WbzhMRE5weU5WcHYK",
      "endpoints": [
        "https://api.upgrade.toolsetlink.com/v1/tauri/upgrade?tauriKey=VsD99h2Y0AHwh_gGf2iiJw&versionName={{current_version}}&appointVersionName=&devModelKey=&devKey=&target={{target}}&arch={{arch}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**配置参数详解：**

| 参数 | 说明 |
|------|------|
| `pubkey` | 用于验证更新包签名的公钥（Base64编码），确保更新包来自可信来源 |
| `endpoints` | UpgradeLink API端点，包含以下查询参数 |
| `tauriKey` | UpgradeLink平台分配的应用标识 |
| `versionName` | 当前应用版本号（自动填充） |
| `target` | 操作系统类型（自动填充）：windows/darwin/linux |
| `arch` | 系统架构（自动填充）：x86_64/aarch64等 |
| `plugins.updater.windows.installMode` | 更新安装模式："passive"表示静默安装，"basicUI"表示显示进度 |
| `bundle.windows.nsis.installMode` | **NSIS 安装模式**：`currentUser`（用户级安装，无需UAC）或 `perMachine`（系统级安装，需要UAC） |

> **重要**: `bundle.windows.nsis.installMode` 必须与旧版本保持一致！如果旧版本是用户级安装（`AppData\Local`），新版本也必须是 `currentUser`，否则会导致更新失败。

### API端点说明

UpgradeLink提供的Tauri更新API完全兼容Tauri官方更新协议：
- **版本检查**: `GET https://api.upgrade.toolsetlink.com/v1/tauri/upgrade`
- **文件下载**: `GET https://api.upgrade.toolsetlink.com/v1/tauri/download`

响应格式符合Tauri官方规范，可无缝替换使用。

## 核心代码逻辑

### 更新模块 (`src-tauri/src/updater.rs`)

#### 1. 创建更新器
```rust
pub fn create_updater(app_handle: &AppHandle) -> Result<Updater, String> {
    app_handle
        .updater_builder()
        .header("X-AccessKey", UPDATE_API_KEY)
        .map_err(|e| format!("设置请求头失败: {}", e))?
        .build()
        .map_err(|e| format!("构建更新器失败: {}", e))
}
```

#### 2. 检查更新
```rust
pub async fn check_for_updates(app_handle: AppHandle) -> UpdateCheckResult {
    let updater = match create_updater(&app_handle) {
        Ok(u) => u,
        Err(e) => return UpdateCheckResult::InitFailed(e),
    };

    match updater.check().await {
        Ok(Some(update)) => UpdateCheckResult::UpdateAvailable(update),
        Ok(None) => UpdateCheckResult::UpToDate,
        Err(e) => UpdateCheckResult::Failed(format!("{}", e)),
    }
}
```

#### 3. 下载并安装更新
```rust
pub async fn download_and_install_update(update: Update) -> Result<(), String> {
    update
        .download_and_install(
            |_downloaded, _total| {
                // 进度回调，可在此处更新 UI 进度条
            },
            || {
                // 下载完成回调
                log::info!("更新包下载完成");
            },
        )
        .await
        .map_err(|e| format!("下载或安装更新失败: {}", e))?;

    log::info!("更新安装完成");
    Ok(())
}
```

#### 4. 处理更新结果
```rust
pub async fn handle_update_result(app_handle: AppHandle, result: UpdateCheckResult) {
    match result {
        UpdateCheckResult::UpdateAvailable(update) => {
            log::info!("有新版本可用: {}", update.version);
            match download_and_install_update(update).await {
                Ok(()) => {
                    log::info!("更新安装成功，等待 installer 自动重启应用...");
                    // Windows installer 会自动重启应用
                    // 不要手动调用 restart()
                }
                Err(e) => {
                    log::error!("下载更新失败: {}", e);
                }
            }
        }
        UpdateCheckResult::UpToDate => {
            log::info!("当前已是最新版本");
        }
        UpdateCheckResult::Failed(e) => {
            log::error!("检查更新失败: {}", e);
        }
        UpdateCheckResult::InitFailed(e) => {
            log::error!("初始化更新器失败: {}", e);
        }
    }
}
```

> **关键依赖**: 重启功能依赖 `tauri-plugin-process` 插件，需要在 `Cargo.toml` 中添加依赖并在 `lib.rs` 中注册。

### 更新检查结果枚举
```rust
pub enum UpdateCheckResult {
    UpdateAvailable(Update),  // 有新版本可用
    UpToDate,                 // 当前已是最新版本
    Failed(String),           // 检查失败
    InitFailed(String),       // 更新器初始化失败
}
```

## 用户交互

### 前端驱动更新弹窗逻辑

新的更新流程采用前端驱动弹窗方式，提供更好的用户体验和更灵活的交互选项。

#### 1. 应用启动时自动检查
应用启动时会自动调用 `checkForUpdateDetails()` 函数检查更新：
```typescript
// 在应用启动时检查更新
import { checkForUpdateDetails } from '@/services/updater'

async function onAppStart() {
  const updateInfo = await checkForUpdateDetails()
  if (updateInfo) {
    // 显示更新弹窗
    showUpdateDialog(updateInfo)
  }
}
```

#### 2. 系统托盘菜单点击
系统托盘菜单中的"检查更新"选项不再直接调用 Rust 端的 `check_for_updates()`，而是：
1. 先恢复主窗口
2. 发送 "check-update" 事件给前端
3. 前端监听事件后执行检查并显示弹窗

```rust
// Rust 端系统托盘事件处理
"check_update" => {
    // 恢复主窗口
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    
    // 发送事件给前端
    app.emit("check-update", ()).unwrap();
}
```

#### 3. 前端事件监听
前端监听 "check-update" 事件：
```typescript
// 在应用初始化时监听检查更新事件
import { listen } from '@tauri-apps/api/event'
import { checkForUpdateDetails } from '@/services/updater'

listen('check-update', async () => {
  const updateInfo = await checkForUpdateDetails()
  if (updateInfo) {
    showUpdateDialog(updateInfo)
  }
})
```

#### 4. 更新弹窗交互
用户通过 UpdateDialog 组件进行交互：

| 选项 | 行为 | 实现方式 |
|------|------|----------|
| **现在升级** | 立即下载并安装更新 | 调用 `startUpdate(updateInfo)` |
| **稍后** | 关闭弹窗，下次启动时再提示 | 调用 `emit('close')` |
| **不再提示** | 跳过当前版本，不再提示 | 调用 `setSkippedVersion(updateInfo.version)` |

### 跳过版本管理
用户可以选择"不再提示"来跳过特定版本的更新提醒。跳过版本信息存储在浏览器的 `localStorage` 中：

```typescript
// 存储跳过的版本
const SKIPPED_VERSION_KEY = 'skippedUpdateVersion'

// 获取跳过的版本
export function getSkippedVersion(): string | null {
  const skipped = localStorage.getItem(SKIPPED_VERSION_KEY)
  return skipped
}

// 设置跳过的版本
export function setSkippedVersion(version: string): void {
  localStorage.setItem(SKIPPED_VERSION_KEY, version)
}

// 清除跳过的版本记录
export function clearSkippedVersion(): void {
  localStorage.removeItem(SKIPPED_VERSION_KEY)
}

// 检查版本是否被跳过
export function isVersionSkipped(version: string): boolean {
  const skipped = getSkippedVersion()
  return skipped === version
}
```

#### 5. 完整的更新检查流程
完整的前端更新检查流程如下：

1. **调用检查函数**: 调用 `checkForUpdateDetails()` 函数
2. **请求服务器**: 通过 Tauri updater 插件请求 UpgradeLink API
3. **过滤已跳过版本**: 检查返回的版本是否已被用户跳过
4. **返回更新信息**: 如果有新版本且未被跳过，返回更新信息对象
5. **显示弹窗**: 前端收到更新信息后显示 UpdateDialog 组件

**关键函数**:
- `checkForUpdateDetails()`: 检查更新详情，过滤已跳过版本
- `startUpdate()`: 执行下载安装，不手动调用重启
- `setSkippedVersion()`: 设置跳过版本
- `clearSkippedVersion()`: 清除跳过版本记录
- `isVersionSkipped()`: 检查版本是否被跳过

### 系统托盘菜单
在系统托盘菜单中添加了"检查更新"选项：
```rust
let check_update = MenuItemBuilder::new("检查更新")
    .id("check_update")
    .build(app)?;
```

### 事件处理
当用户点击"检查更新"时：
```rust
"check_update" => {
    // 恢复主窗口并发送事件给前端
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    
    // 发送事件给前端，由前端处理更新检查
    app.emit("check-update", ()).unwrap();
}
```

### Rust 端变化

新的前端驱动更新弹窗逻辑对 Rust 后端进行了以下调整：

#### 1. 系统托盘事件处理变化
```rust
// 旧版本：直接调用更新检查
"check_update" => {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = updater::check_for_updates(app_handle.clone()).await;
        updater::handle_update_result(app_handle, result).await;
    });
}

// 新版本：发送事件给前端，由前端处理
"check_update" => {
    // 恢复主窗口
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    
    // 发送事件给前端
    app.emit("check-update", ()).unwrap();
}
```

#### 2. 前端事件监听
前端需要监听 "check-update" 事件：
```typescript
import { listen } from '@tauri-apps/api/event'

// 监听检查更新事件
listen('check-update', async () => {
  const updateInfo = await checkForUpdateDetails()
  if (updateInfo) {
    showUpdateDialog(updateInfo)
  }
})
```

#### 3. 应用启动时自动检查
应用启动时自动检查更新的逻辑移到前端：
```typescript
// 应用启动时检查更新
async function initApp() {
  // ... 其他初始化代码
  
  // 检查更新
  const updateInfo = await checkForUpdateDetails()
  if (updateInfo) {
    showUpdateDialog(updateInfo)
  }
}
```

### 必要插件配置

更新流程依赖以下 Tauri 插件：

1. **tauri-plugin-updater**: 提供更新检查、下载、安装功能
2. **tauri-plugin-process**: 提供应用重启功能 (`app.restart()` / `relaunch()`)

在 `Cargo.toml` 中添加：
```toml
[dependencies]
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

在 `lib.rs` 中注册：
```rust
.plugin(tauri_plugin_process::init())
.plugin(tauri_plugin_updater::Builder::default().build())
```

## 常见问题

### 1. 更新检查失败
**可能原因：**
- 网络连接问题
- UpgradeLink服务器不可用
- tauriKey或X-AccessKey无效
- 应用未在UpgradeLink平台正确配置

**解决方案：**
1. 检查网络连接
2. 验证tauriKey是否正确（从UpgradeLink后台获取）
3. 确认X-AccessKey是否有效
4. 在UpgradeLink后台检查应用版本是否已上传

### 2. 更新下载失败
**可能原因：**
- 磁盘空间不足
- 文件权限问题
- UpgradeLink平台文件存储异常

**解决方案：**
1. 清理磁盘空间
2. 以管理员权限运行应用
3. 检查UpgradeLink后台版本文件是否正常

### 3. 更新安装失败
**可能原因：**
- 签名验证失败（pubkey配置错误）
- 文件被占用
- 系统权限不足

**解决方案：**
1. 确保使用与构建时匹配的公钥
2. 关闭应用后重试
3. 以管理员权限运行

### 4. 更新安装后未生效（程序重启但版本未变）
**可能原因：**
- 手动调用 `Restart()` 导致安装进程被终止
- `installMode: "passive"` 模式下过早重启

**解决方案：**
1. **不要手动调用 restart()** - Windows installer 会自动处理
2. 确保 `installMode` 设置为 "passive"
3. 检查日志确认没有过早重启
4. NSIS installer 会通过 `/R` flag 自动重启
5. MSI installer 会通过 `AUTOLAUNCHAPP=True` 自动重启

### 5. UAC 弹窗后更新失败（安装程序未执行安装）
**可能原因：**
- 新旧版本的 `nsis.installMode` 不一致
- 旧版本是 `currentUser` 模式，新版本尝试 `perMachine` 安装
- NSIS installer 在错误的注册表位置查找旧版本信息

**解决方案：**
1. 确保在 `tauri.conf.json` 中明确配置 `bundle.windows.nsis.installMode`
2. 如果旧版本安装在 `AppData\Local`，新版本必须设置 `installMode: "currentUser"`
3. 如果旧版本安装在 `Program Files`，新版本必须设置 `installMode: "perMachine"`
4. 检查旧版本注册表位置：
   - `currentUser`: `HKCU\Software\[厂商]\[产品名]`
   - `perMachine`: `HKLM\Software\[厂商]\[产品名]`

### 6. 如何获取tauriKey？
1. 登录 [UpgradeLink控制台](https://www.toolsetlink.com/)
2. 创建Tauri类型应用
3. 在应用详情页获取tauriKey

### 7. 如何上传新版本？
有两种方式：
1. **手动上传**: 在UpgradeLink后台手动上传latest.json和安装包
2. **GitHub Actions自动化**: 使用[upgradelink-action](https://github.com/toolsetlink/upgradelink-action)自动上传

### 8. 升级策略如何配置？
在UpgradeLink后台可以配置：
- **全量升级**: 所有用户立即收到更新
- **灰度发布**: 按比例逐步推送更新
- **版本指定**: 指定从某个版本升级到目标版本

### 9. 前端更新弹窗不显示
**可能原因：**
- 前端没有正确监听 "check-update" 事件
- 应用启动时没有调用 `checkForUpdateDetails()`
- 更新版本已被跳过

**解决方案：**
1. 确保前端正确监听事件：
   ```typescript
   import { listen } from '@tauri-apps/api/event'
   
   listen('check-update', async () => {
     const updateInfo = await checkForUpdateDetails()
     if (updateInfo) {
       showUpdateDialog(updateInfo)
     }
   })
   ```
2. 检查应用启动时是否调用了更新检查
3. 检查 localStorage 中是否有跳过的版本记录

### 10. 用户选择"不再提示"后如何恢复提示？
**解决方案：**
1. 清除跳过的版本记录：
   ```typescript
   import { clearSkippedVersion } from '@/services/updater'
   
   clearSkippedVersion()
   ```
2. 或者在设置页面添加"重置更新提示"选项

### 11. 更新弹窗层级问题
**可能原因：**
- 弹窗被其他组件遮挡
- `z-index` 设置不正确

**解决方案：**
1. 确保 UpdateDialog 使用 `Teleport` 渲染到 `body`
2. 设置正确的 `z-index`（当前为 10001，高于 ReminderPopup 的 10000）
3. 检查是否有其他组件设置了更高的 `z-index`

### UpdateDialog 组件 (`src/components/update/UpdateDialog.vue`)

更新弹窗组件用于显示新版本信息和用户交互选项。该组件使用 Vue 3 Composition API 编写，遵循项目统一的代码规范。

#### 组件导入
```vue
<script setup lang="ts">
import UpdateDialog from '@/components/update/UpdateDialog.vue'
</script>
```

#### 组件 Props
| 属性 | 类型 | 说明 |
|------|------|------|
| `visible` | `boolean` | 控制对话框显示/隐藏（必需） |
| `updateInfo` | `UpdateInfo \| null` | 更新信息，包含版本号、更新日志等（必需） |
| `loading` | `boolean` | 是否处于下载/安装中状态（可选，默认: `false`） |

#### 组件 Events
| 事件 | 说明 | 参数 |
|------|------|------|
| `upgrade` | 用户点击"现在升级"按钮 | 无 |
| `later` | 用户点击"稍后"按钮 | 无 |
| `skip` | 用户点击"不再提示"按钮 | 无 |
| `close` | 用户关闭对话框（点击关闭按钮或遮罩层） | 无 |

#### 组件特点
1. **渲染位置**: 使用 `Teleport` 将组件渲染到 `body` 元素，避免层级问题
2. **动画效果**: 使用 Vue 的 `Transition` 组件提供平滑的动画效果
3. **禁用状态**: 在 `loading` 状态下禁用所有按钮，防止重复操作
4. **安全渲染**: 使用 `v-html` 渲染更新日志时进行 HTML 转义（由 Vue 自动处理）
5. **键盘友好**: 支持 ESC 键关闭（通过遮罩层点击事件实现）

#### 使用示例
```vue
<template>
  <UpdateDialog
    :visible="showUpdateDialog"
    :update-info="updateInfo"
    :loading="isUpdating"
    @upgrade="handleUpgrade"
    @later="handleLater"
    @skip="handleSkip"
    @close="handleClose"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import UpdateDialog from '@/components/update/UpdateDialog.vue'
import { checkForUpdateDetails, startUpdate, setSkippedVersion } from '@/services/updater'

const showUpdateDialog = ref(false)
const updateInfo = ref(null)
const isUpdating = ref(false)

// 检查更新并显示弹窗
async function checkAndShowUpdate() {
  const info = await checkForUpdateDetails()
  if (info) {
    updateInfo.value = info
    showUpdateDialog.value = true
  }
}

// 处理升级
async function handleUpgrade() {
  if (!updateInfo.value) return
  
  isUpdating.value = true
  try {
    await startUpdate(updateInfo.value)
  } catch (error) {
    console.error('更新失败:', error)
  } finally {
    isUpdating.value = false
  }
}

// 处理稍后
function handleLater() {
  showUpdateDialog.value = false
}

// 处理跳过
function handleSkip() {
  if (updateInfo.value) {
    setSkippedVersion(updateInfo.value.version)
  }
  showUpdateDialog.value = false
}

// 处理关闭
function handleClose() {
  showUpdateDialog.value = false
}
</script>
```

#### 样式特性
- **遮罩层**: 半透明黑色背景 (`rgba(0, 0, 0, 0.5)`)，模糊效果 (`backdrop-filter: blur(4px)`)
- **对话框**: Fluent Design 风格，圆角阴影，使用 CSS 变量定义样式
- **动画**: 淡入淡出 + 缩放动画，使用 CSS transition 和 keyframes 实现
- **响应式**: 移动端适配（`max-width: 480px`），按钮自适应布局
- **层级**: `z-index: 10001`（高于提醒弹窗的 10000）

#### 关键 CSS 类
- `.dialog-overlay`: 遮罩层容器
- `.update-dialog`: 对话框主体
- `.dialog-header`: 对话框头部，包含标题和关闭按钮
- `.dialog-body`: 对话框内容区域，显示更新日志
- `.dialog-footer`: 对话框底部按钮区域
- `.btn-accent`: 主要操作按钮（"现在升级"）
- `.btn-secondary`: 次要操作按钮（"稍后"、"不再提示"）

#### 实现细节
1. **位置控制**: 对话框居中显示，最大宽度 480px
2. **滚动处理**: 内容区域有滚动条，限制最大高度
3. **按钮状态**: 根据 `loading` 状态禁用/启用按钮
4. **关闭方式**: 点击关闭按钮或遮罩层都会触发关闭事件
5. **更新日志渲染**: 支持 HTML 内容，样式已预定义

## 相关文件

- 配置文件: `src-tauri/tauri.conf.json`
- Rust 更新逻辑: `src-tauri/src/updater.rs`
- Rust 主程序入口: `src-tauri/src/lib.rs`
- 前端更新服务: `src/services/updater.ts`
- 前端更新弹窗: `src/components/update/UpdateDialog.vue`
- 前端更新测试: `src/__tests__/updater.test.ts`
- 前端组件测试: `src/__tests__/UpdateDialog.test.ts`
- 系统托盘逻辑: `src-tauri/src/lib.rs`

### 前端更新服务 (`src/services/updater.ts`)

前端使用 `@tauri-apps/plugin-updater` 和 `@tauri-apps/plugin-process` 实现更新流程，新增了弹窗交互和跳过版本功能。

#### 1. 检查更新详情（过滤已跳过版本）
```typescript
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
```

#### 2. 开始下载并安装更新
```typescript
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
```

#### 3. 跳过版本管理工具函数
```typescript
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
```

#### 4. 旧版兼容函数
```typescript
/**
 * 检查并安装更新（旧版兼容）
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
```

> **注意**: 前端的 `relaunch()` 需要 Rust 端注册 `tauri-plugin-process` 插件才能正常工作。

## UpgradeLink平台资源

- [UpgradeLink官网](https://www.toolsetlink.com/)
- [Tauri应用接入指南](https://www.toolsetlink.com/upgrade/example/tauri/tauri-example.html)
- [GitHub Actions自动化部署](https://www.toolsetlink.com/upgrade/example/tauri/tauri-action-example.html)
- [Tauri应用升级接入模板](https://www.toolsetlink.com/upgrade/skill/tauri.html)
- [SDK文档](https://www.toolsetlink.com/upgrade/sdk/sdk)