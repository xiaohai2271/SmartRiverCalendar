// 日历 Repository 实现
// 提供日历数据的 CRUD 操作

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

/// 日历实体
///
/// 表示一个日历，可以是本地日历或外部日历（Exchange、CalDAV 等）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Calendar {
    /// 日历 ID（自增）
    pub id: i64,
    /// 日历名称
    pub name: String,
    /// 日历颜色（十六进制，如 "#FF5733"）
    pub color: String,
    /// 日历类型：local、exchange、caldav
    #[serde(rename = "type")]
    pub type_: String,
    /// 关联的外部账户 ID
    pub account_id: Option<i64>,
    /// 是否可见
    pub visible: bool,
    /// 是否启用同步
    pub sync_enabled: bool,
    /// 创建时间戳（毫秒）
    pub created_at: i64,
    /// 更新时间戳（毫秒）
    pub updated_at: i64,
}

/// 创建日历请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCalendarRequest {
    pub name: String,
    pub color: String,
    #[serde(rename = "type", default = "default_calendar_type")]
    pub type_: String,
    pub account_id: Option<i64>,
    #[serde(default = "default_visible")]
    pub visible: bool,
    #[serde(default)]
    pub sync_enabled: bool,
}

/// 更新日历请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCalendarRequest {
    pub id: i64,
    pub name: Option<String>,
    pub color: Option<String>,
    pub visible: Option<bool>,
    pub sync_enabled: Option<bool>,
}

fn default_calendar_type() -> String {
    "local".to_string()
}

fn default_visible() -> bool {
    true
}

impl Calendar {
    /// 从数据库行创建 Calendar 实例
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Calendar {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            type_: row.get(3)?,
            account_id: row.get(4)?,
            visible: row.get::<_, i64>(5)? != 0,
            sync_enabled: row.get::<_, i64>(6)? != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }
}

/// 日历 Repository
///
/// 提供日历数据的 CRUD 操作，支持事务
pub struct CalendarRepository<'a> {
    db: &'a DatabaseConnection,
}

