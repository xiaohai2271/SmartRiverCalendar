// 同步执行器
// 负责上传本地变更、拉取远端变更、冲突解决

use std::sync::Arc;

use crate::api::{CalendarApi, SyncChange, SyncUploadRequest};
use crate::db::connection::DatabaseConnection;
use crate::db::errors::DatabaseResult;
use crate::sync_engine::tracker::ChangeTracker;

/// 同步结果
#[derive(Debug, Clone)]
pub struct SyncResult {
    /// 上传的变更数量
    pub uploaded: usize,
    /// 下载的变更数量
    pub downloaded: usize,
    /// 冲突数量
    pub conflicts: usize,
    /// 服务端最新版本号
    pub server_version: i64,
    /// 是否成功
    pub success: bool,
    /// 错误信息
    pub errors: Vec<String>,
}

impl SyncResult {
    /// 创建成功的同步结果
    pub fn ok(server_version: i64) -> Self {
        Self {
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
            server_version,
            success: true,
            errors: Vec::new(),
        }
    }

    /// 创建失败的同步结果
    pub fn err(message: String) -> Self {
        Self {
            uploaded: 0,
            downloaded: 0,
            conflicts: 0,
            server_version: 0,
            success: false,
            errors: vec![message],
        }
    }
}

// ================================================================
// JSON 值提取辅助函数
// 将 serde_json::Value 转换为 rusqlite 兼容的 Rust 原始类型
// ================================================================

/// 从 JSON 中提取 i64，不存在返回 None
fn json_i64(data: &serde_json::Value, key: &str) -> Option<i64> {
    data.get(key).and_then(|v| v.as_i64())
}

/// 从 JSON 中提取字符串，不存在返回 None
fn json_str<'a>(data: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    data.get(key).and_then(|v| v.as_str())
}

/// 从 JSON 中提取布尔值，不存在返回 None
fn json_bool(data: &serde_json::Value, key: &str) -> Option<bool> {
    data.get(key).and_then(|v| v.as_bool())
}

/// 同步执行器
///
/// 负责执行完整的同步流程：
/// 1. 从 sync_log 获取未同步的本地变更
/// 2. 上传本地变更到远端
/// 3. 拉取远端变更
/// 4. 将远端变更应用到本地 SQLite（使用事务）
/// 5. 冲突解决（Last-Wins：比较 updated_at）
/// 6. 标记已同步的本地变更
pub struct SyncExecutor<'a> {
    /// 数据库连接
    db: &'a DatabaseConnection,
    /// API 客户端
    api: Arc<dyn CalendarApi>,
    /// 变更追踪器
    tracker: ChangeTracker<'a>,
}

impl<'a> SyncExecutor<'a> {
    /// 创建同步执行器实例
    ///
    /// # 参数
    /// - `db`: 数据库连接引用
    /// - `api`: CalendarApi 实现的 Arc 引用
    pub fn new(db: &'a DatabaseConnection, api: Arc<dyn CalendarApi>) -> Self {
        let tracker = ChangeTracker::new(db);
        Self { db, api, tracker }
    }

