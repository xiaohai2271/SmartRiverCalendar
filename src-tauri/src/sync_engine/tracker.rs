// 变更追踪器
// 监听本地数据库变更，写入 sync_log 表，查询未同步记录，标记已同步

use crate::db::connection::DatabaseConnection;
use crate::db::errors::DatabaseResult;
use crate::db::repositories::sync_log::{CreateSyncLogParams, SyncLogEntry, SyncLogRepository};

/// 变更追踪器
///
/// 负责记录本地数据库的变更操作到 sync_log 表，
/// 供同步执行器上传到远端服务器。
///
/// # 使用方式
/// 在 Tauri Command 层执行 CRUD 操作后，调用 `track_change` 记录变更。
///
/// # 示例
/// ```ignore
/// let tracker = ChangeTracker::new(&db);
/// tracker.track_change(Some(user_id), "event", event_id, "create", &payload)?;
/// ```
pub struct ChangeTracker<'a> {
    repo: SyncLogRepository<'a>,
}

impl<'a> ChangeTracker<'a> {
    /// 创建变更追踪器实例
    ///
    /// # 参数
    /// - `db`: 数据库连接引用
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self {
            repo: SyncLogRepository::new(db),
        }
    }

    /// 记录一条变更
    ///
    /// 在 Tauri Command 层执行 CRUD 后调用此方法，将变更写入 sync_log。
    ///
    /// # 参数
    /// - `user_id`: 所属用户 ID，可为 None
    /// - `entity_type`: 实体类型 ("event", "todo", "calendar")
    /// - `entity_id`: 实体 ID
    /// - `action`: 操作类型 ("create", "update", "delete")
    /// - `payload`: 变更数据的 JSON 字符串
    ///
    /// # 返回
    /// 成功返回写入的 SyncLogEntry
    pub fn track_change(
        &self,
        user_id: Option<i64>,
        entity_type: &str,
        entity_id: i64,
        action: &str,
        payload: &str,
    ) -> DatabaseResult<SyncLogEntry> {
        log::debug!(
            "追踪变更: user_id={:?}, entity_type={}, entity_id={}, action={}",
            user_id, entity_type, entity_id, action
        );

        let params = CreateSyncLogParams {
            user_id,
            entity_type: entity_type.to_string(),
            entity_id,
            action: action.to_string(),
            payload: payload.to_string(),
        };

        let entry = self.repo.create(&params)?;
        log::info!(
            "变更已记录: id={}, entity_type={}, entity_id={}, action={}",
            entry.id, entry.entity_type, entry.entity_id, entry.action
        );
        Ok(entry)
    }

    /// 获取指定用户的未同步记录
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    ///
    /// # 返回
    /// 未同步的变更列表，按创建时间升序排列
    pub fn get_unsynced_by_user(&self, user_id: i64) -> DatabaseResult<Vec<SyncLogEntry>> {
        self.repo.get_unsynced_by_user(user_id)
    }

    /// 获取所有未同步记录
    ///
    /// # 返回
    /// 未同步的变更列表，按创建时间升序排列
    pub fn get_all_unsynced(&self) -> DatabaseResult<Vec<SyncLogEntry>> {
        self.repo.get_all_unsynced()
    }

    /// 标记单条记录为已同步
    ///
    /// # 参数
    /// - `id`: sync_log 记录 ID
    ///
    /// # 返回
    /// 成功返回 true，不存在返回 false
    pub fn mark_synced(&self, id: i64) -> DatabaseResult<bool> {
        self.repo.mark_synced(id)
    }

    /// 批量标记记录为已同步
    ///
    /// # 参数
    /// - `ids`: sync_log 记录 ID 列表
    ///
    /// # 返回
    /// 成功更新的行数
    pub fn mark_synced_batch(&self, ids: &[i64]) -> DatabaseResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let count = self.repo.mark_synced_batch(ids)?;
        log::info!("批量标记已同步: {} 条记录", count);
        Ok(count)
    }

    /// 清理指定用户已同步的日志
    ///
    /// 定期调用以避免 sync_log 表无限增长。
    ///
    /// # 参数
    /// - `user_id`: 用户 ID
    ///
    /// # 返回
    /// 删除的行数
    pub fn cleanup_synced(&self, user_id: i64) -> DatabaseResult<usize> {
        let count = self.repo.delete_synced_by_user(user_id)?;
        log::info!("清理已同步日志: user_id={}, 删除 {} 条", user_id, count);
        Ok(count)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;
    use rusqlite::params;

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

    /// 测试追踪单条变更
    #[test]
    fn test_track_change() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        let entry = tracker
            .track_change(Some(user_id), "event", 1, "create", r#"{"title":"测试事件"}"#)
            .expect("追踪变更失败");

        assert!(entry.id > 0);
        assert_eq!(entry.entity_type, "event");
        assert_eq!(entry.entity_id, 1);
        assert_eq!(entry.action, "create");
        assert!(!entry.synced);
        assert_eq!(entry.payload, r#"{"title":"测试事件"}"#);
    }

    /// 测试追踪多种实体类型的变更
    #[test]
    fn test_track_different_entity_types() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        // 追踪事件变更
        let event_entry = tracker
            .track_change(Some(user_id), "event", 1, "create", "{}")
            .expect("追踪事件变更失败");
        assert_eq!(event_entry.entity_type, "event");

        // 追踪待办变更
        let todo_entry = tracker
            .track_change(Some(user_id), "todo", 2, "update", "{}")
            .expect("追踪待办变更失败");
        assert_eq!(todo_entry.entity_type, "todo");

        // 追踪日历变更
        let calendar_entry = tracker
            .track_change(Some(user_id), "calendar", 3, "delete", "{}")
            .expect("追踪日历变更失败");
        assert_eq!(calendar_entry.entity_type, "calendar");
    }

    /// 测试获取未同步记录
    #[test]
    fn test_get_unsynced() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        // 创建 3 条变更
        for i in 1..=3 {
            tracker
                .track_change(Some(user_id), "event", i, "create", "{}")
                .expect("追踪变更失败");
        }

        // 获取未同步记录
        let unsynced = tracker.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 3);

        // 验证按创建时间升序
        assert!(unsynced[0].created_at <= unsynced[1].created_at);
        assert!(unsynced[1].created_at <= unsynced[2].created_at);
    }

    /// 测试获取所有未同步记录（无用户 ID）
    #[test]
    fn test_get_all_unsynced() {
        let db = setup_test_db();
        let tracker = ChangeTracker::new(&db);

        // 创建无用户 ID 的变更
        tracker
            .track_change(None, "calendar", 1, "create", "{}")
            .expect("追踪变更失败");

        let unsynced = tracker.get_all_unsynced().expect("查询失败");
        assert_eq!(unsynced.len(), 1);
    }

    /// 测试标记单条已同步
    #[test]
    fn test_mark_synced() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        let entry = tracker
            .track_change(Some(user_id), "event", 1, "create", "{}")
            .expect("追踪变更失败");

        assert!(!entry.synced);

        let result = tracker.mark_synced(entry.id).expect("标记失败");
        assert!(result);

        // 标记后应不在未同步列表中
        let unsynced = tracker.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 0);
    }

    /// 测试批量标记已同步
    #[test]
    fn test_mark_synced_batch() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        // 创建 5 条变更
        let mut ids = Vec::new();
        for i in 1..=5 {
            let entry = tracker
                .track_change(Some(user_id), "event", i, "create", "{}")
                .expect("追踪变更失败");
            ids.push(entry.id);
        }

        // 批量标记前 3 条
        let count = tracker.mark_synced_batch(&ids[..3]).expect("批量标记失败");
        assert_eq!(count, 3);

        // 剩余 2 条未同步
        let unsynced = tracker.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 2);
    }

    /// 测试批量标记空列表
    #[test]
    fn test_mark_synced_batch_empty() {
        let db = setup_test_db();
        let tracker = ChangeTracker::new(&db);

        let count = tracker.mark_synced_batch(&[]).expect("批量标记失败");
        assert_eq!(count, 0);
    }

    /// 测试清理已同步日志
    #[test]
    fn test_cleanup_synced() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        // 创建 4 条变更，标记偶数为已同步
        for i in 1..=4 {
            let entry = tracker
                .track_change(Some(user_id), "event", i, "create", "{}")
                .expect("追踪变更失败");
            if i % 2 == 0 {
                tracker.mark_synced(entry.id).expect("标记失败");
            }
        }

        // 清理已同步的日志
        let deleted = tracker.cleanup_synced(user_id).expect("清理失败");
        assert_eq!(deleted, 2);
    }

    /// 测试追踪 update 和 delete 操作
    #[test]
    fn test_track_update_and_delete() {
        let db = setup_test_db();
        let user_id = create_test_user(&db);
        let tracker = ChangeTracker::new(&db);

        // 创建
        let create_entry = tracker
            .track_change(Some(user_id), "event", 1, "create", r#"{"title":"新事件"}"#)
            .expect("追踪 create 失败");
        assert_eq!(create_entry.action, "create");

        // 更新
        let update_entry = tracker
            .track_change(Some(user_id), "event", 1, "update", r#"{"title":"更新事件"}"#)
            .expect("追踪 update 失败");
        assert_eq!(update_entry.action, "update");

        // 删除
        let delete_entry = tracker
            .track_change(Some(user_id), "event", 1, "delete", r#"{"id":1}"#)
            .expect("追踪 delete 失败");
        assert_eq!(delete_entry.action, "delete");

        // 应有 3 条未同步记录
        let unsynced = tracker.get_unsynced_by_user(user_id).expect("查询失败");
        assert_eq!(unsynced.len(), 3);
    }
}