impl<'a> CalendarRepository<'a> {
    /// 创建 CalendarRepository 实例
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建日历
    ///
    /// # 参数
    /// - `req`: 创建请求
    ///
    /// # 返回
    /// 成功返回新创建的日历（包含生成的 ID）
    pub fn create(&self, req: &CreateCalendarRequest) -> DatabaseResult<Calendar> {
        let now = chrono::Utc::now().timestamp_millis();

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                INSERT INTO calendars (name, color, type, account_id, visible, sync_enabled, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
                params![
                    req.name,
                    req.color,
                    req.type_,
                    req.account_id,
                    req.visible as i64,
                    req.sync_enabled as i64,
                    now,
                    now,
                ],
            )?;

            let id = tx.last_insert_rowid();

            Ok(Calendar {
                id,
                name: req.name.clone(),
                color: req.color.clone(),
                type_: req.type_.clone(),
                account_id: req.account_id,
                visible: req.visible,
                sync_enabled: req.sync_enabled,
                created_at: now,
                updated_at: now,
            })
        })
    }

    /// 获取所有日历
    ///
    /// 按创建时间降序排列
    pub fn get_all(&self) -> DatabaseResult<Vec<Calendar>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, name, color, type, account_id, visible, sync_enabled, created_at, updated_at
                FROM calendars
                ORDER BY created_at DESC
                "#,
            )?;

            let calendars = stmt
                .query_map([], |row| Calendar::from_row(row))?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(calendars)
        })
    }

    /// 根据 ID 获取日历
    ///
    /// # 参数
    /// - `id`: 日历 ID
    ///
    /// # 返回
    /// 成功返回日历实体，失败返回 NotFound 错误
    pub fn get_by_id(&self, id: i64) -> DatabaseResult<Calendar> {
        let result = self.db.execute(|conn| {
            conn.query_row(
                r#"
                SELECT id, name, color, type, account_id, visible, sync_enabled, created_at, updated_at
                FROM calendars
                WHERE id = ?1
                "#,
                params![id],
                |row| Calendar::from_row(row),
            )
        });

        result.map_err(|_| DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id,
        })
    }

    /// 更新日历
    ///
    /// 只更新请求中提供的字段
    ///
    /// # 参数
    /// - `req`: 更新请求
    ///
    /// # 返回
    /// 成功返回更新后的日历实体
    pub fn update(&self, req: &UpdateCalendarRequest) -> DatabaseResult<Calendar> {
        let now = chrono::Utc::now().timestamp_millis();

        // 先获取现有日历
        let existing = self.get_by_id(req.id)?;

        // 合并更新
        let name = req.name.clone().unwrap_or(existing.name);
        let color = req.color.clone().unwrap_or(existing.color);
        let visible = req.visible.unwrap_or(existing.visible);
        let sync_enabled = req.sync_enabled.unwrap_or(existing.sync_enabled);

        let result = self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                UPDATE calendars
                SET name = ?1, color = ?2, visible = ?3, sync_enabled = ?4, updated_at = ?5
                WHERE id = ?6
                "#,
                params![
                    name,
                    color,
                    visible as i64,
                    sync_enabled as i64,
                    now,
                    req.id
                ],
            )?;

            let changes = tx.changes();

            if changes == 0 {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            Ok(Calendar {
                id: req.id,
                name,
                color,
                type_: existing.type_,
                account_id: existing.account_id,
                visible,
                sync_enabled,
                created_at: existing.created_at,
                updated_at: now,
            })
        });

        result.map_err(|_| DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id: req.id,
        })
    }

    /// 删除日历
    ///
    /// 删除日历会级联删除相关事件（由外键约束自动处理）
    ///
    /// # 参数
    /// - `id`: 日历 ID
    ///
    /// # 返回
    /// 成功返回 ()，不存在返回 NotFound 错误
    pub fn delete(&self, id: i64) -> DatabaseResult<()> {
        let result = self.db.execute_in_transaction(|tx| {
            tx.execute("DELETE FROM calendars WHERE id = ?1", params![id])?;

            let changes = tx.changes();

            if changes == 0 {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            Ok(())
        });

        result.map_err(|_| DatabaseError::NotFound {
            entity: "Calendar".to_string(),
            id,
        })
    }

    /// 根据账户 ID 获取日历列表
    ///
    /// # 参数
    /// - `account_id`: 外部账户 ID
    ///
    /// # 返回
    /// 返回该账户下的所有日历
    pub fn get_by_account_id(&self, account_id: i64) -> DatabaseResult<Vec<Calendar>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, name, color, type, account_id, visible, sync_enabled, created_at, updated_at
                FROM calendars
                WHERE account_id = ?1
                ORDER BY created_at DESC
                "#,
            )?;

            let calendars = stmt
                .query_map(params![account_id], |row| Calendar::from_row(row))?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(calendars)
        })
    }

    /// 获取可见日历列表
    ///
    /// # 返回
    /// 返回所有可见的日历
    pub fn get_visible(&self) -> DatabaseResult<Vec<Calendar>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, name, color, type, account_id, visible, sync_enabled, created_at, updated_at
                FROM calendars
                WHERE visible = 1
                ORDER BY created_at DESC
                "#,
            )?;

            let calendars = stmt
                .query_map([], |row| Calendar::from_row(row))?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(calendars)
        })
    }
}