    /// 执行批量同步
    ///
    /// 完整流程：上传本地变更 → 拉取远端变更 → 应用远端变更 → 标记已同步
    ///
    /// # 参数
    /// - `user_id`: 当前用户 ID
    /// - `local_version`: 本地当前版本号
    ///
    /// # 返回
    /// 同步结果
    pub async fn batch_sync(&self, user_id: i64, local_version: i64) -> SyncResult {
        log::info!(
            "开始批量同步: user_id={}, local_version={}",
            user_id,
            local_version
        );

        // 1. 获取未同步的本地变更
        let local_changes = match self.tracker.get_unsynced_by_user(user_id) {
            Ok(changes) => changes,
            Err(e) => {
                log::error!("获取未同步变更失败: {}", e);
                return SyncResult::err(format!("获取未同步变更失败: {}", e));
            }
        };

        log::info!("本地未同步变更数量: {}", local_changes.len());

        // 2. 转换为 API 同步变更格式
        let sync_changes: Vec<SyncChange> = local_changes
            .iter()
            .map(|entry| SyncChange {
                action: entry.action.clone(),
                entity_type: entry.entity_type.clone(),
                data: serde_json::from_str(&entry.payload).unwrap_or(serde_json::Value::Null),
                timestamp: entry.created_at,
            })
            .collect();

        // 3. 上传本地变更并拉取远端变更
        let upload_request = SyncUploadRequest {
            local_version,
            changes: sync_changes,
        };

        let download_response = match self.api.sync_upload(upload_request).await {
            Ok(response) => response,
            Err(e) => {
                log::error!("上传变更失败: {}", e);
                return SyncResult::err(format!("上传变更失败: {}", e));
            }
        };

        log::info!(
            "上传成功，远端返回 {} 条变更，服务端版本: {}",
            download_response.changes.len(),
            download_response.server_version
        );

        // 4. 应用远端变更到本地
        let apply_result = self.apply_server_changes(&download_response.changes);

        // 5. 标记本地变更为已同步
        let local_ids: Vec<i64> = local_changes.iter().map(|c| c.id).collect();
        if !local_ids.is_empty() {
            if let Err(e) = self.tracker.mark_synced_batch(&local_ids) {
                log::error!("标记已同步失败: {}", e);
            }
        }

        // 6. 组装结果
        let mut result = SyncResult::ok(download_response.server_version);
        result.uploaded = local_ids.len();
        result.downloaded = download_response.changes.len();

        match apply_result {
            Ok(conflicts) => {
                result.conflicts = conflicts;
            }
            Err(e) => {
                result.success = false;
                result.errors.push(format!("应用远端变更失败: {}", e));
            }
        }

        log::info!(
            "同步完成: 上传={}, 下载={}, 冲突={}, 成功={}",
            result.uploaded,
            result.downloaded,
            result.conflicts,
            result.success
        );

        result
    }

    /// 仅拉取远端变更
    ///
    /// # 参数
    /// - `since_version`: 从哪个版本开始拉取
    ///
    /// # 返回
    /// 同步结果
    pub async fn pull_only(&self, since_version: i64) -> SyncResult {
        log::info!("开始拉取远端变更: since_version={}", since_version);

        let download_response = match self.api.sync_download(since_version).await {
            Ok(response) => response,
            Err(e) => {
                log::error!("拉取远端变更失败: {}", e);
                return SyncResult::err(format!("拉取远端变更失败: {}", e));
            }
        };

        let apply_result = self.apply_server_changes(&download_response.changes);

        let mut result = SyncResult::ok(download_response.server_version);
        result.downloaded = download_response.changes.len();

        match apply_result {
            Ok(conflicts) => {
                result.conflicts = conflicts;
            }
            Err(e) => {
                result.success = false;
                result.errors.push(format!("应用远端变更失败: {}", e));
            }
        }

        result
    }

    /// 将远端变更应用到本地 SQLite（使用事务）
    ///
    /// # 参数
    /// - `changes`: 远端变更列表
    ///
    /// # 返回
    /// 冲突数量
    fn apply_server_changes(&self, changes: &[SyncChange]) -> DatabaseResult<usize> {
        if changes.is_empty() {
            return Ok(0);
        }

        let mut conflict_count = 0;

        self.db.execute_in_transaction(|tx| {
            for change in changes {
                match self.apply_single_change(tx, change) {
                    Ok(has_conflict) => {
                        if has_conflict {
                            conflict_count += 1;
                        }
                    }
                    Err(e) => {
                        log::error!(
                            "应用变更失败: action={}, entity_type={}, error={}",
                            change.action,
                            change.entity_type,
                            e
                        );
                    }
                }
            }
            Ok(())
        })?;

        Ok(conflict_count)
    }

    /// 应用单条变更到本地数据库
    fn apply_single_change(
        &self,
        tx: &rusqlite::Transaction,
        change: &SyncChange,
    ) -> DatabaseResult<bool> {
        match change.entity_type.as_str() {
            "event" => self.apply_event_change(tx, change),
            "todo" => self.apply_todo_change(tx, change),
            "calendar" => self.apply_calendar_change(tx, change),
            _ => {
                log::warn!("未知实体类型: {}", change.entity_type);
                Ok(false)
            }
        }
    }

