// 本地用户 Repository
// 管理认证用户的本地缓存信息

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};

/// 本地用户实体
///
/// 缓存远程认证用户的信息，user_id 与远程用户 ID 对应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalUser {
    /// 远程用户 ID（主键）
    pub user_id: i64,
    /// 用户邮箱
    pub email: String,
    /// 显示名称
    pub display_name: String,
    /// 是否为当前登录用户
    pub is_current: bool,
    /// 创建时间戳（毫秒）
    pub created_at: i64,
    /// 更新时间戳（毫秒）
    pub updated_at: i64,
}

/// 创建本地用户的参数
#[derive(Debug, Clone)]
pub struct CreateLocalUserParams {
    /// 远程用户 ID
    pub user_id: i64,
    /// 用户邮箱
    pub email: String,
    /// 显示名称
    pub display_name: String,
    /// 是否为当前登录用户
    pub is_current: bool,
}

/// 更新本地用户的参数
#[derive(Debug, Clone)]
pub struct UpdateLocalUserParams {
    /// 远程用户 ID
    pub user_id: i64,
    /// 用户邮箱
    pub email: Option<String>,
    /// 显示名称
    pub display_name: Option<String>,
    /// 是否为当前登录用户
    pub is_current: Option<bool>,
}

/// 本地用户查询的列列表
const LOCAL_USER_COLUMNS: &str = r#"
    user_id, email, display_name, is_current, created_at, updated_at
"#;

