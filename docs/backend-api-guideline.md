# SmartRiver Calendar 后端数据接口指导手册

> **版本:** v1.0
> **日期:** 2026-05-05
> **状态:** 后端孵化阶段 — 本文档为后端服务开发提供接口规范指导

---

## 1. 概述

SmartRiver Calendar 是一款基于 Tauri + Vue 3 的桌面日历应用，当前数据存储在本地 SQLite 数据库中，通过 Tauri IPC（Rust 后端）进行数据操作。

本手册定义了后端数据服务需要提供的 RESTful API 接口规范，目的是：

- 将本地数据迁移到云端，实现多设备同步
- 提供实时数据服务（WebSocket 推送）
- 支持多用户场景下的数据隔离

---

## 2. 通用规范

### 2.1 基础 URL

```
生产环境: https://api.calendar.menghuan.life/v1
测试环境: https://api-test.calendar.menghuan.life/v1
```

### 2.2 认证方式

所有接口使用 JWT Bearer Token 认证：

```
Authorization: Bearer <access_token>
```

- Access Token 有效期：2 小时
- Refresh Token 有效期：30 天
- Token 刷新接口：`POST /auth/refresh`

### 2.3 请求/响应格式

- Content-Type: `application/json`
- 字符编码: UTF-8
- 时间格式: Unix 时间戳（毫秒），除非特别说明

### 2.4 统一响应结构

**成功响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

**分页响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
}
```

**错误响应：**

```json
{
  "code": 40001,
  "message": "日历不存在",
  "data": null
}
```

### 2.5 错误码规范

| 范围 | 含义 |
|------|------|
| 0 | 成功 |
| 40001 - 40099 | 参数校验错误 |
| 40101 - 40199 | 认证/授权错误 |
| 40401 - 40499 | 资源不存在 |
| 40901 - 40999 | 资源冲突（如重复创建） |
| 50001 - 50099 | 服务端内部错误 |

### 2.6 字段命名规范

后端 API 采用 **snake_case** 命名，与当前 SQLite 数据库字段保持一致。前端负责 camelCase 转换。

### 2.7 软删除

所有核心实体（日历、事件、待办）采用软删除机制：

- 删除时设置 `deleted_at` 字段（Unix 时间戳毫秒）
- 查询默认过滤已删除记录
- 软删除记录保留 30 天后自动清理

---

## 3. 数据模型

### 3.1 实体关系图

```
User
 ├── Account (外部账户)
 │    └── Calendar (日历, account_id FK)
 │         ├── Event (事件, calendar_id FK, CASCADE)
 │         ├── Todo (待办, calendar_id FK, CASCADE)
 │         └── SyncState (同步状态)
 ├── AppSettings (应用设置, KV 存储)
 └── UserHoliday (用户节假日)