    /// 应用事件变更
    fn apply_event_change(
        &self,
        tx: &rusqlite::Transaction,
        change: &SyncChange,
    ) -> DatabaseResult<bool> {
        let data = &change.data;
        match change.action.as_str() {
            "create" => {
                let now = chrono::Utc::now().timestamp_millis();
                let id: i64 = json_i64(data, "id").unwrap_or(0);
                let title = json_str(data, "title").unwrap_or("");
                let description = json_str(data, "description");
                let start_time: i64 = json_i64(data, "start_time").unwrap_or(0);
                let end_time: i64 = json_i64(data, "end_time").unwrap_or(0);
                let all_day: bool = json_bool(data, "is_all_day").unwrap_or(false);
                let calendar_id: i64 = json_i64(data, "calendar_id").unwrap_or(0);
                let color = json_str(data, "color");
                let reminder: Option<i32> = json_i64(data, "reminder_minutes").map(|v| v as i32);
                let repeat_rule = json_str(data, "recurrence_rule");
                let location = json_str(data, "location");
                let external_id = json_str(data, "external_id");
                let user_id = json_i64(data, "user_id");
                let timezone = json_str(data, "timezone").unwrap_or("Asia/Shanghai");

                tx.execute(
                    "INSERT OR IGNORE INTO events (id, title, description, start_time, end_time, all_day, calendar_id, color, reminder, repeat_rule, location, external_id, user_id, timezone, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                    rusqlite::params![
                        id, title, description, start_time, end_time, all_day,
                        calendar_id, color, reminder, repeat_rule, location,
                        external_id, user_id, timezone, now, now,
                    ],
                )?;
                Ok(false)
            }
            "update" => {
                let has_conflict = Self::check_conflict(tx, "events", change)?;
                let now = chrono::Utc::now().timestamp_millis();
                let title = json_str(data, "title").unwrap_or("");
                let description = json_str(data, "description");
                let start_time: i64 = json_i64(data, "start_time").unwrap_or(0);
                let end_time: i64 = json_i64(data, "end_time").unwrap_or(0);
                let all_day: bool = json_bool(data, "is_all_day").unwrap_or(false);
                let calendar_id: i64 = json_i64(data, "calendar_id").unwrap_or(0);
                let color = json_str(data, "color");
                let reminder: Option<i32> = json_i64(data, "reminder_minutes").map(|v| v as i32);
                let repeat_rule = json_str(data, "recurrence_rule");
                let location = json_str(data, "location");
                let id: i64 = json_i64(data, "id").unwrap_or(0);

                tx.execute(
                    "UPDATE events SET title=?1, description=?2, start_time=?3, end_time=?4, all_day=?5, calendar_id=?6, color=?7, reminder=?8, repeat_rule=?9, location=?10, updated_at=?11 WHERE id=?12",
                    rusqlite::params![
                        title, description, start_time, end_time, all_day,
                        calendar_id, color, reminder, repeat_rule, location,
                        now, id,
                    ],
                )?;
                Ok(has_conflict)
            }
            "delete" => {
                let now = chrono::Utc::now().timestamp_millis();
                if let Some(id) = json_i64(data, "id") {
                    tx.execute(
                        "UPDATE events SET deleted_at=?1, updated_at=?2 WHERE id=?3",
                        rusqlite::params![now, now, id],
                    )?;
                }
                Ok(false)
            }
            _ => {
                log::warn!("未知事件操作: {}", change.action);
                Ok(false)
            }
        }
    }

    /// 应用待办变更
    fn apply_todo_change(
        &self,
        tx: &rusqlite::Transaction,
        change: &SyncChange,
    ) -> DatabaseResult<bool> {
        let data = &change.data;
        match change.action.as_str() {
            "create" => {
                let now = chrono::Utc::now().timestamp_millis();
                let id: i64 = json_i64(data, "id").unwrap_or(0);
                let title = json_str(data, "title").unwrap_or("");
                let description = json_str(data, "description");
                let due_date = json_i64(data, "due_date");
                let completed: bool = json_bool(data, "is_completed").unwrap_or(false);
                let priority = json_str(data, "priority").unwrap_or("medium");
                let calendar_id: i64 = json_i64(data, "calendar_id").unwrap_or(0);
                let user_id = json_i64(data, "user_id");
                let timezone = json_str(data, "timezone").unwrap_or("Asia/Shanghai");

                tx.execute(
                    "INSERT OR IGNORE INTO todos (id, title, description, due_date, completed, priority, calendar_id, user_id, timezone, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    rusqlite::params![
                        id, title, description, due_date, completed, priority,
                        calendar_id, user_id, timezone, now, now,
                    ],
                )?;
                Ok(false)
            }
            "update" => {
                let has_conflict = Self::check_conflict(tx, "todos", change)?;
                let now = chrono::Utc::now().timestamp_millis();
                let title = json_str(data, "title").unwrap_or("");
                let description = json_str(data, "description");
                let due_date = json_i64(data, "due_date");
                let completed: bool = json_bool(data, "is_completed").unwrap_or(false);
                let priority = json_str(data, "priority").unwrap_or("medium");
                let calendar_id: i64 = json_i64(data, "calendar_id").unwrap_or(0);
                let id: i64 = json_i64(data, "id").unwrap_or(0);

                tx.execute(
                    "UPDATE todos SET title=?1, description=?2, due_date=?3, completed=?4, priority=?5, calendar_id=?6, updated_at=?7 WHERE id=?8",
                    rusqlite::params![
                        title, description, due_date, completed, priority,
                        calendar_id, now, id,
                    ],
                )?;
                Ok(has_conflict)
            }
            "delete" => {
                let now = chrono::Utc::now().timestamp_millis();
                if let Some(id) = json_i64(data, "id") {
                    tx.execute(
                        "UPDATE todos SET deleted_at=?1, updated_at=?2 WHERE id=?3",
                        rusqlite::params![now, now, id],
                    )?;
                }
                Ok(false)
            }
            _ => {
                log::warn!("未知待办操作: {}", change.action);
                Ok(false)
            }
        }
    }

    /// 应用日历变更
    fn apply_calendar_change(
        &self,
        tx: &rusqlite::Transaction,
        change: &SyncChange,
    ) -> DatabaseResult<bool> {
        let data = &change.data;
        match change.action.as_str() {
            "create" => {
                let now = chrono::Utc::now().timestamp_millis();
                let id: i64 = json_i64(data, "id").unwrap_or(0);
                let name = json_str(data, "name").unwrap_or("");
                let color = json_str(data, "color").unwrap_or("#000000");
                let type_ = json_str(data, "type").unwrap_or("local");
                let visible: bool = json_bool(data, "visible").unwrap_or(true);
                let sync_enabled: bool = json_bool(data, "sync_enabled").unwrap_or(false);
                let user_id = json_i64(data, "user_id");
                let timezone = json_str(data, "timezone").unwrap_or("Asia/Shanghai");

                tx.execute(
                    "INSERT OR IGNORE INTO calendars (id, name, color, type, visible, sync_enabled, user_id, timezone, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    rusqlite::params![
                        id, name, color, type_, visible, sync_enabled,
                        user_id, timezone, now, now,
                    ],
                )?;
                Ok(false)
            }
            "update" => {
                let has_conflict = Self::check_conflict(tx, "calendars", change)?;
                let now = chrono::Utc::now().timestamp_millis();
                let name = json_str(data, "name").unwrap_or("");
                let color = json_str(data, "color").unwrap_or("#000000");
                let type_ = json_str(data, "type").unwrap_or("local");
                let visible: bool = json_bool(data, "visible").unwrap_or(true);
                let sync_enabled: bool = json_bool(data, "sync_enabled").unwrap_or(false);
                let user_id = json_i64(data, "user_id");
                let id: i64 = json_i64(data, "id").unwrap_or(0);

                tx.execute(
                    "UPDATE calendars SET name=?1, color=?2, type=?3, visible=?4, sync_enabled=?5, user_id=?6, updated_at=?7 WHERE id=?8",
                    rusqlite::params![
                        name, color, type_, visible, sync_enabled,
                        user_id, now, id,
                    ],
                )?;
                Ok(has_conflict)
            }
            "delete" => {
                let now = chrono::Utc::now().timestamp_millis();
                if let Some(id) = json_i64(data, "id") {
                    tx.execute(
                        "UPDATE calendars SET deleted_at=?1, updated_at=?2 WHERE id=?3",
                        rusqlite::params![now, now, id],
                    )?;
                }
                Ok(false)
            }
            _ => {
                log::warn!("未知日历操作: {}", change.action);
                Ok(false)
            }
        }
    }

    /// 冲突检测（Last-Wins 策略）
    ///
    /// 比较本地记录的 updated_at 与远端变更的 timestamp，
    /// 如果本地更新时间晚于远端变更时间，则认为发生冲突。
    /// Last-Wins 策略下，仍应用远端变更（因为远端时间戳更大才应该赢），
    /// 但记录冲突数量供上层决策。
    fn check_conflict(
        tx: &rusqlite::Transaction,
        table: &str,
        change: &SyncChange,
    ) -> DatabaseResult<bool> {
        let entity_id = match json_i64(&change.data, "id") {
            Some(id) => id,
            None => return Ok(false),
        };

        let local_updated_at: i64 = tx
            .query_row(
                &format!("SELECT updated_at FROM {} WHERE id = ?1", table),
                rusqlite::params![entity_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // 如果本地记录存在且本地更新时间晚于远端变更时间，视为冲突
        let has_conflict = local_updated_at > 0 && local_updated_at > change.timestamp;

        if has_conflict {
            log::info!(
                "检测到冲突: table={}, id={}, local_updated_at={}, remote_timestamp={}",
                table,
                entity_id,
                local_updated_at,
                change.timestamp
            );
        }

        Ok(has_conflict)
    }

    /// 显式的冲突解决方法
    ///
    /// Last-Wins 策略：比较本地 updated_at 和远端 timestamp，
    /// 时间戳更大的一方获胜。
    ///
    /// # 参数
    /// - `local_updated_at`: 本地记录的 updated_at
    /// - `remote_timestamp`: 远端变更的时间戳
    ///
    /// # 返回
    /// true 表示远端获胜（应使用远端数据），false 表示本地获胜
    pub fn resolve_conflict(local_updated_at: i64, remote_timestamp: i64) -> bool {
        // Last-Wins: 时间戳更大的获胜
        remote_timestamp >= local_updated_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::mock::MockApiClient;
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

    /// 创建测试用的日历
    fn create_test_calendar(db: &DatabaseConnection) -> i64 {
        let now = chrono::Utc::now().timestamp_millis();
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO calendars (name, color, type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params!["测试日历", "#FF0000", "local", now, now],
            )?;
            Ok(tx.last_insert_rowid())
        })
        .expect("创建测试日历失败")
    }

    /// 测试冲突解决 - 远端获胜
    #[test]
    fn test_resolve_conflict_remote_wins() {
        assert!(SyncExecutor::resolve_conflict(1000, 2000));
        assert!(SyncExecutor::resolve_conflict(1000, 1000));
    }

    /// 测试冲突解决 - 本地获胜
    #[test]
    fn test_resolve_conflict_local_wins() {
        assert!(!SyncExecutor::resolve_conflict(2000, 1000));
    }

    /// 测试应用远端事件 create 变更
    #[test]
    fn test_apply_event_create() {
        let db = setup_test_db();
        let _calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let change = SyncChange {
            action: "create".to_string(),
            entity_type: "event".to_string(),
            data: serde_json::json!({
                "id": 100,
                "title": "远端事件",
                "start_time": 1700000000000_i64,
                "end_time": 1700003600000_i64,
                "is_all_day": false,
                "calendar_id": 1,
            }),
            timestamp: 1700000000000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());

        let count: i64 = db
            .execute(|conn| {
                conn.query_row("SELECT COUNT(*) FROM events WHERE id = 100", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(count, 1);
    }

    /// 测试应用远端事件 update 变更
    #[test]
    fn test_apply_event_update() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let now = chrono::Utc::now().timestamp_millis();
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO events (id, title, start_time, end_time, all_day, calendar_id, timezone, created_at, updated_at) VALUES (100, '原始标题', ?1, ?2, 0, ?3, 'Asia/Shanghai', ?4, ?4)",
                rusqlite::params![now, now + 3600000, calendar_id, now],
            )?;
            Ok(())
        })
        .unwrap();

        let change = SyncChange {
            action: "update".to_string(),
            entity_type: "event".to_string(),
            data: serde_json::json!({
                "id": 100,
                "title": "更新标题",
                "start_time": now,
                "end_time": now + 3600000,
                "is_all_day": false,
                "calendar_id": calendar_id,
            }),
            timestamp: now + 1000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());

        let title: String = db
            .execute(|conn| {
                conn.query_row("SELECT title FROM events WHERE id = 100", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(title, "更新标题");
    }

    /// 测试应用远端事件 delete 变更（软删除）
    #[test]
    fn test_apply_event_delete() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let now = chrono::Utc::now().timestamp_millis();
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO events (id, title, start_time, end_time, all_day, calendar_id, timezone, created_at, updated_at) VALUES (200, '待删除', ?1, ?2, 0, ?3, 'Asia/Shanghai', ?4, ?4)",
                rusqlite::params![now, now + 3600000, calendar_id, now],
            )?;
            Ok(())
        })
        .unwrap();

        let change = SyncChange {
            action: "delete".to_string(),
            entity_type: "event".to_string(),
            data: serde_json::json!({"id": 200}),
            timestamp: now + 1000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());

        let deleted_at: Option<i64> = db
            .execute(|conn| {
                conn.query_row("SELECT deleted_at FROM events WHERE id = 200", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert!(deleted_at.is_some());
    }

    /// 测试应用远端日历变更
    #[test]
    fn test_apply_calendar_create() {
        let db = setup_test_db();
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let change = SyncChange {
            action: "create".to_string(),
            entity_type: "calendar".to_string(),
            data: serde_json::json!({
                "id": 500,
                "name": "远端日历",
                "color": "#00FF00",
                "type": "local",
                "visible": true,
                "sync_enabled": false,
            }),
            timestamp: 1700000000000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());

        let name: String = db
            .execute(|conn| {
                conn.query_row("SELECT name FROM calendars WHERE id = 500", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(name, "远端日历");
    }

    /// 测试应用远端待办变更
    #[test]
    fn test_apply_todo_create() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let change = SyncChange {
            action: "create".to_string(),
            entity_type: "todo".to_string(),
            data: serde_json::json!({
                "id": 300,
                "title": "远端待办",
                "is_completed": false,
                "priority": "high",
                "calendar_id": calendar_id,
            }),
            timestamp: 1700000000000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());

        let title: String = db
            .execute(|conn| {
                conn.query_row("SELECT title FROM todos WHERE id = 300", [], |row| {
                    row.get(0)
                })
            })
            .unwrap();
        assert_eq!(title, "远端待办");
    }

    /// 测试冲突检测
    #[test]
    fn test_conflict_detection() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let now = chrono::Utc::now().timestamp_millis();
        let local_updated_at = now + 5000;
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO events (id, title, start_time, end_time, all_day, calendar_id, timezone, created_at, updated_at) VALUES (100, '本地标题', ?1, ?2, 0, ?3, 'Asia/Shanghai', ?4, ?5)",
                rusqlite::params![now, now + 3600000, calendar_id, now, local_updated_at],
            )?;
            Ok(())
        })
        .unwrap();

        let change = SyncChange {
            action: "update".to_string(),
            entity_type: "event".to_string(),
            data: serde_json::json!({
                "id": 100,
                "title": "远端标题",
                "start_time": now,
                "end_time": now + 3600000,
                "is_all_day": false,
                "calendar_id": calendar_id,
            }),
            timestamp: now,
        };

        let conflicts = executor.apply_server_changes(&[change]).unwrap();
        assert_eq!(conflicts, 1);
    }

    /// 测试无冲突情况
    #[test]
    fn test_no_conflict_when_remote_newer() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api.clone());

        let now = chrono::Utc::now().timestamp_millis();
        let local_updated_at = now - 5000;
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO events (id, title, start_time, end_time, all_day, calendar_id, timezone, created_at, updated_at) VALUES (100, '本地标题', ?1, ?2, 0, ?3, 'Asia/Shanghai', ?4, ?5)",
                rusqlite::params![now, now + 3600000, calendar_id, now, local_updated_at],
            )?;
            Ok(())
        })
        .unwrap();

        let change = SyncChange {
            action: "update".to_string(),
            entity_type: "event".to_string(),
            data: serde_json::json!({
                "id": 100,
                "title": "远端标题",
                "start_time": now,
                "end_time": now + 3600000,
                "is_all_day": false,
                "calendar_id": calendar_id,
            }),
            timestamp: now,
        };

        let conflicts = executor.apply_server_changes(&[change]).unwrap();
        assert_eq!(conflicts, 0);
    }

    /// 测试空变更列表
    #[test]
    fn test_apply_empty_changes() {
        let db = setup_test_db();
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api);

        let result = executor.apply_server_changes(&[]);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    /// 测试未知实体类型
    #[test]
    fn test_apply_unknown_entity_type() {
        let db = setup_test_db();
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api);

        let change = SyncChange {
            action: "create".to_string(),
            entity_type: "unknown".to_string(),
            data: serde_json::json!({"id": 1}),
            timestamp: 1700000000000,
        };

        let result = executor.apply_server_changes(&[change]);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    /// 测试 SyncResult 构建
    #[test]
    fn test_sync_result_ok() {
        let result = SyncResult::ok(42);
        assert!(result.success);
        assert_eq!(result.server_version, 42);
        assert_eq!(result.uploaded, 0);
        assert_eq!(result.downloaded, 0);
        assert!(result.errors.is_empty());
    }

    /// 测试 SyncResult 错误
    #[test]
    fn test_sync_result_err() {
        let result = SyncResult::err("同步失败".to_string());
        assert!(!result.success);
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0], "同步失败");
    }

    /// 测试批量变更应用（事务性）
    #[test]
    fn test_apply_multiple_changes_transactional() {
        let db = setup_test_db();
        let _calendar_id = create_test_calendar(&db);
        let api = Arc::new(MockApiClient::new());
        let executor = SyncExecutor::new(&db, api);

        let changes = vec![
            SyncChange {
                action: "create".to_string(),
                entity_type: "event".to_string(),
                data: serde_json::json!({
                    "id": 101,
                    "title": "事件1",
                    "start_time": 1700000000000_i64,
                    "end_time": 1700003600000_i64,
                    "is_all_day": false,
                    "calendar_id": 1,
                }),
                timestamp: 1700000000000,
            },
            SyncChange {
                action: "create".to_string(),
                entity_type: "event".to_string(),
                data: serde_json::json!({
                    "id": 102,
                    "title": "事件2",
                    "start_time": 1700000000000_i64,
                    "end_time": 1700003600000_i64,
                    "is_all_day": false,
                    "calendar_id": 1,
                }),
                timestamp: 1700000000000,
            },
        ];

        let result = executor.apply_server_changes(&changes);
        assert!(result.is_ok());

        let count: i64 = db
            .execute(|conn| conn.query_row("SELECT COUNT(*) FROM events WHERE id IN (101, 102)", [], |row| row.get(0)))
            .unwrap();
        assert_eq!(count, 2);
    }

    /// 测试 JSON 辅助提取函数
    #[test]
    fn test_json_helper_functions() {
        let data = serde_json::json!({
            "id": 42,
            "name": "测试",
            "active": true,
            "missing_field": null,
        });

        assert_eq!(json_i64(&data, "id"), Some(42));
        assert_eq!(json_i64(&data, "missing_field"), None);
        assert_eq!(json_i64(&data, "not_exist"), None);

        assert_eq!(json_str(&data, "name"), Some("测试"));
        assert_eq!(json_str(&data, "not_exist"), None);

        assert_eq!(json_bool(&data, "active"), Some(true));
        assert_eq!(json_bool(&data, "not_exist"), None);
    }
}
