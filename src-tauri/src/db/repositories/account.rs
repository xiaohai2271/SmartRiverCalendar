// Account Repository
// 账号数据访问层，实现外部账号的 CRUD 操作

use crate::db::connection::DatabaseConnection;
use crate::db::errors::{DatabaseError, DatabaseResult};
use rusqlite::{params, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

/// 账号实体
///
/// 表示一个外部日历账号（CalDAV 或 Exchange）
/// 密码已由 crypto 模块加密，Repository 只负责存储
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    /// 账号 ID（自增主键）
    pub id: i64,
    /// 账号类型：exchange 或 caldav
    #[serde(rename = "type")]
    pub type_: String,
    /// 服务器地址
    pub server_url: String,
    /// 用户名
    pub username: String,
    /// 已加密的密码
    pub encrypted_password: String,
    /// 显示名称
    pub display_name: Option<String>,
    /// 是否启用
    pub enabled: bool,
    /// 创建时间（Unix 时间戳，毫秒）
    pub created_at: i64,
    /// 更新时间（Unix 时间戳，毫秒）
    pub updated_at: i64,
}

/// 创建账号参数
///
/// 用于创建新账号时传递参数
#[derive(Debug, Clone)]
pub struct CreateAccountParams {
    /// 账号类型
    pub type_: String,
    /// 服务器地址
    pub server_url: String,
    /// 用户名
    pub username: String,
    /// 已加密的密码
    pub encrypted_password: String,
    /// 显示名称
    pub display_name: Option<String>,
    /// 是否启用
    pub enabled: bool,
}

/// 更新账号参数
///
/// 用于更新账号时传递参数
#[derive(Debug, Clone)]
pub struct UpdateAccountParams {
    /// 账号 ID
    pub id: i64,
    /// 账号类型
    pub type_: String,
    /// 服务器地址
    pub server_url: String,
    /// 用户名
    pub username: String,
    /// 已加密的密码
    pub encrypted_password: String,
    /// 显示名称
    pub display_name: Option<String>,
    /// 是否启用
    pub enabled: bool,
}

/// Account Repository
///
/// 封装账号相关的数据库操作
pub struct AccountRepository<'a> {
    db: &'a DatabaseConnection,
}

impl<'a> AccountRepository<'a> {
    /// 创建 AccountRepository 实例
    pub fn new(db: &'a DatabaseConnection) -> Self {
        Self { db }
    }

    /// 从数据库行解析 Account
    fn row_to_account(row: &Row) -> rusqlite::Result<Account> {
        Ok(Account {
            id: row.get(0)?,
            type_: row.get(1)?,
            server_url: row.get(2)?,
            username: row.get(3)?,
            encrypted_password: row.get(4)?,
            display_name: row.get(5)?,
            enabled: row.get::<_, i64>(6)? != 0,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }

    /// 创建新账号
    ///
    /// # 参数
    /// - `params`: 创建参数
    ///
    /// # 返回
    /// 成功返回新创建的账号（包含生成的 ID）
    pub fn create(&self, params: CreateAccountParams) -> DatabaseResult<Account> {
        let now = chrono::Utc::now().timestamp_millis();

        let id = self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                INSERT INTO accounts (type, server_url, username, encrypted_password, display_name, enabled, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
                params![
                    params.type_,
                    params.server_url,
                    params.username,
                    params.encrypted_password,
                    params.display_name,
                    if params.enabled { 1i64 } else { 0i64 },
                    now,
                    now,
                ],
            )?;
            Ok(tx.last_insert_rowid())
        })?;

        // 返回创建的账号
        self.get_by_id(id)?.ok_or_else(|| DatabaseError::NotFound {
            entity: "Account".to_string(),
            id,
        })
    }

