// API 错误模块
// 定义 API 相关的错误类型和 Result 类型别名

use thiserror::Error;

/// API 错误类型
#[derive(Debug, Error)]
pub enum ApiError {
    /// 网络请求错误 (连接失败、超时等)
    #[error("网络错误: {0}")]
    NetworkError(String),

    /// 认证错误 (401 Unauthorized)
    #[error("认证错误: {0}")]
    AuthError(String),

    /// Token 已过期
    #[error("Token 已过期")]
    TokenExpired,

    /// 服务器错误 (5xx)
    #[error("服务器错误: {0}")]
    ServerError(String),

    /// 参数错误
    #[error("参数错误: {0}")]
    ParamError(String),

    /// 请求超时
    #[error("请求超时")]
    TimeoutError,

    /// 解析错误
    #[error("解析错误: {0}")]
    ParseError(String),

    /// 其他错误
    #[error("未知错误: {0}")]
    Other(String),
}

/// 从 reqwest::Error 转换
impl From<reqwest::Error> for ApiError {
    fn from(err: reqwest::Error) -> Self {
        // 根据 reqwest 错误类型分类
        if err.is_timeout() {
            ApiError::TimeoutError
        } else if err.is_connect() {
            ApiError::NetworkError(format!("连接失败: {}", err))
        } else if err.is_status() {
            let status = err.status().unwrap_or(reqwest::StatusCode::INTERNAL_SERVER_ERROR);
            match status {
                reqwest::StatusCode::UNAUTHORIZED => ApiError::AuthError("认证失败".to_string()),
                s if s.as_u16() >= 500 => ApiError::ServerError(format!("HTTP {}", s)),
                s => ApiError::Other(format!("HTTP {}", s)),
            }
        } else if err.is_decode() {
            ApiError::ParseError(err.to_string())
        } else {
            ApiError::NetworkError(err.to_string())
        }
    }
}

/// 从 serde_json::Error 转换
impl From<serde_json::Error> for ApiError {
    fn from(err: serde_json::Error) -> Self {
        ApiError::ParseError(err.to_string())
    }
}

/// API Result 类型别名
pub type ApiResult<T> = Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;

    /// 测试 ApiError 显示
    #[test]
    fn test_api_error_display() {
        let err = ApiError::NetworkError("连接超时".to_string());
        assert_eq!(format!("{}", err), "网络错误: 连接超时");

        let err = ApiError::AuthError("Token 无效".to_string());
        assert_eq!(format!("{}", err), "认证错误: Token 无效");

        let err = ApiError::TokenExpired;
        assert_eq!(format!("{}", err), "Token 已过期");

        let err = ApiError::ServerError("500 Internal".to_string());
        assert_eq!(format!("{}", err), "服务器错误: 500 Internal");

        let err = ApiError::ParamError("缺少参数".to_string());
        assert_eq!(format!("{}", err), "参数错误: 缺少参数");

        let err = ApiError::TimeoutError;
        assert_eq!(format!("{}", err), "请求超时");

        let err = ApiError::ParseError("JSON 解析失败".to_string());
        assert_eq!(format!("{}", err), "解析错误: JSON 解析失败");

        let err = ApiError::Other("未知问题".to_string());
        assert_eq!(format!("{}", err), "未知错误: 未知问题");
    }

    /// 测试 ApiResult 成功情况
    #[test]
    fn test_api_result_ok() {
        let result: ApiResult<String> = Ok("success".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "success");
    }

    /// 测试 ApiResult 失败情况
    #[test]
    fn test_api_result_err() {
        let result: ApiResult<String> = Err(ApiError::NetworkError("failed".to_string()));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, ApiError::NetworkError(_)));
    }
}