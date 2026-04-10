// 数据库表结构定义
// 定义所有数据库表的创建 SQL 和初始化函数

use crate::db::errors::DatabaseError;
use rusqlite::Connection;

/// 创建所有数据库表
///
/// 包括：
/// - calendars: 日历表
/// - events: 日历事件表
/// - todos: 待办事项表
/// - accounts: 外部账户表
/// - sync_state: 同步状态表
///
/// 以及相关索引
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

        -- 索引
        CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
        CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
        CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);
        CREATE INDEX IF NOT EXISTS idx_todos_calendar_id ON todos(calendar_id);
        CREATE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id);
        "#,
    )?;

    Ok(())
}

/// 初始化数据库
///
/// 创建所有必要的表结构和索引
pub fn init_database(conn: &Connection) -> Result<(), DatabaseError> {
    create_tables(conn)?;
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
    }

    #[test]
    fn test_indexes_exist() {
        let conn = Connection::open_in_memory().unwrap();
        create_tables(&conn).unwrap();

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
    }
}
