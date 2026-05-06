// HTTP 客户端模块
// 封装 reqwest::Client，提供 Token 管理、401 自动刷新等功能

use crate::api::errors::{ApiError, ApiResult};
use crate::api::types::RefreshTokenResponse;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, RwLock};

/// Token 信息 (用于 HTTP 客户端内部存储)
#[derive(Debug, Clone)]
pub struct TokenInfo {
    /// 访问令牌
    pub access_token: String,
    /// 刷新令牌
    pub refresh_token: String,
    /// 过期时间 (Unix 时间戳，毫秒)
    pub expires_at: i64,
}

/// HTTP 客户端 — 封装 reqwest，支持 Token 管理
///
/// 功能:
/// - 自动添加 Authorization 头
/// - 401 响应时自动刷新 Token
/// - 防止并发刷新 (使用 Mutex 锁)
/// - 超时控制
pub struct HttpClient {
    /// reqwest 客户端
    client: reqwest::Client,
    /// API 基础 URL
    base_url: String,
    /// Token 存储 (Arc<RwLock> 支持并发读取)
    token_store: Arc<RwLock<Option<TokenInfo>>>,
    /// 刷新锁 (防止并发刷新)
    refresh_lock: Arc<Mutex<()>>,
}

impl HttpClient {
    /// 创建新的 HTTP 客户端
    ///
    /// # 参数
    /// - `base_url`: API 基础 URL
    pub fn new(base_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .expect("创建 HTTP 客户端失败");

        Self {
            client,
            base_url,
            token_store: Arc::new(RwLock::new(None)),
            refresh_lock: Arc::new(Mutex::new(())),
        }
    }

    /// 设置 Token
    pub async fn set_token(&self, token: TokenInfo) {
        let mut store = self.token_store.write().await;
        *store = Some(token);
    }

    /// 获取当前 Token
    pub async fn get_token(&self) -> Option<TokenInfo> {
        self.token_store.read().await.clone()
    }

    /// 清除 Token
    pub async fn clear_token(&self) {
        let mut store = self.token_store.write().await;
        *store = None;
    }

    /// 检查 Token 是否过期 (提前5分钟视为过期)
    pub fn is_token_expired(&self, token: &TokenInfo) -> bool {
        let now = chrono::Utc::now().timestamp_millis();
        now >= token.expires_at - 300_000
    }

    /// GET 请求 (带认证)
    pub async fn get<T: serde::de::DeserializeOwned>(&self, path: &str) -> ApiResult<T> {
        self.request_with_auth(|client, url| client.get(url), path).await
    }