```

### 3.2 数据库表结构

#### users 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| email | VARCHAR(255) | UNIQUE | 邮箱（本地注册必填） |
| password_hash | VARCHAR(255) | NULL | 密码哈希（OAuth登录可为空） |
| display_name | VARCHAR(100) | NOT NULL | 显示名称 |
| avatar_url | VARCHAR(500) | NULL | 头像URL |
| provider | VARCHAR(50) | NOT NULL, DEFAULT 'local' | 注册来源: local / github / google / wechat 等 |
| provider_id | VARCHAR(255) | NULL | 第三方平台的用户唯一ID |
| created_at | BIGINT | NOT NULL | 创建时间 |
| updated_at | BIGINT | NOT NULL | 更新时间 |

**索引：**
- `idx_users_email` (email)
- `idx_users_provider` (provider, provider_id)

#### calendars 日历表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK | 所属用户 |
| name | VARCHAR(100) | NOT NULL | 日历名称 |
| color | VARCHAR(20) | NOT NULL | 颜色值（如 #FF5733） |
| type | VARCHAR(20) | NOT NULL, DEFAULT 'local' | 类型: local / exchange / caldav |
| account_id | BIGINT | NULL, FK | 关联外部账户 ID |
| visible | BOOLEAN | NOT NULL, DEFAULT TRUE | 是否在 UI 中显示 |
| sync_enabled | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否启用同步 |
| created_at | BIGINT | NOT NULL | 创建时间（毫秒时间戳） |
| updated_at | BIGINT | NOT NULL | 更新时间（毫秒时间戳） |
| deleted_at | BIGINT | NULL | 软删除时间 |

**索引：**
- `idx_calendars_user_id` (user_id)
- `idx_calendars_account_id` (account_id)
- `idx_calendars_deleted_at` (deleted_at)

#### events 事件表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK | 所属用户 |
| title | VARCHAR(500) | NOT NULL | 事件标题 |
| description | TEXT | NULL | 事件描述 |
| start_time | BIGINT | NOT NULL | 开始时间（毫秒时间戳） |
| end_time | BIGINT | NOT NULL | 结束时间（毫秒时间戳） |
| all_day | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否全天事件 |
| calendar_id | BIGINT | NOT NULL, FK | 所属日历 ID |
| timezone | VARCHAR(50) | NOT NULL, DEFAULT 'UTC' | 所在时区（如 Asia/Shanghai），处理跨时区和夏令时的关键 |
| color | VARCHAR(20) | NULL | 事件颜色 |
| reminder | INT | NULL | 提前提醒分钟数 |
| repeat_rule | JSON | NULL | 重复规则（JSON 格式） |
| location | VARCHAR(500) | NULL | 事件地点 |
| external_id | VARCHAR(500) | NULL | 外部日历事件 ID |
| created_at | BIGINT | NOT NULL | 创建时间 |
| updated_at | BIGINT | NOT NULL | 更新时间 |
| deleted_at | BIGINT | NULL | 软删除时间 |

**repeat_rule JSON 结构：**

```json
{
  "frequency": "weekly",
  "interval": 1,
  "end_date": 1735689600000,
  "count": 10,
  "days_of_week": [1, 3, 5],
  "day_of_month": 15
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| frequency | STRING | 必填。daily / weekly / monthly / yearly / custom |
| interval | INT | 必填。间隔数量 |
| end_date | BIGINT | 可选。结束时间戳 |
| count | INT | 可选。重复次数 |
| days_of_week | INT[] | 可选。周几重复（0=周日, 1=周一...） |
| day_of_month | INT | 可选。每月第几天 |

**索引：**
- `idx_events_user_id` (user_id)
- `idx_events_calendar_id` (calendar_id)
- `idx_events_start_time` (start_time)
- `idx_events_external_id` (external_id)
- `idx_events_time_range` (user_id, start_time, end_time)
- `idx_events_deleted_at` (deleted_at)

#### todos 待办表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK | 所属用户 |
| title | VARCHAR(500) | NOT NULL | 待办标题 |
| description | TEXT | NULL | 待办描述 |
| due_date | BIGINT | NULL | 截止时间（毫秒时间戳） |
| completed | BOOLEAN | NOT NULL, DEFAULT FALSE | 是否完成 |
| priority | VARCHAR(20) | NOT NULL, DEFAULT 'medium' | 优先级: low / medium / high |
| calendar_id | BIGINT | NOT NULL, FK | 所属日历 ID |
| created_at | BIGINT | NOT NULL | 创建时间 |
| updated_at | BIGINT | NOT NULL | 更新时间 |
| deleted_at | BIGINT | NULL | 软删除时间 |

**索引：**
- `idx_todos_user_id` (user_id)
- `idx_todos_calendar_id` (calendar_id)
- `idx_todos_due_date` (due_date)
- `idx_todos_deleted_at` (deleted_at)

#### accounts 外部账户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK | 所属用户 |
| type | VARCHAR(20) | NOT NULL | 类型: exchange / caldav |
| server_url | VARCHAR(500) | NOT NULL | 服务器地址 |
| username | VARCHAR(200) | NOT NULL | 用户名 |
| encrypted_password | TEXT | NOT NULL | 加密后的密码 |
| display_name | VARCHAR(200) | NULL | 显示名称 |
| enabled | BOOLEAN | NOT NULL, DEFAULT TRUE | 是否启用 |
| created_at | BIGINT | NOT NULL | 创建时间 |
| updated_at | BIGINT | NOT NULL | 更新时间 |

**索引：**
- `idx_accounts_user_id` (user_id)
- `idx_accounts_type` (user_id, type)

#### sync_state 同步状态表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL | 所属用户 |
| account_id | BIGINT | NOT NULL, FK | 账户 ID |
| calendar_id | BIGINT | NOT NULL, FK | 日历 ID |
| sync_token | VARCHAR(500) | NULL | 增量同步令牌 |
| last_sync_at | BIGINT | NULL | 最后同步时间 |
| sync_window_start | BIGINT | NULL | 同步窗口起始 |
| sync_window_end | BIGINT | NULL | 同步窗口结束 |

**唯一约束：** `uk_sync_state_account_calendar` (account_id, calendar_id)

#### app_settings 应用设置表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL | 所属用户 |
| key | VARCHAR(200) | NOT NULL | 设置键名（如 app.theme） |
| value | TEXT | NOT NULL | 设置值（JSON 字符串） |
| description | VARCHAR(500) | NOT NULL, DEFAULT '' | 设置描述 |
| updated_at | BIGINT | NOT NULL | 更新时间 |

**唯一约束：** `uk_settings_user_key` (user_id, key)

#### user_holidays 用户节假日表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL | 所属用户 |
| date | VARCHAR(10) | NOT NULL | 日期（YYYY-MM-DD） |
| name | VARCHAR(200) | NOT NULL | 节假日名称 |
| category | VARCHAR(20) | NOT NULL | 类别: holiday / makeup |
| source | VARCHAR(20) | NOT NULL, DEFAULT 'custom' | 来源: custom / api |
| created_at | BIGINT | NOT NULL | 创建时间 |

**唯一约束：** `uk_holiday_date_category` (user_id, date, category)

---

## 4. API 接口详细设计

### 4.1 认证模块

#### POST /auth/register

注册新用户。

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "display_name": "张三"
}
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "user_id": 1,
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 7200
  }
}
```

#### POST /auth/login

用户登录。

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**响应：** 同注册

#### POST /auth/refresh

刷新 Access Token。

**请求体：**

```json
{
  "refresh_token": "eyJ..."
}
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "access_token": "eyJ...",
    "expires_in": 7200
  }
}
```

#### GET /auth/oauth/{provider}

发起 OAuth 授权流程（如 github, google, wechat）。

**路径参数：**
- `provider`: OAuth 服务商名称

**响应：**
返回 HTTP 302 重定向到第三方授权页面，或返回授权 URL：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "redirect_url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

#### GET /auth/oauth/{provider}/callback

OAuth 授权回调接口，处理授权码并进行登录或自动注册。

**查询参数：**
- `code`: 第三方授权码
- `state`: 状态参数（防 CSRF）

**响应：** 同 `/auth/login`，返回 Token 信息

#### POST /auth/logout

用户登出，将当前 Access Token 和 Refresh Token 失效。

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

#### GET /user/profile

获取当前登录用户信息。

**响应：**
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "display_name": "张三",
    "avatar_url": "https://...",
    "provider": "github"
  }
}
```

