// 同步状态 Repository
// 实现同步状态的 CRUD 操作，用于跟踪外部日历的同步进度

use crate::db::errors::DatabaseResult;
use rusqlite::{Connection, Row};

/// 同步状态实体
///
/// 存储外部日历的同步信息，用于增量同步
/// 主键是复合主键 (account_id, calendar_id)
#[derive(Debug, Clone)]
pub struct SyncState {
    /// 外部账户 ID
    pub account_id: i64,
    /// 日历 ID
    pub calendar_id: i64,
    /// 同步令牌，用于增量同步
    pub sync_token: Option<String>,
    /// 上次同步时间（Unix 时间戳，毫秒）
    pub last_sync_at: Option<i64>,
    /// 同步窗口起始时间（Unix 时间戳，毫秒）
    pub sync_window_start: Option<i64>,
    /// 同步窗口结束时间（Unix 时间戳，毫秒）
    pub sync_window_end: Option<i64>,
}

/// 同步状态新建参数
///
/// 用于创建新的同步状态记录
#[derive(Debug, Clone)]
pub struct NewSyncState {
    pub account_id: i64,
    pub calendar_id: i64,
    pub sync_token: Option<String>,
    pub last_sync_at: Option<i64>,
    pub sync_window_start: Option<i64>,
    pub sync_window_end: Option<i64>,
}

/// 同步状态更新参数
///
/// 用于更新现有同步状态记录
#[derive(Debug, Clone)]
pub struct UpdateSyncState {
    pub sync_token: Option<String>,
    pub last_sync_at: Option<i64>,
    pub sync_window_start: Option<i64>,
    pub sync_window_end: Option<i64>,
}

/// 同步状态 Repository
///
/// 提供同步状态的数据访问操作
pub struct SyncStateRepository;

impl SyncStateRepository {
    /// 从数据库行解析同步状态
    fn from_row(row: &Row) -> rusqlite::Result<SyncState> {
        Ok(SyncState {
            account_id: row.get(0)?,
            calendar_id: row.get(1)?,
            sync_token: row.get(2)?,
            last_sync_at: row.get(3)?,
            sync_window_start: row.get(4)?,
            sync_window_end: row.get(5)?,
        })
    }

    /// 获取同步状态
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `account_id`: 外部账户 ID
    /// - `calendar_id`: 日历 ID
    ///
    /// # 返回
    /// 成功返回同步状态，不存在返回 None
    pub fn get(
        conn: &Connection,
        account_id: i64,
        calendar_id: i64,
    ) -> DatabaseResult<Option<SyncState>> {
        let result = conn.query_row(
            "SELECT account_id, calendar_id, sync_token, last_sync_at, sync_window_start, sync_window_end
             FROM sync_state 
             WHERE account_id = ?1 AND calendar_id = ?2",
            [account_id, calendar_id],
            Self::from_row,
        );

        match result {
            Ok(state) => Ok(Some(state)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// 插入或更新同步状态
    ///
    /// 使用 ON CONFLICT DO UPDATE 实现 upsert 操作
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `new_state`: 新同步状态参数
    ///
    /// # 返回
    /// 成功返回 ()
    pub fn upsert(conn: &Connection, new_state: &NewSyncState) -> DatabaseResult<()> {
        conn.execute(
            "INSERT INTO sync_state (account_id, calendar_id, sync_token, last_sync_at, sync_window_start, sync_window_end)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(account_id, calendar_id) DO UPDATE SET
                 sync_token = excluded.sync_token,
                 last_sync_at = excluded.last_sync_at,
                 sync_window_start = excluded.sync_window_start,
                 sync_window_end = excluded.sync_window_end",
            rusqlite::params![
                new_state.account_id,
                new_state.calendar_id,
                new_state.sync_token,
                new_state.last_sync_at,
                new_state.sync_window_start,
                new_state.sync_window_end,
            ],
        )?;

        Ok(())
    }

    /// 更新同步令牌
    ///
    /// 更新指定账户和日历的同步令牌，同时更新最后同步时间
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `account_id`: 外部账户 ID
    /// - `calendar_id`: 日历 ID
    /// - `sync_token`: 新的同步令牌
    /// - `last_sync_at`: 最后同步时间（Unix 时间戳，毫秒）
    ///
    /// # 返回
    /// 成功返回更新的行数，如果记录不存在返回 0
    pub fn update_sync_token(
        conn: &Connection,
        account_id: i64,
        calendar_id: i64,
        sync_token: &str,
        last_sync_at: i64,
    ) -> DatabaseResult<usize> {
        let rows_affected = conn.execute(
            "UPDATE sync_state 
             SET sync_token = ?1, last_sync_at = ?2 
             WHERE account_id = ?3 AND calendar_id = ?4",
            rusqlite::params![sync_token, last_sync_at, account_id, calendar_id],
        )?;

        Ok(rows_affected)
    }

    /// 删除同步状态
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `account_id`: 外部账户 ID
    /// - `calendar_id`: 日历 ID
    ///
    /// # 返回
    /// 成功返回删除的行数
    pub fn delete(conn: &Connection, account_id: i64, calendar_id: i64) -> DatabaseResult<usize> {
        let rows_affected = conn.execute(
            "DELETE FROM sync_state WHERE account_id = ?1 AND calendar_id = ?2",
            [account_id, calendar_id],
        )?;

        Ok(rows_affected)
    }

    /// 删除指定账户的所有同步状态
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `account_id`: 外部账户 ID
    ///
    /// # 返回
    /// 成功返回删除的行数
    pub fn delete_by_account(conn: &Connection, account_id: i64) -> DatabaseResult<usize> {
        let rows_affected =
            conn.execute("DELETE FROM sync_state WHERE account_id = ?1", [account_id])?;

        Ok(rows_affected)
    }

    /// 删除指定日历的所有同步状态
    ///
    /// # 参数
    /// - `conn`: 数据库连接
    /// - `calendar_id`: 日历 ID
    ///
    /// # 返回
    /// 成功返回删除的行数
    pub fn delete_by_calendar(conn: &Connection, calendar_id: i64) -> DatabaseResult<usize> {
        let rows_affected = conn.execute(
            "DELETE FROM sync_state WHERE calendar_id = ?1",
            [calendar_id],
        )?;

        Ok(rows_affected)
    }
}

// ============================================================================
// 测试模块
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;
    use rusqlite::Connection;

    /// 创建内存数据库并初始化表结构
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("创建内存数据库失败");
        create_tables(&conn).expect("创建表失败");
        conn
    }

    /// 创建测试账户
    fn create_test_account(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO accounts (type, server_url, username, encrypted_password, created_at, updated_at)
             VALUES ('caldav', 'https://test.com', 'testuser', 'encrypted', strftime('%s','now') * 1000, strftime('%s','now') * 1000)",
            [],
        ).expect("创建测试账户失败");
        conn.last_insert_rowid()
    }

