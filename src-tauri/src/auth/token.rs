// Token 管理模块
// 负责 JWT Token 的安全存储、读取、刷新和过期检查
// 使用 keyring crate 实现跨平台安全存储:
// - Windows: Windows Credential Manager
// - macOS: Keychain
// - Linux: Secret Service (GNOME Keyring / KDE Wallet)

use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

/// Token 信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    /// 访问令牌
    pub access_token: String,
    /// 刷新令牌
    pub refresh_token: String,
    /// 过期时间 (Unix 时间戳，毫秒)
    pub expires_at: i64,
    /// 用户 ID
    pub user_id: i64,
}

/// Token 存储服务 — 使用 keyring crate 操作系统安全存储
///
/// 跨平台安全存储:
/// - Windows: Windows Credential Manager
/// - macOS: Keychain
/// - Linux: Secret Service (GNOME Keyring / KDE Wallet)
pub struct TokenStore {
    /// 服务名称，用于 keyring 条目标识
    service_name: String,
}

impl TokenStore {
    /// 创建新的 TokenStore 实例
    pub fn new() -> Self {
        Self {
            service_name: "SmartRiverCalendar".to_string(),
        }
    }

    /// 保存 Token 到操作系统安全存储
    ///
    /// 使用 keyring::Entry 存储，键格式为 "tokens:{user_id}"
    /// TokenInfo 序列化为 JSON 便于读取完整信息
    pub fn save_tokens(&self, tokens: &TokenInfo) -> Result<(), TokenError> {
        let entry = Entry::new(&self.service_name, &format!("tokens:{}", tokens.user_id))
            .map_err(|e| TokenError::KeyringError(e.to_string()))?;
        let json = serde_json::to_string(tokens)
            .map_err(|e| TokenError::SerializeError(e.to_string()))?;
        entry
            .set_password(&json)
            .map_err(|e| TokenError::KeyringError(e.to_string()))?;
        Ok(())
    }

    /// 从操作系统安全存储读取 Token
    ///
    /// # 返回
    /// - `Ok(Some(TokenInfo))`: 找到并成功解析 Token
    /// - `Ok(None)`: 未找到 Token（用户未登录）
    /// - `Err(...)`: 读取或解析失败
    pub fn load_tokens(&self, user_id: i64) -> Result<Option<TokenInfo>, TokenError> {
        let entry = Entry::new(&self.service_name, &format!("tokens:{}", user_id))
            .map_err(|e| TokenError::KeyringError(e.to_string()))?;
        match entry.get_password() {
            Ok(json) => {
                let tokens: TokenInfo = serde_json::from_str(&json)
                    .map_err(|e| TokenError::DeserializeError(e.to_string()))?;
                Ok(Some(tokens))
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(TokenError::KeyringError(e.to_string())),
        }
    }

    /// 删除 Token（退出登录时调用）
    ///
    /// 忽略"条目不存在"错误（退出登录时可能已删除）
    pub fn delete_tokens(&self, user_id: i64) -> Result<(), TokenError> {
        let entry = Entry::new(&self.service_name, &format!("tokens:{}", user_id))
            .map_err(|e| TokenError::KeyringError(e.to_string()))?;
        // 忽略"条目不存在"错误
        let _ = entry.delete_credential();
        Ok(())
    }

    /// 检查 Token 是否过期
    ///
    /// 提前5分钟视为过期，避免临界情况
    /// 在 Token 即将过期时就刷新，确保请求不会因 Token 过期而失败
    pub fn is_token_expired(&self, tokens: &TokenInfo) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        // 提前5分钟视为过期，避免临界情况
        now >= tokens.expires_at - 300_000
    }
}

impl Default for TokenStore {
    fn default() -> Self {
        Self::new()
    }
}