impl LocalUser {
    /// 从数据库行解析本地用户（使用列名访问，更安全）
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(LocalUser {
            user_id: row.get("user_id")?,
            email: row.get("email")?,
            display_name: row.get("display_name")?,
            is_current: row.get::<_, i64>("is_current")? != 0,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

/// 本地用户 Repository
///
/// 提供本地用户的数据访问操作
pub struct LocalUserRepository<'a> {
    db: &'a DatabaseConnection,
}

impl<'a> LocalUserRepository<'a> {
    /// 创建 LocalUserRepository 实例
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 创建本地用户
    ///
    /// # 参数
    /// - `params`: 创建参数
    ///
    /// # 返回
    /// 成功返回新创建的本地用户
    pub fn create(&self, params: &CreateLocalUserParams) -> DatabaseResult<LocalUser> {
        let now = chrono::Utc::now().timestamp_millis();

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                "INSERT INTO local_users (user_id, email, display_name, is_current, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    params.user_id,
                    params.email,
                    params.display_name,
                    if params.is_current { 1i64 } else { 0i64 },
                    now,
                    now,
                ],
            )?;

            Ok(LocalUser {
                user_id: params.user_id,
                email: params.email.clone(),
                display_name: params.display_name.clone(),
                is_current: params.is_current,
                created_at: now,
                updated_at: now,
            })
        })
    }

    /// 根据用户 ID 获取本地用户
    ///
    /// # 参数
    /// - `user_id`: 远程用户 ID
    ///
    /// # 返回
    /// 找到返回 Some(LocalUser)，否则返回 None
    pub fn get_by_user_id(&self, user_id: i64) -> DatabaseResult<Option<LocalUser>> {
        self.db.execute(|conn| {
            let result = conn.query_row(
                &format!("SELECT {LOCAL_USER_COLUMNS} FROM local_users WHERE user_id = ?1"),
                params![user_id],
                LocalUser::from_row,
            );
            match result {
                Ok(user) => Ok(Some(user)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// 获取当前登录用户
    ///
    /// # 返回
    /// 找到返回 Some(LocalUser)，否则返回 None
    pub fn get_current_user(&self) -> DatabaseResult<Option<LocalUser>> {
        self.db.execute(|conn| {
            let result = conn.query_row(
                &format!("SELECT {LOCAL_USER_COLUMNS} FROM local_users WHERE is_current = 1"),
                [],
                LocalUser::from_row,
            );
            match result {
                Ok(user) => Ok(Some(user)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e.into()),
            }
        })
    }

    /// 获取所有本地用户
    ///
    /// # 返回
    /// 所有本地用户列表
    pub fn get_all(&self) -> DatabaseResult<Vec<LocalUser>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(&format!(
                "SELECT {LOCAL_USER_COLUMNS} FROM local_users ORDER BY created_at ASC"
            ))?;
            let users = stmt
                .query_map([], LocalUser::from_row)?
                .filter_map(|r| r.ok())
                .collect();
            Ok(users)
        })
    }

    /// 更新本地用户
    ///
    /// # 参数
    /// - `params`: 更新参数
    ///
    /// # 返回
    /// 成功返回更新后的本地用户
    pub fn update(&self, params: &UpdateLocalUserParams) -> DatabaseResult<LocalUser> {
        let existing = self
            .get_by_user_id(params.user_id)?
            .ok_or_else(|| DatabaseError::NotFound {
                entity: "LocalUser".to_string(),
                id: params.user_id,
            })?;

        let now = chrono::Utc::now().timestamp_millis();
        let email = params.email.clone().unwrap_or(existing.email);
        let display_name = params.display_name.clone().unwrap_or(existing.display_name);
        let is_current = params.is_current.unwrap_or(existing.is_current);

        // 如果设置为当前用户，先取消其他用户的当前状态
        if is_current && !existing.is_current {
            self.db.execute(|conn| {
                conn.execute(
                    "UPDATE local_users SET is_current = 0 WHERE is_current = 1",
                    [],
                )
            })?;
        }

        self.db.execute_in_transaction(|tx| {
            tx.execute(
                "UPDATE local_users SET email = ?1, display_name = ?2, is_current = ?3, updated_at = ?4
                 WHERE user_id = ?5",
                params![
                    email,
                    display_name,
                    if is_current { 1i64 } else { 0i64 },
                    now,
                    params.user_id,
                ],
            )?;
            Ok(())
        })?;

        self.get_by_user_id(params.user_id)?
            .ok_or_else(|| DatabaseError::NotFound {
                entity: "LocalUser".to_string(),
                id: params.user_id,
            })
    }

    /// 删除本地用户
    ///
    /// # 参数
    /// - `user_id`: 远程用户 ID
    ///
    /// # 返回
    /// 成功返回 true，不存在返回 false
    pub fn delete(&self, user_id: i64) -> DatabaseResult<bool> {
        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute(
                "DELETE FROM local_users WHERE user_id = ?1",
                params![user_id],
            )?;
            Ok(tx.changes())
        })?;

        Ok(rows_affected > 0)
    }

    /// 设置当前用户（取消其他用户的当前状态）
    ///
    /// # 参数
    /// - `user_id`: 要设置为当前用户的远程用户 ID
    ///
    /// # 返回
    /// 成功返回 ()
    pub fn set_current_user(&self, user_id: i64) -> DatabaseResult<()> {
        self.db.execute_in_transaction(|tx| {
            // 先取消所有用户的当前状态
            tx.execute("UPDATE local_users SET is_current = 0, updated_at = ?1", params![chrono::Utc::now().timestamp_millis()])?;

            // 设置指定用户为当前用户
            let rows = tx.execute(
                "UPDATE local_users SET is_current = 1, updated_at = ?1 WHERE user_id = ?2",
                params![chrono::Utc::now().timestamp_millis(), user_id],
            )?;

            if rows == 0 {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            Ok(())
        }).map_err(|_| DatabaseError::NotFound {
            entity: "LocalUser".to_string(),
            id: user_id,
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

    #[test]
    fn test_create_local_user() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let params = CreateLocalUserParams {
            user_id: 1,
            email: "test@example.com".to_string(),
            display_name: "测试用户".to_string(),
            is_current: true,
        };

        let user = repo.create(&params).expect("创建用户失败");

        assert_eq!(user.user_id, 1);
        assert_eq!(user.email, "test@example.com");
        assert_eq!(user.display_name, "测试用户");
        assert!(user.is_current);
    }

    #[test]
    fn test_get_by_user_id() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let params = CreateLocalUserParams {
            user_id: 42,
            email: "find@example.com".to_string(),
            display_name: "查找用户".to_string(),
            is_current: false,
        };

        repo.create(&params).expect("创建用户失败");

        let found = repo.get_by_user_id(42).expect("查询失败");
        assert!(found.is_some());
        assert_eq!(found.unwrap().email, "find@example.com");
    }

    #[test]
    fn test_get_by_user_id_not_found() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let found = repo.get_by_user_id(999).expect("查询失败");
        assert!(found.is_none());
    }

    #[test]
    fn test_get_current_user() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        // 创建非当前用户
        let params1 = CreateLocalUserParams {
            user_id: 1,
            email: "other@example.com".to_string(),
            display_name: "其他用户".to_string(),
            is_current: false,
        };
        repo.create(&params1).expect("创建用户失败");

        // 创建当前用户
        let params2 = CreateLocalUserParams {
            user_id: 2,
            email: "current@example.com".to_string(),
            display_name: "当前用户".to_string(),
            is_current: true,
        };
        repo.create(&params2).expect("创建用户失败");

        let current = repo.get_current_user().expect("查询失败");
        assert!(current.is_some());
        assert_eq!(current.unwrap().user_id, 2);
    }

    #[test]
    fn test_get_current_user_none() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let current = repo.get_current_user().expect("查询失败");
        assert!(current.is_none());
    }

    #[test]
    fn test_update_local_user() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let params = CreateLocalUserParams {
            user_id: 1,
            email: "old@example.com".to_string(),
            display_name: "旧名称".to_string(),
            is_current: false,
        };

        repo.create(&params).expect("创建用户失败");

        let update_params = UpdateLocalUserParams {
            user_id: 1,
            email: Some("new@example.com".to_string()),
            display_name: Some("新名称".to_string()),
            is_current: Some(true),
        };

        let updated = repo.update(&update_params).expect("更新用户失败");
        assert_eq!(updated.email, "new@example.com");
        assert_eq!(updated.display_name, "新名称");
        assert!(updated.is_current);
    }

    #[test]
    fn test_update_local_user_not_found() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let update_params = UpdateLocalUserParams {
            user_id: 999,
            email: Some("x@example.com".to_string()),
            display_name: None,
            is_current: None,
        };

        let result = repo.update(&update_params);
        assert!(result.is_err());
    }

    #[test]
    fn test_set_current_user() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        // 创建两个用户
        let params1 = CreateLocalUserParams {
            user_id: 1,
            email: "user1@example.com".to_string(),
            display_name: "用户1".to_string(),
            is_current: true,
        };
        repo.create(&params1).expect("创建用户1失败");

        let params2 = CreateLocalUserParams {
            user_id: 2,
            email: "user2@example.com".to_string(),
            display_name: "用户2".to_string(),
            is_current: false,
        };
        repo.create(&params2).expect("创建用户2失败");

        // 设置用户2为当前用户
        repo.set_current_user(2).expect("设置当前用户失败");

        // 验证用户2是当前用户
        let current = repo.get_current_user().expect("查询失败").unwrap();
        assert_eq!(current.user_id, 2);

        // 验证用户1不再是当前用户
        let user1 = repo.get_by_user_id(1).expect("查询失败").unwrap();
        assert!(!user1.is_current);
    }

    #[test]
    fn test_delete_local_user() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let params = CreateLocalUserParams {
            user_id: 1,
            email: "delete@example.com".to_string(),
            display_name: "待删除".to_string(),
            is_current: false,
        };

        repo.create(&params).expect("创建用户失败");
        let deleted = repo.delete(1).expect("删除失败");
        assert!(deleted);

        let found = repo.get_by_user_id(1).expect("查询失败");
        assert!(found.is_none());
    }

    #[test]
    fn test_delete_local_user_not_found() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        let deleted = repo.delete(999).expect("删除失败");
        assert!(!deleted);
    }

    #[test]
    fn test_get_all_users() {
        let db = setup_test_db();
        let repo = LocalUserRepository::new(&db);

        for i in 1..=3 {
            let params = CreateLocalUserParams {
                user_id: i,
                email: format!("user{}@example.com", i),
                display_name: format!("用户 {}", i),
                is_current: i == 1,
            };
            repo.create(&params).expect("创建用户失败");
        }

        let users = repo.get_all().expect("查询失败");
        assert_eq!(users.len(), 3);
    }
}