#### PUT /user/profile

更新当前用户信息（如修改昵称、头像）。

---

### 4.2 日历模块

#### GET /calendars

获取当前用户所有日历列表。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 按类型筛选: local / exchange / caldav |
| visible | boolean | 否 | 按可见性筛选 |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "name": "工作日历",
      "color": "#4A90D9",
      "type": "local",
      "account_id": null,
      "visible": true,
      "sync_enabled": false,
      "created_at": 1714867200000,
      "updated_at": 1714867200000
    }
  ]
}
```

#### POST /calendars

创建日历。

**请求体：**

```json
{
  "name": "工作日历",
  "color": "#4A90D9",
  "type": "local",
  "account_id": null,
  "visible": true,
  "sync_enabled": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 日历名称，1-100字符 |
| color | string | 是 | 颜色值，支持 hex 格式 |
| type | string | 是 | local / exchange / caldav |
| account_id | number | 否 | 外部账户 ID（外部日历时必填） |
| visible | boolean | 否 | 默认 true |
| sync_enabled | boolean | 否 | 默认 false |

**响应：** 返回创建的日历对象（含 id、created_at、updated_at）

#### PUT /calendars/{id}

更新日历。只传需要更新的字段。

**请求体：**

```json
{
  "name": "个人日历",
  "color": "#E74C3C",
  "visible": false
}
```

**响应：** 返回更新后的完整日历对象

#### DELETE /calendars/{id}

删除日历（软删除）。**级联删除该日历下的所有事件和待办**。

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

---

### 4.3 事件模块

#### GET /events

获取事件列表。支持按时间范围和日历筛选。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| calendar_id | number | 否 | 按日历筛选 |
| start_time | number | 否 | 开始时间下界（毫秒时间戳） |
| end_time | number | 否 | 结束时间上界（毫秒时间戳） |
| all_day | boolean | 否 | 按全天事件筛选 |
| page | number | 否 | 页码，默认 1 |
| page_size | number | 否 | 每页条数，默认 100，最大 500 |

> **重要：** `start_time` 和 `end_time` 的筛选逻辑为：事件的 `[start_time, end_time)` 与查询范围有交集。即：`event.start_time < query.end_time AND event.end_time > query.start_time`

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "title": "项目评审会",
        "description": "Q2 项目评审",
        "start_time": 1714867200000,
        "end_time": 1714874400000,
        "all_day": false,
        "calendar_id": 1,
        "color": null,
        "reminder": 15,
        "repeat_rule": null,
        "location": "3号会议室",
        "external_id": null,
        "created_at": 1714867200000,
        "updated_at": 1714867200000
      }
    ],
    "total": 42,
    "page": 1,
    "page_size": 100
  }
}
```

#### GET /events/{id}

获取单个事件详情。

**响应：** 返回事件对象

#### POST /events

创建事件。

**请求体：**

```json
{
  "title": "项目评审会",
  "description": "Q2 项目评审",
  "start_time": 1714867200000,
  "end_time": 1714874400000,
  "all_day": false,
  "calendar_id": 1,
  "color": null,
  "reminder": 15,
  "repeat_rule": {
    "frequency": "weekly",
    "interval": 1,
    "days_of_week": [1, 3, 5]
  },
  "location": "3号会议室",
  "external_id": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 事件标题，1-500字符 |
| description | string | 否 | 事件描述 |
| start_time | number | 是 | 开始时间（毫秒时间戳） |
| end_time | number | 是 | 结束时间（毫秒时间戳），必须大于 start_time |
| all_day | boolean | 是 | 是否全天事件 |
| calendar_id | number | 是 | 所属日历 ID，必须存在且属于当前用户 |
| timezone | string | 否 | 所在时区（如 Asia/Shanghai），默认 UTC |
| color | string | 否 | 事件颜色 |
| reminder | number | 否 | 提前提醒分钟数 |
| repeat_rule | object | 否 | 重复规则（见 3.2 节） |
| location | string | 否 | 事件地点 |
| external_id | string | 否 | 外部日历事件 ID |

**业务校验：**
- `end_time` 必须 > `start_time`（全天事件允许同日 start == end）
- `calendar_id` 对应的日历必须存在且非只读
- 外部日历事件（有 `external_id`）只能由同步服务创建

**响应：** 返回创建的事件对象（含 id、created_at、updated_at）

#### PUT /events/{id}

更新事件。只传需要更新的字段。

**请求体：**

```json
{
  "title": "项目评审会（延期）",
  "start_time": 1714870800000,
  "end_time": 1714878000000
}
```

**响应：** 返回更新后的完整事件对象

#### DELETE /events/{id}

删除事件（软删除）。

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": null
}
```

---

### 4.4 待办模块

#### GET /todos

获取待办列表。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| calendar_id | number | 否 | 按日历筛选 |
| completed | boolean | 否 | 按完成状态筛选 |
| priority | string | 否 | 按优先级筛选: low / medium / high |
| due_before | number | 否 | 截止时间上界（毫秒时间戳） |
| due_after | number | 否 | 截止时间下界（毫秒时间戳） |
| page | number | 否 | 页码，默认 1 |
| page_size | number | 否 | 每页条数，默认 100 |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "title": "完成报告",
        "description": null,
        "due_date": 1714867200000,
        "completed": false,
        "priority": "high",
        "calendar_id": 1,
        "created_at": 1714867200000,
        "updated_at": 1714867200000
      }
    ],
    "total": 15,
    "page": 1,
    "page_size": 100
  }
}
```

