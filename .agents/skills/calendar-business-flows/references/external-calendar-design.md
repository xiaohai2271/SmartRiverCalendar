# 外部日历集成设计文档

## 1. 概述

### 1.1 功能目标
在小河日历中实现外部日历集成，支持 Exchange EWS 和 CalDAV 协议连接外部日历服务器，实现事件的双向同步（创建/修改/删除），支持定时自动同步和手动触发同步。

### 1.2 技术栈
- **前端**: Vue 3 + TypeScript + Pinia
- **后端**: Tauri 2.x (Rust)
- **协议**: Exchange EWS (SOAP/XML) + CalDAV (WebDAV/iCal)
- **加密**: AES-256-GCM
- **数据库**: SQLite (tauri-plugin-sql)

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      前端 (Vue 3)                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SettingsView │  │ CalendarView │  │ SyncService  │      │
│  │  (设置页面)   │  │  (日历视图)   │  │  (同步服务)   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────┴─────────────────┴─────────────────┴──────┐       │
│  │              Calendar Store (Pinia)              │       │
│  │         日历状态管理 + 外部日历集成               │       │
│  └──────────────────────┬──────────────────────────┘       │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────┐       │
│  │           Database Layer (database.ts)           │       │
│  │      accounts / sync_state / events 表操作       │       │
│  └──────────────────────┬──────────────────────────┘       │
└─────────────────────────┼───────────────────────────────────┘
                          │ safeInvoke
┌─────────────────────────┼───────────────────────────────────┐
│                   后端 (Rust/Tauri)                          │
│  ┌──────────────────────┴──────────────────────────┐       │
│  │              Tauri Commands (commands.rs)        │       │
│  │    connect_exchange / connect_caldav / sync_*    │       │
│  └──────┬──────────────┬──────────────┬────────────┘       │
│         │              │              │                     │
│  ┌──────┴─────┐  ┌─────┴──────┐  ┌───┴────────┐           │
│  │  ews.rs    │  │ caldav.rs  │  │  sync.rs   │           │
│  │ EWS 客户端  │  │ CalDAV 客户端│  │  同步引擎   │           │
│  └──────┬─────┘  └─────┬──────┘  └───┬────────┘           │
│         │              │              │                     │
│  ┌──────┴──────────────┴──────────────┴────────────┐       │
│  │              crypto.rs (AES-256-GCM)            │       │
│  │                 凭证加密模块                     │       │
│  └─────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                          │ HTTP
┌─────────────────────────┼───────────────────────────────────┐
│              外部日历服务器                                  │
│  ┌──────────────┐  ┌────┴──────────┐                       │
│  │ Exchange EWS │  │   CalDAV      │                       │
│  │   服务器      │  │   服务器       │                       │
│  └──────────────┘  └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

| 模块 | 文件 | 职责 |
|------|------|------|
| **EWS 客户端** | `src-tauri/src/ews.rs` | 与 Exchange EWS 服务器通信，SOAP/XML 请求构建和响应解析 |
| **CalDAV 客户端** | `src-tauri/src/caldav.rs` | 与 CalDAV 服务器通信，WebDAV PROPFIND/REPORT 请求，iCal 解析 |
| **同步引擎** | `src-tauri/src/sync.rs` | 双向同步逻辑，冲突解决（服务器优先），后台定时器 |
| **加密模块** | `src-tauri/src/crypto.rs` | AES-256-GCM 凭证加密/解密，密钥派生 |
| **Tauri 命令** | `src-tauri/src/commands.rs` | 前后端桥接，暴露 9 个命令供前端调用 |
| **同步服务** | `src/services/sync.ts` | 前端同步服务，管理自动/手动同步，事件回调 |
| **日历 Store** | `src/stores/calendar.ts` | 日历状态管理，外部日历数据集成 |
| **数据库层** | `src/utils/database.ts` | SQLite 操作，accounts/sync_state/events 表 CRUD |
| **设置页面** | `src/views/SettingsView.vue` | 外部日历添加对话框，日历列表管理，同步状态显示 |

---

## 3. 数据模型

### 3.1 数据库表结构

#### accounts 表（外部账号）
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,              -- 账号唯一标识
  type TEXT NOT NULL,               -- 账号类型: 'exchange' | 'caldav'
  server_url TEXT NOT NULL,         -- 服务器地址
  username TEXT NOT NULL,           -- 用户名
  encrypted_password TEXT NOT NULL, -- AES-256-GCM 加密后的密码
  display_name TEXT,                -- 显示名称
  enabled INTEGER NOT NULL DEFAULT 1, -- 是否启用
  created_at INTEGER NOT NULL,     -- 创建时间
  updated_at INTEGER NOT NULL      -- 更新时间
);
```

#### sync_state 表（同步状态）
```sql
CREATE TABLE sync_state (
  account_id TEXT NOT NULL,         -- 账号 ID
  calendar_id TEXT NOT NULL,        -- 日历 ID
  sync_token TEXT,                  -- 同步令牌（增量同步用）
  last_sync_at INTEGER,             -- 最后同步时间
  sync_window_start INTEGER,        -- 同步窗口开始时间
  sync_window_end INTEGER,          -- 同步窗口结束时间
  PRIMARY KEY(account_id, calendar_id)
);
```

#### events 表扩展
```sql
-- 新增列
ALTER TABLE events ADD COLUMN external_id TEXT;
-- 新增索引
CREATE INDEX idx_events_external_id ON events(external_id);
```

### 3.2 TypeScript 类型定义

```typescript
// 日历类型（扩展）
type CalendarType = 'local' | 'exchange' | 'caldav'

