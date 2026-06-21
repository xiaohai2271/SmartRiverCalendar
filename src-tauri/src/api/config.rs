// API 配置模块
// 管理 API 接口地址、平台地址、OAuth 配置等
// 移除 ApiMode 枚举，默认使用线上环境

use serde::{Deserialize, Serialize};

/// API 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// API 接口地址（如 https://calendar.menghuan.life/api）
    #[serde(rename = "apiUrl")]
    pub api_url: String,
    /// 平台地址（OAuth 跳转，如 https://calendar.menghuan.life）
    #[serde(rename = "platformUrl")]
    pub platform_url: String,
    /// GitHub OAuth Client ID
    #[serde(rename = "githubClientId")]
    pub github_client_id: String,
}

/// 线上默认值
const DEFAULT_API_URL: &str = "https://calendar.menghuan.life/api";
const DEFAULT_PLATFORM_URL: &str = "https://calendar.menghuan.life";

impl ApiConfig {
    /// 从环境变量创建配置
    ///
    /// 环境变量:
    /// - SMART_RIVER_API_URL: API 接口地址
    /// - SMART_RIVER_PLATFORM_URL: 平台地址（OAuth 跳转）
    /// - SMART_RIVER_GITHUB_CLIENT_ID: GitHub OAuth Client ID
    pub fn from_env() -> Self {
        let api_url = std::env::var("SMART_RIVER_API_URL")
            .or_else(|_| std::env::var("SMART_RIVER_API_BASE_URL")) // 兼容旧环境变量名
            .unwrap_or_else(|_| DEFAULT_API_URL.to_string());

        let platform_url = std::env::var("SMART_RIVER_PLATFORM_URL")
            .unwrap_or_else(|_| DEFAULT_PLATFORM_URL.to_string());

        let github_client_id = std::env::var("SMART_RIVER_GITHUB_CLIENT_ID")
            .unwrap_or_else(|_| String::new());

        Self {
            api_url,
            platform_url,
            github_client_id,
        }
    }

    /// 从数据库设置创建配置
    ///
    /// 从 SQLite app_settings 表读取 api_url 和 api_platform_url
    /// 如果数据库中不存在，回退到环境变量
    pub fn from_settings(db: &rusqlite::Connection) -> Self {
        let api_url = db.query_row(
            "SELECT value FROM app_settings WHERE key = 'api_url'",
            [],
            |row| row.get::<_, String>(0),
        ).ok();

        let platform_url = db.query_row(
            "SELECT value FROM app_settings WHERE key = 'api_platform_url'",
            [],
            |row| row.get::<_, String>(0),
        ).ok();

        // 兼容旧字段名：如果 api_url 不存在但 api_base_url 存在，使用旧值
        let final_api_url = api_url
            .or_else(|| db.query_row(
                "SELECT value FROM app_settings WHERE key = 'api_base_url'",
                [],
                |row| row.get::<_, String>(0),
            ).ok())
            .unwrap_or_else(|| {
                std::env::var("SMART_RIVER_API_URL")
                    .or_else(|_| std::env::var("SMART_RIVER_API_BASE_URL"))
                    .unwrap_or_else(|_| DEFAULT_API_URL.to_string())
            });

        let final_platform_url = platform_url
            .unwrap_or_else(|| {
                std::env::var("SMART_RIVER_PLATFORM_URL")
                    .unwrap_or_else(|_| DEFAULT_PLATFORM_URL.to_string())
            });

        let github_client_id = std::env::var("SMART_RIVER_GITHUB_CLIENT_ID")
            .unwrap_or_else(|_| String::new());

        Self {
            api_url: final_api_url,
            platform_url: final_platform_url,
            github_client_id,
        }
    }

    /// 持久化配置到数据库
    pub fn save_to_db(&self, db: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
        let now = chrono::Utc::now().timestamp();
        db.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES ('api_url', ?1, 'API 接口地址', ?2)",
            rusqlite::params![self.api_url, now],
        )?;
        db.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES ('api_platform_url', ?1, '平台地址（OAuth 跳转）', ?2)",
            rusqlite::params![self.platform_url, now],
        )?;
        // 清除旧字段，避免回退读取
        db.execute(
            "DELETE FROM app_settings WHERE key = 'api_base_url'",
            [],
        )?;
        db.execute(
            "DELETE FROM app_settings WHERE key = 'api_mode'",
            [],
        )?;
        Ok(())
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            api_url: DEFAULT_API_URL.to_string(),
            platform_url: DEFAULT_PLATFORM_URL.to_string(),
            github_client_id: String::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 ApiConfig 默认值
    #[test]
    fn test_api_config_default() {
        let config = ApiConfig::default();
        assert_eq!(config.api_url, DEFAULT_API_URL);
        assert_eq!(config.platform_url, DEFAULT_PLATFORM_URL);
        assert_eq!(config.github_client_id, "");
    }

    /// 测试 ApiConfig 序列化
    #[test]
    fn test_api_config_serialization() {
        let config = ApiConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ApiConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.api_url, config.api_url);
        assert_eq!(deserialized.platform_url, config.platform_url);
    }

    /// 测试 save_to_db 和 from_settings 的一致性
    #[test]
    fn test_api_config_db_roundtrip() {
        let config = ApiConfig {
            api_url: "https://test.example.com/api".to_string(),
            platform_url: "https://test.example.com".to_string(),
            github_client_id: "test_client_id".to_string(),
        };

        // 创建内存数据库
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at INTEGER
            )",
            [],
        ).unwrap();

        config.save_to_db(&db).unwrap();

        let loaded = ApiConfig::from_settings(&db);
        assert_eq!(loaded.api_url, config.api_url);
        assert_eq!(loaded.platform_url, config.platform_url);
    }

    /// 测试旧字段兼容性
    #[test]
    fn test_api_config_legacy_field_compat() {
        let db = rusqlite::Connection::open_in_memory().unwrap();
        db.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at INTEGER
            )",
            [],
        ).unwrap();

        // 写入旧字段名
        let now = chrono::Utc::now().timestamp();
        db.execute(
            "INSERT INTO app_settings (key, value, description, updated_at) VALUES ('api_base_url', 'https://legacy.example.com/api', '旧 API 地址', ?1)",
            rusqlite::params![now],
        ).unwrap();

        let loaded = ApiConfig::from_settings(&db);
        assert_eq!(loaded.api_url, "https://legacy.example.com/api");
    }
}