#### GET /todos/{id}

获取单个待办详情。

#### POST /todos

创建待办。

**请求体：**

```json
{
  "title": "完成报告",
  "description": null,
  "due_date": 1714867200000,
  "completed": false,
  "priority": "high",
  "calendar_id": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 待办标题，1-500字符 |
| description | string | 否 | 待办描述 |
| due_date | number | 否 | 截止时间（毫秒时间戳） |
| completed | boolean | 否 | 默认 false |
| priority | string | 否 | low / medium / high，默认 medium |
| calendar_id | number | 是 | 所属日历 ID |

**响应：** 返回创建的待办对象

#### PUT /todos/{id}

更新待办。只传需要更新的字段。

**请求体：**

```json
{
  "completed": true
}
```

**响应：** 返回更新后的完整待办对象

#### PATCH /todos/{id}/toggle

快捷切换待办完成状态。

**响应：** 返回更新后的完整待办对象

#### DELETE /todos/{id}

删除待办（软删除）。

---

### 4.5 外部账户模块

#### GET /accounts

获取当前用户所有外部账户。

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "type": "exchange",
      "server_url": "https://mail.example.com/EWS/Exchange.asmx",
      "username": "user@example.com",
      "encrypted_password": "AES256加密字符串",
      "display_name": "公司邮箱",
      "enabled": true,
      "created_at": 1714867200000,
      "updated_at": 1714867200000
    }
  ]
}
```

