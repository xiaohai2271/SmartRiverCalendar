# 飞书 CalDAV 设计文档

## Context

### 技术背景

小河日历使用 CalDAV 协议与外部日历服务同步。CalDAV 基于 WebDAV，使用 HTTP 扩展方法（PROPFIND, REPORT）进行日历和事件操作。

### 标准 CalDAV 流程

```
1. PROPFIND /.well-known/caldav → 发现服务器根路径
2. PROPFIND /dav/ → 获取 current-user-principal
3. PROPFIND /principals/users/xxx/ → 获取 calendar-home-set
4. PROPFIND /calendars/xxx/ → 获取日历列表
5. REPORT /calendars/xxx/default/ → 获取事件（可包含 calendar-data）
```

### 飞书 CalDAV 特点

1. **非标准路径格式**: `/u_xxx/` 而非 `/principals/users/xxx/`
2. **不完整 REPORT 支持**: REPORT 返回 href 列表，不返回 calendar-data
3. **需要二次请求**: 每个事件需要单独 GET 获取 iCal 内容

### 钉钉 CalDAV 特点

1. **OPTIONS 不返回 DAV 头**: 需要跳过 DAV 能力检查
2. **非标准发现路径**: 需要尝试常见路径模式
3. **只读支持**: 不支持事件创建/修改

---

## Goals

### 主要目标

1. **修复飞书 CalDAV 同步问题**
   - 正确解析飞书的 Principal URL
   - 实现两阶段事件获取机制
   - 确保事件正确显示

2. **修复钉钉 CalDAV 同步问题**
   - 实现渐进式发现策略
   - 正确处理时区

3. **修复数据库兼容性问题**
   - 自动迁移旧数据库结构
   - 添加缺失的列

### 非目标 (Non-Goals)

- 不重构整个 CalDAV 模块
- 不添加新的外部日历服务
- 不实现双向同步（飞书/钉钉只读）
- 不修改前端 UI

---

## Decisions

### Decision 1: Principal URL 发现策略

**问题**: 飞书使用非标准路径格式，原有正则无法匹配。

**方案**: 采用多模式匹配 + fallback 机制。

```rust
// 优先级顺序：
// 1. current-user-principal 元素内的 href（最准确）
// 2. 正则匹配 /principals/users/xxx/（标准格式）
// 3. 正则匹配 /u_xxx/（飞书格式）
// 4. 直接使用用户输入路径
```

**理由**: 兼容标准和非标准实现，保证最大兼容性。

### Decision 2: 两阶段事件获取

**问题**: 飞书 REPORT 不返回 calendar-data。

**方案**: 
1. 发送 `REPORT calendar-query` 获取事件 href 列表
2. 对每个 href 发送 `GET` 请求获取 iCal 内容
3. 解析并返回完整事件列表

```rust
pub async fn fetch_events(&self) -> Result<Vec<CalendarEvent>> {
    // 阶段 1: 获取 href 列表
    let event_refs = self.fetch_event_refs().await?;
    
    // 阶段 2: 逐个获取 iCal 内容
    let mut events = Vec::new();
    for event_ref in event_refs {
        let ical = self.fetch_event_ical(&event_ref.href).await?;
        let event = self.parse_event(&event_ref.href, &ical)?;
        events.push(event);
    }
    
    Ok(events)
}
```

**权衡**: 增加了请求次数，但兼容性更好。

### Decision 3: 数据库迁移策略

**问题**: 旧数据库缺少 `external_id` 和 `location` 列。

**方案**: 启动时自动检测并添加缺失列。

```typescript
async function runMigrations(db: Database): Promise<void> {
    const columns = ['external_id', 'location'];
    for (const col of columns) {
        if (!(await columnExists(db, 'events', col))) {
            await db.execute(`ALTER TABLE events ADD COLUMN ${col} TEXT`);
        }
    }
}
```

**理由**: 无需手动迁移，用户体验好。

### Decision 4: 时区处理

**问题**: 不带 `Z` 后缀的时间被错误解析。

**方案**: 按 iCal 规范，浮动时间解释为本地时区。

```rust
fn parse_ical_datetime(dt: &str) -> Result<DateTime<Local>> {
    if dt.ends_with('Z') {
        // UTC 时间，转换为本地时区
        let utc = DateTime::parse_from_rfc3339(dt)?;
        Ok(utc.with_timezone(&Local))
    } else {
        // 浮动时间，解释为本地时区
        let naive = NaiveDateTime::parse_from_str(dt, "%Y%m%dT%H%M%S")?;
        Ok(Local.from_local_datetime(&naive).single().unwrap())
    }
}
```

### Decision 5: 渐进式发现策略

**问题**: 钉钉 OPTIONS 不返回 DAV 头。

**方案**: 标准发现失败时，尝试常见路径模式。

```rust
// 发现策略：
// 1. 标准 /.well-known/caldav 发现
// 2. 如果失败，尝试 /dav/
// 3. 如果仍失败，尝试 /caldav/
// 4. 最后尝试直接使用用户输入的路径
```

---

## Risks

### 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| 多次请求导致性能下降 | 中 | 可考虑并发 GET 请求 |
| 路径格式变化导致失效 | 低 | 多模式匹配提供 fallback |
| 时区解析错误 | 低 | 完整的测试覆盖 |
| 数据库迁移失败 | 低 | 迁移前备份，事务保护 |

### 已知限制

1. **飞书/钉钉只读**: 不支持事件创建、修改、删除同步
2. **性能**: 两阶段获取增加请求次数
3. **路径发现**: 可能存在其他非标准路径格式未覆盖

---

## Implementation Notes

### 关键代码位置

| 功能 | 文件 | 位置 |
|------|------|------|
| Principal 发现 | `src-tauri/src/caldav.rs` | `discover_principal()` |
| 事件获取 | `src-tauri/src/caldav.rs` | `fetch_events()`, `fetch_event_ical()` |
| 时区解析 | `src-tauri/src/caldav.rs` | `parse_ical_datetime()` |
| 数据库迁移 | `src/utils/database.ts` | `runMigrations()` |

### 测试覆盖

- `src-tauri/tests/feishu_caldav_test.rs`: 7 个集成测试
- `src-tauri/src/caldav.rs`: 24 个单元测试（内联）
- 总计: 67 个测试通过