/// Token 错误类型
#[derive(Debug, thiserror::Error)]
pub enum TokenError {
    /// keyring 操作错误
    #[error("Keyring 错误: {0}")]
    KeyringError(String),
    /// 序列化错误
    #[error("序列化错误: {0}")]
    SerializeError(String),
    /// 反序列化错误
    #[error("反序列化错误: {0}")]
    DeserializeError(String),
    /// Token 已过期
    #[error("Token 已过期")]
    TokenExpired,
    /// 未找到 Token
    #[error("未找到 Token")]
    TokenNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 TokenInfo 序列化/反序列化
    #[test]
    fn test_token_info_serialization() {
        let token = TokenInfo {
            access_token: "test_access_token".to_string(),
            refresh_token: "test_refresh_token".to_string(),
            expires_at: 1700000000000,
            user_id: 42,
        };

        let json = serde_json::to_string(&token).unwrap();
        let deserialized: TokenInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.access_token, token.access_token);
        assert_eq!(deserialized.refresh_token, token.refresh_token);
        assert_eq!(deserialized.expires_at, token.expires_at);
        assert_eq!(deserialized.user_id, token.user_id);
    }

    /// 测试 TokenInfo JSON 格式
    #[test]
    fn test_token_info_json_format() {
        let token = TokenInfo {
            access_token: "abc123".to_string(),
            refresh_token: "def456".to_string(),
            expires_at: 1700000000000,
            user_id: 1,
        };

        let json = serde_json::to_string(&token).unwrap();
        assert!(json.contains("access_token"));
        assert!(json.contains("refresh_token"));
        assert!(json.contains("expires_at"));
        assert!(json.contains("user_id"));
    }

    /// 测试过期检查 — 未过期的 Token
    #[test]
    fn test_token_not_expired() {
        let store = TokenStore::new();
        // 设置过期时间为1小时后
        let future_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            + 3600_000;
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: future_time,
            user_id: 1,
        };

        assert!(!store.is_token_expired(&token));
    }

    /// 测试过期检查 — 已过期的 Token
    #[test]
    fn test_token_expired() {
        let store = TokenStore::new();
        // 设置过期时间为1小时前
        let past_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            - 3600_000;
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: past_time,
            user_id: 1,
        };

        assert!(store.is_token_expired(&token));
    }

    /// 测试过期检查 — 临界情况（4分钟内过期，应视为过期）
    #[test]
    fn test_token_near_expiry() {
        let store = TokenStore::new();
        // 设置过期时间为4分钟后（在5分钟提前量内）
        let near_future = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            + 240_000; // 4分钟
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: near_future,
            user_id: 1,
        };

        // 4分钟后过期，在5分钟提前量内，应视为过期
        assert!(store.is_token_expired(&token));
    }

    /// 测试过期检查 — 临界情况（6分钟后过期，不应视为过期）
    #[test]
    fn test_token_not_near_expiry() {
        let store = TokenStore::new();
        // 设置过期时间为6分钟后（在5分钟提前量之外）
        let near_future = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            + 360_000; // 6分钟
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: near_future,
            user_id: 1,
        };

        // 6分钟后过期，不在5分钟提前量内，不应视为过期
        assert!(!store.is_token_expired(&token));
    }

    /// 测试 TokenStore 服务名称
    #[test]
    fn test_token_store_service_name() {
        let store = TokenStore::new();
        assert_eq!(store.service_name, "SmartRiverCalendar");
    }

    /// 测试 TokenStore Default trait
    #[test]
    fn test_token_store_default() {
        let store = TokenStore::default();
        assert_eq!(store.service_name, "SmartRiverCalendar");
    }

    /// 测试 TokenError 显示
    #[test]
    fn test_token_error_display() {
        let err = TokenError::KeyringError("test error".to_string());
        assert_eq!(format!("{}", err), "Keyring 错误: test error");

        let err = TokenError::TokenExpired;
        assert_eq!(format!("{}", err), "Token 已过期");

        let err = TokenError::TokenNotFound;
        assert_eq!(format!("{}", err), "未找到 Token");
    }
}
