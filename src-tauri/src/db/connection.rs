// 数据库连接管理模块
// 负责数据库连接池的创建、配置和生命周期管理

use super::errors::{DatabaseError, DatabaseResult};
use rusqlite::{Connection, Transaction, TransactionBehavior};
use std::sync::Mutex;

/// 数据库连接管理器
///
/// 封装 SQLite 连接，提供线程安全的数据库访问
/// 使用 Mutex 确保线程安全（rusqlite::Connection 是 Send 但不是 Sync）
pub struct DatabaseConnection {
    /// 内部连接，使用 Mutex 包装以支持多线程访问
    conn: Mutex<Connection>,
}

impl DatabaseConnection {
    /// 创建并配置数据库连接
    ///
    /// # 参数
    /// - `path`: 数据库文件路径，支持 `:memory:` 表示内存数据库
    ///
    /// # 返回
    /// 成功返回 DatabaseConnection 实例，失败返回错误
    ///
    /// # 示例
    /// ```ignore
    /// let db = DatabaseConnection::connect("calendar.db")?;
    /// let memory_db = DatabaseConnection::connect(":memory:")?;
    /// ```
    pub fn connect(path: &str) -> DatabaseResult<Self> {
        // 验证路径不为空
        if path.is_empty() {
            return Err(DatabaseError::ConnectionError {
                message: "数据库路径不能为空".to_string(),
            });
        }

        // 打开或创建数据库连接
        let conn = Connection::open(path)?;

        // 配置数据库参数
        Self::configure_connection(&conn)?;

        log::info!("数据库连接成功: {}", path);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 创建内存数据库连接（用于测试）
    ///
    /// # 返回
    /// 成功返回内存数据库连接实例
    pub fn in_memory() -> DatabaseResult<Self> {
        let conn = Connection::open_in_memory()?;
        Self::configure_connection(&conn)?;

        log::debug!("内存数据库连接成功");

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 配置数据库连接参数
    ///
    /// 设置：
    /// - busy_timeout: 5000ms (避免数据库锁定)
    /// - foreign_keys: ON (启用外键约束)
    fn configure_connection(conn: &Connection) -> DatabaseResult<()> {
        // 设置繁忙超时为 5 秒
        // 当数据库被其他连接锁定时，等待最多 5 秒而不是立即失败
        conn.pragma_update(None, "busy_timeout", 5000)
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("设置 busy_timeout 失败: {}", e),
            })?;

        // 启用外键约束
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(|e| DatabaseError::ConnectionError {
                message: format!("启用外键约束失败: {}", e),
            })?;

        log::debug!("数据库配置完成: busy_timeout=5000, foreign_keys=ON");

        Ok(())
    }

