// GitHub OAuth 模块
// 处理 GitHub OAuth 授权流程
// 桌面应用使用 localhost 临时 HTTP 服务器接收回调

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener as TokioTcpListener;

/// GitHub OAuth 配置
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OAuthConfig {
    /// GitHub OAuth App 的 Client ID
    pub client_id: String,
    /// GitHub OAuth App 的 Client Secret（Desktop App 可选）
    pub client_secret: String,
    /// 重定向基础 URL（如 "http://localhost"）
    pub redirect_base: String,
}

/// OAuth 回调结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OAuthCallbackResult {
    /// GitHub 返回的授权码
    pub code: String,
    /// 防 CSRF 的 state 参数
    pub state: String,
}

/// OAuth 服务 — 处理 GitHub OAuth 授权流程
///
/// 桌面应用使用 localhost 临时 HTTP 服务器接收回调:
/// 1. 在随机端口启动 HTTP 服务器
/// 2. 生成授权 URL，用户在浏览器中打开
/// 3. GitHub 重定向到 localhost/callback?code=xxx&state=xxx
/// 4. 服务器接收回调，提取 code 和 state
/// 5. 关闭服务器，返回 OAuthCallbackResult
pub struct OAuthService {
    /// OAuth 配置
    config: OAuthConfig,
}

impl OAuthService {
    /// 创建新的 OAuth 服务实例
    pub fn new(config: OAuthConfig) -> Self {
        Self { config }
    }

    /// 获取 GitHub 授权 URL
    ///
    /// 用户在浏览器中打开此 URL 进行授权
    /// 请求 user:email 权限以获取用户邮箱
    pub fn get_authorization_url(&self, state: &str) -> String {
        format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}/callback&state={}&scope=user:email",
            self.config.client_id, self.config.redirect_base, state
        )
    }

    /// 启动 localhost 临时 HTTP 服务器接收 OAuth 回调
    ///
    /// 在随机端口上监听，等待 GitHub 回调
    /// 默认超时时间: 5分钟
    ///
    /// # 参数
    /// - `timeout_secs`: 超时时间（秒），默认 300（5分钟）
    ///
    /// # 返回
    /// 包含 code 和 state 的回调结果
    pub async fn listen_for_callback(
        &self,
        timeout_secs: u64,
    ) -> Result<OAuthCallbackResult, OAuthError> {
        // 在随机端口启动 TCP 监听
        let listener = TokioTcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| OAuthError::ListenerError(e.to_string()))?;
        let port = listener
            .local_addr()
            .map(|addr| addr.port())
            .map_err(|e| OAuthError::ListenerError(format!("获取监听地址失败: {}", e)))?;

        log::info!("OAuth 回调服务器已启动，监听端口: {}", port);

        // 设置超时
        let result = tokio::time::timeout(
            std::time::Duration::from_secs(timeout_secs),
            self.handle_callback(listener, port),
        )
        .await;

        match result {
            Ok(inner) => inner,
            Err(_) => Err(OAuthError::Timeout),
        }
    }

    /// 处理回调请求
    ///
    /// 接受传入连接，解析 HTTP 请求中的 code 和 state 参数，
    /// 然后返回成功响应告知用户可以关闭窗口
    async fn handle_callback(
        &self,
        listener: TokioTcpListener,
        _port: u16,
    ) -> Result<OAuthCallbackResult, OAuthError> {
        // 接受连接
        let (mut stream, _) = listener
            .accept()
            .await
            .map_err(|e| OAuthError::AcceptError(e.to_string()))?;

        // 读取 HTTP 请求
        let mut buf = vec![0u8; 4096];
        let n = stream
            .read(&mut buf)
            .await
            .map_err(|e| OAuthError::ReadError(e.to_string()))?;
        let request = String::from_utf8_lossy(&buf[..n]);

        // 解析 query parameters (code, state)
        let params = self.parse_callback_params(&request)?;

        // 发送 HTML 响应（告知用户可以关闭窗口）
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<html><body><h3>授权成功，请关闭此窗口</h3></body></html>";
        stream
            .write_all(response.as_bytes())
            .await
            .map_err(|e| OAuthError::WriteError(e.to_string()))?;
        stream.flush().await.ok();

        Ok(params)
    }

    /// 从 HTTP 请求中解析 callback 参数
    ///
    /// 提取 GET 请求路径中的 code 和 state 查询参数
    fn parse_callback_params(&self, request: &str) -> Result<OAuthCallbackResult, OAuthError> {
        // 提取 GET 请求路径（如 /callback?code=xxx&state=yyy）
        let path = request
            .lines()
            .next()
            .and_then(|line| line.split_whitespace().nth(1))
            .unwrap_or("");

        let query = path.split('?').nth(1).unwrap_or("");
        let mut code = None;
        let mut state = None;

        for param in query.split('&') {
            let mut kv = param.split('=');
            let key = kv.next().unwrap_or("");
            let value = kv.next().unwrap_or("");
            match key {
                "code" => code = Some(value.to_string()),
                "state" => state = Some(value.to_string()),
                _ => {}
            }
        }

        match (code, state) {
            (Some(c), Some(s)) => Ok(OAuthCallbackResult { code: c, state: s }),
            _ => Err(OAuthError::InvalidCallback(
                "缺少 code 或 state 参数".to_string(),
            )),
        }
    }

    /// 生成随机 state 参数（防 CSRF）
    ///
    /// 使用 UUID v4 生成随机 state
    pub fn generate_state() -> String {
        uuid::Uuid::new_v4().to_string()
    }
}

