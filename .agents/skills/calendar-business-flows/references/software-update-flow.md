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

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  用户触发   │───▶│  检查更新   │───▶│  下载更新   │───▶│  安装更新   │───▶│  重启应用   │
│  或自动检查 │    │  (服务器)   │    │  (签名验证) │    │  (完成)     │    │  (生效)     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

> **重要**: 安装完成后必须调用 `app.restart()` (Rust) 或 `relaunch()` (前端) 重启应用，更新才能生效。

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
| `windows.installMode` | 更新安装模式："passive"表示静默安装，"basicUI"表示显示进度 |

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

#### 4. 处理更新结果并重启
```rust
pub async fn handle_update_result(app_handle: AppHandle, result: UpdateCheckResult) {
    match result {
        UpdateCheckResult::UpdateAvailable(update) => {
            log::info!("有新版本可用: {}", update.version);
            match download_and_install_update(update).await {
                Ok(()) => {
                    log::info!("更新安装成功，正在重启应用...");
                    // 使用 tauri-plugin-process 提供的 restart 功能
                    app_handle.restart();
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
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let result = updater::check_for_updates(app_handle.clone()).await;
        updater::handle_update_result(app_handle, result).await;
    });
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
- 缺少 `tauri-plugin-process` 插件
- 安装完成后未调用重启方法
- `installMode: "passive"` 模式下应用过早重启，安装进程被终止

**解决方案：**
1. 确保 `Cargo.toml` 中添加了 `tauri-plugin-process = "2"` 依赖
2. 确保 `lib.rs` 中注册了 `.plugin(tauri_plugin_process::init())`
3. 确保 `updater.rs` 在安装完成后调用 `app_handle.restart()`
4. 检查日志确认更新流程完整执行

### 4. 如何获取tauriKey？
1. 登录 [UpgradeLink控制台](https://www.toolsetlink.com/)
2. 创建Tauri类型应用
3. 在应用详情页获取tauriKey

### 5. 如何上传新版本？
有两种方式：
1. **手动上传**: 在UpgradeLink后台手动上传latest.json和安装包
2. **GitHub Actions自动化**: 使用[upgradelink-action](https://github.com/toolsetlink/upgradelink-action)自动上传

### 6. 升级策略如何配置？
在UpgradeLink后台可以配置：
- **全量升级**: 所有用户立即收到更新
- **灰度发布**: 按比例逐步推送更新
- **版本指定**: 指定从某个版本升级到目标版本

## 相关文件

- 配置文件: `src-tauri/tauri.conf.json`
- Rust 更新逻辑: `src-tauri/src/updater.rs`
- Rust 主程序入口: `src-tauri/src/lib.rs`
- 前端更新服务: `src/services/updater.ts`
- 系统托盘逻辑: `src-tauri/src/lib.rs`

### 前端更新服务 (`src/services/updater.ts`)

前端使用 `@tauri-apps/plugin-updater` 和 `@tauri-apps/plugin-process` 实现更新流程：

```typescript
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export async function checkAndInstallUpdate(showNotification = true): Promise<void> {
  const update = await check({
    timeout: 5000,
    headers: { 'X-AccessKey': 'your-access-key' },
  })

  if (update) {
    // 下载并安装
    await update.downloadAndInstall((event) => {
      // 处理下载进度
    })

    // 重启应用使更新生效
    await relaunch()
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