    /// POST 请求 (带认证)
    pub async fn post<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        self.request_with_auth_body(|client, url| client.post(url), path, body).await
    }

    /// PUT 请求 (带认证)
    pub async fn put<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        self.request_with_auth_body(|client, url| client.put(url), path, body).await
    }

    /// DELETE 请求 (带认证)
    pub async fn delete<T: serde::de::DeserializeOwned>(&self, path: &str) -> ApiResult<T> {
        self.request_with_auth(|client, url| client.delete(url), path).await
    }

    /// POST 请求 (不带认证，用于登录/注册)
    pub async fn post_no_auth<T: serde::de::DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> ApiResult<T> {
        let url = format!("{}{}", self.base_url, path);
        let response = self
            .client
            .post(&url)
            .json(body)
            .send()
            .await?;

        self.handle_response(response).await
    }

    /// 带认证的请求 (GET/DELETE)
    async fn request_with_auth<T: serde::de::DeserializeOwned, F>(
        &self,
        request_fn: F,
        path: &str,
    ) -> ApiResult<T>
    where
        F: Fn(&reqwest::Client, &str) -> reqwest::RequestBuilder,
    {
        let token = self.get_valid_token().await?;

        let url = format!("{}{}", self.base_url, path);
        let response = request_fn(&self.client, &url)
            .bearer_auth(&token.access_token)
            .send()
            .await?;

        // 检查是否为 401
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            // 尝试刷新 Token
            let new_token = self.refresh_token_internal().await?;

            // 使用新 Token 重试
            let retry_response = request_fn(&self.client, &url)
                .bearer_auth(&new_token.access_token)
                .send()
                .await?;

            return self.handle_response(retry_response).await;
        }

        self.handle_response(response).await
    }

    /// 带认证和 Body 的请求 (POST/PUT)
    async fn request_with_auth_body<T: serde::de::DeserializeOwned, B: serde::Serialize, F>(
        &self,
        request_fn: F,
        path: &str,
        body: &B,
    ) -> ApiResult<T>
    where
        F: Fn(&reqwest::Client, &str) -> reqwest::RequestBuilder,
    {
        let token = self.get_valid_token().await?;

        let url = format!("{}{}", self.base_url, path);
        let response = request_fn(&self.client, &url)
            .bearer_auth(&token.access_token)
            .json(body)
            .send()
            .await?;

        // 检查是否为 401
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            // 尝试刷新 Token
            let new_token = self.refresh_token_internal().await?;

            // 使用新 Token 重试
            let retry_response = request_fn(&self.client, &url)
                .bearer_auth(&new_token.access_token)
                .json(body)
                .send()
                .await?;

            return self.handle_response(retry_response).await;
        }

        self.handle_response(response).await
    }

    /// 获取有效 Token (自动刷新过期 Token)
    async fn get_valid_token(&self) -> ApiResult<TokenInfo> {
        let token = self.get_token().await;

        match token {
            Some(t) if !self.is_token_expired(&t) => Ok(t),
            Some(_t) => {
                // Token 过期，刷新
                let new_token = self.refresh_token_internal().await?;
                Ok(new_token)
            },
            None => Err(ApiError::AuthError("未认证".to_string())),
        }
    }

    /// 内部刷新 Token (使用 refresh_lock 防止并发刷新)
    async fn refresh_token_internal(&self) -> ApiResult<TokenInfo> {
        // 获取刷新锁
        let _lock = self.refresh_lock.lock().await;

        // 再次检查 Token (可能在等待锁时已被其他请求刷新)
        let current_token = self.get_token().await;
        if let Some(ref t) = current_token {
            if !self.is_token_expired(t) {
                return Ok(t.clone());
            }
        }

        // 执行刷新请求
        let refresh_token = current_token
            .as_ref()
            .map(|t| t.refresh_token.clone())
            .ok_or(ApiError::AuthError("无 refresh_token".to_string()))?;

        let url = format!("{}{}", self.base_url, "/auth/refresh");
        let response = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "refresh_token": refresh_token }))
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            // refresh_token 也过期，需要重新登录
            self.clear_token().await;
            return Err(ApiError::TokenExpired);
        }

        let refresh_response: RefreshTokenResponse = self.handle_response(response).await?;

        // 更新 Token 存储
        let current = current_token.ok_or(ApiError::AuthError("无当前 Token".to_string()))?;
        let new_token = TokenInfo {
            access_token: refresh_response.access_token,
            refresh_token: current.refresh_token, // refresh_token 不变
            expires_at: chrono::Utc::now().timestamp_millis() + refresh_response.expires_in * 1000,
        };

        self.set_token(new_token.clone()).await;

        log::info!("Token 刷新成功");

        Ok(new_token)
    }

    /// 处理响应
    async fn handle_response<T: serde::de::DeserializeOwned>(
        &self,
        response: reqwest::Response,
    ) -> ApiResult<T> {
        let status = response.status();

        if status.is_success() {
            let body = response.text().await?;
            let data: T = serde_json::from_str(&body)?;
            Ok(data)
        } else if status.is_client_error() {
            let body = response.text().await?;
            Err(ApiError::Other(format!("客户端错误 {}: {}", status, body)))
        } else {
            let body = response.text().await?;
            Err(ApiError::ServerError(format!("服务器错误 {}: {}", status, body)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 HttpClient 创建
    #[test]
    fn test_http_client_creation() {
        let client = HttpClient::new("http://localhost:3000/api".to_string());
        assert_eq!(client.base_url, "http://localhost:3000/api");
    }

    /// 测试 TokenInfo 创建
    #[test]
    fn test_token_info_creation() {
        let token = TokenInfo {
            access_token: "at_123".to_string(),
            refresh_token: "rt_456".to_string(),
            expires_at: chrono::Utc::now().timestamp_millis() + 3600 * 1000,
        };
        assert_eq!(token.access_token, "at_123");
    }

    /// 测试 Token 过期检查 — 未过期
    #[tokio::test]
    async fn test_token_not_expired() {
        let client = HttpClient::new("http://localhost:3000/api".to_string());
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: chrono::Utc::now().timestamp_millis() + 3600 * 1000, // 1小时后
        };

        assert!(!client.is_token_expired(&token));
    }

    /// 测试 Token 过期检查 — 已过期
    #[tokio::test]
    async fn test_token_expired() {
        let client = HttpClient::new("http://localhost:3000/api".to_string());
        let token = TokenInfo {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: chrono::Utc::now().timestamp_millis() - 3600 * 1000, // 1小时前
        };

        assert!(client.is_token_expired(&token));
    }

    /// 测试 Token 存储
    #[tokio::test]
    async fn test_token_store() {
        let client = HttpClient::new("http://localhost:3000/api".to_string());

        // 初始为空
        assert!(client.get_token().await.is_none());

        // 设置 Token
        let token = TokenInfo {
            access_token: "at".to_string(),
            refresh_token: "rt".to_string(),
            expires_at: chrono::Utc::now().timestamp_millis() + 3600 * 1000,
        };
        client.set_token(token.clone()).await;

        // 获取 Token
        let stored = client.get_token().await;
        assert!(stored.is_some());
        assert_eq!(stored.unwrap().access_token, "at");

        // 清除 Token
        client.clear_token().await;
        assert!(client.get_token().await.is_none());
    }
}