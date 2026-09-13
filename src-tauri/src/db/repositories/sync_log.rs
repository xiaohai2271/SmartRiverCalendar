// 同步日志 Repository
// 记录本地数据变更，用于增量同步

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

/// 同步日志实体
///
/// 记录本地数据的变更操作，用于增量同步到远程服务器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLogEntry {
    /// 日志 ID（自增主键）
    pub id: i64,
    /// 所属用户 ID
    pub user_id: Option<i64>,
    /// 实体类型（event, todo, calendar）
    pub entity_type: String,
    /// 实体 ID
    pub entity_id: i64,
    /// 操作类型（create, update, delete）
    pub action: String,
    /// 变更数据（JSON 格式）
    pub payload: String,
    /// 是否已同步（0=未同步，1=已同步）
    pub synced: bool,
    /// 创建时间戳（毫秒）
    pub created_at: i64,
}

/// 创建同步日志的参数
#[derive(Debug, Clone)]
pub struct CreateSyncLogParams {
    /// 所属用户 ID
    pub user_id: Option<i64>,
    /// 实体类型（event, todo, calendar）
    pub entity_type: String,
    /// 实体 ID
    pub entity_id: i64,
    /// 操作类型（create, update, delete）
    pub action: String,
    /// 变更数据（JSON 格式）
    pub payload: String,
}

/// 同步日志查询的列列表
const SYNC_LOG_COLUMNS: &str = r#"
    id, user_id, entity_type, entity_id, action, payload, synced, created_at
"#;

impl SyncLogEntry {
    /// 从数据库行解析同步日志（使用列名访问，更安全）
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(SyncLogEntry {
            id: row.get("id")?,
            user_id: row.get("user_id")?,
            entity_type: row.get("entity_type")?,
            entity_id: row.get("entity_id")?,
            action: row.get("action")?,
            payload: row.get("payload")?,
            synced: row.get::<_, i64>("synced")? != 0,
            created_at: row.get("created_at")?,
        })
    }
}

/// 同步日志 Repository
///
/// 提供同步日志的数据访问操作
pub struct SyncLogRepository<'a> {
    db: &'a DatabaseConnection,
}

impl<'a> SyncLogRepository<'a> {
    /// 创建 SyncLogRepository 实例
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建同步日志记录
    ///
    /// # 参数
    /// - `params`: 创建参数
    ///
    /// # 返回
    /// 成功返回新创建的同步日志（包含生成的 ID）
    pub fn create(&self, params: &CreateSyncLogParams) -> DatabaseResult<SyncLogEntry> {
        let now = chrono::Utc::now().timestamp_millis();

        let id = self.db.execute_in_transaction(|tx| {
            tx.execute(
                &format!(
                    "INSERT INTO sync_log (user_id, entity_type, entity_id, action, payload, synced, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)"
                ),
                rusqlite::params![
                    params.user_id,
                    params.entity_type,
                    params.entity_id,
                    params.action,
                    params.payload,
                    now,
                ],
            )?;
            Ok(tx.last_insert_rowid())
        })?;

        self.get_by_id(id)?.ok_or_else(|| DatabaseError::NotFound {
            entity: "SyncLogEntry".to_string(),
            id,
        })
    }

    /// 根据 ID 获取同步日志
    ///
    /// # 参数
    /// - `id`: 日志 ID
    ///
    /// # 返回
    /// 找到返回 Some(SyncLogEntry)，否则返回 None
    pub fn get_by_id(&self, id: i64) -> DatabaseResult<Option<SyncLogEntry>> {
        self.db.execute(|conn| {
            let result = conn.query_row(
                &format!("SELECT {SYNC_LOG_COLUMNS} FROM sync_log WHERE id = ?1"),
                params![id],
                SyncLogEntry::from_row,
            );
            match result {
                Ok(entry) => Ok(Some(entry)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// 获取指定用户的未同步日志
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    ///
    /// # 返回
    /// 未同步的日志列表，按创建时间升序排列
    pub fn get_unsynced_by_user(&self, user_id: i64) -> DatabaseResult<Vec<SyncLogEntry>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {SYNC_LOG_COLUMNS} FROM sync_log WHERE user_id = ?1 AND synced = 0 ORDER BY created_at ASC"
            ))?;
            let entries = stmt
                .query_map(params![user_id], SyncLogEntry::from_row)?
                .filter_map(|r| r.ok())
                .collect();
            Ok(entries)
        })
    }

