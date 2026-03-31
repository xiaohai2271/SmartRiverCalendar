// 事件 Repository 模块
// 实现事件的 CRUD 操作和数据访问

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use serde::{Deserialize, Serialize};

/// 事件实体结构
///
/// 对应数据库中的 events 表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    /// 事件唯一标识
    pub id: i64,
    /// 事件标题
    pub title: String,
    /// 事件描述
    pub description: Option<String>,
    /// 开始时间 (Unix 时间戳，毫秒)
    pub start_time: i64,
    /// 结束时间 (Unix 时间戳，毫秒)
    pub end_time: i64,
    /// 是否全天事件
    pub all_day: bool,
    /// 所属日历 ID
    pub calendar_id: i64,
    /// 事件颜色
    pub color: Option<String>,
    /// 提醒时间 (分钟)
    pub reminder: Option<i32>,
    /// 重复规则 (JSON 格式)
    pub repeat_rule: Option<String>,
    /// 地点
    pub location: Option<String>,
    /// 外部 ID (用于同步)
    pub external_id: Option<String>,
    /// 创建时间 (Unix 时间戳，毫秒)
    pub created_at: i64,
    /// 更新时间 (Unix 时间戳，毫秒)
    pub updated_at: i64,
}

/// 创建事件的参数
///
/// 不包含 id, created_at, updated_at (由数据库自动生成)
#[derive(Debug, Clone)]
pub struct CreateEvent {
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub all_day: bool,
    pub calendar_id: i64,
    pub color: Option<String>,
    pub reminder: Option<i32>,
    pub repeat_rule: Option<String>,
    pub location: Option<String>,
    pub external_id: Option<String>,
}

/// 更新事件的参数
///
/// 包含所有可更新字段
#[derive(Debug, Clone)]
pub struct UpdateEvent {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,
    pub end_time: i64,
    pub all_day: bool,
    pub calendar_id: i64,
    pub color: Option<String>,
    pub reminder: Option<i32>,
    pub repeat_rule: Option<String>,
    pub location: Option<String>,
    pub external_id: Option<String>,
}

/// 事件 Repository
///
/// 封装事件相关的数据库操作
pub struct EventRepository<'a> {
    db: &'a DatabaseConnection,
}

