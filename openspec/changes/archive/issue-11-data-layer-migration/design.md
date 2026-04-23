# 设计文档：数据层迁移

> **Issue**: #11 - 检查数据存储，数据和视图进行分离
> **PR**: #14 - refactor: 数据层迁移 - 实现数据和视图分离

---

## Context - 技术背景

### 项目架构

小河日历采用 Tauri 2.x 跨平台架构：

```
┌─────────────────────────────────────────────────────────┐
│                     前端 (Vue 3)                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ Views   │  │ Stores  │  │ Utils   │  │ Types   │     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────────────────┘
                           │
                      invoke() / IPC
                           │
┌─────────────────────────────────────────────────────────┐
│                   后端 (Rust/Tauri)                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ Commands│  │  Repos  │  │   DB    │  │  Sync   │     │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────────────────┘
                           │
                        SQLite
                           │
┌─────────────────────────────────────────────────────────┐
│                    本地存储                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │   Calendar | Event | Todo | Account | SyncState │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 原有问题

**前端直接操作数据库的架构缺陷**：

```typescript
// 旧架构：前端直接操作数据库
// src/utils/database.ts
import { Database } from '@tauri-apps/plugin-sql'

export async function getAllCalendars(): Promise<Calendar[]> {
  const db = await Database.load('sqlite:calendar.db')
  const result = await db.select<Calendar[]>(
    'SELECT * FROM calendars ORDER BY name'
  )
  return result
}
```

问题分析：
1. **跨平台不可用** - Android/iOS 前端需重新实现相同逻辑
2. **安全性问题** - 数据库操作暴露在前端代码中
3. **测试困难** - 前端测试依赖真实数据库
4. **维护分散** - 同一功能多处实现

---

## Goals / Non-Goals - 目标与非目标

### Goals - 目标

1. **数据层统一**
   - 所有数据 CRUD 操作迁移到 Rust 后端
   - 前端通过 invoke 调用统一的数据层
   - 建立清晰的 Repository 层架构

2. **自动化测试覆盖**
   - 使用 TDD 方式开发 Rust 数据层
   - 内存 SQLite 进行隔离测试
   - 目标覆盖率 > 70%

3. **错误处理标准化**
   - 结构化错误类型
   - 前端可区分错误类型进行不同处理

4. **架构一致性**
   - 本地数据与外部数据使用相同的访问模式
   - 前端不再直接操作数据库

### Non-Goals - 非目标

1. **UI 组件修改**
   - 不涉及任何视图层修改
   - 界面行为保持不变

2. **外部日历功能**
   - CalDAV 功能已正确实现，不在本次迁移范围

3. **功能逻辑变更**
   - 不改变业务逻辑
   - 仅改变数据访问方式

4. **数据版本管理**
   - 不实现数据版本控制系统
   - 不实现数据审计日志

---

## Decisions - 关键设计决策

### 决策 1：ID 策略

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **A: 自增整数 ID** | `INTEGER PRIMARY KEY AUTOINCREMENT` | 简化实现，符合数据库最佳实践 | 与旧数据不兼容 |
| B: 字符串 UUID | 前端生成 UUID | 兼容旧数据 | 性能略差，需处理冲突 |

**选择**: 方案 A（自增整数 ID）

**理由**:
- 简化 Rust 实现
- 数据库原生支持，性能最优
- 迁移策略为重建数据库，用户重新配置

### 决策 2：数据库连接管理

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **A: Tauri State 管理** | `State<Mutex<DatabaseConnection>>` | 单例模式，连接复用 | 需处理并发 |
| B: 每次请求创建连接 | 每次操作新建连接 | 简单直接 | 性能开销 |
| C: 连接池 | 多连接池化管理 | 高并发支持 | 实现复杂 |

**选择**: 方案 A（Tauri State 管理）

**理由**:
- 符合 Tauri 最佳实践
- 单例模式适合桌面应用场景
- Mutex 确保并发安全

**实现**:

```rust
// src-tauri/src/lib.rs
fn main() {
    tauri::Builder::default()
        .manage(Mutex::new(DatabaseConnection::new()?))
        .invoke_handler(tauri::generate_handler![
            // 注册所有命令
            get_calendars,
            create_calendar,
            // ...
        ])
        .run(tauri::generate_context!())
}
```

### 决策 3：错误处理策略

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| A: 简单字符串 | `Result<T, String>` | 简单 | 无类型区分 |
| **B: 结构化错误** | `thiserror` 枚举类型 | 类型安全，前端可区分 | 需定义枚举 |

**选择**: 方案 B（结构化错误）

**理由**:
- 前端可区分 NotFound、Duplicate、Constraint 等错误
- 支持自定义错误消息
- 便于日志记录和调试

**实现**:

```rust
// src-tauri/src/db/errors.rs
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("记录未找到: {table} id={id}")]
    NotFound { table: String, id: i64 },
    
    #[error("记录已存在: {table} {field}={value}")]
    Duplicate { table: String, field: String, value: String },
    
    #[error("约束冲突: {constraint}")]
    ConstraintViolation { constraint: String },
    
    #[error("数据库连接错误: {message}")]
    ConnectionError { message: String },
    
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
}
```

### 决策 4：数据迁移策略

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **A: 重建数据库** | 删除旧数据库，重建表结构 | 简单实现 | 用户需重新配置 |
| B: 数据迁移脚本 | 保留数据，转换格式 | 用户数据保留 | 实现复杂，需版本管理 |

**选择**: 方案 A（重建数据库）

**理由**:
- 项目处于早期阶段，用户数据量小
- 简化实现，避免复杂的迁移脚本
- 用户重新配置日历的成本可控

### 决策 5：测试策略

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **A: 内存 SQLite** | `tempfile` 创建临时数据库 | 隔离测试，速度快 | 需额外配置 |
| B: 真实数据库 | 使用真实数据库文件 | 完全真实场景 | 测试污染 |

**选择**: 方案 A（内存 SQLite）

**理由**:
- 测试隔离，无污染风险
- 测试速度快
- 符合 TDD 最佳实践

**实现**:

```rust
// 测试中使用 tempfile
#[cfg(test)]
mod tests {
    use tempfile::NamedTempFile;
    
