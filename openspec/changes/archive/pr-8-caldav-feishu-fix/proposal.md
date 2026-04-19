# 飞书 CalDAV 日历同步修复

## Why

### 问题背景

用户报告使用飞书 CalDAV 日历账户时，已在服务端获取到了日历事件，但程序中无法正确获取和显示。经过诊断，发现飞书 CalDAV 服务存在多处非标准实现，与标准 CalDAV 协议不兼容。

### 问题根因

1. **Principal URL 解析过于严格**
   - 飞书使用非标准的 `/u_xxx/` 路径格式，而非标准的 `/principals/users/xxx/`
   - 原有正则匹配逻辑无法识别飞书的路径格式
   - 导致 `current-user-principal` 发现失败，无法获取用户主目录

2. **事件获取机制不兼容**
   - 飞书 CalDAV 不支持标准的 `REPORT calendar-query` 请求直接返回 `calendar-data`
   - 标准 CalDAV 允许在 REPORT 请求中包含 `<calendar-data>` 元素，直接返回事件内容
   - 飞书仅返回事件的 `href` 引用，需要额外的 GET 请求获取实际 iCal 内容

3. **时区处理问题**
   - iCal 时间解析未正确处理不带 `Z` 后缀的时间戳
   - 钉钉 CalDAV 同样存在兼容性问题（在后续提交中一并修复）

### 业务影响

- 飞书用户无法在小河日历中查看其飞书日程
- 影响日历同步功能的完整性和可靠性
- 限制了外部日历集成的适用范围

---

## What Changes

### 1. Principal URL 解析修复

**修改文件**: `src-tauri/src/caldav.rs`

- 支持飞书非标准的 `/u_xxx/` 路径格式
- 优先匹配 `current-user-principal` 元素内的 `href` 内容
- 添加 fallback 机制，按优先级尝试多种路径格式：
  1. 标准 `/principals/users/xxx/`
  2. 飞书 `/u_xxx/`
  3. 其他常见格式

### 2. 事件获取两阶段机制

**新增结构体**: `EventRef`
```rust
pub struct EventRef {
    pub href: String,
    pub etag: Option<String>,
}
```

**新增方法**: `fetch_event_ical`
- 先通过 `REPORT calendar-query` 获取事件 href 列表
- 再逐个发送 `GET` 请求获取完整 iCal 内容
- 合并返回完整的 `CalendarEvent` 列表

### 3. 数据库迁移逻辑

**修改文件**: `src/utils/database.ts`

- 添加 `columnExists` 辅助函数检查列是否存在
- 添加 `runMigrations` 函数执行数据库迁移
- 自动检测并添加缺失的列（`external_id`, `location`）
- 保持向后兼容性，旧数据库自动升级

### 4. 时区处理修复

**修改文件**: `src-tauri/src/caldav.rs`

- 修复 `parse_ical_datetime` 函数，正确处理不带 `Z` 后缀的时间
- 按 iCal 规范将浮动时间解释为本地时区时间
- 支持钉钉 CalDAV 兼容性（渐进式发现策略）

### 5. 调试日志增强

- 记录 HTTP 请求/响应详情
- 记录 CalDAV 发现过程中的关键步骤
- 便于问题排查和兼容性调试

### 6. 文档更新

**新增文件**: `.agents/skills/calendar-business-flows/references/external-calendar-integration.md`

- 记录飞书 CalDAV 兼容性处理方案
- 记录钉钉 CalDAV 兼容性处理方案
- 提供问题诊断和解决方案参考

---

## Capabilities

### 新增能力

| 能力 | 描述 |
|------|------|
| 飞书日历同步 | 支持飞书 CalDAV 日历事件获取和显示 |
| 钉钉日历同步 | 支持钉钉 CalDAV 日历事件获取（只读） |
| 自动数据库迁移 | 旧版本数据库自动升级到新结构 |
| 增强兼容性 | 支持非标准 CalDAV 服务器实现 |

### 改进能力

| 能力 | 改进内容 |
|------|----------|
| Principal 发现 | 支持多种路径格式的 Principal URL 发现 |
| 事件获取 | 兼容直接返回和不直接返回 calendar-data 的服务器 |
| 时区处理 | 正确解析浮动时间和 UTC 时间 |

---

## Impact

### 影响范围

| 模块 | 影响程度 | 说明 |
|------|----------|------|
| CalDAV 客户端 | 高 | 核心修改，影响所有外部日历同步 |
| 数据库层 | 中 | 新增迁移逻辑，影响事件存储 |
| 日历视图 | 低 | 间接影响，事件显示更可靠 |
| 设置页面 | 无 | 无 UI 变更 |

### 兼容性

- **向后兼容**: 数据库迁移自动执行，旧版本数据无影响
- **服务器兼容**: 保持对标准 CalDAV 服务器的兼容
- **新增支持**: 飞书、钉钉 CalDAV 服务

### 测试覆盖

- 单元测试: 67 个测试用例全部通过
- 集成测试: 7 个飞书 CalDAV 测试用例
- 测试覆盖率: 涵盖 Principal 发现、事件获取、时区处理

---

## Non-Goals

本变更**不包含**以下内容：

- 修改日历视图 UI
- 添加新的外部日历服务支持（如 Google Calendar API）
- 实现事件的创建/更新/删除同步（飞书/钉钉只读）
- 重构整个 CalDAV 模块架构
- 添加用户配置选项
