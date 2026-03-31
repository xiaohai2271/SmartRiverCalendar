// 数据库错误类型定义
// 用于统一处理数据库操作中的各种错误情况

use serde::Serialize;
use thiserror::Error;

/// 数据库错误枚举
///
/// 定义了所有可能的数据库错误类型，用于前端错误处理和用户提示。
/// 错误消息使用中文，与项目整体风格一致。
#[derive(Debug, Error, Clone)]
pub enum DatabaseError {
    /// 实体未找到错误
    ///
    /// 当尝试查询、更新或删除不存在的记录时返回
    #[error("未找到 {entity} (ID: {id})")]
    NotFound {
        /// 实体类型名称（如 "Calendar", "Event"）
        entity: String,
        /// 实体 ID
        id: i64,
    },

    /// 约束违反错误
    ///
    /// 当数据库约束（如唯一性、外键）被违反时返回
    #[error("约束违反: {message}")]
    ConstraintViolation {
        /// 错误描述信息
        message: String,
    },

    /// 连接错误
    ///
    /// 当无法建立或维持数据库连接时返回
    #[error("数据库连接错误: {message}")]
    ConnectionError {
        /// 错误描述信息
        message: String,
    },

    /// 查询错误
    ///
    /// 当 SQL 查询执行失败时返回
    #[error("查询错误: {message}")]
    QueryError {
        /// 错误描述信息
        message: String,
    },

    /// 事务错误
    ///
    /// 当事务操作（开始、提交、回滚）失败时返回
    #[error("事务错误: {message}")]
    TransactionError {
        /// 错误描述信息
        message: String,
    },

    /// 无效路径错误
    ///
    /// 当提供的数据库路径无效时返回
    #[error("无效路径: {message}")]
    InvalidPath {
        /// 错误描述信息
        message: String,
    },

    /// 配置错误
    ///
    /// 当数据库配置（如 PRAGMA 设置）失败时返回
    #[error("配置错误: {message}")]
    ConfigError {
        /// 错误描述信息
        message: String,
    },
}

/// 实现 Serialize 用于前端错误传递
///
/// 将错误序列化为 JSON 格式，便于前端处理：
/// ```json
/// {
///   "type": "NotFound",
///   "entity": "Calendar",
///   "id": 1
/// }
/// ```
impl Serialize for DatabaseError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        match self {
            DatabaseError::NotFound { entity, id } => {
                let mut s = serializer.serialize_struct("DatabaseError", 3)?;
                s.serialize_field("type", "NotFound")?;
                s.serialize_field("entity", entity)?;
                s.serialize_field("id", id)?;
                s.end()
            }
            DatabaseError::ConstraintViolation { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "ConstraintViolation")?;
                s.serialize_field("message", message)?;
                s.end()
            }
            DatabaseError::ConnectionError { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "ConnectionError")?;
                s.serialize_field("message", message)?;
                s.end()
            }
            DatabaseError::QueryError { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "QueryError")?;
                s.serialize_field("message", message)?;
                s.end()
            }
            DatabaseError::TransactionError { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "TransactionError")?;
                s.serialize_field("message", message)?;
                s.end()
            }
            DatabaseError::InvalidPath { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "InvalidPath")?;
                s.serialize_field("message", message)?;
                s.end()
            }
            DatabaseError::ConfigError { message } => {
                let mut s = serializer.serialize_struct("DatabaseError", 2)?;
                s.serialize_field("type", "ConfigError")?;
                s.serialize_field("message", message)?;
                s.end()
            }
        }
    }
}

