// 数据库表结构定义
// 定义所有数据库表的创建 SQL 和初始化函数

use crate::db::errors::DatabaseError;
use rusqlite::Connection;

/// 创建所有数据库表（不含迁移列的索引）
///
/// 包括：
/// - calendars: 日历表
/// - events: 日历事件表
/// - todos: 待办事项表
/// - accounts: 外部账户表
/// - sync_state: 同步状态表
///
/// 注意：user_id/deleted_at 相关索引不在此处创建，
/// 需要在 init_database() 的迁移之后创建，
/// 因为已有数据库可能还没有这些列
pub fn create_tables(conn: &Connection) -> Result<(), DatabaseError> {
    // 启用外键约束
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // 创建所有表
    conn.execute_batch(
        r#"
        -- 日历表
        CREATE TABLE IF NOT EXISTS calendars (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'local',
            account_id INTEGER,
            visible INTEGER NOT NULL DEFAULT 1,
            sync_enabled INTEGER NOT NULL DEFAULT 0,
            user_id INTEGER,
            deleted_at INTEGER,
            timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
        );

        -- 日历事件表
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            all_day INTEGER NOT NULL DEFAULT 0,
            calendar_id INTEGER NOT NULL,
            color TEXT,
            reminder INTEGER,
            repeat_rule TEXT,
            location TEXT,
            external_id TEXT,
            user_id INTEGER,
            deleted_at INTEGER,
            timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
        );

        -- 待办事项表
        CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            due_date INTEGER,
            completed INTEGER NOT NULL DEFAULT 0,
            priority TEXT NOT NULL DEFAULT 'medium',
            calendar_id INTEGER NOT NULL,
            user_id INTEGER,
            deleted_at INTEGER,
            timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
        );

        -- 外部账户表
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            server_url TEXT NOT NULL,
            username TEXT NOT NULL,
            encrypted_password TEXT NOT NULL,
            display_name TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- 同步状态表
        CREATE TABLE IF NOT EXISTS sync_state (
            account_id INTEGER NOT NULL,
            calendar_id INTEGER NOT NULL,
            sync_token TEXT,
            last_sync_at INTEGER,
            sync_window_start INTEGER,
            sync_window_end INTEGER,
            PRIMARY KEY(account_id, calendar_id),
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
        );

        -- 索引（不依赖迁移列的索引）
        CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
        CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
        CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);
        CREATE INDEX IF NOT EXISTS idx_todos_calendar_id ON todos(calendar_id);
        CREATE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id);

        -- 应用设置表（Key-Value 存储）
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            updated_at INTEGER NOT NULL
        );

        -- 用户节假日表（节假日/调休）
        CREATE TABLE IF NOT EXISTS user_holidays (
            date TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('holiday','makeup')),
            source TEXT NOT NULL DEFAULT 'custom' CHECK(source IN ('custom','api')),
            created_at INTEGER NOT NULL,
            PRIMARY KEY (date, category)
        );

        CREATE INDEX IF NOT EXISTS idx_user_holidays_date ON user_holidays(date);

        -- 本地用户表（认证用户信息缓存）
        CREATE TABLE IF NOT EXISTS local_users (
            user_id INTEGER PRIMARY KEY,
            email TEXT NOT NULL,
            display_name TEXT NOT NULL,
            is_current INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_local_users_is_current ON local_users(is_current);

        -- 同步日志表
        CREATE TABLE IF NOT EXISTS sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            entity_type TEXT NOT NULL CHECK(entity_type IN ('event', 'todo', 'calendar')),
            entity_id INTEGER NOT NULL,
            action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
            payload TEXT NOT NULL,
            synced INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES local_users(user_id) ON DELETE SET NULL
        );

        -- 同步日志索引
        CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_sync_log_synced ON sync_log(synced);
        "#,
    )?;

    Ok(())
}

