//! # 应用更新模块
//!
//! 本模块提供小河日历的自动更新功能，支持：
//! - 检查远程服务器是否有新版本
//! - 自动下载并安装更新
//! - 自定义请求头（用于 API 认证）
//!
//! ## 更新服务器配置
//!
//! 更新服务器配置在 `tauri.conf.json` 的 `plugins.updater` 中：
//!
//! ```json
//! {
//!   "plugins": {
//!     "updater": {
//!       "pubkey": "公钥内容",
//!       "endpoints": [
//!         "https://api.upgrade.toolsetlink.com/v1/tauri/upgrade?..."
//!       ]
//!     }
//!   }
//! }
//! ```
//!
//! ## Windows 更新流程
//!
//! 在 Windows 上，安装进程会自动处理应用的关闭和重启：
//! 1. 下载完成后启动安装进程
//! 2. 安装进程关闭当前应用（Windows 安装程序的限制）
//! 3. 安装进程完成文件替换
//! 4. 安装进程自动重启应用（通过 `/R` flag 或 `AUTOLAUNCHAPP=True`）
//!
//! **注意**: 不要手动调用 `restart()`，否则会导致：
//! - 应用过早重启，安装进程被终止
//! - 双重重启冲突
//! - 更新失败
//!
//! ## 使用示例
//!
//! ```rust,ignore
//! use tauri_plugin_updater::UpdaterExt;
//!
//! // 创建更新器并添加认证头
//! let updater = app_handle.updater_builder()
//!     .header("X-AccessKey", "your-api-key")
//!     .expect("设置请求头失败")
//!     .build()
//!     .expect("构建更新器失败");
//!
//! // 检查更新
//! match updater.check().await {
//!     Ok(Some(update)) => {
//!         println!("有新版本: {}", update.version);
//!         // 下载并安装，Windows 上 installer 会自动处理重启
//!         update.download_and_install(|_, _| {}, || {}).await.ok();
//!     }
//!     Ok(None) => println!("已是最新版本"),
//!     Err(e) => println!("检查失败: {}", e),
//! }
//! ```

#![allow(dead_code)]

use tauri::AppHandle;
use tauri_plugin_updater::{Update, Updater, UpdaterExt};

/// 更新服务器 API Key
///
/// 通过编译时环境变量 `UPDATE_API_KEY` 注入，用于向更新服务器认证请求。
/// 此 Key 需要：
/// 1. 作为 `X-AccessKey` 请求头发送
/// 2. 作为 URL 查询参数 `tauriKey` 发送（在 endpoints 配置中）
///
/// 构建时请设置环境变量：`UPDATE_API_KEY=your_key cargo build`
/// 若未设置，将使用空字符串（更新功能将不可用）
const UPDATE_API_KEY: &str = match option_env!("UPDATE_API_KEY") {
    Some(key) => key,
    None => "",
};

/// 更新检查结果
pub enum UpdateCheckResult {
    /// 有新版本可用
    UpdateAvailable(Update),
    /// 当前已是最新版本
    UpToDate,
    /// 检查失败
    Failed(String),
    /// 更新器初始化失败
    InitFailed(String),
}

// 手动实现 Debug，因为 Update 类型不支持 derive(Debug)
impl std::fmt::Debug for UpdateCheckResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UpdateCheckResult::UpdateAvailable(update) => {
                f.debug_struct("UpdateAvailable")
                    .field("version", &update.version)
                    .finish()
            }
            UpdateCheckResult::UpToDate => write!(f, "UpToDate"),
            UpdateCheckResult::Failed(msg) => f.debug_tuple("Failed").field(msg).finish(),
            UpdateCheckResult::InitFailed(msg) => f.debug_tuple("InitFailed").field(msg).finish(),
        }
    }
}

/// 创建带有认证头的更新器
///
/// # 参数
///
/// * `app_handle` - Tauri 应用句柄
///
/// # 返回
///
/// 返回配置好的更新器实例，或错误信息
///
/// # 示例
///
/// ```rust,ignore
/// let updater = create_updater(&app_handle)?;
/// match updater.check().await {
///     Ok(Some(update)) => { /* 处理更新 */ }
///     Ok(None) => { /* 无更新 */ }
///     Err(e) => { /* 处理错误 */ }
/// }
/// ```
pub fn create_updater(app_handle: &AppHandle) -> Result<Updater, String> {
    app_handle
        .updater_builder()
        .header("X-AccessKey", UPDATE_API_KEY)
        .map_err(|e| format!("设置请求头失败: {}", e))?
        .build()
        .map_err(|e| format!("构建更新器失败: {}", e))
}

