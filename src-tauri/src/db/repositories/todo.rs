// 待办事项数据访问层
// 提供待办事项的 CRUD 操作

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

/// 待办事项实体
///
/// 对应数据库中的 todos 表
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    /// 待办事项 ID（自增主键）
    pub id: i64,
    /// 标题
    pub title: String,
    /// 描述
    pub description: Option<String>,
    /// 截止日期（Unix 时间戳，毫秒）
    pub due_date: Option<i64>,
    /// 是否完成
    pub completed: bool,
    /// 优先级（"low", "medium", "high"）
    pub priority: String,
    /// 所属日历 ID
    pub calendar_id: i64,
    /// 外部系统 ID（远端同步时用于关联本地与远端记录）
    pub external_id: Option<String>,
    /// 所属用户 ID
    pub user_id: Option<i64>,
    /// 软删除时间戳（毫秒），NULL 表示未删除
    pub deleted_at: Option<i64>,
    /// 时区
    pub timezone: String,
    /// 创建时间（Unix 时间戳，毫秒）
    pub created_at: i64,
    /// 更新时间（Unix 时间戳，毫秒）
    pub updated_at: i64,
}

/// 创建待办事项的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTodoInput {
    /// 标题
    pub title: String,
    /// 描述
    pub description: Option<String>,
    /// 截止日期
    pub due_date: Option<i64>,
    /// 是否完成（默认 false）
    pub completed: Option<bool>,
    /// 优先级（默认 "medium"）
    pub priority: Option<String>,
    /// 所属日历 ID
    pub calendar_id: i64,
    /// 外部系统 ID（同步时设置）
    pub external_id: Option<String>,
    /// 所属用户 ID
    pub user_id: Option<i64>,
    /// 时区
    pub timezone: Option<String>,
}

/// 更新待办事项的输入参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTodoInput {
    /// 待办事项 ID
    pub id: i64,
    /// 标题
    pub title: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 截止日期
    pub due_date: Option<i64>,
    /// 是否完成
    pub completed: Option<bool>,
    /// 优先级
    pub priority: Option<String>,
    /// 所属日历 ID
    pub calendar_id: Option<i64>,
    /// 外部系统 ID（同步时设置）
    pub external_id: Option<String>,
}

/// 待办事项查询的列列表
const TODO_COLUMNS: &str = r#"
    id, title, description, due_date, completed, priority,
    calendar_id, external_id, user_id, deleted_at, timezone, created_at, updated_at
"#;

/// 待办事项仓库
///
/// 提供待办事项的数据库访问操作
pub struct TodoRepository<'a> {
    db: &'a DatabaseConnection,
}