    /// 创建测试日历
    fn create_test_calendar(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO calendars (name, color, type, created_at, updated_at)
             VALUES ('Test Calendar', '#FF0000', 'local', strftime('%s','now') * 1000, strftime('%s','now') * 1000)",
            [],
        ).expect("创建测试日历失败");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_upsert_and_get() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 插入新的同步状态
        let new_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: Some("token123".to_string()),
            last_sync_at: Some(1700000000000),
            sync_window_start: Some(1699000000000),
            sync_window_end: Some(1701000000000),
        };

        SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");

        // 查询并验证
        let state = SyncStateRepository::get(&conn, account_id, calendar_id)
            .expect("Get 失败")
            .expect("同步状态不存在");

        assert_eq!(state.account_id, account_id);
        assert_eq!(state.calendar_id, calendar_id);
        assert_eq!(state.sync_token, Some("token123".to_string()));
        assert_eq!(state.last_sync_at, Some(1700000000000));
        assert_eq!(state.sync_window_start, Some(1699000000000));
        assert_eq!(state.sync_window_end, Some(1701000000000));
    }

    #[test]
    fn test_upsert_update() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 插入初始同步状态
        let new_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: Some("token123".to_string()),
            last_sync_at: Some(1700000000000),
            sync_window_start: None,
            sync_window_end: None,
        };

        SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");

        // 更新同步状态
        let updated_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: Some("token456".to_string()),
            last_sync_at: Some(1800000000000),
            sync_window_start: Some(1799000000000),
            sync_window_end: Some(1801000000000),
        };

        SyncStateRepository::upsert(&conn, &updated_state).expect("Upsert 更新失败");

        // 查询并验证更新
        let state = SyncStateRepository::get(&conn, account_id, calendar_id)
            .expect("Get 失败")
            .expect("同步状态不存在");

        assert_eq!(state.sync_token, Some("token456".to_string()));
        assert_eq!(state.last_sync_at, Some(1800000000000));
        assert_eq!(state.sync_window_start, Some(1799000000000));
        assert_eq!(state.sync_window_end, Some(1801000000000));
    }

    #[test]
    fn test_get_not_found() {
        let conn = setup_test_db();

        // 查询不存在的同步状态
        let state = SyncStateRepository::get(&conn, 999, 999).expect("Get 失败");

        assert!(state.is_none());
    }

    #[test]
    fn test_update_sync_token() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 先插入同步状态
        let new_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: Some("old_token".to_string()),
            last_sync_at: Some(1700000000000),
            sync_window_start: None,
            sync_window_end: None,
        };

        SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");

        // 更新同步令牌
        let rows = SyncStateRepository::update_sync_token(
            &conn,
            account_id,
            calendar_id,
            "new_token",
            1800000000000,
        )
        .expect("Update sync token 失败");

        assert_eq!(rows, 1);

        // 验证更新结果
        let state = SyncStateRepository::get(&conn, account_id, calendar_id)
            .expect("Get 失败")
            .expect("同步状态不存在");

        assert_eq!(state.sync_token, Some("new_token".to_string()));
        assert_eq!(state.last_sync_at, Some(1800000000000));
        // 其他字段应保持不变
        assert_eq!(state.sync_window_start, None);
        assert_eq!(state.sync_window_end, None);
    }

    #[test]
    fn test_update_sync_token_not_found() {
        let conn = setup_test_db();

        // 更新不存在的记录
        let rows = SyncStateRepository::update_sync_token(&conn, 999, 999, "token", 1700000000000)
            .expect("Update 失败");

        assert_eq!(rows, 0);
    }

    #[test]
    fn test_delete() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 插入同步状态
        let new_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: Some("token".to_string()),
            last_sync_at: Some(1700000000000),
            sync_window_start: None,
            sync_window_end: None,
        };

        SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");

        // 删除同步状态
        let rows =
            SyncStateRepository::delete(&conn, account_id, calendar_id).expect("Delete 失败");

        assert_eq!(rows, 1);

        // 验证删除成功
        let state = SyncStateRepository::get(&conn, account_id, calendar_id).expect("Get 失败");

        assert!(state.is_none());
    }

    #[test]
    fn test_delete_not_found() {
        let conn = setup_test_db();

        // 删除不存在的记录
        let rows = SyncStateRepository::delete(&conn, 999, 999).expect("Delete 失败");

        assert_eq!(rows, 0);
    }

    #[test]
    fn test_delete_by_account() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id1 = create_test_calendar(&conn);
        let calendar_id2 = create_test_calendar(&conn);

        // 为同一账户创建多个同步状态
        for calendar_id in [calendar_id1, calendar_id2] {
            let new_state = NewSyncState {
                account_id,
                calendar_id,
                sync_token: Some("token".to_string()),
                last_sync_at: Some(1700000000000),
                sync_window_start: None,
                sync_window_end: None,
            };
            SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");
        }

        // 删除该账户的所有同步状态
        let rows = SyncStateRepository::delete_by_account(&conn, account_id)
            .expect("Delete by account 失败");

        assert_eq!(rows, 2);

        // 验证删除成功
        assert!(SyncStateRepository::get(&conn, account_id, calendar_id1)
            .expect("Get 失败")
            .is_none());
        assert!(SyncStateRepository::get(&conn, account_id, calendar_id2)
            .expect("Get 失败")
            .is_none());
    }

    #[test]
    fn test_delete_by_calendar() {
        let conn = setup_test_db();
        let account_id1 = create_test_account(&conn);
        let account_id2 = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 为同一日历创建多个同步状态（不同账户）
        for account_id in [account_id1, account_id2] {
            let new_state = NewSyncState {
                account_id,
                calendar_id,
                sync_token: Some("token".to_string()),
                last_sync_at: Some(1700000000000),
                sync_window_start: None,
                sync_window_end: None,
            };
            SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");
        }

        // 删除该日历的所有同步状态
        let rows = SyncStateRepository::delete_by_calendar(&conn, calendar_id)
            .expect("Delete by calendar 失败");

        assert_eq!(rows, 2);

        // 验证删除成功
        assert!(SyncStateRepository::get(&conn, account_id1, calendar_id)
            .expect("Get 失败")
            .is_none());
        assert!(SyncStateRepository::get(&conn, account_id2, calendar_id)
            .expect("Get 失败")
            .is_none());
    }

    #[test]
    fn test_optional_fields() {
        let conn = setup_test_db();
        let account_id = create_test_account(&conn);
        let calendar_id = create_test_calendar(&conn);

        // 插入所有字段为 None 的同步状态
        let new_state = NewSyncState {
            account_id,
            calendar_id,
            sync_token: None,
            last_sync_at: None,
            sync_window_start: None,
            sync_window_end: None,
        };

        SyncStateRepository::upsert(&conn, &new_state).expect("Upsert 失败");

        // 查询并验证
        let state = SyncStateRepository::get(&conn, account_id, calendar_id)
            .expect("Get 失败")
            .expect("同步状态不存在");

        assert_eq!(state.account_id, account_id);
        assert_eq!(state.calendar_id, calendar_id);
        assert_eq!(state.sync_token, None);
        assert_eq!(state.last_sync_at, None);
        assert_eq!(state.sync_window_start, None);
        assert_eq!(state.sync_window_end, None);
    }
}