// ============================================================
// 测试模块
// ============================================================

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

    #[test]
    fn test_create_calendar() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        let req = CreateCalendarRequest {
            name: "工作日历".to_string(),
            color: "#FF5733".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let calendar = repo.create(&req).expect("创建日历失败");

        assert!(calendar.id > 0);
        assert_eq!(calendar.name, "工作日历");
        assert_eq!(calendar.color, "#FF5733");
        assert_eq!(calendar.type_, "local");
        assert!(calendar.visible);
        assert!(!calendar.sync_enabled);
    }

    #[test]
    fn test_get_all_calendars() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建多个日历
        let req1 = CreateCalendarRequest {
            name: "日历1".to_string(),
            color: "#FF0000".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let req2 = CreateCalendarRequest {
            name: "日历2".to_string(),
            color: "#00FF00".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        repo.create(&req1).expect("创建日历1失败");
        // 小延迟确保 created_at 不同
        std::thread::sleep(std::time::Duration::from_millis(1));
        repo.create(&req2).expect("创建日历2失败");

        let calendars = repo.get_all().expect("获取日历列表失败");

        assert_eq!(calendars.len(), 2);
        // 按创建时间降序排列，所以日历2在前
        assert_eq!(calendars[0].name, "日历2");
        assert_eq!(calendars[1].name, "日历1");
    }

    #[test]
    fn test_get_by_id() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        let req = CreateCalendarRequest {
            name: "测试日历".to_string(),
            color: "#0000FF".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: true,
        };

        let created = repo.create(&req).expect("创建日历失败");
        let found = repo.get_by_id(created.id).expect("获取日历失败");

        assert_eq!(found.id, created.id);
        assert_eq!(found.name, "测试日历");
        assert_eq!(found.color, "#0000FF");
        assert!(found.sync_enabled);
    }

    #[test]
    fn test_get_by_id_not_found() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        let result = repo.get_by_id(999);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Calendar");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_update_calendar() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建日历
        let create_req = CreateCalendarRequest {
            name: "原名称".to_string(),
            color: "#111111".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let created = repo.create(&create_req).expect("创建日历失败");

        // 更新日历
        let update_req = UpdateCalendarRequest {
            id: created.id,
            name: Some("新名称".to_string()),
            color: Some("#222222".to_string()),
            visible: Some(false),
            sync_enabled: None, // 不更新
        };

        let updated = repo.update(&update_req).expect("更新日历失败");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.name, "新名称");
        assert_eq!(updated.color, "#222222");
        assert!(!updated.visible);
        assert!(!updated.sync_enabled); // 保持原值
    }

    #[test]
    fn test_update_calendar_not_found() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        let update_req = UpdateCalendarRequest {
            id: 999,
            name: Some("测试".to_string()),
            color: None,
            visible: None,
            sync_enabled: None,
        };

        let result = repo.update(&update_req);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Calendar");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_delete_calendar() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建日历
        let req = CreateCalendarRequest {
            name: "待删除日历".to_string(),
            color: "#333333".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let created = repo.create(&req).expect("创建日历失败");

        // 删除日历
        repo.delete(created.id).expect("删除日历失败");

        // 验证已删除
        let result = repo.get_by_id(created.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_calendar_not_found() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        let result = repo.delete(999);

        assert!(result.is_err());
        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Calendar");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_delete_calendar_cascades_events() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建日历
        let req = CreateCalendarRequest {
            name: "测试日历".to_string(),
            color: "#444444".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let created = repo.create(&req).expect("创建日历失败");

        // 插入一个事件（直接 SQL）
        db.execute(|conn| {
            conn.execute(
                r#"
                INSERT INTO events (title, start_time, end_time, calendar_id, created_at, updated_at)
                VALUES ('测试事件', 1000, 2000, ?1, 1000, 1000)
                "#,
                params![created.id],
            )
        })
        .expect("创建事件失败");

        // 验证事件存在
        let event_count: i64 = db
            .execute(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM events WHERE calendar_id = ?1",
                    params![created.id],
                    |row| row.get(0),
                )
            })
            .expect("查询事件数量失败");

        assert_eq!(event_count, 1);

        // 删除日历
        repo.delete(created.id).expect("删除日历失败");

        // 验证事件已被级联删除
        let event_count_after: i64 = db
            .execute(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM events WHERE calendar_id = ?1",
                    params![created.id],
                    |row| row.get(0),
                )
            })
            .expect("查询事件数量失败");

        assert_eq!(event_count_after, 0);
    }

    #[test]
    fn test_get_by_account_id() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建账户（直接 SQL）
        db.execute(|conn| {
            conn.execute(
                r#"
                INSERT INTO accounts (type, server_url, username, encrypted_password, created_at, updated_at)
                VALUES ('caldav', 'https://example.com', 'user1', 'encrypted', 1000, 1000)
                "#,
                [],
            )
        })
        .expect("创建账户失败");

        // 创建日历关联到账户
        let req1 = CreateCalendarRequest {
            name: "账户日历1".to_string(),
            color: "#555555".to_string(),
            type_: "caldav".to_string(),
            account_id: Some(1),
            visible: true,
            sync_enabled: true,
        };

        let req2 = CreateCalendarRequest {
            name: "本地日历".to_string(),
            color: "#666666".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        repo.create(&req1).expect("创建账户日历失败");
        repo.create(&req2).expect("创建本地日历失败");

        // 获取账户日历
        let account_calendars = repo.get_by_account_id(1).expect("获取账户日历失败");

        assert_eq!(account_calendars.len(), 1);
        assert_eq!(account_calendars[0].name, "账户日历1");
        assert_eq!(account_calendars[0].account_id, Some(1));
    }

    #[test]
    fn test_get_visible_calendars() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建可见和不可见日历
        let req1 = CreateCalendarRequest {
            name: "可见日历".to_string(),
            color: "#777777".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let req2 = CreateCalendarRequest {
            name: "不可见日历".to_string(),
            color: "#888888".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: false,
            sync_enabled: false,
        };

        repo.create(&req1).expect("创建可见日历失败");
        repo.create(&req2).expect("创建不可见日历失败");

        let visible = repo.get_visible().expect("获取可见日历失败");

        assert_eq!(visible.len(), 1);
        assert_eq!(visible[0].name, "可见日历");
        assert!(visible[0].visible);
    }

    #[test]
    fn test_create_with_default_values() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 使用默认值创建
        let req = CreateCalendarRequest {
            name: "默认日历".to_string(),
            color: "#999999".to_string(),
            type_: default_calendar_type(),
            account_id: None,
            visible: default_visible(),
            sync_enabled: false,
        };

        let calendar = repo.create(&req).expect("创建日历失败");

        assert_eq!(calendar.type_, "local");
        assert!(calendar.visible);
        assert!(!calendar.sync_enabled);
    }

    #[test]
    fn test_transaction_rollback_on_error() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建日历
        let req = CreateCalendarRequest {
            name: "测试日历".to_string(),
            color: "#AAAAAA".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: false,
        };

        let created = repo.create(&req).expect("创建日历失败");
        let initial_count = repo.get_all().expect("获取日历列表失败").len();

        // 尝试删除不存在的日历（应该失败并回滚）
        let result = repo.delete(999);
        assert!(result.is_err());

        // 验证数据未改变
        let final_count = repo.get_all().expect("获取日历列表失败").len();
        assert_eq!(initial_count, final_count);

        // 验证原日历仍然存在
        let found = repo.get_by_id(created.id).expect("日历应该仍然存在");
        assert_eq!(found.name, "测试日历");
    }

    #[test]
    fn test_update_partial_fields() {
        let db = setup_test_db();
        let repo = CalendarRepository::new(&db);

        // 创建日历
        let create_req = CreateCalendarRequest {
            name: "原始名称".to_string(),
            color: "#BBBBBB".to_string(),
            type_: "local".to_string(),
            account_id: None,
            visible: true,
            sync_enabled: true,
        };

        let created = repo.create(&create_req).expect("创建日历失败");

        // 只更新名称
        let update_req = UpdateCalendarRequest {
            id: created.id,
            name: Some("新名称".to_string()),
            color: None,
            visible: None,
            sync_enabled: None,
        };

        let updated = repo.update(&update_req).expect("更新日历失败");

        assert_eq!(updated.name, "新名称");
        assert_eq!(updated.color, "#BBBBBB"); // 保持原值
        assert!(updated.visible); // 保持原值
        assert!(updated.sync_enabled); // 保持原值
    }
}