impl Todo {
    /// 从数据库行解析待办事项（使用列名访问，更安全）
    fn from_row(row: &Row) -> rusqlite::Result<Todo> {
        Ok(Todo {
            id: row.get("id")?,
            title: row.get("title")?,
            description: row.get("description")?,
            due_date: row.get("due_date")?,
            completed: row.get::<_, i64>("completed")? != 0,
            priority: row.get("priority")?,
            calendar_id: row.get("calendar_id")?,
            external_id: row.get("external_id")?,
            user_id: row.get("user_id")?,
            deleted_at: row.get("deleted_at")?,
            timezone: row.get("timezone")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl<'a> TodoRepository<'a> {
    /// 创建待办事项仓库实例
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建待办事项
    ///
    /// # 参数
    /// - `input`: 创建参数
    ///
    /// # 返回
    /// 成功返回新创建的待办事项（包含生成的 ID）
    pub fn create(&self, input: &CreateTodoInput) -> DatabaseResult<Todo> {
        let now = chrono::Utc::now().timestamp_millis();
        let completed = input.completed.unwrap_or(false);
        let priority = input
            .priority
            .clone()
            .unwrap_or_else(|| "medium".to_string());
        let timezone = input
            .timezone
            .clone()
            .unwrap_or_else(|| "Asia/Shanghai".to_string());

        let id = self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                INSERT INTO todos (title, description, due_date, completed, priority, calendar_id, external_id, user_id, timezone, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    input.title,
                    input.description,
                    input.due_date,
                    if completed { 1i64 } else { 0i64 },
                    priority,
                    input.calendar_id,
                    input.external_id,
                    input.user_id,
                    timezone,
                    now,
                    now
                ],
            )?;
            Ok(tx.last_insert_rowid())
        })?;

        // 返回创建的待办事项
        self.get_by_id(id)?.ok_or_else(|| DatabaseError::NotFound {
            entity: "Todo".to_string(),
            id,
        })
    }

    /// 获取所有待办事项（未软删除的）
    ///
    /// 按创建时间倒序排列
    ///
    /// # 返回
    /// 待办事项列表
    pub fn get_all(&self) -> DatabaseResult<Vec<Todo>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {TODO_COLUMNS} FROM todos WHERE deleted_at IS NULL ORDER BY created_at DESC"
            ))?;
            let todos = stmt
                .query_map([], Todo::from_row)?
                .filter_map(|r| r.ok())
                .collect();
            Ok(todos)
        })
    }

    /// 根据 ID 获取待办事项（未软删除的）
    ///
    /// # 参数
    /// - `id`: 待办事项 ID
    ///
    /// # 返回
    /// 找到返回 Some(Todo)，否则返回 None
    pub fn get_by_id(&self, id: i64) -> DatabaseResult<Option<Todo>> {
        self.db.execute(|conn| {
            let result = conn.query_row(
                &format!("SELECT {TODO_COLUMNS} FROM todos WHERE id = ?1 AND deleted_at IS NULL"),
                params![id],
                Todo::from_row,
            );
            match result {
                Ok(todo) => Ok(Some(todo)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// 根据日历 ID 获取待办事项（未软删除的）
    ///
    /// # 参数
    /// - `calendar_id`: 日历 ID
    ///
    /// # 返回
    /// 属于该日历的所有待办事项
    pub fn get_by_calendar_id(&self, calendar_id: i64) -> DatabaseResult<Vec<Todo>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {TODO_COLUMNS} FROM todos WHERE calendar_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC"
            ))?;
            let todos = stmt
                .query_map(params![calendar_id], Todo::from_row)?
                .filter_map(|r| r.ok())
                .collect();
            Ok(todos)
        })
    }

    /// 更新待办事项
    ///
    /// # 参数
    /// - `input`: 更新参数
    ///
    /// # 返回
    /// 成功返回更新后的待办事项
    pub fn update(&self, input: &UpdateTodoInput) -> DatabaseResult<Todo> {
        // 首先检查待办事项是否存在
        let existing = self
            .get_by_id(input.id)?
            .ok_or_else(|| DatabaseError::NotFound {
                entity: "Todo".to_string(),
                id: input.id,
            })?;

        let now = chrono::Utc::now().timestamp_millis();
        let title = input.title.clone().unwrap_or(existing.title);
        let description = input.description.clone().or(existing.description);
        let due_date = input.due_date.or(existing.due_date);
        let completed = input.completed.unwrap_or(existing.completed);
        let priority = input.priority.clone().unwrap_or(existing.priority);
        let calendar_id = input.calendar_id.unwrap_or(existing.calendar_id);
        let external_id = input.external_id.clone().or(existing.external_id);

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                UPDATE todos
                SET title = ?1, description = ?2, due_date = ?3, completed = ?4, 
                    priority = ?5, calendar_id = ?6, external_id = ?7, updated_at = ?8
                WHERE id = ?9
                "#,
                params![
                    title,
                    description,
                    due_date,
                    if completed { 1i64 } else { 0i64 },
                    priority,
                    calendar_id,
                    external_id,
                    now,
                    input.id
                ],
            )?;
            Ok(())
        })?;

        // 返回更新后的待办事项
        self.get_by_id(input.id)?
            .ok_or_else(|| DatabaseError::NotFound {
                entity: "Todo".to_string(),
                id: input.id,
            })
    }

    /// 软删除待办事项
    ///
    /// 设置 deleted_at 时间戳而非物理删除
    ///
    /// # 参数
    /// - `id`: 待办事项 ID
    ///
    /// # 返回
    /// 成功返回 true，待办事项不存在返回 false
    pub fn delete(&self, id: i64) -> DatabaseResult<bool> {
        let now = chrono::Utc::now().timestamp_millis();

        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute(
                "UPDATE todos SET deleted_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
                params![now, id],
            )?;
            Ok(tx.changes())
        })?;

        Ok(rows_affected > 0)
    }

    /// 根据日历 ID 软删除所有待办事项
    ///
    /// # 参数
    /// - `calendar_id`: 日历 ID
    ///
    /// # 返回
    /// 删除的记录数
    pub fn delete_by_calendar_id(&self, calendar_id: i64) -> DatabaseResult<usize> {
        let now = chrono::Utc::now().timestamp_millis();

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                "UPDATE todos SET deleted_at = ?1 WHERE calendar_id = ?2 AND deleted_at IS NULL",
                params![now, calendar_id],
            )?;
            Ok(tx.changes() as usize)
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;
    use tempfile::NamedTempFile;

    /// 创建测试数据库
    fn create_test_db() -> DatabaseConnection {
        let temp_file = NamedTempFile::new().expect("创建临时文件失败");
        let path = temp_file.path().to_str().expect("路径转换失败");

        let db = DatabaseConnection::connect(path).expect("连接数据库失败");

        // 创建表结构
        db.execute(|conn| {
            create_tables(conn).map_err(|e| {
                rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    e.to_string(),
                )))
            })
        })
        .expect("创建表失败");

        // 创建测试日历（todos 需要关联日历）
        db.execute(|conn| {
            conn.execute(
                r#"
                INSERT INTO calendars (id, name, color, type, visible, created_at, updated_at)
                VALUES (1, 'Test Calendar', '#FF0000', 'local', 1, 0, 0)
                "#,
                [],
            )
        })
        .expect("创建测试日历失败");

        db
    }

    #[test]
    fn test_create_todo() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let input = CreateTodoInput {
            title: "测试待办".to_string(),
            description: Some("这是一个测试待办事项".to_string()),
            due_date: Some(1735689600000), // 2025-01-01
            completed: Some(false),
            priority: Some("high".to_string()),
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };

        let todo = repo.create(&input).expect("创建待办失败");

        assert!(todo.id > 0);
        assert_eq!(todo.title, "测试待办");
        assert_eq!(todo.description, Some("这是一个测试待办事项".to_string()));
        assert_eq!(todo.due_date, Some(1735689600000));
        assert!(!todo.completed);
        assert_eq!(todo.priority, "high");
        assert_eq!(todo.calendar_id, 1);
        assert_eq!(todo.timezone, "Asia/Shanghai");
    }

    #[test]
    fn test_create_todo_with_defaults() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let input = CreateTodoInput {
            title: "默认值待办".to_string(),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };

        let todo = repo.create(&input).expect("创建待办失败");

        assert!(todo.id > 0);
        assert_eq!(todo.title, "默认值待办");
        assert_eq!(todo.description, None);
        assert_eq!(todo.due_date, None);
        assert!(!todo.completed); // 默认 false
        assert_eq!(todo.priority, "medium"); // 默认 medium
        assert_eq!(todo.timezone, "Asia/Shanghai");
    }

    #[test]
    fn test_get_all_todos() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建多个待办事项
        for i in 1..=3 {
            let input = CreateTodoInput {
                title: format!("待办 {}", i),
                description: None,
                due_date: None,
                completed: None,
                priority: None,
                calendar_id: 1,
                external_id: None,
                user_id: None,
                timezone: None,
            };
            repo.create(&input).expect("创建待办失败");
        }

        let todos = repo.get_all().expect("获取待办列表失败");

        assert_eq!(todos.len(), 3);
        // 按创建时间倒序，最新创建的在前面
        assert_eq!(todos[0].title, "待办 3");
        assert_eq!(todos[1].title, "待办 2");
        assert_eq!(todos[2].title, "待办 1");
    }

    #[test]
    fn test_get_by_id() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let input = CreateTodoInput {
            title: "查找测试".to_string(),
            description: Some("测试通过 ID 查找".to_string()),
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };

        let created = repo.create(&input).expect("创建待办失败");
        let found = repo.get_by_id(created.id).expect("查找待办失败");

        assert!(found.is_some());
        let todo = found.unwrap();
        assert_eq!(todo.id, created.id);
        assert_eq!(todo.title, "查找测试");
    }

    #[test]
    fn test_get_by_id_not_found() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let found = repo.get_by_id(999).expect("查找待办失败");
        assert!(found.is_none());
    }

    #[test]
    fn test_get_by_calendar_id() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建日历 2
        db.execute(|conn| {
            conn.execute(
                r#"
                INSERT INTO calendars (id, name, color, type, visible, created_at, updated_at)
                VALUES (2, 'Calendar 2', '#00FF00', 'local', 1, 0, 0)
                "#,
                [],
            )
        })
        .expect("创建测试日历失败");

        // 在日历 1 创建待办
        let input1 = CreateTodoInput {
            title: "日历 1 待办".to_string(),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        repo.create(&input1).expect("创建待办失败");

        // 在日历 2 创建待办
        let input2 = CreateTodoInput {
            title: "日历 2 待办".to_string(),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 2,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        repo.create(&input2).expect("创建待办失败");

        // 验证按日历查询
        let todos1 = repo.get_by_calendar_id(1).expect("查询失败");
        assert_eq!(todos1.len(), 1);
        assert_eq!(todos1[0].title, "日历 1 待办");

        let todos2 = repo.get_by_calendar_id(2).expect("查询失败");
        assert_eq!(todos2.len(), 1);
        assert_eq!(todos2[0].title, "日历 2 待办");
    }

    #[test]
    fn test_update_todo() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建待办
        let create_input = CreateTodoInput {
            title: "原始标题".to_string(),
            description: Some("原始描述".to_string()),
            due_date: None,
            completed: Some(false),
            priority: Some("low".to_string()),
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        let created = repo.create(&create_input).expect("创建待办失败");

        // 更新待办
        let update_input = UpdateTodoInput {
            id: created.id,
            title: Some("更新标题".to_string()),
            description: Some("更新描述".to_string()),
            due_date: Some(1735689600000),
            completed: Some(true),
            priority: Some("high".to_string()),
            calendar_id: None,
            external_id: None,
        };
        let updated = repo.update(&update_input).expect("更新待办失败");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.title, "更新标题");
        assert_eq!(updated.description, Some("更新描述".to_string()));
        assert_eq!(updated.due_date, Some(1735689600000));
        assert!(updated.completed);
        assert_eq!(updated.priority, "high");
        assert_eq!(updated.calendar_id, 1); // 未更新，保持原值
    }

    #[test]
    fn test_update_todo_partial() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建待办
        let create_input = CreateTodoInput {
            title: "部分更新测试".to_string(),
            description: Some("原始描述".to_string()),
            due_date: Some(1735689600000),
            completed: Some(false),
            priority: Some("low".to_string()),
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        let created = repo.create(&create_input).expect("创建待办失败");

        // 只更新完成状态
        let update_input = UpdateTodoInput {
            id: created.id,
            title: None,
            description: None,
            due_date: None,
            completed: Some(true),
            priority: None,
            calendar_id: None,
            external_id: None,
        };
        let updated = repo.update(&update_input).expect("更新待办失败");

        // 验证只有 completed 改变，其他保持原值
        assert_eq!(updated.title, "部分更新测试");
        assert_eq!(updated.description, Some("原始描述".to_string()));
        assert_eq!(updated.due_date, Some(1735689600000));
        assert!(updated.completed); // 已更新
        assert_eq!(updated.priority, "low");
    }

    #[test]
    fn test_update_todo_not_found() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let update_input = UpdateTodoInput {
            id: 999,
            title: Some("不存在的待办".to_string()),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: None,
            external_id: None,
        };

        let result = repo.update(&update_input);
        assert!(result.is_err());

        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Todo");
                assert_eq!(id, 999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_soft_delete_todo() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建待办
        let input = CreateTodoInput {
            title: "待删除".to_string(),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        let created = repo.create(&input).expect("创建待办失败");

        // 验证存在
        assert!(repo.get_by_id(created.id).expect("查询失败").is_some());

        // 软删除
        let deleted = repo.delete(created.id).expect("删除失败");
        assert!(deleted);

        // 验证 get_by_id 找不到（因为 deleted_at IS NULL 过滤）
        assert!(repo.get_by_id(created.id).expect("查询失败").is_none());

        // 验证 get_all 也不包含软删除的
        let todos = repo.get_all().expect("获取待办列表失败");
        assert!(todos.is_empty());
    }

    #[test]
    fn test_delete_todo_not_found() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let deleted = repo.delete(999).expect("删除失败");
        assert!(!deleted); // 不存在，返回 false
    }

    #[test]
    fn test_delete_by_calendar_id() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建日历 2
        db.execute(|conn| {
            conn.execute(
                r#"
                INSERT INTO calendars (id, name, color, type, visible, created_at, updated_at)
                VALUES (2, 'Calendar 2', '#00FF00', 'local', 1, 0, 0)
                "#,
                [],
            )
        })
        .expect("创建测试日历失败");

        // 在两个日历分别创建待办
        for i in 1..=2 {
            let input = CreateTodoInput {
                title: format!("日历 {} 待办", i),
                description: None,
                due_date: None,
                completed: None,
                priority: None,
                calendar_id: i,
                external_id: None,
                user_id: None,
                timezone: None,
            };
            repo.create(&input).expect("创建待办失败");
        }

        // 软删除日历 1 的所有待办
        let count = repo.delete_by_calendar_id(1).expect("删除失败");
        assert_eq!(count, 1);

        // 验证日历 2 的待办仍在
        let todos2 = repo.get_by_calendar_id(2).expect("查询失败");
        assert_eq!(todos2.len(), 1);

        // 验证日历 1 的待办已软删除
        let todos1 = repo.get_by_calendar_id(1).expect("查询失败");
        assert_eq!(todos1.len(), 0);
    }

    #[test]
    fn test_completed_boolean_conversion() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        // 创建已完成的待办
        let input = CreateTodoInput {
            title: "已完成待办".to_string(),
            description: None,
            due_date: None,
            completed: Some(true),
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: None,
            timezone: None,
        };
        let created = repo.create(&input).expect("创建待办失败");

        assert!(created.completed);

        // 验证数据库中存储的是 1
        let stored: i64 = db
            .execute(|conn| {
                conn.query_row(
                    "SELECT completed FROM todos WHERE id = ?1",
                    params![created.id],
                    |row| row.get(0),
                )
            })
            .expect("查询失败");
        assert_eq!(stored, 1);

        // 更新为未完成
        let update_input = UpdateTodoInput {
            id: created.id,
            title: None,
            description: None,
            due_date: None,
            completed: Some(false),
            priority: None,
            calendar_id: None,
            external_id: None,
        };
        let updated = repo.update(&update_input).expect("更新失败");
        assert!(!updated.completed);

        // 验证数据库中存储的是 0
        let stored: i64 = db
            .execute(|conn| {
                conn.query_row(
                    "SELECT completed FROM todos WHERE id = ?1",
                    params![created.id],
                    |row| row.get(0),
                )
            })
            .expect("查询失败");
        assert_eq!(stored, 0);
    }

    #[test]
    fn test_create_todo_with_user_id_and_timezone() {
        let db = create_test_db();
        let repo = TodoRepository::new(&db);

        let input = CreateTodoInput {
            title: "用户待办".to_string(),
            description: None,
            due_date: None,
            completed: None,
            priority: None,
            calendar_id: 1,
            external_id: None,
            user_id: Some(42),
            timezone: Some("America/New_York".to_string()),
        };

        let todo = repo.create(&input).expect("创建待办失败");
        assert_eq!(todo.user_id, Some(42));
        assert_eq!(todo.timezone, "America/New_York");
    }
}