#### POST /accounts/connect

连接外部日历账户（Exchange 或 CalDAV）。

**请求体：**

```json
{
  "type": "exchange",
  "server_url": "https://mail.example.com/EWS/Exchange.asmx",
  "username": "user@example.com",
  "password": "明文密码（服务端加密存储）"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | exchange / caldav |
| server_url | string | caldav 必填 | 服务器地址（Exchange 可为空，使用 Autodiscover） |
| username | string | 是 | 用户名 |
| password | string | 是 | 明文密码，服务端 AES-256 加密后存储 |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "account": {
      "id": 1,
      "type": "exchange",
      "server_url": "...",
      "username": "...",
      "display_name": "...",
      "enabled": true
    },
    "calendars": [
      {
        "external_id": "calendar-uuid-1",
        "name": "日历",
        "color": "#4A90D9",
        "url": "https://..."
      }
    ]
  }
}
```

#### PUT /accounts/{id}

更新账户信息（如密码、启用状态）。

#### DELETE /accounts/{id}

删除外部账户。级联删除关联的日历、事件、同步状态。

---

### 4.6 同步模块

#### POST /sync/now

触发即时同步。

**请求体：**

```json
{
  "account_id": 1
}
```

`account_id` 可选，不传则同步所有账户。

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "sync_id": "sync-uuid-123",
    "status": "started"
  }
}
```

#### GET /sync/status

获取同步状态。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account_id | number | 否 | 指定账户，不传则返回所有账户状态 |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "account_id": 1,
      "calendar_id": 2,
      "status": "idle",
      "last_sync_at": 1714867200000,
      "sync_token": "token-abc"
    }
  ]
}
```

#### GET /sync/state

获取同步状态记录（sync_token 等增量同步信息）。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| account_id | number | 是 | 账户 ID |
| calendar_id | number | 是 | 日历 ID |

#### PUT /sync/state

更新同步状态（客户端同步完成后上报）。

**请求体：**

```json
{
  "account_id": 1,
  "calendar_id": 2,
  "sync_token": "new-token-xyz",
  "sync_window_start": 1712342400000,
  "sync_window_end": 1717526400000
}
```

---

### 4.7 设置模块

#### GET /settings

获取当前用户所有设置。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prefix | string | 否 | 按前缀筛选（如 app. / popup.） |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "key": "app.theme",
      "value": "\"dark\"",
      "description": "应用主题",
      "updated_at": 1714867200000
    },
    {
      "key": "app.default_reminder",
      "value": "15",
      "description": "默认提醒分钟数",
      "updated_at": 1714867200000
    }
  ]
}
```

#### GET /settings/{key}

获取单个设置项。

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "key": "app.theme",
    "value": "\"dark\"",
    "description": "应用主题",
    "updated_at": 1714867200000
  }
}
```

#### PUT /settings/{key}

设置单个配置项（不存在则创建）。

**请求体：**

