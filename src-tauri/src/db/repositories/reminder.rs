// 提醒数据访问层
// 实现提醒队列、已发送、贪睡、已查看的 CRUD 操作

use crate::db::errors::DatabaseError;
use chrono::Utc;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

/// 提醒队列项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderQueueItem {
    pub id: String,
    pub r#type: String,
    pub title: String,
    pub body: String,
    pub trigger_time: i64,
    pub item_id: String,
    pub item_data: String,
    pub enqueued_at: i64,
}

/// 提醒 Repository
pub struct ReminderRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ReminderRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    /// 加载提醒队列
    pub fn load_queue(&self, user_id: Option<i64>) -> Result<Vec<ReminderQueueItem>, DatabaseError> {
        let mut stmt = if let Some(_uid) = user_id {
            self.conn.prepare(
                "SELECT id, reminder_type, event_title, event_id, trigger_time, event_id, item_data, created_at
                 FROM reminder_queue WHERE user_id = ?1 ORDER BY trigger_time ASC"
            )?
        } else {
            self.conn.prepare(
                "SELECT id, reminder_type, event_title, event_id, trigger_time, event_id, item_data, created_at
                 FROM reminder_queue ORDER BY trigger_time ASC"
            )?
        };

        let rows = if user_id.is_some() {
            stmt.query_map(params![user_id], Self::from_row)?
        } else {
            stmt.query_map([], Self::from_row)?
        };

        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    fn from_row(row: &rusqlite::Row) -> rusqlite::Result<ReminderQueueItem> {
        Ok(ReminderQueueItem {
            id: row.get::<_, i64>(0)?.to_string(),
            r#type: row.get(1)?,
            title: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            body: String::new(),
            trigger_time: row.get(3)?,
            item_id: row.get(4)?,
            item_data: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            enqueued_at: row.get(6)?,
        })
    }

    /// 保存提醒队列（删除旧数据 + 批量插入）
    pub fn save_queue(&self, user_id: Option<i64>, items: &[ReminderQueueItem]) -> Result<(), DatabaseError> {
        if let Some(uid) = user_id {
            self.conn.execute("DELETE FROM reminder_queue WHERE user_id = ?1", params![uid])?;
        } else {
            self.conn.execute("DELETE FROM reminder_queue", [])?;
        }

        for item in items {
            let now = Utc::now().timestamp_millis();
            let id_int: i64 = item.id.parse().unwrap_or(0);
            self.conn.execute(
                "INSERT INTO reminder_queue (id, user_id, event_id, event_title, event_start_time, reminder_type, trigger_time, priority, item_data, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?9)",
                params![id_int, user_id, item.item_id, item.title, item.trigger_time, item.r#type, item.trigger_time, item.item_data, now],
            )?;
        }

        Ok(())
    }

    /// 检查提醒是否已发送
    pub fn is_reminder_sent(&self, key: &str) -> Result<bool, DatabaseError> {
        let result: Option<i64> = self.conn
            .query_row(
                "SELECT 1 FROM reminder_sent WHERE key = ?1 LIMIT 1",
                params![key],
                |row| row.get(0),
            )
            .ok();
        Ok(result.is_some())
    }

    /// 标记提醒已发送
    pub fn mark_reminder_sent(&self, key: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().timestamp_millis();
        self.conn.execute(
            "INSERT OR IGNORE INTO reminder_sent (key, created_at) VALUES (?1, ?2)",
            params![key, now],
        )?;
        Ok(())
    }

    /// 获取贪睡时间
    pub fn get_snooze_time(&self, id: &str) -> Result<Option<i64>, DatabaseError> {
        let result = self.conn.query_row(
            "SELECT snooze_until FROM reminder_snooze WHERE id = ?1",
            params![id],
            |row| row.get(0),
        );

        match result {
            Ok(time) => Ok(Some(time)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// 设置贪睡时间
    pub fn set_snooze_time(&self, id: &str, snooze_until: i64) -> Result<(), DatabaseError> {
        let now = Utc::now().timestamp_millis();
        self.conn.execute(
            "INSERT OR REPLACE INTO reminder_snooze (id, snooze_until, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
            params![id, snooze_until, now],
        )?;
        Ok(())
    }

    /// 清除贪睡时间
    pub fn clear_snooze_time(&self, id: &str) -> Result<(), DatabaseError> {
        self.conn.execute(
            "DELETE FROM reminder_snooze WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    /// 检查提醒是否已查看（在有效期内）
    pub fn is_reminder_viewed(&self, id: &str, valid_duration_ms: i64) -> Result<bool, DatabaseError> {
        let now = Utc::now().timestamp_millis();
        let cutoff = now - valid_duration_ms;
        let result: Option<i64> = self.conn
            .query_row(
                "SELECT 1 FROM reminder_viewed WHERE id = ?1 AND viewed_at > ?2 LIMIT 1",
                params![id, cutoff],
                |row| row.get(0),
            )
            .ok();
        Ok(result.is_some())
    }

    /// 标记提醒已查看
    pub fn mark_reminder_as_viewed(&self, id: &str) -> Result<(), DatabaseError> {
        let now = Utc::now().timestamp_millis();
        self.conn.execute(
            "INSERT OR REPLACE INTO reminder_viewed (id, viewed_at, created_at) VALUES (?1, ?2, ?2)",
            params![id, now],
        )?;
        Ok(())
    }

    /// 清理过期记录
    pub fn cleanup_expired(&self, now: i64) -> Result<(), DatabaseError> {
        let seven_days_ago = now - 7 * 24 * 60 * 60 * 1000;

        self.conn.execute(
            "DELETE FROM reminder_sent WHERE created_at < ?1",
            params![seven_days_ago],
        )?;

        let one_hour_ago = now - 60 * 60 * 1000;
        self.conn.execute(
            "DELETE FROM reminder_viewed WHERE viewed_at < ?1",
            params![one_hour_ago],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::create_tables;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("创建内存数据库失败");
        create_tables(&conn).expect("创建表失败");
        conn
    }

    #[test]
    fn test_save_and_load_queue() {
        let conn = setup_test_db();
        let repo = ReminderRepository::new(&conn);

        let items = vec![ReminderQueueItem {
            id: "1".to_string(),
            r#type: "event".to_string(),
            title: "测试提醒".to_string(),
            body: "提醒内容".to_string(),
            trigger_time: 1700000000000,
            item_id: "event-1".to_string(),
            item_data: "{}".to_string(),
            enqueued_at: 1700000000000,
        }];

        repo.save_queue(Some(1), &items).unwrap();
        let loaded = repo.load_queue(Some(1)).unwrap();
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].title, "测试提醒");
    }

    #[test]
    fn test_reminder_sent() {
        let conn = setup_test_db();
        let repo = ReminderRepository::new(&conn);

        assert!(!repo.is_reminder_sent("key1").unwrap());
        repo.mark_reminder_sent("key1").unwrap();
        assert!(repo.is_reminder_sent("key1").unwrap());
    }

    #[test]
    fn test_snooze_time() {
        let conn = setup_test_db();
        let repo = ReminderRepository::new(&conn);

        assert!(repo.get_snooze_time("id1").unwrap().is_none());
        repo.set_snooze_time("id1", 1700000000000).unwrap();
        assert_eq!(repo.get_snooze_time("id1").unwrap(), Some(1700000000000));
        repo.clear_snooze_time("id1").unwrap();
        assert!(repo.get_snooze_time("id1").unwrap().is_none());
    }

    #[test]
    fn test_reminder_viewed() {
        let conn = setup_test_db();
        let repo = ReminderRepository::new(&conn);

        assert!(!repo.is_reminder_viewed("id1", 3600000).unwrap());
        repo.mark_reminder_as_viewed("id1").unwrap();
        assert!(repo.is_reminder_viewed("id1", 3600000).unwrap());
    }

    #[test]
    fn test_cleanup_expired() {
        let conn = setup_test_db();
        let repo = ReminderRepository::new(&conn);

        let old_time = 1000000;
        repo.mark_reminder_sent("old_key").unwrap();
        conn.execute("UPDATE reminder_sent SET created_at = ?1 WHERE key = 'old_key'", params![old_time]).unwrap();

        let now = old_time + 8 * 24 * 60 * 60 * 1000;
        repo.cleanup_expired(now).unwrap();
        assert!(!repo.is_reminder_sent("old_key").unwrap());
    }
}