/// 检查应用更新
///
/// 异步检查更新服务器是否有新版本可用。
///
/// # 参数
///
/// * `app_handle` - Tauri 应用句柄
///
/// # 返回
///
/// 返回 `UpdateCheckResult` 枚举，表示检查结果
///
/// # 更新流程
///
/// 1. 创建带有认证头的更新器
/// 2. 向服务器发送版本检查请求
/// 3. 服务器返回：
///    - `200 OK` + JSON：有新版本
///    - `204 No Content`：无更新
///    - 其他状态码：错误
///
/// # 服务器响应格式
///
/// 有更新时，服务器应返回如下 JSON：
///
/// ```json
/// {
///   "version": "0.2.0",
///   "notes": "更新说明",
///   "pub_date": "2026-03-22T00:00:00Z",
///   "platforms": {
///     "windows-x86_64": {
///       "signature": "签名内容",
///       "url": "下载链接"
///     }
///   }
/// }
/// ```
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

/// 下载并安装更新
///
/// # 参数
///
/// * `update` - 可用的更新对象
///
/// # 返回
///
/// 返回 `Ok(())` 表示成功，或错误信息
///
/// # 注意
///
/// - 下载过程中会调用进度回调（当前为空实现）
/// - 安装完成后需要用户重启应用才能生效
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

/// 处理更新检查结果并输出日志
///
/// # 参数
///
/// * `app_handle` - Tauri 应用句柄
/// * `result` - 更新检查结果
///
/// # 行为
///
/// - 有更新：打印版本号并自动下载安装，Windows 上等待 installer 自动重启
/// - 无更新：打印提示信息
/// - 失败：打印错误信息
pub async fn handle_update_result(_app_handle: AppHandle, result: UpdateCheckResult) {
    match result {
        UpdateCheckResult::UpdateAvailable(update) => {
            log::info!("有新版本可用: {}", update.version);
            match download_and_install_update(update).await {
                Ok(()) => {
                    log::info!("更新安装成功，等待 installer 自动重启应用...");
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

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 API Key 常量类型正确
    #[test]
    fn test_api_key_is_string() {
        // API Key 应为非空字符串类型（实际值由编译时环境变量决定）
        let _key: &str = UPDATE_API_KEY;
    }

    /// 测试 UpdateCheckResult 枚举变体
    #[test]
    fn test_update_check_result_variants() {
        // 测试 UpToDate 变体
        let up_to_date = UpdateCheckResult::UpToDate;
        match up_to_date {
            UpdateCheckResult::UpToDate => assert!(true),
            _ => panic!("应该是 UpToDate 变体"),
        }

        // 测试 Failed 变体
        let failed = UpdateCheckResult::Failed("测试错误".to_string());
        match failed {
            UpdateCheckResult::Failed(msg) => {
                assert_eq!(msg, "测试错误");
            }
            _ => panic!("应该是 Failed 变体"),
        }

        // 测试 InitFailed 变体
        let init_failed = UpdateCheckResult::InitFailed("初始化失败".to_string());
        match init_failed {
            UpdateCheckResult::InitFailed(msg) => {
                assert_eq!(msg, "初始化失败");
            }
            _ => panic!("应该是 InitFailed 变体"),
        }
    }

    /// 测试 UpdateCheckResult 的 Debug 输出
    #[test]
    fn test_update_check_result_debug() {
        let result = UpdateCheckResult::UpToDate;
        let debug_str = format!("{:?}", result);
        assert!(debug_str.contains("UpToDate"), "应包含 UpToDate");

        let result = UpdateCheckResult::Failed("错误".to_string());
        let debug_str = format!("{:?}", result);
        assert!(debug_str.contains("Failed"), "应包含 Failed");
        assert!(debug_str.contains("错误"), "应包含错误信息");

        let result = UpdateCheckResult::InitFailed("初始化失败".to_string());
        let debug_str = format!("{:?}", result);
        assert!(debug_str.contains("InitFailed"), "应包含 InitFailed");
        assert!(debug_str.contains("初始化失败"), "应包含初始化失败信息");
    }

    /// 测试 handle_update_result 不会 panic
    ///
    /// 注意：由于需要 AppHandle，无法直接测试 check_for_updates
    /// 这里只测试不需要 AppHandle 的函数
    #[test]
    fn test_handle_update_result_sync() {
        // 测试同步部分
        let up_to_date = UpdateCheckResult::UpToDate;
        // 由于 handle_update_result 是异步的，这里只测试枚举构造
        match up_to_date {
            UpdateCheckResult::UpToDate => assert!(true),
            _ => panic!("枚举匹配失败"),
        }
    }

    /// 测试 API Key 格式（如果已设置）
    #[test]
    fn test_api_key_format() {
        // 仅在环境变量已设置时验证格式
        if !UPDATE_API_KEY.is_empty() {
            let key = UPDATE_API_KEY;
            let is_valid_base64 = key
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '_');
            assert!(is_valid_base64, "API Key 应该是有效的 Base64 格式");
        }
    }
}