```json
{
  "value": "\"dark\"",
  "description": "应用主题"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| value | string | 是 | 设置值（JSON 字符串） |
| description | string | 否 | 设置描述 |

#### DELETE /settings/{key}

删除单个设置项。

---

### 4.8 用户节假日模块

#### GET /holidays

获取用户自定义节假日。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| year | number | 否 | 按年筛选 |
| category | string | 否 | holiday / makeup |
| source | string | 否 | custom / api |

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "date": "2026-10-01",
      "name": "国庆节",
      "category": "holiday",
      "source": "api",
      "created_at": 1714867200000
    }
  ]
}
```

#### POST /holidays

添加自定义节假日。

**请求体：**

```json
{
  "date": "2026-10-01",
  "name": "国庆节",
  "category": "holiday",
  "source": "custom"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 是 | 日期，YYYY-MM-DD 格式 |
| name | string | 是 | 节假日名称 |
| category | string | 是 | holiday / makeup |
| source | string | 否 | custom / api，默认 custom |

**唯一约束：** 同一用户同一 date + category 只能存在一条记录

#### DELETE /holidays

删除节假日。

**请求体：**

```json
{
  "date": "2026-10-01",
  "category": "holiday"
}
```

---

### 4.9 批量操作模块

#### POST /batch/sync

客户端批量同步接口。用于客户端启动时一次性上传本地变更、拉取远端更新。

**请求体：**

```json
{
  "last_sync_at": 1714867200000,
  "changes": {
    "calendars": {
      "created": [...],
      "updated": [...],
      "deleted": [1, 3]
    },
    "events": {
      "created": [...],
      "updated": [...],
      "deleted": [5, 8, 12]
    },
    "todos": {
      "created": [...],
      "updated": [...],
      "deleted": [2]
    }
  }
}
```

**响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "server_changes": {
      "calendars": {
        "created": [...],
        "updated": [...],
        "deleted": [7]
      },
      "events": {
        "created": [...],
        "updated": [...],
        "deleted": []
      },
      "todos": {
        "created": [...],
        "updated": [...],
        "deleted": []
      }
    },
    "sync_token": "sync-token-xyz",
    "server_time": 1714953600000
  }
}
```

**冲突解决策略：**
- 同一字段冲突时，以 `updated_at` 较新的为准
- 若时间戳相同，服务端数据优先
- 删除优先于更新（若服务端已删除，客户端更新被忽略）

---

### 4.10 回收站模块 (Trash)

为了闭环实体表中的 `deleted_at` 软删除机制，必须提供回收站接口。

#### GET /trash

获取已删除的实体列表（可传入 `type` 筛选 calendars/events/todos）。

#### POST /trash/{entity_type}/{id}/restore

恢复被软删除的实体。

#### DELETE /trash/{entity_type}/{id}

彻底删除（硬删除）实体，或传入 `/trash/empty` 清空所有回收站数据。

---

## 5. 实时数据服务（WebSocket）

### 5.1 连接

```
ws://api.smartriver.calendar/v1/ws?token=<access_token>
```

### 5.2 消息格式

所有消息使用 JSON 格式：

```json
{
  "type": "event.created",
  "payload": { ... },
  "timestamp": 1714867200000
}
```

### 5.3 服务端推送事件类型

| 事件类型 | 说明 | Payload |
|----------|------|---------|
| `calendar.created` | 日历创建 | 日历对象 |
| `calendar.updated` | 日历更新 | 日历对象 |
| `calendar.deleted` | 日历删除 | `{ id: number }` |
| `event.created` | 事件创建 | 事件对象 |
| `event.updated` | 事件更新 | 事件对象 |
| `event.deleted` | 事件删除 | `{ id: number }` |
| `todo.created` | 待办创建 | 待办对象 |
| `todo.updated` | 待办更新 | 待办对象 |
| `todo.deleted` | 待办删除 | `{ id: number }` |
| `sync.status` | 同步状态变更 | 同步状态对象 |
| `settings.updated` | 设置变更 | `{ key, value }` |

### 5.4 心跳机制

- 客户端每 30 秒发送 `{"type": "ping"}`
- 服务端回复 `{"type": "pong"}`
- 超过 60 秒无心跳则服务端断开连接
- 客户端应实现自动重连（指数退避，最大间隔 30 秒）

---

## 6. 安全规范

### 6.1 数据隔离

