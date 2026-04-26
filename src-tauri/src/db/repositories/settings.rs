// 应用设置和用户节假日 Repository
// 实现应用设置的 Key-Value 存储和用户自定义节假日的数据访问操作

use crate::db::errors::DatabaseError;
use chrono::Utc;
use rusqlite::{Connection, params, Row};
use serde::{Deserialize, Serialize};

/// 应用设置条目（含描述）
///
/// 包含完整的设置信息，用于前端展示设置列表时提供描述文字
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingEntry {
    /// 设置键名
    pub key: String,
    /// 设置值
    pub value: String,
    /// 设置描述（用于 UI 展示）
    pub description: String,
    /// 更新时间（Unix 时间戳，秒）
    pub updated_at: i64,
}

/// 应用设置 Repository
///
/// 提供 Key-Value 形式的应用设置存储，用于保存用户偏好、配置等
pub struct SettingsRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SettingsRepository<'a> {
    /// 创建应用设置 Repository 实例
    ///
    /// # 参数
    /// - `conn`: 数据库连接引用
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// 获取设置值
    ///
    /// 内部通过 get_entry() 实现，从中提取 value
    ///
    /// # 参数
    /// - `key`: 设置键名
    ///
    /// # 返回
    /// 找到返回 Some(String)，不存在返回 None
    pub fn get(&self, key: &str) -> Result<Option<String>, DatabaseError> {
        self.get_entry(key).map(|opt| opt.map(|e| e.value))
    }

    /// 获取完整设置条目（含描述和时间戳）
    ///
    /// # 参数
    /// - `key`: 设置键名
    ///
    /// # 返回
    /// 找到返回 Some(SettingEntry)，不存在返回 None
    pub fn get_entry(&self, key: &str) -> Result<Option<SettingEntry>, DatabaseError> {
        let result = self.conn.query_row(
            "SELECT key, value, description, updated_at FROM app_settings WHERE key = ?1",
            params![key],
            |row| {
                Ok(SettingEntry {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    description: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            },
        );

        match result {
            Ok(entry) => Ok(Some(entry)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// 设置值（插入或更新）
    ///
    /// 使用 INSERT OR REPLACE 实现 upsert 语义
    ///
    /// # 参数
    /// - `key`: 设置键名
    /// - `value`: 设置值
    /// - `description`: 设置描述（可选，默认空字符串）
    pub fn set(&self, key: &str, value: &str, description: Option<&str>) -> Result<(), DatabaseError> {
        let updated_at = Utc::now().timestamp();
        let desc = description.unwrap_or("");
        self.conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value, description, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![key, value, desc, updated_at],
        )?;
        Ok(())
    }

    /// 按前缀获取所有设置
    ///
    /// 内部通过 get_entries_by_prefix() 实现，提取 key 和 value
    ///
    /// # 参数
    /// - `prefix`: 键名前缀（如 "theme."）
    ///
    /// # 返回
    /// 匹配前缀的所有键值对列表
    pub fn get_by_prefix(&self, prefix: &str) -> Result<Vec<(String, String)>, DatabaseError> {
        self.get_entries_by_prefix(prefix).map(|v| {
            v.into_iter().map(|e| (e.key, e.value)).collect()
        })
    }

    /// 按前缀获取完整设置条目（含描述和时间戳）
    ///
    /// # 参数
    /// - `prefix`: 键名前缀（如 "theme."）
    ///
    /// # 返回
    /// 匹配前缀的所有 SettingEntry 列表
    pub fn get_entries_by_prefix(&self, prefix: &str) -> Result<Vec<SettingEntry>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT key, value, description, updated_at FROM app_settings WHERE key LIKE ?1 ORDER BY key",
        )?;
        let settings = stmt
            .query_map(params![format!("{}%", prefix)], |row| {
                Ok(SettingEntry {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    description: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(settings)
    }
}

/// 用户自定义节假日实体
///
/// 存储用户自定义的节假日或调休补班日期
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserHoliday {
    /// 日期（格式：YYYY-MM-DD）
    pub date: String,
    /// 节假日名称
    pub name: String,
    /// 类别：holiday（节假日）或 makeup（调休补班）
    pub category: String,
    /// 来源：custom（用户自定义）或 api（外部接口）
    pub source: String,
    /// 创建时间（Unix 时间戳，秒）
    pub created_at: i64,
}

/// 用户节假日 Repository
///
/// 提供用户自定义节假日的数据访问操作
pub struct UserHolidaysRepository<'a> {
    conn: &'a Connection,
}

impl<'a> UserHolidaysRepository<'a> {
    /// 创建用户节假日 Repository 实例
    ///
    /// # 参数
    /// - `conn`: 数据库连接引用
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// 从数据库行解析用户节假日
    fn from_row(row: &Row) -> rusqlite::Result<UserHoliday> {
        Ok(UserHoliday {
            date: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
            source: row.get(3)?,
            created_at: row.get(4)?,
        })
    }

    /// 添加节假日或调休
    ///
    /// # 参数
    /// - `date`: 日期（YYYY-MM-DD）
    /// - `name`: 节假日名称
    /// - `category`: 类别（"holiday" 或 "makeup"）
    /// - `source`: 来源（可选，默认 "custom"）
    pub fn add(
        &self,
        date: &str,
        name: &str,
        category: &str,
        source: Option<&str>,
    ) -> Result<(), DatabaseError> {
        let source = source.unwrap_or("custom");
        let created_at = Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO user_holidays (date, name, category, source, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![date, name, category, source, created_at],
        )?;
        Ok(())
    }

    /// 删除节假日或调休
    ///
    /// # 参数
    /// - `date`: 日期
    /// - `category`: 类别
    ///
    /// # 返回
    /// 成功删除返回 true，不存在返回 false
    pub fn remove(&self, date: &str, category: &str) -> Result<bool, DatabaseError> {
        let rows_affected = self.conn.execute(
            "DELETE FROM user_holidays WHERE date = ?1 AND category = ?2",
            params![date, category],
        )?;
        Ok(rows_affected > 0)
    }

    /// 获取所有用户节假日
    ///
    /// # 返回
    /// 所有用户自定义的节假日列表，按日期排序
    pub fn get_all(&self) -> Result<Vec<UserHoliday>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT date, name, category, source, created_at FROM user_holidays ORDER BY date",
        )?;
        let holidays = stmt
            .query_map([], Self::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(holidays)
    }

    /// 按日期范围获取节假日
    ///
    /// # 参数
    /// - `start`: 开始日期（YYYY-MM-DD）
    /// - `end`: 结束日期（YYYY-MM-DD）
    ///
    /// # 返回
    /// 在指定日期范围内的节假日列表
    pub fn get_by_date_range(
        &self,
        start: &str,
        end: &str,
    ) -> Result<Vec<UserHoliday>, DatabaseError> {
        let mut stmt = self.conn.prepare(
            "SELECT date, name, category, source, created_at FROM user_holidays WHERE date >= ?1 AND date <= ?2 ORDER BY date",
        )?;
        let holidays = stmt
            .query_map(params![start, end], Self::from_row)?
            .filter_map(|r| r.ok())
            .collect();
        Ok(holidays)
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

    // SettingsRepository 测试

    #[test]
    fn test_get_settings() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 先设置一个值
        repo.set("theme", "dark", None).expect("设置失败");

        // 获取并验证
        let value = repo.get("theme").expect("获取失败");
        assert!(value.is_some());
        assert_eq!(value.unwrap(), "dark");
    }

    #[test]
    fn test_get_settings_not_found() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 查询不存在的设置
        let value = repo.get("nonexistent").expect("获取失败");
        assert!(value.is_none());
    }

    #[test]
    fn test_set_settings() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置新值
        repo.set("language", "zh-CN", None).expect("设置失败");

        // 验证已保存
        let value = repo.get("language").expect("获取失败");
        assert!(value.is_some());
        assert_eq!(value.unwrap(), "zh-CN");
    }

    #[test]
    fn test_set_settings_overwrite() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置初始值
        repo.set("view_mode", "month", None).expect("设置失败");

        // 覆盖更新
        repo.set("view_mode", "week", None).expect("更新失败");

        // 验证更新后的值
        let value = repo.get("view_mode").expect("获取失败");
        assert!(value.is_some());
        assert_eq!(value.unwrap(), "week");
    }

    #[test]
    fn test_get_all_settings_by_prefix() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置多个前缀相同的设置
        repo.set("theme.color", "blue", None).expect("设置失败");
        repo.set("theme.mode", "dark", None).expect("设置失败");
        repo.set("theme.font", "sans-serif", None).expect("设置失败");
        repo.set("other.key", "value", None).expect("设置失败");

        // 按前缀查询
        let settings = repo.get_by_prefix("theme.").expect("查询失败");

        assert_eq!(settings.len(), 3);

        // 验证结果包含正确的键
        let keys: Vec<&str> = settings.iter().map(|(k, _)| k.as_str()).collect();
        assert!(keys.contains(&"theme.color"));
        assert!(keys.contains(&"theme.mode"));
        assert!(keys.contains(&"theme.font"));
        // 不应包含 other.key
        assert!(!keys.contains(&"other.key"));
    }

    #[test]
    fn test_set_with_description() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置带描述的值
        repo.set("theme", "dark", Some("应用主题颜色")).expect("设置失败");

        // 验证完整条目
        let entry = repo.get_entry("theme").expect("获取失败");
        assert!(entry.is_some());
        let entry = entry.unwrap();
        assert_eq!(entry.key, "theme");
        assert_eq!(entry.value, "dark");
        assert_eq!(entry.description, "应用主题颜色");
        assert!(entry.updated_at > 0);
    }

    #[test]
    fn test_get_entry() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置带描述的值
        repo.set("language", "zh-CN", Some("界面语言")).expect("设置失败");

        // 获取完整条目
        let entry = repo.get_entry("language").expect("获取失败");
        assert!(entry.is_some());
        let entry = entry.unwrap();
        assert_eq!(entry.key, "language");
        assert_eq!(entry.value, "zh-CN");
        assert_eq!(entry.description, "界面语言");

        // 验证 get() 仍返回正确值
        let value = repo.get("language").expect("获取失败");
        assert_eq!(value, Some("zh-CN".to_string()));
    }

    #[test]
    fn test_get_entry_not_found() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 查询不存在的条目
        let entry = repo.get_entry("nonexistent").expect("查询失败");
        assert!(entry.is_none());
    }

    #[test]
    fn test_get_entries_by_prefix() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 设置多个带描述的前缀设置
        repo.set("theme.color", "blue", Some("主题颜色")).expect("设置失败");
        repo.set("theme.mode", "dark", Some("主题模式")).expect("设置失败");
        repo.set("theme.font", "sans-serif", Some("主题字体")).expect("设置失败");
        repo.set("other.key", "value", None).expect("设置失败");

        // 按前缀获取完整条目
        let entries = repo.get_entries_by_prefix("theme.").expect("查询失败");
        assert_eq!(entries.len(), 3);

        // 验证每个条目的描述
        let color_entry = entries.iter().find(|e| e.key == "theme.color").unwrap();
        assert_eq!(color_entry.description, "主题颜色");

        let mode_entry = entries.iter().find(|e| e.key == "theme.mode").unwrap();
        assert_eq!(mode_entry.description, "主题模式");

        // 验证 get_by_prefix() 仍返回正确结果
        let settings = repo.get_by_prefix("theme.").expect("查询失败");
        assert_eq!(settings.len(), 3);
        let keys: Vec<&str> = settings.iter().map(|(k, _)| k.as_str()).collect();
        assert!(keys.contains(&"theme.color"));
    }

    #[test]
    fn test_set_empty_description_default() {
        let conn = setup_test_db();
        let repo = SettingsRepository::new(&conn);

        // 不传描述时默认应为空字符串
        repo.set("key1", "value1", None).expect("设置失败");

        let entry = repo.get_entry("key1").expect("获取失败").unwrap();
        assert_eq!(entry.description, "");
    }

    // UserHolidaysRepository 测试

    #[test]
    fn test_add_holiday() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 添加节假日
        repo.add("2025-01-01", "元旦", "holiday", None)
            .expect("添加失败");

        // 验证已添加
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 1);

        let holiday = &holidays[0];
        assert_eq!(holiday.date, "2025-01-01");
        assert_eq!(holiday.name, "元旦");
        assert_eq!(holiday.category, "holiday");
        assert_eq!(holiday.source, "custom"); // 默认值
    }

    #[test]
    fn test_add_makeup_day() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 添加调休补班
        repo.add("2025-01-26", "春节前补班", "makeup", None)
            .expect("添加失败");

        // 验证
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 1);

        let holiday = &holidays[0];
        assert_eq!(holiday.category, "makeup");
        assert_eq!(holiday.name, "春节前补班");
    }

    #[test]
    fn test_add_duplicate() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 添加第一个节假日
        repo.add("2025-05-01", "劳动节", "holiday", None)
            .expect("添加失败");

        // 尝试添加相同日期和类别的节假日（应因主键冲突而失败）
        let result = repo.add("2025-05-01", "国际劳动节", "holiday", None);
        assert!(result.is_err());

        // 验证只有一个记录
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 1);
        assert_eq!(holidays[0].name, "劳动节"); // 保持第一个
    }

    #[test]
    fn test_remove_holiday() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 添加节假日
        repo.add("2025-10-01", "国庆节", "holiday", None)
            .expect("添加失败");

        // 删除
        let removed = repo.remove("2025-10-01", "holiday").expect("删除失败");
        assert!(removed);

        // 验证已删除
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 0);
    }

    #[test]
    fn test_get_all_holidays() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 添加多个节假日
        repo.add("2025-01-01", "元旦", "holiday", None)
            .expect("添加失败");
        repo.add("2025-01-26", "补班", "makeup", None)
            .expect("添加失败");
        repo.add("2025-05-01", "劳动节", "holiday", Some("api"))
            .expect("添加失败");

        // 获取所有
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 3);

        // 验证按日期排序
        assert_eq!(holidays[0].date, "2025-01-01");
        assert_eq!(holidays[1].date, "2025-01-26");
        assert_eq!(holidays[2].date, "2025-05-01");

        // 验证不同类别和来源
        assert_eq!(holidays[0].category, "holiday");
        assert_eq!(holidays[1].category, "makeup");
        assert_eq!(holidays[2].source, "api");
    }

    #[test]
    fn test_holiday_source_default() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 不指定来源
        repo.add("2025-02-14", "情人节", "holiday", None)
            .expect("添加失败");

        // 验证默认值为 custom
        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 1);
        assert_eq!(holidays[0].source, "custom");

        // 指定来源为 api
        repo.add("2025-03-08", "妇女节", "holiday", Some("api"))
            .expect("添加失败");

        let holidays = repo.get_all().expect("获取失败");
        assert_eq!(holidays.len(), 2);
        assert_eq!(holidays[1].source, "api");
    }

    #[test]
    fn test_get_by_date_range() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 攔加多个节假日
        repo.add("2025-01-01", "元旦", "holiday", None)
            .expect("添加失败");
        repo.add("2025-02-14", "情人节", "holiday", None)
            .expect("添加失败");
        repo.add("2025-05-01", "劳动节", "holiday", None)
            .expect("添加失败");
        repo.add("2025-10-01", "国庆节", "holiday", None)
            .expect("添加失败");

        // 查询日期范围
        let holidays = repo
            .get_by_date_range("2025-02-01", "2025-06-01")
            .expect("查询失败");

        assert_eq!(holidays.len(), 2);
        assert_eq!(holidays[0].date, "2025-02-14");
        assert_eq!(holidays[1].date, "2025-05-01");
    }

    #[test]
    fn test_remove_not_found() {
        let conn = setup_test_db();
        let repo = UserHolidaysRepository::new(&conn);

        // 删除不存在的记录
        let removed = repo.remove("2025-12-31", "holiday").expect("删除失败");
        assert!(!removed);
    }
}