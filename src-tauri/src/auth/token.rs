// Token 管理模块
// 负责 JWT Token 的安全存储、读取、刷新和过期检查
//
// 存储策略：SQLite + AES-256-GCM 加密
// Token 以加密形式存储在 app_settings 表中，key 格式为 "auth_tokens:{user_id}"
// 加密使用与项目一致的 AES-256-GCM 算法（crypto 模块），密钥由 user_id + 随机盐值派生
//
// 历史原因：之前使用 keyring crate 存储到操作系统凭据管理器，
// 但 keyring 在 Windows 上存在严重 bug：
// - set_password 返回 Ok 但凭据未实际写入 (Windows Credential Manager)
// - 重新创建 Entry 实例后 get_password 返回 NoEntry
// 详见 https://github.com/hwchen/keyring-rs/issues/163
// 改用 SQLite 存储后，读写一致性有保障，同时通过加密保护敏感数据

use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use base64::Engine;

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

/// Token 存储服务 — 使用 SQLite 加密存储
///
/// Token 以 AES-256-GCM 加密后存储在 app_settings 表中，
/// key 格式为 "auth_tokens:{user_id}"
/// 与 Web 端（localStorage）和 Tauri 端共享同一套 Token 数据结构
pub struct TokenStore;

impl TokenStore {
    /// 创建新的 TokenStore 实例
    pub fn new() -> Self {
        Self
    }

    /// 生成存储 key
    fn storage_key(user_id: i64) -> String {
        format!("auth_tokens:{}", user_id)
    }

    /// 保存 Token 到 SQLite（加密存储）
    ///
    /// 使用 AES-256-GCM 加密后存储到 app_settings 表
    pub fn save_tokens(&self, conn: &rusqlite::Connection, tokens: &TokenInfo) -> Result<(), TokenError> {
        let json = serde_json::to_string(tokens)
            .map_err(|e| TokenError::SerializeError(e.to_string()))?;

        // 为每个用户生成或复用盐值
        let salt_key = format!("auth_salt:{}", tokens.user_id);
        let salt_b64: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                rusqlite::params![salt_key],
                |row| row.get(0),
            )
            .ok()
            .flatten();

        let (salt, salt_b64_value) = if let Some(b64) = salt_b64 {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(&b64)
                .map_err(|e| TokenError::EncryptError(format!("盐值解码失败: {}", e)))?;
            if bytes.len() < 16 {
                return Err(TokenError::EncryptError(format!("盐值长度不足: {} < 16", bytes.len())));
            }
            let mut arr = [0u8; 16];
            arr.copy_from_slice(&bytes[..16]);
            (arr, b64)
        } else {
            let s = crate::crypto::generate_salt();
            let b64 = base64::engine::general_purpose::STANDARD.encode(s);
            (s, b64)
        };

        // 加密 Token JSON
        let encrypted = crate::crypto::encrypt_password(&json, tokens.user_id, &salt)
            .map_err(|e| TokenError::EncryptError(e))?;