- 所有数据查询必须带 `user_id` 条件，确保用户间数据隔离
- API 网关层从 JWT Token 中提取 `user_id`，不允许客户端传入

### 6.2 密码存储

- 外部账户密码使用 AES-256-GCM 加密存储
- 加密密钥通过 KMS（密钥管理服务）管理
- 每个账户使用独立 IV（初始化向量）
- 返回给客户端时，`encrypted_password` 字段不脱敏（前端需要用于同步）

### 6.3 输入校验

- 所有字符串输入做长度限制（见各字段说明）
- 时间戳范围校验：`1970-01-01` 至 `2100-12-31`
- JSON 字段（如 `repeat_rule`）做 Schema 校验
- 防止 SQL 注入：使用参数化查询

### 6.4 频率限制

| 接口类型 | 限制 |
|----------|------|
| 认证接口 | 同一 IP 10 次/分钟 |
| 读操作 | 同一用户 200 次/分钟 |
| 写操作 | 同一用户 60 次/分钟 |
| 批量同步 | 同一用户 6 次/分钟 |
| WebSocket | 同一用户 1 个连接 |

---

## 7. 前端适配指南

### 7.1 数据转换映射

前端 camelCase 与后端 snake_case 的映射关系：

| 前端字段 | 后端字段 |
|----------|----------|
| startTime | start_time |
| endTime | end_time |
| allDay | all_day |
| calendarId | calendar_id |
| externalId | external_id |
| repeatRule | repeat_rule |
| dueDate | due_date |
| calendarType | type（创建日历时使用 calendar_type） |
| accountId | account_id |
| syncEnabled | sync_enabled |
| encryptedPassword | encrypted_password |
| displayName | display_name |
| lastSyncAt | last_sync_at |
| syncToken | sync_token |
| syncWindowStart | sync_window_start |
| syncWindowEnd | sync_window_end |
| createdAt | created_at |
| updatedAt | updated_at |
| deletedAt | deleted_at |

### 7.2 ID 类型处理

- 后端使用 BIGINT 自增 ID
- 前端当前使用 string 类型（通过 `String(raw.id)` 转换）
- API 传输中使用 number 类型，前端负责转换

### 7.3 设置项 Key 映射

| 前端设置字段 | 后端存储 Key |
|--------------|-------------|
| theme | app.theme |
| defaultView | app.defaultView |
| defaultReminder | app.defaultReminder |
| showLunar | app.showLunar |
| reminderMode | app.reminderMode |
| popupWindowSize | popup.popupWindowSize |
| popupShowLunar | popup.popupShowLunar |
| ... | ... |

规则：`app.` 前缀对应 `AppSettings`，`popup.` 前缀对应 `PopupSettings`

### 7.4 离线与同步策略

1. **本地优先：** 前端优先写入本地 SQLite，后台异步同步到云端
2. **启动同步：** 应用启动时调用 `POST /batch/sync` 拉取远端变更
3. **实时推送：** WebSocket 接收服务端变更，更新本地数据
4. **冲突处理：** 以 `updated_at` 时间戳判断，新值覆盖旧值
5. **降级方案：** 网络不可用时完全依赖本地数据库，不阻塞用户操作

---

## 8. 接口汇总

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/register | 用户注册 |
| POST | /auth/login | 用户登录 |
| POST | /auth/refresh | 刷新 Token |
| GET | /calendars | 获取日历列表 |
| POST | /calendars | 创建日历 |
| PUT | /calendars/{id} | 更新日历 |
| DELETE | /calendars/{id} | 删除日历 |
| GET | /events | 获取事件列表 |
| GET | /events/{id} | 获取事件详情 |
| POST | /events | 创建事件 |
| PUT | /events/{id} | 更新事件 |
| DELETE | /events/{id} | 删除事件 |
| GET | /todos | 获取待办列表 |
| GET | /todos/{id} | 获取待办详情 |
| POST | /todos | 创建待办 |
| PUT | /todos/{id} | 更新待办 |
| PATCH | /todos/{id}/toggle | 切换完成状态 |
| DELETE | /todos/{id} | 删除待办 |
| GET | /accounts | 获取外部账户 |
| POST | /accounts/connect | 连接外部账户 |
| PUT | /accounts/{id} | 更新账户 |
| DELETE | /accounts/{id} | 删除账户 |
| POST | /sync/now | 触发同步 |
| GET | /sync/status | 获取同步状态 |
| GET | /sync/state | 获取同步状态记录 |
| PUT | /sync/state | 更新同步状态记录 |
| GET | /settings | 获取所有设置 |
| GET | /settings/{key} | 获取单个设置 |
| PUT | /settings/{key} | 更新设置 |
| DELETE | /settings/{key} | 删除设置 |
| GET | /holidays | 获取节假日列表 |
| POST | /holidays | 添加节假日 |
| DELETE | /holidays | 删除节假日 |
| POST | /batch/sync | 批量同步 |
| WebSocket | /ws | 实时推送 |