/// OAuth 错误类型
#[derive(Debug, thiserror::Error)]
pub enum OAuthError {
    /// TCP 监听器启动错误
    #[error("监听器错误: {0}")]
    ListenerError(String),
    /// 接受连接错误
    #[error("接受连接错误: {0}")]
    AcceptError(String),
    /// 读取请求数据错误
    #[error("读取错误: {0}")]
    ReadError(String),
    /// 写入响应数据错误
    #[error("写入错误: {0}")]
    WriteError(String),
    /// OAuth 回调超时
    #[error("OAuth 回调超时")]
    Timeout,
    /// 无效的回调参数
    #[error("无效回调: {0}")]
    InvalidCallback(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试授权 URL 生成
    #[test]
    fn test_authorization_url() {
        let config = OAuthConfig {
            client_id: "test_client_id".to_string(),
            client_secret: "test_secret".to_string(),
            redirect_base: "http://localhost:9223".to_string(),
        };
        let service = OAuthService::new(config);
        let state = "random_state_123";
        let url = service.get_authorization_url(state);

        assert!(url.contains("client_id=test_client_id"));
        assert!(url.contains("redirect_uri=http://localhost:9223/callback"));
        assert!(url.contains("state=random_state_123"));
        assert!(url.contains("scope=user:email"));
        assert!(url.starts_with("https://github.com/login/oauth/authorize"));
    }

    /// 测试授权 URL 格式完整性
    #[test]
    fn test_authorization_url_format() {
        let config = OAuthConfig {
            client_id: "myapp".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);
        let url = service.get_authorization_url("test_state");

        // 验证 URL 包含所有必要参数
        assert!(url.contains("client_id=myapp"));
        assert!(url.contains("redirect_uri=http://localhost:8080/callback"));
        assert!(url.contains("state=test_state"));
        assert!(url.contains("scope=user:email"));
    }

    /// 测试回调参数解析 — 正常情况
    #[test]
    fn test_parse_callback_params_valid() {
        let config = OAuthConfig {
            client_id: "test".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);

        let request = "GET /callback?code=abc123&state=xyz789 HTTP/1.1\r\nHost: localhost:8080\r\n\r\n";
        let result = service.parse_callback_params(request).unwrap();

        assert_eq!(result.code, "abc123");
        assert_eq!(result.state, "xyz789");
    }

    /// 测试回调参数解析 — 缺少 code
    #[test]
    fn test_parse_callback_params_missing_code() {
        let config = OAuthConfig {
            client_id: "test".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);

        let request = "GET /callback?state=xyz789 HTTP/1.1\r\nHost: localhost:8080\r\n\r\n";
        let result = service.parse_callback_params(request);

        assert!(result.is_err());
        match result {
            Err(OAuthError::InvalidCallback(msg)) => {
                assert!(msg.contains("缺少 code 或 state 参数"));
            }
            _ => panic!("期望 InvalidCallback 错误"),
        }
    }

    /// 测试回调参数解析 — 缺少 state
    #[test]
    fn test_parse_callback_params_missing_state() {
        let config = OAuthConfig {
            client_id: "test".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);

        let request = "GET /callback?code=abc123 HTTP/1.1\r\nHost: localhost:8080\r\n\r\n";
        let result = service.parse_callback_params(request);

        assert!(result.is_err());
    }

    /// 测试回调参数解析 — 空请求
    #[test]
    fn test_parse_callback_params_empty_request() {
        let config = OAuthConfig {
            client_id: "test".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);

        let result = service.parse_callback_params("");

        assert!(result.is_err());
    }

    /// 测试回调参数解析 — 包含额外参数
    #[test]
    fn test_parse_callback_params_extra_params() {
        let config = OAuthConfig {
            client_id: "test".to_string(),
            client_secret: "".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let service = OAuthService::new(config);

        let request = "GET /callback?code=abc123&state=xyz789&extra=foo HTTP/1.1\r\nHost: localhost:8080\r\n\r\n";
        let result = service.parse_callback_params(request).unwrap();

        assert_eq!(result.code, "abc123");
        assert_eq!(result.state, "xyz789");
    }

    /// 测试 state 生成
    #[test]
    fn test_generate_state() {
        let state1 = OAuthService::generate_state();
        let state2 = OAuthService::generate_state();

        // 两次生成的 state 应不同
        assert_ne!(state1, state2);
        // state 应为 UUID 格式
        assert!(uuid::Uuid::parse_str(&state1).is_ok());
        assert!(uuid::Uuid::parse_str(&state2).is_ok());
    }

    /// 测试 OAuthError 显示
    #[test]
    fn test_oauth_error_display() {
        let err = OAuthError::ListenerError("bind failed".to_string());
        assert_eq!(format!("{}", err), "监听器错误: bind failed");

        let err = OAuthError::Timeout;
        assert_eq!(format!("{}", err), "OAuth 回调超时");

        let err = OAuthError::InvalidCallback("bad params".to_string());
        assert_eq!(format!("{}", err), "无效回调: bad params");
    }

    /// 测试 OAuthCallbackResult 序列化
    #[test]
    fn test_callback_result_serialization() {
        let result = OAuthCallbackResult {
            code: "test_code".to_string(),
            state: "test_state".to_string(),
        };

        let json = serde_json::to_string(&result).unwrap();
        let deserialized: OAuthCallbackResult = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.code, result.code);
        assert_eq!(deserialized.state, result.state);
    }

    /// 测试 OAuthConfig 克隆
    #[test]
    fn test_oauth_config_clone() {
        let config = OAuthConfig {
            client_id: "test_id".to_string(),
            client_secret: "test_secret".to_string(),
            redirect_base: "http://localhost:8080".to_string(),
        };
        let cloned = config.clone();

        assert_eq!(cloned.client_id, config.client_id);
        assert_eq!(cloned.client_secret, config.client_secret);
        assert_eq!(cloned.redirect_base, config.redirect_base);
    }
}
