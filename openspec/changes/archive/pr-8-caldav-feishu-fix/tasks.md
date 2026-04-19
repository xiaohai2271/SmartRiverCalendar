# 飞书 CalDAV 任务清单

## 1. Principal URL 解析修复 [已完成]

### 1.1 修复 parse_principal_url 匹配逻辑

**状态**: ✅ 已完成

**描述**: 修复 Principal URL 正则匹配过于严格的问题，支持飞书非标准路径格式。

**实现内容**:
- 支持 `/u_xxx/` 路径格式（飞书特有）
- 优先匹配 `current-user-principal` 元素内的 `href`
- 添加 fallback 机制支持多种路径格式

**涉及文件**:
- `src-tauri/src/caldav.rs`

**验收标准**:
- [x] 飞书 Principal URL 正确解析
- [x] 标准 CalDAV 服务器仍兼容
- [x] 单元测试通过

---

### 1.2 自动规范化服务器 URL

**状态**: ✅ 已完成

**描述**: 用户输入服务器 URL 时自动添加 `https://` 前缀。

**实现内容**:
- 检测 URL 是否包含协议前缀
- 无前缀时自动添加 `https://`

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

## 2. 事件获取机制重构 [已完成]

### 2.1 实现 EventRef 结构体

**状态**: ✅ 已完成

**描述**: 新增事件引用结构体，用于存储 REPORT 返回的事件列表。

**实现内容**:
```rust
pub struct EventRef {
    pub href: String,    // 事件 URL
    pub etag: Option<String>,  // ETag 用于缓存验证
}
```

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

### 2.2 实现 fetch_event_ical 方法

**状态**: ✅ 已完成

**描述**: 实现单个事件的 iCal 内容获取。

**实现内容**:
- 发送 GET 请求到事件 href
- 解析 iCal 内容
- 返回 CalendarEvent 结构

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

### 2.3 重构事件获取流程

**状态**: ✅ 已完成

**描述**: 实现两阶段事件获取机制，兼容飞书 CalDAV。

**实现流程**:
1. 发送 `REPORT calendar-query` 获取事件 href 列表
2. 对每个 href 发送 `GET` 请求获取 iCal 内容
3. 解析并返回完整事件列表

**涉及文件**:
- `src-tauri/src/caldav.rs`

**验收标准**:
- [x] 飞书事件正确获取
- [x] 标准 CalDAV 服务器仍兼容
- [x] 事件数据完整

---

## 3. 时区处理修复 [已完成]

### 3.1 修复 parse_ical_datetime 函数

**状态**: ✅ 已完成

**描述**: 正确处理 iCal 时间解析，支持浮动时间和 UTC 时间。

**实现内容**:
- 带 `Z` 后缀的时间转换为本地时区
- 不带 `Z` 后缀的时间解释为本地时区时间

**涉及文件**:
- `src-tauri/src/caldav.rs`

**验收标准**:
- [x] UTC 时间正确解析
- [x] 浮动时间正确解析
- [x] 测试用例通过

---

## 4. 数据库迁移 [已完成]

### 4.1 添加数据库迁移逻辑

**状态**: ✅ 已完成

**描述**: 实现自动数据库迁移，添加缺失的列。

**实现内容**:
- `columnExists` 辅助函数检查列是否存在
- `runMigrations` 函数执行迁移
- 自动添加 `external_id` 和 `location` 列

**涉及文件**:
- `src/utils/database.ts`

**验收标准**:
- [x] 旧数据库自动升级
- [x] 新数据库正常工作
- [x] 无数据丢失

---

### 4.2 修复 saveEvent 函数

**状态**: ✅ 已完成

**描述**: 更新事件时保留原有的 `created_at` 时间戳。

**涉及文件**:
- `src/utils/database.ts`

---

## 5. 钉钉 CalDAV 兼容性 [已完成]

### 5.1 实现渐进式发现策略

**状态**: ✅ 已完成

**描述**: 标准发现失败时尝试常见路径模式。

**实现内容**:
- 尝试 `/.well-known/caldav`
- 回退到 `/dav/`
- 回退到 `/caldav/`
- 最后使用用户输入路径

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

### 5.2 移除 OPTIONS DAV 头检查

**状态**: ✅ 已完成

**描述**: 钉钉 OPTIONS 不返回 DAV 头，需要跳过检查。

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

### 5.3 优化事件更新策略

**状态**: ✅ 已完成

**描述**: 采用增量更新策略处理事件修改。

**实现内容**:
- GET 原始数据
- 修改指定字段
- PUT 更新

**涉及文件**:
- `src-tauri/src/caldav.rs`

**备注**: 钉钉 CalDAV 不支持修改事件，仅支持查看和删除。

---

## 6. 测试覆盖 [已完成]

### 6.1 新增飞书 CalDAV 集成测试

**状态**: ✅ 已完成

**描述**: 添加 7 个飞书 CalDAV 集成测试用例。

**测试覆盖**:
- Principal 发现
- 日历列表获取
- 事件获取
- 时区处理
- 错误处理

**涉及文件**:
- `src-tauri/tests/feishu_caldav_test.rs`

---

### 6.2 新增事件解析单元测试

**状态**: ✅ 已完成

**描述**: 添加 24 个事件解析单元测试。

**测试覆盖**:
- iCal 解析
- 时间格式处理
- 事件属性提取

**涉及文件**:
- `src-tauri/src/caldav.rs`

---

## 7. 文档更新 [已完成]

### 7.1 更新外部日历集成文档

**状态**: ✅ 已完成

**描述**: 记录飞书和钉钉 CalDAV 兼容性处理方案。

**涉及文件**:
- `.agents/skills/calendar-business-flows/references/external-calendar-integration.md`

---

## 验收结果

### 测试执行

```
单元测试: 67 passed
集成测试: 7 passed (飞书 CalDAV)
```

### 功能验证

| 功能 | 状态 |
|------|------|
| 飞书 Principal 发现 | ✅ 通过 |
| 飞书日历列表获取 | ✅ 通过 |
| 飞书事件获取 | ✅ 通过 |
| 钉钉 Principal 发现 | ✅ 通过 |
| 钉钉日历列表获取 | ✅ 通过 |
| 钉钉事件获取 | ✅ 通过 |
| 数据库迁移 | ✅ 通过 |
| 时区处理 | ✅ 通过 |

### 提交记录

| 提交 | 描述 |
|------|------|
| `1a1d951` | fix(caldav): 修复飞书 CalDAV 日历同步问题 |
| `71ad499` | fix(db): 添加数据库迁移逻辑修复列缺失问题 |
| `e925154` | fix(caldav): 修复 CalDAV 时区处理和钉钉兼容性问题 |