// 外部账号
interface ExternalAccount {
  id: string
  type: 'exchange' | 'caldav'
  serverUrl: string
  username: string
  displayName?: string
  enabled: boolean
  lastSyncAt?: number
  createdAt: number
  updatedAt: number
}

// 同步状态
interface SyncState {
  accountId: string
  calendarId: string
  syncToken?: string
  lastSyncAt?: number
  syncWindowStart?: number
  syncWindowEnd?: number
}

// 同步状态类型
type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'
```

### 3.3 Rust 结构体

```rust
// EWS/CalDAV 通用事件信息
pub struct EventInfo {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub start_time: i64,      // Unix 时间戳
    pub end_time: i64,
    pub all_day: bool,
    pub location: Option<String>,
}

// 同步结果
pub struct SyncResult {
    pub account_id: String,
    pub success: bool,
    pub added: usize,
    pub updated: usize,
    pub deleted: usize,
    pub errors: Vec<String>,
}

// 同步配置
pub struct SyncConfig {
    pub past_days: i64,       // 默认 30 天
    pub future_days: i64,     // 默认 90 天
    pub interval_minutes: u64, // 默认 15 分钟
}
```

---

## 4. 安全设计

### 4.1 凭证加密

使用 AES-256-GCM 对密码进行应用层加密：

```
明文密码 → AES-256-GCM 加密 → base64(nonce + ciphertext) → 存储到 SQLite
```

**密钥派生**:
```
机器特征值（hostname） + 固定盐值 → SHA-256 → 32 字节密钥
```

**安全特性**:
- 每次加密使用随机 12 字节 nonce
- 相同密码每次加密产生不同密文
- 密钥基于机器特征值，不同设备无法解密
- 不在日志中输出密钥或明文密码

### 4.2 网络安全
- 使用 HTTPS 连接外部服务器
- HTTP Basic 认证（Base64 编码凭证）
- 请求超时设置 30 秒

---

## 5. 接口设计

### 5.1 Tauri 命令接口

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `connect_exchange` | serverUrl, username, password | AccountInfo | 连接 Exchange 服务器 |
| `connect_caldav` | serverUrl, username, password | AccountInfo | 连接 CalDAV 服务器 |
| `get_all_accounts` | - | Vec\<AccountInfo\> | 获取所有外部账号 |
| `delete_account` | accountId | () | 删除外部账号 |
| `get_external_calendars` | accountId | Vec\<CalendarInfo\> | 获取外部日历列表 |
| `sync_now` | accountId? | SyncResult | 手动触发同步 |
| `sync_all` | - | Vec\<SyncResult\> | 同步所有账号 |
| `get_sync_status` | accountId | SyncStatus | 获取同步状态 |
| `set_sync_interval` | minutes | () | 设置同步间隔 |

### 5.2 前端服务接口

```typescript
class SyncService {
  startAutoSync(intervalMinutes: number): void
  stopAutoSync(): void
  syncNow(accountId?: string): Promise<void>
  getSyncStatus(accountId: string): Promise<SyncStatus>
  onSyncStart(callback: () => void): void
  onSyncComplete(callback: (result: SyncResult) => void): void
  onSyncError(callback: (error: string) => void): void
}
```

---

## 6. 文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src-tauri/src/ews.rs` | 新增 | EWS 客户端模块（977 行） |
| `src-tauri/src/caldav.rs` | 新增 | CalDAV 客户端模块（1144 行） |
| `src-tauri/src/sync.rs` | 新增 | 同步引擎模块（701 行） |
| `src-tauri/src/crypto.rs` | 新增 | 凭证加密模块（167 行） |
| `src/services/sync.ts` | 新增 | 前端同步服务（259 行） |
| `src-tauri/src/commands.rs` | 修改 | 添加 9 个 Tauri 命令 |
| `src-tauri/src/lib.rs` | 修改 | 注册新模块和命令 |
| `src-tauri/Cargo.toml` | 修改 | 添加依赖 |
| `src/types/index.ts` | 修改 | 扩展类型定义 |
| `src/utils/database.ts` | 修改 | 添加表和 CRUD 函数 |
| `src/utils/tauri.ts` | 修改 | 添加 safeInvoke 封装 |
| `src/stores/calendar.ts` | 修改 | 集成外部日历 |
| `src/views/SettingsView.vue` | 修改 | 添加外部日历 UI |
