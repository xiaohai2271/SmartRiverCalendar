// API 配置模块
// 管理 API 模式 (Mock/Real)、基础 URL、OAuth 配置等

use serde::{Deserialize, Serialize};

/// API 运行模式
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ApiMode {
    /// Mock 模式 — 使用内存模拟数据，用于开发和测试
    Mock,
    /// Real 模式 — 连接真实后端服务
    Real,
}

/// API 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    /// API 运行模式
    pub mode: ApiMode,
    /// API 基础 URL (Real 模式使用)
    pub base_url: String,
    /// GitHub OAuth Client ID
    pub github_client_id: String,
}

impl ApiConfig {
    /// 从环境变量创建配置
    ///
    /// 环境变量:
    /// - SMART_RIVER_API_MODE: "mock" 或 "real"
    /// - SMART_RIVER_API_BASE_URL: API 基础 URL (Real 模式必需)
    /// - SMART_RIVER_GITHUB_CLIENT_ID: GitHub OAuth Client ID
    pub fn from_env() -> Self {
        let mode = std::env::var("SMART_RIVER_API_MODE")
            .ok()
            .and_then(|v| match v.to_lowercase().as_str() {
                "mock" => Some(ApiMode::Mock),
                "real" => Some(ApiMode::Real),
                _ => None,
            })
            .unwrap_or(ApiMode::Mock);

        let base_url = std::env::var("SMART_RIVER_API_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:3000/api".to_string());

        let github_client_id = std::env::var("SMART_RIVER_GITHUB_CLIENT_ID")
            .unwrap_or_else(|_| "mock_github_client_id".to_string());

        Self {
            mode,
            base_url,
            github_client_id,
        }
    }

    /// 创建默认 Mock 配置
    pub fn default_mock() -> Self {
        Self {
            mode: ApiMode::Mock,
            base_url: "http://localhost:3000/api".to_string(),
            github_client_id: "mock_github_client_id".to_string(),
        }
    }

    /// 创建 Real 模式配置
    pub fn real(base_url: String, github_client_id: String) -> Self {
        Self {
            mode: ApiMode::Real,
            base_url,
            github_client_id,
        }
    }

    /// 检查是否为 Mock 模式
    pub fn is_mock(&self) -> bool {
        self.mode == ApiMode::Mock
    }

    /// 检查是否为 Real 模式
    pub fn is_real(&self) -> bool {
        self.mode == ApiMode::Real
    }

    /// 从数据库设置创建配置
    ///
    /// 从 SQLite app_settings 表读取 api_mode 和 api_base_url
    /// 如果数据库中不存在，回退到环境变量
    pub fn from_settings(db: &rusqlite::Connection) -> Self {
        let mode_str = db.query_row(
            "SELECT value FROM app_settings WHERE key = 'api_mode'",
            [],
            |row| row.get::<_, String>(0),
        ).ok();

        let base_url = db.query_row(
            "SELECT value FROM app_settings WHERE key = 'api_base_url'",
            [],
            |row| row.get::<_, String>(0),
        ).ok();

        let mode = mode_str
            .and_then(|v| match v.to_lowercase().as_str() {
                "mock" => Some(ApiMode::Mock),
                "real" => Some(ApiMode::Real),
                _ => None,
            })
            .unwrap_or_else(|| {
                // 回退到环境变量
                std::env::var("SMART_RIVER_API_MODE")
                    .ok()
                    .and_then(|v| match v.to_lowercase().as_str() {
                        "mock" => Some(ApiMode::Mock),
                        "real" => Some(ApiMode::Real),
                        _ => None,
                    })
                    .unwrap_or(ApiMode::Mock)
            });

        let final_base_url = base_url
            .unwrap_or_else(||
                std::env::var("SMART_RIVER_API_BASE_URL")
                    .unwrap_or_else(|_| "http://localhost:3000/api".to_string())
            );

        let github_client_id = std::env::var("SMART_RIVER_GITHUB_CLIENT_ID")
            .unwrap_or_else(|_| "mock_github_client_id".to_string());

        Self {
            mode,
            base_url: final_base_url,
            github_client_id,
        }
    }

    /// 持久化配置到数据库
    pub fn save_to_db(&self, db: &rusqlite::Connection) -> Result<(), rusqlite::Error> {
        let now = chrono::Utc::now().timestamp();
        db.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES ('api_mode', ?1, 'API 运行模式 (mock/real)', ?2)",
            rusqlite::params![format!("{:?}", self.mode).to_lowercase(), now],
        )?;
        db.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES ('api_base_url', ?1, 'API 基础 URL', ?2)",
            rusqlite::params![self.base_url, now],
        )?;
        Ok(())
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self::default_mock()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 ApiMode 序列化
    #[test]
    fn test_api_mode_serialization() {
        let mock = ApiMode::Mock;
        let json = serde_json::to_string(&mock).unwrap();
        assert!(json.contains("Mock"));

        let real = ApiMode::Real;
        let json = serde_json::to_string(&real).unwrap();
        assert!(json.contains("Real"));
    }

    /// 测试 ApiConfig 默认值
    #[test]
    fn test_api_config_default() {
        let config = ApiConfig::default();
        assert!(config.is_mock());
        assert!(!config.is_real());
    }

    /// 测试 ApiConfig::default_mock
    #[test]
    fn test_api_config_default_mock() {
        let config = ApiConfig::default_mock();
        assert_eq!(config.mode, ApiMode::Mock);
    }

    /// 测试 ApiConfig::real
    #[test]
    fn test_api_config_real() {
        let config = ApiConfig::real(
            "https://api.example.com".to_string(),
            "github_client_123".to_string(),
        );
        assert_eq!(config.mode, ApiMode::Real);
        assert_eq!(config.base_url, "https://api.example.com");
        assert_eq!(config.github_client_id, "github_client_123");
    }

    /// 测试 is_mock 和 is_real
    #[test]
    fn test_api_mode_checks() {
        let mock_config = ApiConfig::default_mock();
        assert!(mock_config.is_mock());
        assert!(!mock_config.is_real());

        let real_config = ApiConfig::real("https://api.example.com".to_string(), "client_id".to_string());
        assert!(!real_config.is_mock());
        assert!(real_config.is_real());
    }

    /// 测试 ApiConfig 序列化
    #[test]
    fn test_api_config_serialization() {
        let config = ApiConfig::default_mock();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ApiConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.mode, ApiMode::Mock);
        assert_eq!(deserialized.base_url, config.base_url);
    }
}