---

## 附录 A：设置项完整清单

### AppSettings（app. 前缀）

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| app.theme | string | "light" | 主题: light / dark / auto |
| app.defaultView | string | "month" | 默认视图 |
| app.firstDayOfWeek | number | 1 | 每周起始日（0=周日） |
| app.defaultReminder | number | 15 | 默认提醒分钟数 |
| app.startMinimized | boolean | false | 启动时最小化 |
| app.autoStart | boolean | false | 开机自启 |
| app.autoUpdate | boolean | true | 自动更新 |
| app.showLunar | boolean | true | 显示农历 |
| app.showLunarFestival | boolean | true | 显示农历节日 |
| app.showSolarTerm | boolean | true | 显示节气 |
| app.showHoliday | boolean | true | 显示法定假日 |
| app.showMakeupDay | boolean | true | 显示调休补班 |
| app.showWeekend | boolean | true | 周末标识 |
| app.monthEventDisplayStyle | string | "bar" | 月视图事件样式: dot / bar |
| app.allDayReminderTime | string | "morning" | 全天提醒: evening_before / morning |
| app.allDayReminderHour | number | 9 | 全天提醒小时 |
| app.reminderMode | string | "standard" | 提醒模式: standard / strong / silent |
| app.customReminderTitle | string | "" | 自定义通知标题 |
| app.customReminderBody | string | "" | 自定义通知正文 |
| app.clockHookEnabled | boolean | false | 时钟点击检测 |
| app.clockHookBlockPopup | boolean | false | 阻止系统日历弹窗 |
| app.proxyMode | string | "none" | 代理模式 |
| app.proxyHost | string | "" | 代理主机 |
| app.proxyPort | number | 0 | 代理端口 |
| app.proxyUsername | string | "" | 代理用户名 |
| app.proxyPassword | string | "" | 代理密码 |

### PopupSettings（popup. 前缀）

| Key | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| popup.popupShowLunar | boolean | true | 弹窗显示农历 |
| popup.popupShowLunarFestival | boolean | true | 弹窗显示农历节日 |
| popup.popupShowSolarTerm | boolean | true | 弹窗显示节气 |
| popup.popupShowHoliday | boolean | true | 弹窗显示假日 |
| popup.popupShowEvents | boolean | true | 弹窗显示事件 |
| popup.popupCalendarShowLunar | boolean | true | 日历格子显示农历 |
| popup.popupWindowSize | string | "medium" | 弹窗尺寸: small / medium / large |

---

## 附录 B：提醒服务对接说明

当前提醒服务运行在客户端（10秒轮询），后端可选择性提供以下增强能力：

### B.1 服务端推送提醒

当后端检测到事件即将到达提醒时间时，通过 WebSocket 推送：

```json
{
  "type": "reminder.trigger",
  "payload": {
    "item_type": "event",
    "item_id": 42,
    "title": "项目评审会",
    "trigger_time": 1714867200000,
    "reminder_minutes": 15
  },
  "timestamp": 1714866300000
}
```

### B.2 提醒确认回执

客户端处理完提醒后，上报回执：

```
POST /reminders/ack
{
  "item_type": "event",
  "item_id": 42,
  "action": "dismissed",
  "timestamp": 1714866310000
}
```

`action` 可选值：`dismissed`（已忽略）、`snoozed`（已贪睡）、`completed`（已完成，仅待办）

### B.3 多设备提醒协调

- 同一提醒只在一台设备上展示（通过分布式锁或 Redis 标记）
- 其他设备收到 `reminder.suppressed` 事件
- 贪睡/忽略操作通过 WebSocket 同步到所有设备