    /// 获取数据库连接的互斥锁守卫
    ///
    /// # 返回
    /// 返回 MutexGuard，用于访问底层连接
    ///
    /// # 注意
    /// 获取锁后应尽快释放，避免长时间持有导致阻塞
    pub fn get_connection(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|e| {
            log::error!("数据库连接锁获取失败: {}", e);
            e.into_inner()
        })
    }

    /// 开始延迟事务
    ///
    /// 使用 TransactionBehavior::Deferred 延迟获取锁，
    /// 适用于读取为主的场景，减少锁竞争
    ///
    /// # 返回
    /// 成功返回事务对象
    ///
    /// # 注意
    /// 由于生命周期限制，事务对象需要在闭包内使用。
    /// 推荐使用 `execute_in_transaction` 方法。
    pub fn with_deferred_transaction<F, T>(&self, f: F) -> DatabaseResult<T>
    where
        F: FnOnce(&Transaction) -> rusqlite::Result<T>,
    {
        let mut conn = self.get_connection();
        let tx = conn.transaction_with_behavior(TransactionBehavior::Deferred)?;

        let result = f(&tx)?;

        tx.commit()?;

        Ok(result)
    }

    /// 执行闭包操作（自动处理连接锁）
    ///
    /// # 参数
    /// - `f`: 要执行的闭包，接收 Connection 引用
    ///
    /// # 返回
    /// 闭包的返回值
    ///
    /// # 示例
    /// ```ignore
    /// let count = db.execute(|conn| {
    ///     conn.query_row("SELECT COUNT(*) FROM events", [], |row| row.get(0))
    /// })?;
    /// ```
    pub fn execute<F, T>(&self, f: F) -> DatabaseResult<T>
    where
        F: FnOnce(&Connection) -> rusqlite::Result<T>,
    {
        let conn = self.get_connection();
        let result = f(&conn)?;
        Ok(result)
    }

    /// 在事务中执行闭包操作
    ///
    /// 自动提交或回滚事务
    ///
    /// # 参数
    /// - `f`: 要执行的闭包，接收 Transaction 引用
    ///
    /// # 返回
    /// 闭包的返回值
    ///
    /// # 示例
    /// ```ignore
    /// let id = db.execute_in_transaction(|tx| {
    ///     tx.execute("INSERT INTO events (title) VALUES (?1)", [&title])?;
    ///     Ok(tx.last_insert_rowid())
    /// })?;
    /// ```
    pub fn execute_in_transaction<F, T>(&self, f: F) -> DatabaseResult<T>
    where
        F: FnOnce(&Transaction) -> rusqlite::Result<T>,
    {
        let mut conn = self.get_connection();
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|e| DatabaseError::TransactionError {
                message: format!("开始事务失败: {}", e),
            })?;

        let result = f(&tx)?;

        tx.commit().map_err(|e| DatabaseError::TransactionError {
            message: format!("提交事务失败: {}", e),
        })?;

        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_connection() {
        let db = DatabaseConnection::in_memory().expect("创建内存数据库失败");

        // 测试可以获取连接
        let _conn = db.get_connection();
    }

    #[test]
    fn test_execute() {
        let db = DatabaseConnection::in_memory().unwrap();

        // 创建测试表
        db.execute(|conn| {
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)", [])
        })
        .unwrap();

        // 插入数据
        db.execute(|conn| conn.execute("INSERT INTO test (value) VALUES ('hello')", []))
            .unwrap();

        // 查询数据
        let value: String = db
            .execute(|conn| {
                conn.query_row("SELECT value FROM test WHERE id = 1", [], |row| row.get(0))
            })
            .unwrap();

        assert_eq!(value, "hello");
    }

    #[test]
    fn test_transaction() {
        let db = DatabaseConnection::in_memory().unwrap();

        // 创建测试表
        db.execute(|conn| {
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)", [])
        })
        .unwrap();

        // 使用事务插入数据
        let id = db
            .execute_in_transaction(|tx| {
                tx.execute("INSERT INTO test (value) VALUES ('world')", [])?;
                Ok(tx.last_insert_rowid())
            })
            .unwrap();

        assert_eq!(id, 1);

        // 验证数据
        let count: i64 = db
            .execute(|conn| conn.query_row("SELECT COUNT(*) FROM test", [], |row| row.get(0)))
            .unwrap();

        assert_eq!(count, 1);
    }

    #[test]
    fn test_transaction_rollback() {
        let db = DatabaseConnection::in_memory().unwrap();

        // 创建测试表
        db.execute(|conn| {
            conn.execute("CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)", [])
        })
        .unwrap();

        // 事务失败时应回滚
        let result: Result<(), _> = db.execute_in_transaction(|tx| {
            tx.execute("INSERT INTO test (value) VALUES ('temp')", [])?;
            Err(rusqlite::Error::InvalidQuery) // 模拟错误
        });

        assert!(result.is_err());

        // 验证数据未插入
        let count: i64 = db
            .execute(|conn| conn.query_row("SELECT COUNT(*) FROM test", [], |row| row.get(0)))
            .unwrap();

        assert_eq!(count, 0);
    }

    #[test]
    fn test_invalid_path() {
        let result = DatabaseConnection::connect("");
        assert!(result.is_err());

        match result {
            Err(DatabaseError::ConnectionError { message: _ }) => (),
            _ => panic!("期望 ConnectionError 错误"),
        }
    }

    #[test]
    fn test_pragma_settings() {
        let db = DatabaseConnection::in_memory().unwrap();

        // 验证 foreign_keys 已启用
        let fk_enabled: i64 = db
            .execute(|conn| conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0)))
            .unwrap();

        assert_eq!(fk_enabled, 1);

        // 验证 busy_timeout 已设置
        let timeout: i64 = db
            .execute(|conn| conn.query_row("PRAGMA busy_timeout", [], |row| row.get(0)))
            .unwrap();

        assert_eq!(timeout, 5000);
    }
}