    /// 获取所有未同步日志
    ///
    /// # 返回
    /// 未同步的日志列表，按创建时间升序排列
    pub fn get_all_unsynced(&self) -> DatabaseResult<Vec<SyncLogEntry>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {SYNC_LOG_COLUMNS} FROM sync_log WHERE synced = 0 ORDER BY created_at ASC"
            ))?;
            let entries = stmt
                .query_map([], SyncLogEntry::from_row)?
                .filter_map(|r| r.ok())
                .collect();
            Ok(entries)
        })
    }

    /// 标记指定日志为已同步
    ///
    /// # 参数
    /// - `id`: 日志 ID
    ///
    /// # 返回
    /// 成功返回 true，不存在返回 false
    pub fn mark_synced(&self, id: i64) -> DatabaseResult<bool> {
        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute(
                "UPDATE sync_log SET synced = 1 WHERE id = ?1",
                params![id],
            )?;
            Ok(tx.changes())
        })?;

        Ok(rows_affected > 0)
    }

    /// 批量标记指定日志为已同步
    ///
    /// # 参数
    /// - `ids`: 日志 ID 列表
    ///
    /// # 返回
    /// 成功返回更新的行数
    pub fn mark_synced_batch(&self, ids: &[i64]) -> DatabaseResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }

        let rows_affected = self.db.execute_in_transaction(|tx| {
            let placeholders: Vec<String> = ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
            let sql = format!(
                "UPDATE sync_log SET synced = 1 WHERE id IN ({})",
                placeholders.join(",")
            );
            let params: Vec<&dyn rusqlite::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::ToSql).collect();
            tx.execute(&sql, params.as_slice())?;
            Ok(tx.changes() as usize)
        })?;

        Ok(rows_affected)
    }

    /// 删除指定用户已同步的日志
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    ///
    /// # 返回
    /// 删除的行数
    pub fn delete_synced_by_user(&self, user_id: i64) -> DatabaseResult<usize> {
        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute(
                "DELETE FROM sync_log WHERE user_id = ?1 AND synced = 1",
                params![user_id],
            )?;
            Ok(tx.changes() as usize)
        })?;

        Ok(rows_affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;

    /// 创建测试用的内存数据库
    fn setup_test_db() -> DatabaseConnection {
        let db = DatabaseConnection::in_memory().expect("创建内存数据库失败");
        db.execute(|conn| {
            create_tables(conn).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e.to_string(),
                )))
            })
        })
        .expect("创建表失败");
        db
    }

    /// 创建测试用的本地用户
    fn create_test_user(db: &DatabaseConnection) -> i64 {
        let now = chrono::Utc::now().timestamp_millis();
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO local_users (user_id, email, display_name, is_current, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![1i64, "test@example.com", "测试用户", 1i64, now, now],
            )?;
            Ok(tx.last_insert_rowid())
        })
        .expect("创建测试用户失败")
    }

    #[test]
    fn test_create_sync_log() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        let params = CreateSyncLogParams {
            user_id: Some(user_id),
            entity_type: "event".to_string(),
            entity_id: 1,
            action: "create".to_string(),
            payload: r#"{"title":"测试事件"}"#.to_string(),
        };

        let entry = repo.create(&params).expect("创建同步日志失败");

        assert!(entry.id > 0);
        assert_eq!(entry.entity_type, "event");
        assert_eq!(entry.entity_id, 1);
        assert_eq!(entry.action, "create");
        assert!(!entry.synced);
    }

    #[test]
    fn test_get_by_id() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        let params = CreateSyncLogParams {
            user_id: Some(user_id),
            entity_type: "event".to_string(),
            entity_id: 1,
            action: "update".to_string(),
            payload: "{}".to_string(),
        };

        let created = repo.create(&params).expect("创建同步日志失败");
        let found = repo.get_by_id(created.id).expect("查询失败");

        assert!(found.is_some());
        assert_eq!(found.unwrap().action, "update");
    }

    #[test]
    fn test_get_by_id_not_found() {
        let db = setup_test_db();
        let repo = SyncLogRepository::new(&db);

        let found = repo.get_by_id(999).expect("查询失败");
        assert!(found.is_none());
    }

    #[test]
    fn test_get_unsynced_by_user() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        // 创建多个同步日志
        for i in 1..=3 {
            let params = CreateSyncLogParams {
                user_id: Some(user_id),
                entity_type: "event".to_string(),
                entity_id: i,
                action: "create".to_string(),
                payload: "{}".to_string(),
            };
            repo.create(&params).expect("创建同步日志失败");
        }

        // 获取未同步日志
        let unsynced = repo.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 3);

        // 标记第一个为已同步
        repo.mark_synced(unsynced[0].id).expect("标记失败");

        // 再次获取未同步日志
        let unsynced_after = repo.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced_after.len(), 2);
    }

    #[test]
    fn test_get_all_unsynced() {
        let db = setup_test_db();
        let repo = SyncLogRepository::new(&db);

        // 创建无用户 ID 的日志
        let params = CreateSyncLogParams {
            user_id: None,
            entity_type: "calendar".to_string(),
            entity_id: 1,
            action: "create".to_string(),
            payload: "{}".to_string(),
        };
        repo.create(&params).expect("创建同步日志失败");

        let unsynced = repo.get_all_unsynced().expect("查询失败");
        assert_eq!(unsynced.len(), 1);
    }

    #[test]
    fn test_mark_synced() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        let params = CreateSyncLogParams {
            user_id: Some(user_id),
            entity_type: "todo".to_string(),
            entity_id: 1,
            action: "delete".to_string(),
            payload: "{}".to_string(),
        };

        let created = repo.create(&params).expect("创建同步日志失败");
        assert!(!created.synced);

        let result = repo.mark_synced(created.id).expect("标记失败");
        assert!(result);

        let found = repo.get_by_id(created.id).expect("查询失败").unwrap();
        assert!(found.synced);
    }

    #[test]
    fn test_mark_synced_not_found() {
        let db = setup_test_db();
        let repo = SyncLogRepository::new(&db);

        let result = repo.mark_synced(999).expect("标记失败");
        assert!(!result);
    }

    #[test]
    fn test_mark_synced_batch() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        // 创建多条日志
        let mut ids = Vec::new();
        for i in 1..=5 {
            let params = CreateSyncLogParams {
                user_id: Some(user_id),
                entity_type: "event".to_string(),
                entity_id: i,
                action: "create".to_string(),
                payload: "{}".to_string(),
            };
            let entry = repo.create(&params).expect("创建同步日志失败");
            ids.push(entry.id);
        }

        // 批量标记前 3 条为已同步
        let count = repo
            .mark_synced_batch(&ids[..3])
            .expect("批量标记失败");
        assert_eq!(count, 3);

        // 验证未同步日志只剩 2 条
        let unsynced = repo.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 2);
    }

    #[test]
    fn test_delete_synced_by_user() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let repo = SyncLogRepository::new(&db);

        // 创建多条日志
        for i in 1..=4 {
            let params = CreateSyncLogParams {
                user_id: Some(user_id),
                entity_type: "event".to_string(),
                entity_id: i,
                action: "create".to_string(),
                payload: "{}".to_string(),
            };
            let entry = repo.create(&params).expect("创建同步日志失败");
            // 标记偶数 ID 的为已同步
            if i % 2 == 0 {
                repo.mark_synced(entry.id).expect("标记失败");
            }
        }

        // 删除已同步的日志
        let count = repo
            .delete_synced_by_user(user_id)
            .expect("删除失败");
        assert_eq!(count, 2);

        // 验证剩余日志
        let unsynced = repo.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 2);
    }
}