/// 创建依赖迁移列的索引
///
/// 这些索引依赖 user_id/deleted_at 列，
/// 必须在 ALTER TABLE 迁移之后调用
fn create_migration_indexes(conn: &Connection) -> Result<(), DatabaseError> {
    conn.execute_batch(
        r#"
        -- 日历、事件、待办的 user_id 和 deleted_at 索引
        CREATE INDEX IF NOT EXISTS idx_calendars_user_id ON calendars(user_id);
        CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
        CREATE INDEX IF NOT EXISTS idx_events_deleted_at ON events(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
        CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);
        "#,
    )?;

    Ok(())
}

/// 初始化数据库
///
/// 执行顺序：
/// 1. 创建表结构（CREATE TABLE IF NOT EXISTS）
/// 2. 执行列迁移（ALTER TABLE ADD COLUMN）
/// 3. 创建依赖迁移列的索引
///
/// 这个顺序确保已有数据库能正确迁移，
/// 因为索引引用的列必须先存在
pub fn init_database(conn: &Connection) -> Result<(), DatabaseError> {
    // 1. 创建表结构（新库创建，旧库跳过）
    create_tables(conn)?;

    // 2. 数据库迁移：为已有数据库添加 description 列
    // 忽略"列已存在"错误
    let _ = conn.execute(
        "ALTER TABLE app_settings ADD COLUMN description TEXT NOT NULL DEFAULT ''",
        [],
    );

    // 迁移：为已有表添加 user_id, deleted_at, timezone 字段
    let migrations = [
        "ALTER TABLE calendars ADD COLUMN user_id INTEGER",
        "ALTER TABLE calendars ADD COLUMN deleted_at INTEGER",
        "ALTER TABLE calendars ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'",
        "ALTER TABLE events ADD COLUMN user_id INTEGER",
        "ALTER TABLE events ADD COLUMN deleted_at INTEGER",
        "ALTER TABLE events ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'",
        "ALTER TABLE todos ADD COLUMN user_id INTEGER",
        "ALTER TABLE todos ADD COLUMN deleted_at INTEGER",
        "ALTER TABLE todos ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai'",
    ];
    for sql in &migrations {
        let _ = conn.execute(sql, []);
    }

    // 3. 创建依赖迁移列的索引（必须在迁移之后）
    create_migration_indexes(conn)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_create_tables() {
        // 创建内存数据库
        let conn = Connection::open_in_memory().unwrap();

        // 创建表
        let result = create_tables(&conn);
        assert!(result.is_ok());

        // 验证外键约束已启用
        let fk_enabled: i32 = conn
            .query_row("PRAGMA foreign_keys;", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk_enabled, 1);
    }

    #[test]
    fn test_tables_exist() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

        // 验证所有表都存在
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"calendars".to_string()));
        assert!(tables.contains(&"events".to_string()));
        assert!(tables.contains(&"todos".to_string()));
        assert!(tables.contains(&"accounts".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
        assert!(tables.contains(&"app_settings".to_string()));
        assert!(tables.contains(&"user_holidays".to_string()));
        assert!(tables.contains(&"local_users".to_string()));
        assert!(tables.contains(&"sync_log".to_string()));
    }

    #[test]
    fn test_indexes_exist() {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();

        // 验证所有索引都存在
        let indexes: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(indexes.contains(&"idx_events_calendar_id".to_string()));
        assert!(indexes.contains(&"idx_events_start_time".to_string()));
        assert!(indexes.contains(&"idx_events_external_id".to_string()));
        assert!(indexes.contains(&"idx_todos_calendar_id".to_string()));
        assert!(indexes.contains(&"idx_sync_state_account_id".to_string()));
        assert!(indexes.contains(&"idx_user_holidays_date".to_string()));
        assert!(indexes.contains(&"idx_local_users_is_current".to_string()));
        assert!(indexes.contains(&"idx_sync_log_user_id".to_string()));
        assert!(indexes.contains(&"idx_sync_log_entity".to_string()));
        assert!(indexes.contains(&"idx_sync_log_synced".to_string()));
        assert!(indexes.contains(&"idx_calendars_user_id".to_string()));
        assert!(indexes.contains(&"idx_events_user_id".to_string()));
        assert!(indexes.contains(&"idx_events_deleted_at".to_string()));
        assert!(indexes.contains(&"idx_todos_user_id".to_string()));
        assert!(indexes.contains(&"idx_todos_deleted_at".to_string()));
    }
}