/// 实现 From<rusqlite::Error> 转换
///
/// 将 rusqlite 的底层错误转换为我们的 DatabaseError，
/// 便于统一错误处理，同时隐藏数据库内部细节。
impl From<rusqlite::Error> for DatabaseError {
    fn from(error: rusqlite::Error) -> Self {
        match error {
            // 查询未找到结果
            rusqlite::Error::QueryReturnedNoRows => DatabaseError::NotFound {
                entity: "记录".to_string(),
                id: 0,
            },

            // SQLite 约束错误
            rusqlite::Error::SqliteFailure(err, msg) => {
                let message = msg
                    .clone()
                    .unwrap_or_else(|| format!("SQLite 错误: {:?}", err.code));

                match err.code {
                    // 唯一约束违反和外键约束违反
                    rusqlite::ErrorCode::ConstraintViolation => {
                        DatabaseError::ConstraintViolation {
                            message: format!("数据约束冲突: {}", message),
                        }
                    }
                    // 其他 SQLite 错误
                    _ => DatabaseError::QueryError {
                        message: format!("数据库操作失败: {}", message),
                    },
                }
            }

            // 无效参数
            rusqlite::Error::InvalidParameterName(name) => DatabaseError::QueryError {
                message: format!("无效的参数名: {}", name),
            },

            // 无效列名
            rusqlite::Error::InvalidColumnName(name) => DatabaseError::QueryError {
                message: format!("无效的列名: {}", name),
            },

            // 无效查询
            rusqlite::Error::InvalidQuery => DatabaseError::QueryError {
                message: "无效的 SQL 查询".to_string(),
            },

            // 类型转换错误
            rusqlite::Error::InvalidColumnType(idx, name, ty) => DatabaseError::QueryError {
                message: format!("列 '{}' (索引 {}) 类型错误: {}", name, idx, ty),
            },

            // 连接错误
            rusqlite::Error::InvalidPath(path) => DatabaseError::ConnectionError {
                message: format!("无效的数据库路径: {:?}", path),
            },

            rusqlite::Error::Utf8Error(err) => DatabaseError::ConnectionError {
                message: format!("UTF-8 编码错误: {}", err),
            },

            rusqlite::Error::NulError(err) => DatabaseError::ConnectionError {
                message: format!("字符串包含空字符: {}", err),
            },

            // 其他错误统一作为查询错误处理
            _ => DatabaseError::QueryError {
                message: format!("数据库错误: {}", error),
            },
        }
    }
}

/// 数据库操作结果类型别名
///
/// 使用此类型别名简化函数签名，统一错误类型
pub type DatabaseResult<T> = Result<T, DatabaseError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_error() {
        let error = DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id: 42,
        };

        // 测试 Display trait（通过 thiserror 的 #[error]）
        assert!(error.to_string().contains("Calendar"));
        assert!(error.to_string().contains("42"));

        // 测试序列化
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains(r#""type":"NotFound"#));
        assert!(json.contains(r#""entity":"Calendar"#));
        assert!(json.contains(r#""id":42"#));
    }

    #[test]
    fn test_constraint_violation_error() {
        let error = DatabaseError::ConstraintViolation {
            message: "日历名称已存在".to_string(),
        };

        assert!(error.to_string().contains("日历名称已存在"));

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains(r#""type":"ConstraintViolation"#));
        assert!(json.contains(r#""message":"日历名称已存在"#));
    }

    #[test]
    fn test_connection_error() {
        let error = DatabaseError::ConnectionError {
            message: "无法连接到数据库文件".to_string(),
        };

        assert!(error.to_string().contains("无法连接到数据库文件"));

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains(r#""type":"ConnectionError"#));
    }

    #[test]
    fn test_query_error() {
        let error = DatabaseError::QueryError {
            message: "SQL 语法错误".to_string(),
        };

        assert!(error.to_string().contains("SQL 语法错误"));

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains(r#""type":"QueryError"#));
    }

    #[test]
    fn test_transaction_error() {
        let error = DatabaseError::TransactionError {
            message: "事务回滚失败".to_string(),
        };

        assert!(error.to_string().contains("事务回滚失败"));

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains(r#""type":"TransactionError"#));
    }

    #[test]
    fn test_from_rusqlite_error_query_no_rows() {
        let rusqlite_err = rusqlite::Error::QueryReturnedNoRows;
        let db_err: DatabaseError = rusqlite_err.into();

        match db_err {
            DatabaseError::NotFound { entity, id } => {
                assert_eq!(entity, "记录");
                assert_eq!(id, 0);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_from_rusqlite_error_invalid_parameter() {
        let rusqlite_err = rusqlite::Error::InvalidParameterName("test_param".to_string());
        let db_err: DatabaseError = rusqlite_err.into();

        match db_err {
            DatabaseError::QueryError { message } => {
                assert!(message.contains("test_param"));
            }
            _ => panic!("期望 QueryError 错误"),
        }
    }

    #[test]
    fn test_from_rusqlite_error_invalid_query() {
        let rusqlite_err = rusqlite::Error::InvalidQuery;
        let db_err: DatabaseError = rusqlite_err.into();

        match db_err {
            DatabaseError::QueryError { message } => {
                assert!(message.contains("无效的 SQL 查询"));
            }
            _ => panic!("期望 QueryError 错误"),
        }
    }

    #[test]
    fn test_database_result_ok() {
        let result: DatabaseResult<i32> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_database_result_err() {
        let result: DatabaseResult<i32> = Err(DatabaseError::NotFound {
            entity: "Event".to_string(),
            id: 1,
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_error_clone() {
        let error = DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id: 1,
        };
        let cloned = error.clone();

        match cloned {
            DatabaseError::NotFound { entity, id } => {
                assert_eq!(entity, "Calendar");
                assert_eq!(id, 1);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }
}