    fn setup_test_db() -> DatabaseConnection {
        let temp_file = NamedTempFile::new().unwrap();
        let path = temp_file.path().to_str().unwrap();
        DatabaseConnection::new(path).unwrap()
    }
}
```

### 决策 6：事务范围

| 方案 | 描述 | 优势 | 劣势 |
|------|------|------|------|
| **A: 原子操作** | 每个命令独立事务 | 简单，无锁竞争 | 批量操作性能低 |
| B: 批量事务 | 支持多操作事务 | 批量效率高 | 实现复杂 |

**选择**: 方案 A（原子操作）

**理由**:
- 桌面应用场景，单操作为主
- 简化实现
- 无锁竞争风险

---

## Risks - 风险分析

### 风险 1：数据丢失

| 项目 | 内容 |
|------|------|
| **描述** | 数据库重建导致用户日历配置丢失 |
| **影响** | 用户需重新配置日历设置 |
| **缓解措施** | 1. 提供迁移提示 2. 记录迁移日志 3. 保留导入功能 |
| **状态** | 已接受（项目早期，用户数据量小） |

### 风险 2：ID 格式变更

| 项目 | 内容 |
|------|------|
| **描述** | ID 从字符串 UUID 改为整数，前端需适配 |
| **影响** | calendarId 参数处理需增加类型转换 |
| **缓解措施** | 1. tauri.ts 增加 parseInt 处理 2. NaN 值回退默认值 |
| **状态** | 已缓解（已在 PR 中实现） |

### 风险 3：性能影响

| 项目 | 内容 |
|------|------|
| **描述** | invoke 调用增加 IPC 开销 |
| **影响** | 数据操作可能变慢 |
| **缓解措施** | 1. 数据库连接复用 2. 批量操作优化 |
| **状态** | 已验证（开销极小，无明显影响） |

### 风险 4：并发安全

| 项目 | 内容 |
|------|------|
| **描述** | Mutex 可能导致阻塞 |
| **影响** | 多线程访问可能等待 |
| **缓解措施** | 1. 桌面应用单用户场景 2. 原子操作减少锁持有时间 |
| **状态** | 已接受（场景风险可控） |

---

## 架构视图

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                         前端                                 │
│                                                              │
│   calendar.ts Store                                          │
│   ┌────────────────────────────────────────────────────┐   │
│   │ async loadCalendars() {                            │   │
│   │   const calendars = await invoke('get_calendars')  │   │
│   │   this.calendars = calendars                       │   │
│   │ }                                                  │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
│   tauri.ts                                                   │
│   ┌────────────────────────────────────────────────────┐   │
│   │ export async function safeInvoke<T>(               │   │
│   │   cmd: string,                                     │   │
│   │   args?: Record<string, unknown>                   │   │
│   │ ): Promise<T> {                                    │   │
│   │   // NaN 检查、类型转换、错误处理                    │   │
│   │ }                                                  │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                     invoke()
                          │
┌─────────────────────────────────────────────────────────────┐
│                        Rust 后端                             │
│                                                              │
│   commands.rs                                                │
│   ┌────────────────────────────────────────────────────┐   │
│   │ #[tauri::command]                                  │   │
│   │ async fn get_calendars(                            │   │
│   │   state: State<Mutex<DatabaseConnection>>          │   │
│   │ ) -> Result<Vec<Calendar>, String> {               │   │
│   │   let db = state.lock().await;                     │   │
│   │   let repo = CalendarRepository::new(&db);         │   │
│   │   repo.get_all().map_err(|e| e.to_string())        │   │
│   │ }                                                  │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
│   repositories/calendar.rs                                   │
│   ┌────────────────────────────────────────────────────┐   │
│   │ pub fn get_all(&self) -> Result<Vec<Calendar>> {   │   │
│   │   self.conn.prepare("SELECT * FROM calendars")     │   │
│   │     .query_map([], row_to_calendar)                │   │
│   │ }                                                  │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                          │
                       SQLite
                          │
┌─────────────────────────────────────────────────────────────┐
│                       数据存储                                │
│                                                              │
│   calendars 表                                               │
│   ┌────────────────────────────────────────────────────┐   │
│   │ id INTEGER PRIMARY KEY AUTOINCREMENT               │   │
│   │ name TEXT                                          │   │
│   │ color TEXT                                         │   │
│   │ is_default BOOLEAN                                 │   │
│   │ created_at DATETIME                                │   │
│   └────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 模块结构

```
src-tauri/src/
├── db/
│   ├── mod.rs            # 模块入口
│   ├── errors.rs         # 错误类型定义
│   ├── connection.rs     # 连接管理
│   ├── schema.rs         # 表结构定义
│   └── repositories/
│       ├── mod.rs
│       ├── calendar.rs   # 日历仓库
│       ├── event.rs      # 事件仓库
│       ├── todo.rs       # 待办仓库
│       ├── account.rs    # 账号仓库
│       └── sync_state.rs # 同步状态仓库
├── commands.rs           # Tauri 命令
└── lib.rs               # 应用入口
```

---

## 结论

本设计通过建立统一的 Rust 数据层，成功实现了数据和视图分离的核心原则。关键设计决策确保了架构的可维护性、跨平台兼容性和安全性，同时控制了迁移风险。测试结果验证了设计方案的正确性。