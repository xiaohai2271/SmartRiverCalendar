# 数据库字段规范

## 目录
1. [命名规范](#命名规范)
2. [必要字段](#必要字段)
3. [字段类型规范](#字段类型规范)
4. [索引策略](#索引策略)
5. [迁移规范](#迁移规范)

## 命名规范

### 表名
- 使用 **snake_case** 小写复数形式
- 示例: `calendars`, `events`, `todos`, `accounts`

### 字段名
- 数据库层 (Rust/SQLite): 使用 **snake_case**
- 前端层 (TypeScript): 使用 **camelCase**
- 前端与后端之间的字段映射由 Service 层负责

```sql
-- ✅ 数据库层正确命名
CREATE TABLE calendar_events (
    id              TEXT PRIMARY KEY NOT NULL,
    title           TEXT NOT NULL,
    start_time      INTEGER NOT NULL,   -- Unix timestamp (毫秒)
    end_time        INTEGER NOT NULL,
    is_all_day      INTEGER DEFAULT 0,  -- SQLite 无 BOOLEAN，用 INTEGER 0/1
    calendar_id     TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
```

```typescript
// ✅ 前端层正确命名 (camelCase)
interface CalendarEvent {
  id: string
  title: string
  startTime: number    // 对应数据库 start_time
  endTime: number      // 对应数据库 end_time
  isAllDay: boolean    // 对应数据库 is_all_day
  calendarId: string   // 对应数据库 calendar_id
  createdAt: number
  updatedAt: number
}
```

### 命名原则
- **简洁明了**: 字段名应直接反映其含义，无需额外注释
- **避免缩写**: 除约定俗成的缩写外 (如 `id`, `url`)，不使用缩写
- **布尔字段**: 以 `is_` 前缀开头 (如 `is_all_day`, `is_visible`)
- **时间字段**: 以 `_at` 结尾表示时间点 (如 `created_at`, `updated_at`)

## 必要字段

每张数据表必须包含以下标准字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | TEXT | 主键，使用 UUID v4 |
| `created_at` | INTEGER | 创建时间戳 (Unix 毫秒) |
| `updated_at` | INTEGER | 最后更新时间戳 (Unix 毫秒) |

### 可选标准字段

| 字段名 | 类型 | 说明 | 使用场景 |
|--------|------|------|----------|
| `deleted_at` | INTEGER | 软删除时间戳 | 需要回收站/撤销功能时 |
| `sort_order` | INTEGER | 排序序号 | 需要手动排序时 |
| `version` | INTEGER | 乐观锁版本号 | 需要并发控制时 |

## 字段类型规范

### SQLite 类型映射

| 业务类型 | SQLite 类型 | 说明 |
|----------|-------------|------|
| UUID/ID | TEXT | 使用 UUID v4 字符串 |
| 字符串 | TEXT | VARCHAR 在 SQLite 中等同 TEXT |
| 整数 | INTEGER | 64 位有符号整数 |
| 浮点数 | REAL | 8 字节浮点数 |
| 布尔值 | INTEGER | 0 = false, 1 = true |
| 时间戳 | INTEGER | Unix 毫秒时间戳 |
| 日期 | TEXT | ISO 8601 格式 (YYYY-MM-DD) |
| JSON | TEXT | 序列化为 JSON 字符串存储 |
| 枚举 | TEXT | 存储枚举值字符串，不要存数字 |

### Rust 类型映射

| SQLite 类型 | Rust 类型 | 说明 |
|-------------|-----------|------|
| TEXT (UUID) | String | UUID v4 |
| TEXT | String | 普通字符串 |
| INTEGER | i64 | 时间戳、计数 |
| REAL | f64 | 浮点数 |
| INTEGER (bool) | bool | 通过 0/1 转换 |
| TEXT (JSON) | serde_json::Value 或自定义 struct | JSON 数据 |
| TEXT (enum) | 自定义 enum + Display/FromStr | 枚举值 |

### 禁止事项

```sql
-- ❌ 禁止：使用关键字作为字段名
CREATE TABLE events (order INTEGER, group TEXT);

-- ❌ 禁止：使用中文或拼音字段名
CREATE TABLE events (标题 TEXT, 开始时间 INTEGER);

-- ❌ 禁止：存储布尔值用字符串
CREATE TABLE events (is_all_day TEXT);  -- 用 'true'/'false' 存储

-- ❌ 禁止：时间戳存字符串
CREATE TABLE events (created_at TEXT);  -- 如 "2024-01-01 12:00:00"

-- ✅ 正确做法
CREATE TABLE events (
    sort_order  INTEGER,  -- 避开关键字
    title       TEXT,
    start_time  INTEGER,  -- Unix 毫秒时间戳
    is_all_day  INTEGER DEFAULT 0,
    created_at  INTEGER
);
```

## 索引策略

### 必须建立索引的场景
1. **外键字段**: `calendar_id`, `event_id` 等关联字段
2. **高频查询字段**: `start_time`, `due_date` 等时间范围查询字段
3. **排序字段**: `sort_order`, `created_at` 等

### 索引命名
```
idx_{表名}_{字段名}
```

```sql
-- 单列索引
CREATE INDEX idx_events_calendar_id ON events(calendar_id);
CREATE INDEX idx_events_start_time ON events(start_time);

-- 复合索引 (按查询频率排列字段顺序)
CREATE INDEX idx_events_calendar_time ON events(calendar_id, start_time);
```

### 索引注意事项
- 不要过度索引（每个索引增加写入成本）
- 小表（< 1000 行）可以不建索引
- 定期检查索引使用情况，删除无用索引

## 迁移规范

### 迁移原则
1. **所有表结构变更必须通过迁移脚本**，不可手动修改数据库
2. 迁移脚本存放在 `src-tauri/migrations/` 目录下
3. 迁移文件命名: `{序号}_{描述}.sql` (如 `001_create_events.sql`)
4. 每次迁移必须可逆（提供 down 脚本或记录回滚方案）
5. 迁移脚本在应用启动时自动执行

### 迁移示例

```sql
-- 001_create_events.sql
-- 创建事件表

CREATE TABLE IF NOT EXISTS events (
    id              TEXT PRIMARY KEY NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT DEFAULT '',
    start_time      INTEGER NOT NULL,
    end_time        INTEGER NOT NULL,
    is_all_day      INTEGER DEFAULT 0,
    calendar_id     TEXT NOT NULL,
    color           TEXT DEFAULT '',
    location        TEXT DEFAULT '',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
```