    /// 获取所有账号
    ///
    /// # 返回
    /// 按创建时间倒序排列的账号列表
    pub fn get_all(&self) -> DatabaseResult<Vec<Account>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, type, server_url, username, encrypted_password, display_name, enabled, created_at, updated_at
                FROM accounts
                ORDER BY created_at DESC
                "#,
            )?;

            let accounts = stmt
                .query_map([], Self::row_to_account)?
                .filter_map(|r| r.ok())
                .collect();

            Ok(accounts)
        })
    }

    /// 根据 ID 获取账号
    ///
    /// # 参数
    /// - `id`: 账号 ID
    ///
    /// # 返回
    /// 成功返回账号，不存在返回 None
    pub fn get_by_id(&self, id: i64) -> DatabaseResult<Option<Account>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, type, server_url, username, encrypted_password, display_name, enabled, created_at, updated_at
                FROM accounts
                WHERE id = ?1
                "#,
            )?;

            let result = stmt.query_row(params![id], Self::row_to_account).optional()?;
            Ok(result)
        })
    }

    /// 根据服务器地址和用户名获取账号
    ///
    /// 用于检查账号是否已存在，避免重复创建
    ///
    /// # 参数
    /// - `server_url`: 服务器地址
    /// - `username`: 用户名
    ///
    /// # 返回
    /// 成功返回账号，不存在返回 None
    pub fn get_by_server_and_username(
        &self,
        server_url: &str,
        username: &str,
    ) -> DatabaseResult<Option<Account>> {
        self.db.execute(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, type, server_url, username, encrypted_password, display_name, enabled, created_at, updated_at
                FROM accounts
                WHERE server_url = ?1 AND username = ?2
                "#,
            )?;

            let result = stmt
                .query_row(params![server_url, username], Self::row_to_account)
                .optional()?;
            Ok(result)
        })
    }

    /// 更新账号
    ///
    /// 使用 ON CONFLICT DO UPDATE 策略，根据 ID 更新
    ///
    /// # 参数
    /// - `params`: 更新参数
    ///
    /// # 返回
    /// 成功返回更新后的账号
    pub fn update(&self, params: UpdateAccountParams) -> DatabaseResult<Account> {
        let now = chrono::Utc::now().timestamp_millis();

        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute(
                r#"
                UPDATE accounts
                SET type = ?1, server_url = ?2, username = ?3, encrypted_password = ?4,
                    display_name = ?5, enabled = ?6, updated_at = ?7
                WHERE id = ?8
                "#,
                params![
                    params.type_,
                    params.server_url,
                    params.username,
                    params.encrypted_password,
                    params.display_name,
                    if params.enabled { 1i64 } else { 0i64 },
                    now,
                    params.id,
                ],
            )
        })?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound {
                entity: "Account".to_string(),
                id: params.id,
            });
        }

        self.get_by_id(params.id)?
            .ok_or_else(|| DatabaseError::NotFound {
                entity: "Account".to_string(),
                id: params.id,
            })
    }

    /// 删除账号
    ///
    /// # 参数
    /// - `id`: 账号 ID
    ///
    /// # 返回
    /// 成功返回删除的行数
    pub fn delete(&self, id: i64) -> DatabaseResult<usize> {
        let rows_affected = self.db.execute_in_transaction(|tx| {
            tx.execute("DELETE FROM accounts WHERE id = ?1", params![id])
        })?;

        if rows_affected == 0 {
            return Err(DatabaseError::NotFound {
                entity: "Account".to_string(),
                id,
            });
        }

        Ok(rows_affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;
    use tempfile::NamedTempFile;

    /// 创建测试用的数据库连接
    fn create_test_db() -> (DatabaseConnection, NamedTempFile) {
        let temp_file = NamedTempFile::new().expect("创建临时文件失败");
        let path = temp_file.path().to_str().expect("路径转换失败");

        let db = DatabaseConnection::connect(path).expect("连接数据库失败");
        create_tables(&db.get_connection()).expect("创建表失败");

        (db, temp_file)
    }

    /// 创建测试用的账号参数
    fn create_test_params(server_url: &str, username: &str, type_: &str) -> CreateAccountParams {
        CreateAccountParams {
            type_: type_.to_string(),
            server_url: server_url.to_string(),
            username: username.to_string(),
            encrypted_password: "encrypted_password_123".to_string(),
            display_name: Some(format!("{} Display", username)),
            enabled: true,
        }
    }

    #[test]
    fn test_create_account() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let params = create_test_params("https://caldav.example.com", "user1", "caldav");
        let account = repo.create(params).expect("创建账号失败");

        assert!(account.id > 0);
        assert_eq!(account.type_, "caldav");
        assert_eq!(account.server_url, "https://caldav.example.com");
        assert_eq!(account.username, "user1");
        assert_eq!(account.encrypted_password, "encrypted_password_123");
        assert!(account.enabled);
    }

    #[test]
    fn test_create_exchange_account() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let params =
            create_test_params("https://outlook.office365.com", "exchange_user", "exchange");
        let account = repo.create(params).expect("创建 Exchange 账号失败");

        assert_eq!(account.type_, "exchange");
        assert_eq!(account.server_url, "https://outlook.office365.com");
    }

    #[test]
    fn test_get_all_accounts() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        // 创建多个账号
        repo.create(create_test_params("https://server1.com", "user1", "caldav"))
            .expect("创建账号1失败");
        repo.create(create_test_params(
            "https://server2.com",
            "user2",
            "exchange",
        ))
        .expect("创建账号2失败");

        let accounts = repo.get_all().expect("获取账号列表失败");

        assert_eq!(accounts.len(), 2);
        // 验证按创建时间倒序排列（最新的在前）
        assert_eq!(accounts[0].username, "user2");
        assert_eq!(accounts[1].username, "user1");
    }

    #[test]
    fn test_get_by_id() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let created = repo
            .create(create_test_params(
                "https://server.com",
                "testuser",
                "caldav",
            ))
            .expect("创建账号失败");

        let found = repo
            .get_by_id(created.id)
            .expect("查询账号失败")
            .expect("账号不存在");

        assert_eq!(found.id, created.id);
        assert_eq!(found.username, "testuser");
        assert_eq!(found.server_url, "https://server.com");
    }

    #[test]
    fn test_get_by_id_not_found() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let result = repo.get_by_id(99999).expect("查询操作失败");
        assert!(result.is_none());
    }

    #[test]
    fn test_get_by_server_and_username() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        repo.create(create_test_params(
            "https://unique.server.com",
            "uniqueuser",
            "caldav",
        ))
        .expect("创建账号失败");

        // 查找存在的账号
        let found = repo
            .get_by_server_and_username("https://unique.server.com", "uniqueuser")
            .expect("查询失败")
            .expect("账号不存在");

        assert_eq!(found.username, "uniqueuser");
        assert_eq!(found.server_url, "https://unique.server.com");

        // 查找不存在的账号
        let not_found = repo
            .get_by_server_and_username("https://other.server.com", "otheruser")
            .expect("查询失败");

        assert!(not_found.is_none());
    }

    #[test]
    fn test_update_account() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let created = repo
            .create(create_test_params(
                "https://old.server.com",
                "olduser",
                "caldav",
            ))
            .expect("创建账号失败");

        let update_params = UpdateAccountParams {
            id: created.id,
            type_: "exchange".to_string(),
            server_url: "https://new.server.com".to_string(),
            username: "newuser".to_string(),
            encrypted_password: "new_encrypted_password".to_string(),
            display_name: Some("New Display Name".to_string()),
            enabled: false,
        };

        let updated = repo.update(update_params).expect("更新账号失败");

        assert_eq!(updated.id, created.id);
        assert_eq!(updated.type_, "exchange");
        assert_eq!(updated.server_url, "https://new.server.com");
        assert_eq!(updated.username, "newuser");
        assert_eq!(updated.encrypted_password, "new_encrypted_password");
        assert!(!updated.enabled);
        assert!(updated.updated_at > created.updated_at);
    }

    #[test]
    fn test_update_account_not_found() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let update_params = UpdateAccountParams {
            id: 99999,
            type_: "caldav".to_string(),
            server_url: "https://server.com".to_string(),
            username: "user".to_string(),
            encrypted_password: "password".to_string(),
            display_name: None,
            enabled: true,
        };

        let result = repo.update(update_params);
        assert!(result.is_err());

        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Account");
                assert_eq!(id, 99999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_delete_account() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let created = repo
            .create(create_test_params(
                "https://to-delete.com",
                "deleteuser",
                "caldav",
            ))
            .expect("创建账号失败");

        let rows = repo.delete(created.id).expect("删除账号失败");
        assert_eq!(rows, 1);

        // 验证已删除
        let found = repo.get_by_id(created.id).expect("查询失败");
        assert!(found.is_none());
    }

    #[test]
    fn test_delete_account_not_found() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let result = repo.delete(99999);
        assert!(result.is_err());

        match result {
            Err(DatabaseError::NotFound { entity, id }) => {
                assert_eq!(entity, "Account");
                assert_eq!(id, 99999);
            }
            _ => panic!("期望 NotFound 错误"),
        }
    }

    #[test]
    fn test_account_with_disabled_status() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let mut params = create_test_params("https://disabled.com", "disableduser", "caldav");
        params.enabled = false;

        let account = repo.create(params).expect("创建禁用账号失败");
        assert!(!account.enabled);

        // 验证数据库中存储正确
        let found = repo
            .get_by_id(account.id)
            .expect("查询失败")
            .expect("账号不存在");
        assert!(!found.enabled);
    }

    #[test]
    fn test_account_without_display_name() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let mut params = create_test_params("https://nodisplay.com", "nodisplayuser", "caldav");
        params.display_name = None;

        let account = repo.create(params).expect("创建无显示名账号失败");
        assert!(account.display_name.is_none());

        let found = repo
            .get_by_id(account.id)
            .expect("查询失败")
            .expect("账号不存在");
        assert!(found.display_name.is_none());
    }

    #[test]
    fn test_duplicate_server_username_constraint() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        // 创建第一个账号
        repo.create(create_test_params(
            "https://duplicate.com",
            "dupuser",
            "caldav",
        ))
        .expect("创建第一个账号失败");

        // 注意：当前表结构没有唯一约束，所以这个测试主要验证业务逻辑
        // 在实际应用中，应该先调用 get_by_server_and_username 检查是否存在
        let existing = repo
            .get_by_server_and_username("https://duplicate.com", "dupuser")
            .expect("查询失败");

        assert!(existing.is_some(), "应该能找到已存在的账号");
    }

    #[test]
    fn test_created_at_timestamp() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let before = chrono::Utc::now().timestamp_millis();
        let account = repo
            .create(create_test_params("https://time.com", "timeuser", "caldav"))
            .expect("创建账号失败");
        let after = chrono::Utc::now().timestamp_millis();

        assert!(account.created_at >= before);
        assert!(account.created_at <= after);
        assert_eq!(account.created_at, account.updated_at);
    }

    #[test]
    fn test_updated_at_changes_on_update() {
        let (db, _temp) = create_test_db();
        let repo = AccountRepository::new(&db);

        let created = repo
            .create(create_test_params(
                "https://updatetime.com",
                "updatetimeuser",
                "caldav",
            ))
            .expect("创建账号失败");

        // 等待一小段时间确保时间戳不同
        std::thread::sleep(std::time::Duration::from_millis(10));

        let update_params = UpdateAccountParams {
            id: created.id,
            type_: created.type_.clone(),
            server_url: created.server_url.clone(),
            username: created.username.clone(),
            encrypted_password: "updated_password".to_string(),
            display_name: created.display_name.clone(),
            enabled: created.enabled,
        };

        let updated = repo.update(update_params).expect("更新账号失败");

        assert!(updated.updated_at > created.updated_at);
        assert_eq!(updated.created_at, created.created_at);
    }
}