impl<'a> EventRepository<'a> {
    /// 创建新的事件 Repository
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建新事件
    ///
    /// # 返回
    /// 成功返回新创建的事件 (包含生成的 id)
    pub fn create(&self, event: &CreateEvent) -> DatabaseResult<Event> {
        let now = chrono::Utc::now().timestamp_millis();

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                INSERT INTO events (
                    title, description, start_time, end_time, all_day,
                    calendar_id, color, reminder, repeat_rule, location,
                    external_id, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                rusqlite::params![
                    event.title,
                    event.description,
                    event.start_time,
                    event.end_time,
                    event.all_day as i32,
                    event.calendar_id,
                    event.color,
                    event.reminder,
                    event.repeat_rule,
                    event.location,
                    event.external_id,
                    now,
                    now,
                ],
            )?;

            let id = tx.last_insert_rowid();

            Ok(Event {
                id,
                title: event.title.clone(),
                description: event.description.clone(),
                start_time: event.start_time,
                end_time: event.end_time,
                all_day: event.all_day,
                calendar_id: event.calendar_id,
                color: event.color.clone(),
                reminder: event.reminder,
                repeat_rule: event.repeat_rule.clone(),
                location: event.location.clone(),
                external_id: event.external_id.clone(),
                created_at: now,
                updated_at: now,
            })
        })
    }

    /// 获取所有事件
    ///
    /// 按开始时间升序排列
    pub fn get_all(&self) -> DatabaseResult<Vec<Event>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, description, start_time, end_time, all_day,
                       calendar_id, color, reminder, repeat_rule, location,
                       external_id, created_at, updated_at
                FROM events
                ORDER BY start_time ASC
                "#,
            )?;

            let events = stmt
                .query_map([], |row| {
                    Ok(Event {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        description: row.get(2)?,
                        start_time: row.get(3)?,
                        end_time: row.get(4)?,
                        all_day: row.get::<_, i32>(5)? != 0,
                        calendar_id: row.get(6)?,
                        color: row.get(7)?,
                        reminder: row.get(8)?,
                        repeat_rule: row.get(9)?,
                        location: row.get(10)?,
                        external_id: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(events)
        })
    }

    /// 根据 ID 获取事件
    ///
    /// # 错误
    /// 如果事件不存在，返回 NotFound 错误
    pub fn get_by_id(&self, id: i64) -> DatabaseResult<Event> {
        let result = self.db.execute(|conn| {
            conn.query_row(
                r#"
                SELECT id, title, description, start_time, end_time, all_day,
                       calendar_id, color, reminder, repeat_rule, location,
                       external_id, created_at, updated_at
                FROM events
                WHERE id = ?1
                "#,
                rusqlite::params![id],
                |row| {
                    Ok(Event {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        description: row.get(2)?,
                        start_time: row.get(3)?,
                        end_time: row.get(4)?,
                        all_day: row.get::<_, i32>(5)? != 0,
                        calendar_id: row.get(6)?,
                        color: row.get(7)?,
                        reminder: row.get(8)?,
                        repeat_rule: row.get(9)?,
                        location: row.get(10)?,
                        external_id: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                    })
                },
            )
        });

        result.map_err(|_| DatabaseError::NotFound {
            entity: "Event".to_string(),
            id,
        })
    }

    /// 根据日历 ID 获取所有事件
    ///
    /// 按开始时间升序排列
    pub fn get_by_calendar_id(&self, calendar_id: i64) -> DatabaseResult<Vec<Event>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, description, start_time, end_time, all_day,
                       calendar_id, color, reminder, repeat_rule, location,
                       external_id, created_at, updated_at
                FROM events
                WHERE calendar_id = ?1
                ORDER BY start_time ASC
                "#,
            )?;

            let events = stmt
                .query_map(rusqlite::params![calendar_id], |row| {
                    Ok(Event {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        description: row.get(2)?,
                        start_time: row.get(3)?,
                        end_time: row.get(4)?,
                        all_day: row.get::<_, i32>(5)? != 0,
                        calendar_id: row.get(6)?,
                        color: row.get(7)?,
                        reminder: row.get(8)?,
                        repeat_rule: row.get(9)?,
                        location: row.get(10)?,
                        external_id: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(events)
        })
    }

    /// 根据时间范围获取事件
    ///
    /// # 参数
    /// - `start_time`: 范围开始时间 (Unix 时间戳，毫秒)
    /// - `end_time`: 范围结束时间 (Unix 时间戳，毫秒)
    ///
    /// # 说明
    /// 返回所有与指定时间范围有重叠的事件
    /// 条件: event.start_time < end_time AND event.end_time > start_time
    pub fn get_by_time_range(&self, start_time: i64, end_time: i64) -> DatabaseResult<Vec<Event>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, description, start_time, end_time, all_day,
                       calendar_id, color, reminder, repeat_rule, location,
                       external_id, created_at, updated_at
                FROM events
                WHERE start_time < ?1 AND end_time > ?2
                ORDER BY start_time ASC
                "#,
            )?;

            let events = stmt
                .query_map(rusqlite::params![end_time, start_time], |row| {
                    Ok(Event {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        description: row.get(2)?,
                        start_time: row.get(3)?,
                        end_time: row.get(4)?,
                        all_day: row.get::<_, i32>(5)? != 0,
                        calendar_id: row.get(6)?,
                        color: row.get(7)?,
                        reminder: row.get(8)?,
                        repeat_rule: row.get(9)?,
                        location: row.get(10)?,
                        external_id: row.get(11)?,
                        created_at: row.get(12)?,
                        updated_at: row.get(13)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(events)
        })
    }

    /// 更新事件
    ///
    /// 使用 ON CONFLICT DO UPDATE 语法
    ///
    /// # 返回
    /// 成功返回更新后的事件
    ///
    /// # 错误
    /// 如果事件不存在，返回 NotFound 错误
    pub fn update(&self, event: &UpdateEvent) -> DatabaseResult<Event> {
        let now = chrono::Utc::now().timestamp_millis();

        // 先获取原事件，确认存在并保留 created_at
        let original = self.get_by_id(event.id)?;

        self.db.execute_in_transaction(|tx| {
            let rows_affected = tx.execute(
                r#"
                UPDATE events SET
                    title = ?1, description = ?2, start_time = ?3, end_time = ?4,
                    all_day = ?5, calendar_id = ?6, color = ?7, reminder = ?8,
                    repeat_rule = ?9, location = ?10, external_id = ?11, updated_at = ?12
                WHERE id = ?13
                "#,
                rusqlite::params![
                    event.title,
                    event.description,
                    event.start_time,
                    event.end_time,
                    event.all_day as i32,
                    event.calendar_id,
                    event.color,
                    event.reminder,
                    event.repeat_rule,
                    event.location,
                    event.external_id,
                    now,
                    event.id,
                ],
            )?;

            if rows_affected == 0 {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            Ok(Event {
                id: event.id,
                title: event.title.clone(),
                description: event.description.clone(),
                start_time: event.start_time,
                end_time: event.end_time,
                all_day: event.all_day,
                calendar_id: event.calendar_id,
                color: event.color.clone(),
                reminder: event.reminder,
                repeat_rule: event.repeat_rule.clone(),
                location: event.location.clone(),
                external_id: event.external_id.clone(),
                created_at: original.created_at,
                updated_at: now,
            })
        })
    }

    /// 删除事件
    ///
    /// # 返回
    /// 成功返回 true，如果事件不存在返回 false
    pub fn delete(&self, id: i64) -> DatabaseResult<bool> {
        self.db.execute_in_transaction(|tx| {
            let rows_affected =
                tx.execute("DELETE FROM events WHERE id = ?1", rusqlite::params![id])?;
            Ok(rows_affected > 0)
        })
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

    /// 创建测试日历 (事件需要关联日历)
    fn create_test_calendar(db: &DatabaseConnection) -> i64 {
        let now = chrono::Utc::now().timestamp_millis();
        db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO calendars (name, color, type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params!["测试日历", "#FF0000", "local", now, now],
            )?;
            Ok(tx.last_insert_rowid())
        })
        .expect("创建测试日历失败")
    }

    #[test]
    fn test_create_event() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        let create_event = CreateEvent {
            title: "测试事件".to_string(),
            description: Some("这是一个测试事件".to_string()),
            start_time: 1609459200000, // 2021-01-01 00:00:00 UTC
            end_time: 1609462800000,   // 2021-01-01 01:00:00 UTC
            all_day: false,
            calendar_id,
            color: Some("#00FF00".to_string()),
            reminder: Some(15),
            repeat_rule: None,
            location: Some("会议室".to_string()),
            external_id: None,
        };

        let event = repo.create(&create_event).expect("创建事件失败");

        assert_eq!(event.title, "测试事件");
        assert_eq!(event.description, Some("这是一个测试事件".to_string()));
        assert_eq!(event.start_time, 1609459200000);
        assert_eq!(event.end_time, 1609462800000);
        assert!(!event.all_day);
        assert_eq!(event.calendar_id, calendar_id);
        assert_eq!(event.color, Some("#00FF00".to_string()));
        assert_eq!(event.reminder, Some(15));
        assert_eq!(event.location, Some("会议室".to_string()));
        assert!(event.id > 0);
    }

    #[test]
    fn test_get_all_events() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        // 创建两个事件
        repo.create(&CreateEvent {
            title: "事件1".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件1失败");

        repo.create(&CreateEvent {
            title: "事件2".to_string(),
            description: None,
            start_time: 500,
            end_time: 600,
            all_day: true,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件2失败");

        let events = repo.get_all().expect("获取所有事件失败");

        assert_eq!(events.len(), 2);
        // 应该按 start_time 升序排列
        assert_eq!(events[0].title, "事件2");
        assert_eq!(events[1].title, "事件1");
    }

    #[test]
    fn test_get_by_id() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        let created = repo
            .create(&CreateEvent {
                title: "查找测试".to_string(),
                description: Some("测试描述".to_string()),
                start_time: 1000,
                end_time: 2000,
                all_day: false,
                calendar_id,
                color: None,
                reminder: None,
                repeat_rule: None,
                location: None,
                external_id: None,
            })
            .expect("创建事件失败");

        let found = repo.get_by_id(created.id).expect("获取事件失败");

        assert_eq!(found.id, created.id);
        assert_eq!(found.title, "查找测试");
        assert_eq!(found.description, Some("测试描述".to_string()));
    }

    #[test]
    fn test_get_by_id_not_found() {
        let db = setup_test_db();
        let repo = EventRepository::new(&db);

        let result = repo.get_by_id(999);

        assert!(result.is_err());
        match result.unwrap_err() {
            DatabaseError::NotFound { entity, id } => {
                assert_eq!(entity, "Event");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_get_by_calendar_id() {
        let db = setup_test_db();
        let calendar1 = create_test_calendar(&db);

        // 创建第二个日历
        let calendar2 = db
            .execute_in_transaction(|tx| {
                let now = chrono::Utc::now().timestamp_millis();
                tx.execute(
                    "INSERT INTO calendars (name, color, type, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params!["日历2", "#0000FF", "local", now, now],
                )?;
                Ok(tx.last_insert_rowid())
            })
            .expect("创建日历2失败");

        let repo = EventRepository::new(&db);

        // 为日历1创建事件
        repo.create(&CreateEvent {
            title: "日历1事件".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id: calendar1,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件失败");

        // 为日历2创建事件
        repo.create(&CreateEvent {
            title: "日历2事件".to_string(),
            description: None,
            start_time: 2000,
            end_time: 3000,
            all_day: false,
            calendar_id: calendar2,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件失败");

        let events1 = repo
            .get_by_calendar_id(calendar1)
            .expect("获取日历1事件失败");
        let events2 = repo
            .get_by_calendar_id(calendar2)
            .expect("获取日历2事件失败");

        assert_eq!(events1.len(), 1);
        assert_eq!(events1[0].title, "日历1事件");

        assert_eq!(events2.len(), 1);
        assert_eq!(events2[0].title, "日历2事件");
    }

    #[test]
    fn test_get_by_time_range() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        // 创建几个事件
        // 事件1: 1000-2000
        repo.create(&CreateEvent {
            title: "事件1".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件1失败");

        // 事件2: 3000-4000
        repo.create(&CreateEvent {
            title: "事件2".to_string(),
            description: None,
            start_time: 3000,
            end_time: 4000,
            all_day: false,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件2失败");

        // 事件3: 5000-6000
        repo.create(&CreateEvent {
            title: "事件3".to_string(),
            description: None,
            start_time: 5000,
            end_time: 6000,
            all_day: false,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        })
        .expect("创建事件3失败");

        // 查询范围: 1500-3500
        // 应该匹配事件1 (与范围重叠) 和事件2 (与范围重叠)
        // 事件3 不重叠
        let events = repo
            .get_by_time_range(1500, 3500)
            .expect("按时间范围查询失败");

        assert_eq!(events.len(), 2);
        assert!(events.iter().any(|e| e.title == "事件1"));
        assert!(events.iter().any(|e| e.title == "事件2"));
        assert!(!events.iter().any(|e| e.title == "事件3"));
    }

    #[test]
    fn test_update_event() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        let created = repo
            .create(&CreateEvent {
                title: "原标题".to_string(),
                description: Some("原描述".to_string()),
                start_time: 1000,
                end_time: 2000,
                all_day: false,
                calendar_id,
                color: None,
                reminder: None,
                repeat_rule: None,
                location: None,
                external_id: None,
            })
            .expect("创建事件失败");

        // 等待一段时间确保 updated_at 不同
        std::thread::sleep(std::time::Duration::from_millis(10));

        let updated = repo
            .update(&UpdateEvent {
                id: created.id,
                title: "新标题".to_string(),
                description: Some("新描述".to_string()),
                start_time: 2000,
                end_time: 3000,
                all_day: true,
                calendar_id,
                color: Some("#FF0000".to_string()),
                reminder: Some(30),
                repeat_rule: Some(r#"{"frequency":"daily"}"#.to_string()),
                location: Some("新地点".to_string()),
                external_id: Some("ext-123".to_string()),
            })
            .expect("更新事件失败");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.title, "新标题");
        assert_eq!(updated.description, Some("新描述".to_string()));
        assert_eq!(updated.start_time, 2000);
        assert_eq!(updated.end_time, 3000);
        assert!(updated.all_day);
        assert_eq!(updated.color, Some("#FF0000".to_string()));
        assert_eq!(updated.reminder, Some(30));
        assert_eq!(
            updated.repeat_rule,
            Some(r#"{"frequency":"daily"}"#.to_string())
        );
        assert_eq!(updated.location, Some("新地点".to_string()));
        assert_eq!(updated.external_id, Some("ext-123".to_string()));
        // created_at 应该保持不变
        assert_eq!(updated.created_at, created.created_at);
        // updated_at 应该更新
        assert!(updated.updated_at > created.updated_at);
    }

    #[test]
    fn test_update_event_not_found() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        let result = repo.update(&UpdateEvent {
            id: 999,
            title: "不存在的标题".to_string(),
            description: None,
            start_time: 1000,
            end_time: 2000,
            all_day: false,
            calendar_id,
            color: None,
            reminder: None,
            repeat_rule: None,
            location: None,
            external_id: None,
        });

        assert!(result.is_err());
        match result.unwrap_err() {
            DatabaseError::NotFound { entity, id } => {
                assert_eq!(entity, "Event");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_delete_event() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        let created = repo
            .create(&CreateEvent {
                title: "待删除事件".to_string(),
                description: None,
                start_time: 1000,
                end_time: 2000,
                all_day: false,
                calendar_id,
                color: None,
                reminder: None,
                repeat_rule: None,
                location: None,
                external_id: None,
            })
            .expect("创建事件失败");

        let deleted = repo.delete(created.id).expect("删除事件失败");
        assert!(deleted);

        // 验证事件已删除
        let result = repo.get_by_id(created.id);
        assert!(result.is_err());
    }

    #[test]
    fn test_delete_event_not_found() {
        let db = setup_test_db();
        let repo = EventRepository::new(&db);

        let deleted = repo.delete(999).expect("删除不存在的操作应该成功");
        assert!(!deleted); // 返回 false 表示没有删除任何记录
    }

    #[test]
    fn test_all_day_conversion() {
        let db = setup_test_db();
        let calendar_id = create_test_calendar(&db);
        let repo = EventRepository::new(&db);

        // 测试 all_day = true
        let event_all_day = repo
            .create(&CreateEvent {
                title: "全天事件".to_string(),
                description: None,
                start_time: 1000,
                end_time: 2000,
                all_day: true,
                calendar_id,
                color: None,
                reminder: None,
                repeat_rule: None,
                location: None,
                external_id: None,
            })
            .expect("创建全天事件失败");

        assert!(event_all_day.all_day);

        // 重新查询验证
        let found = repo.get_by_id(event_all_day.id).expect("获取事件失败");
        assert!(found.all_day);
    }
}