        let key = Self::storage_key(tokens.user_id);
        let now = chrono::Utc::now().timestamp();

        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![key, encrypted, "加密存储的用户认证 Token", now],
        )
        .map_err(|e| TokenError::DbError(e.to_string()))?;

        // 保存盐值
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![salt_key, salt_b64_value, "加密盐值", now],
        )
        .map_err(|e| TokenError::DbError(e.to_string()))?;

        Ok(())
    }

    /// 从 SQLite 读取 Token（解密）
    ///
    /// # 返回
    /// - `Ok(Some(TokenInfo))`: 找到并成功解密解析 Token
    /// - `Ok(None)`: 未找到 Token（用户未登录）
    /// - `Err(...)`: 读取或解密失败
    pub fn load_tokens(&self, conn: &rusqlite::Connection, user_id: i64) -> Result<Option<TokenInfo>, TokenError> {
        let key = Self::storage_key(user_id);

        let encrypted: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                rusqlite::params![key],
                |row| row.get(0),
            )
            .ok();

        match encrypted {
            Some(enc) => {
                // 读取盐值
                let salt_key = format!("auth_salt:{}", user_id);
                let salt_b64: Option<String> = conn
                    .query_row(
                        "SELECT value FROM app_settings WHERE key = ?1",
                        rusqlite::params![salt_key],
                        |row| row.get(0),
                    )
                    .ok()
                    .flatten();

                let json = if let Some(b64) = salt_b64 {
                    // 新版：使用 user_id + 盐值解密
                    let bytes = base64::engine::general_purpose::STANDARD
                        .decode(&b64)
                        .map_err(|e| TokenError::DecryptError(format!("盐值解码失败: {}", e)))?;
                    if bytes.len() < 16 {
                        return Err(TokenError::DecryptError(format!("盐值长度不足: {} < 16", bytes.len())));
                    }
                    let mut salt = [0u8; 16];
                    salt.copy_from_slice(&bytes[..16]);
                    crate::crypto::decrypt_password(&enc, user_id, &salt)
                        .map_err(|e| TokenError::DecryptError(e))?
                } else {
                    // 旧版：使用旧版密钥解密，并自动迁移到新加密方式
                    let plaintext = crate::crypto::decrypt_password_legacy(&enc)
                        .map_err(|e| TokenError::DecryptError(e))?;
                    // 自动迁移：用新密钥重新加密并保存
                    let tokens: TokenInfo = serde_json::from_str(&plaintext)
                        .map_err(|e| TokenError::DeserializeError(e.to_string()))?;
                    if let Err(e) = self.save_tokens(conn, &tokens) {
                        log::warn!("[load_tokens] 旧版 Token 自动迁移失败: {}", e);
                    } else {
                        log::info!("[load_tokens] 旧版 Token 已自动迁移到新加密方式 (user_id={})", user_id);
                    }
                    plaintext
                };

                let tokens: TokenInfo = serde_json::from_str(&json)
                    .map_err(|e| TokenError::DeserializeError(e.to_string()))?;
                Ok(Some(tokens))
            }
            None => Ok(None),
        }
    }

    /// 删除 Token（退出登录时调用）
    pub fn delete_tokens(&self, conn: &rusqlite::Connection, user_id: i64) -> Result<(), TokenError> {
        let key = Self::storage_key(user_id);
        conn.execute(
            "DELETE FROM app_settings WHERE key = ?1",
            rusqlite::params![key],
        )
        .map_err(|e| TokenError::DbError(e.to_string()))?;
        // 同时删除盐值
        let salt_key = format!("auth_salt:{}", user_id);
        conn.execute(
            "DELETE FROM app_settings WHERE key = ?1",
            rusqlite::params![salt_key],
        )
        .map_err(|e| TokenError::DbError(e.to_string()))?;
        Ok(())
    }

    /// 检查 Token 是否过期
    ///
    /// 提前5分钟视为过期，避免临界情况
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
    /// 数据库操作错误
    #[error("数据库错误: {0}")]
    DbError(String),
    /// 加密错误
    #[error("加密错误: {0}")]
    EncryptError(String),
    /// 解密错误
    #[error("解密错误: {0}")]
    DecryptError(String),
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
        let near_future = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            + 240_000;
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: near_future,
            user_id: 1,
        };

        assert!(store.is_token_expired(&token));
    }

    /// 测试过期检查 — 临界情况（6分钟后过期，不应视为过期）
    #[test]
    fn test_token_not_near_expiry() {
        let store = TokenStore::new();
        let near_future = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64
            + 360_000;
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: near_future,
            user_id: 1,
        };

        assert!(!store.is_token_expired(&token));
    }

    /// 测试 storage_key 格式
    #[test]
    fn test_storage_key_format() {
        assert_eq!(TokenStore::storage_key(1), "auth_tokens:1");
        assert_eq!(TokenStore::storage_key(42), "auth_tokens:42");
    }

    /// 测试 TokenStore Default trait
    #[test]
    fn test_token_store_default() {
        let _store = TokenStore::default();
    }

    /// 测试 TokenError 显示
    #[test]
    fn test_token_error_display() {
        let err = TokenError::DbError("test error".to_string());
        assert_eq!(format!("{}", err), "数据库错误: test error");

        let err = TokenError::EncryptError("enc error".to_string());
        assert_eq!(format!("{}", err), "加密错误: enc error");

        let err = TokenError::TokenExpired;
        assert_eq!(format!("{}", err), "Token 已过期");

        let err = TokenError::TokenNotFound;
        assert_eq!(format!("{}", err), "未找到 Token");
    }

    /// 测试 SQLite 存储的完整流程（使用内存数据库）
    #[test]
    fn test_save_load_delete_tokens() {
        use crate::db::schema;

        // 创建内存数据库
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        schema::init_database(&conn).unwrap();

        let store = TokenStore::new();
        let token = TokenInfo {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64
                + 3600_000,
            user_id: 1,
        };

        // 保存
        store.save_tokens(&conn, &token).unwrap();

        // 读取
        let loaded = store.load_tokens(&conn, 1).unwrap();
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.access_token, "test_access");
        assert_eq!(loaded.refresh_token, "test_refresh");
        assert_eq!(loaded.user_id, 1);

        // 删除
        store.delete_tokens(&conn, 1).unwrap();

        // 确认已删除
        let loaded = store.load_tokens(&conn, 1).unwrap();
        assert!(loaded.is_none());
    }

    /// 测试未存储的 Token 返回 None
    #[test]
    fn test_load_nonexistent_tokens() {
        use crate::db::schema;

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        schema::init_database(&conn).unwrap();

        let store = TokenStore::new();
        let result = store.load_tokens(&conn, 999).unwrap();
        assert!(result.is_none());
    }

    /// 测试覆盖更新 Token
    #[test]
    fn test_update_tokens() {
        use crate::db::schema;

        let conn = rusqlite::Connection::open_in_memory().unwrap();
        schema::init_database(&conn).unwrap();

        let store = TokenStore::new();

        // 保存初始 Token
        let token_v1 = TokenInfo {
            access_token: "access_v1".to_string(),
            refresh_token: "refresh_v1".to_string(),
            expires_at: 1700000000000,
            user_id: 1,
        };
        store.save_tokens(&conn, &token_v1).unwrap();

        // 更新为新 Token
        let token_v2 = TokenInfo {
            access_token: "access_v2".to_string(),
            refresh_token: "refresh_v2".to_string(),
            expires_at: 1700001000000,
            user_id: 1,
        };
        store.save_tokens(&conn, &token_v2).unwrap();

        // 读取应为新 Token
        let loaded = store.load_tokens(&conn, 1).unwrap().unwrap();
        assert_eq!(loaded.access_token, "access_v2");
        assert_eq!(loaded.refresh_token, "refresh_v2");
    }
}
