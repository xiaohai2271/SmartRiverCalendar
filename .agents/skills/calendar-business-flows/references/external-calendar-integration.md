# 外部日历集成核心业务流程

## 1. 添加外部日历账号流程

### 1.1 流程图

```
用户操作                    前端                         后端 (Rust)
   │                        │                              │
   │  点击"添加外部日历"     │                              │
   ├───────────────────────►│                              │
   │                        │                              │
   │  填写表单              │                              │
   │  - 类型(Exchange/CalDAV)                              │
   │  - 服务器地址           │                              │
   │  - 用户名              │                              │
   │  - 密码               │                              │
   │                        │                              │
   │  点击"连接"            │                              │
   ├───────────────────────►│  safeInvoke(                 │
   │                        │    'connect_exchange',       │
   │                        │    {serverUrl, username, pwd}│
   │                        │  )                          │
   │                        ├─────────────────────────────►│
   │                        │                              │  创建 EwsClient
   │                        │                              │  发送 SOAP 请求
   │                        │                              │  验证连接
   │                        │                              │  获取日历列表
   │                        │                              │  加密密码
   │                        │                              │  保存到 accounts 表
   │                        │◄─────────────────────────────┤
   │                        │  返回 AccountInfo            │
   │                        │  + 日历列表                  │
   │                        │                              │
   │  显示发现的日历        │                              │
   │◄───────────────────────┤                              │
   │                        │                              │
   │  选择要同步的日历      │                              │
   │  点击"添加选中的日历"   │                              │
   ├───────────────────────►│  为每个选中的日历:           │
   │                        │  - 创建 Calendar 记录        │
   │                        │  - 创建 sync_state 记录      │
   │                        │  - 触发初始同步              │
   │                        ├─────────────────────────────►│
   │                        │                              │  执行初始同步
   │                        │                              │  获取事件数据
   │                        │                              │  保存到 events 表
   │                        │◄─────────────────────────────┤
   │                        │  返回同步结果                │
   │                        │                              │
   │  显示添加成功          │                              │
   │◄───────────────────────┤                              │
```

### 1.2 关键步骤

1. **用户输入**: 选择日历类型（Exchange/CalDAV），填写服务器地址、用户名、密码
2. **连接验证**: 后端创建对应客户端，发送协议请求验证连接
3. **日历发现**: 获取服务器上的日历列表
4. **凭证加密**: 使用 AES-256-GCM 加密密码后存储
5. **日历选择**: 用户选择要同步的日历
6. **初始同步**: 获取过去 30 天 + 未来 90 天的事件数据

---

## 2. 双向同步流程

### 2.1 定时自动同步

```
┌─────────────────────────────────────────────────────────────┐
│                    SyncTimer (后台定时器)                    │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│  │ 启动定时器   │───►│ 等待间隔    │───►│ 触发同步    │    │
│  │ (15分钟)    │    │ (interval)  │    │ (sync_all)  │    │
│  └─────────────┘    └─────────────┘    └──────┬──────┘    │
│        ▲                                       │           │
│        │                                       ▼           │
│        │              ┌─────────────────────────────┐     │
│        └──────────────│  SyncEngine.sync_all()      │     │
│                       │  遍历所有启用的账号          │     │
│                       └─────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 单账号同步流程

```
SyncEngine.sync_account(account_id)
    │
    ├─► 1. 获取账号信息（从数据库）
    │
    ├─► 2. 根据账号类型创建客户端
    │     - Exchange → EwsClient
    │     - CalDAV → CalDavClient
    │
    ├─► 3. 获取服务器事件
    │     - 计算同步时间窗口
    │     - 发送请求获取事件列表
    │
    ├─► 4. 获取本地事件
    │     - 从数据库查询该账号的事件
    │
    ├─► 5. 对比差异
    │     ┌─────────────────────────────────────┐
    │     │ 服务器事件    本地事件    操作       │
    │     ├─────────────────────────────────────┤
    │     │ 存在         不存在     → 新增到本地 │
    │     │ 存在         存在(不同) → 更新本地   │
    │     │ 不存在       存在       → 删除本地   │
    │     │ (本地新增)   不存在     → 同步到服务器│
    │     │ (本地修改)   存在       → 同步到服务器│
    │     └─────────────────────────────────────┘
    │
    ├─► 6. 执行同步操作
    │     - 服务器 → 本地: 保存到数据库
    │     - 本地 → 服务器: 调用客户端 API
    │
    ├─► 7. 冲突解决（服务器优先）
    │     - 如果本地和服务器都有修改
    │     - 以服务器版本为准
    │
    ├─► 8. 更新同步状态
    │     - 更新 sync_token
    │     - 更新 last_sync_at
    │
    └─► 9. 返回同步结果
          - added: 新增数量
          - updated: 更新数量
          - deleted: 删除数量
          - errors: 错误列表
```

### 2.3 手动触发同步

```
用户点击"立即同步"按钮
    │
    ▼
SettingsView.syncCalendar(accountId)
    │
    ▼
SyncService.syncNow(accountId)
    │
    ▼
safeInvoke('sync_now', { accountId })
    │
    ▼
Rust: sync_engine.sync_account(account_id)
    │
    ▼
Tauri 事件: emit('sync-status-changed', result)
    │
    ▼
前端监听: triggerSyncComplete(result)
    │
    ▼
更新 UI: 同步状态、最后同步时间
```

---

## 3. 离线先行与实时加载 (Offline-First 架构)

为了在断网环境下提供无缝体验并保证数据的时效性，应用采取 "**离线先行 + 实时按需获取**" 双规策略。

### 3.1 初始启动加载（离线先行）

```
程序启动
    │
    ▼
CalendarStore.initialize()
    │
    ├─► 从本地 SQLite `events` 表中读取所有事件（包含 local 和 external）
    │
    └─► 瞬间完成界面渲染，无需等待网络请求，断网下依然可见完整日历。
```

### 3.2 翻页动态刷新（实时拉取与落库合并）

当用户切换月份/周（即 `currentDateRange` 发生变化时）：

```
watch(currentDateRange, (newRange) => {
    loadExternalEvents(newRange.start, newRange.end)
})
    │
    ▼
向后端发起 `get_external_events` (传递检索范围与账号凭证)
    │
    ▼
Rust 转换调用 CalDAV Client 发出 HTTP 请求获取事件
    │
    ▼
前端接收最新数据并进入与 SQLite 的协调阶段：
    │
    ├─► 1. 查找缓存：查出当前范围内，归属于该外部账号的本地 SQLite 事件 `oldEvents`
    │
    ├─► 2. 差分删除：如果 `oldEvents` 中的事件不在服务器最新返回库中，调用 `dbDeleteEvent` 删除本地"幽灵事件"
    │
    ├─► 3. 同步落库：遍历获取的新事件，调用 `saveEvent` 全部覆盖更新进 SQLite 数据库
    │
    └─► 4. 刷新 Vue Store：内存中剥离旧事件，注入最新事件触发 UI 更新。
```

---

## 4. 事件增删改操作流程 (外部日历)

### 4.1 创建事件（外部日历）

```
用户在日历视图创建事件
    │
    ▼
CalendarStore.addEvent(event)
    │
    ├─► 检查目标日历类型
    │
    ├─► 如果是本地日历:
    │     └─► 直接保存到数据库
    │
    └─► 如果是外部日历:
          │
          ▼
        safeInvoke('create_external_event', {
          accountId, ...authParams, calendarUrl, event
        })
          │
          ▼
        Rust: CalDAV PUT 请求上传 iCal 生成事件
          │
          ▼
        返回 ExternalEventResult(success, externalId)
          │
          ▼
        合并外部ID，并立即存入本地 SQLite (saveEvent)
```

### 4.2 修改事件（外部日历）

```
用户编辑事件
    │
    ▼
CalendarStore.updateEvent(id, updates)
    │
    ├─► 根据 external_id 及类型判断调用方
    │
    └─► 外部事件:
          │
          ▼
        safeInvoke('update_external_event', {
          accountId, ...authParams, calendarUrl, event: 完整事件对象
        })
          │
          ▼
        Rust: CalDAV PUT 请求更新 iCal
          │
          ▼
        成功后更新 Vue store，并同步 saveEvent 进本地 SQLite
```

### 4.3 删除事件（外部日历）

```
用户删除事件
    │
    ▼
CalendarStore.deleteEvent(id)
    │
    ├─► 若是本机事件则仅调用 dbDeleteEvent
    │
    └─► 如果是外部事件:
          │
          ▼
        safeInvoke('delete_external_event', {
          ...authParams, eventId: id
        })
          │
          ▼
        前端收到后端成功返回后
          │
          ▼
        触发本地 dbDeleteEvent 彻底删除
```

---

## 5. 凭证管理流程

### 4.1 密码加密存储

```
用户输入密码
    │
    ▼
前端传递明文密码到后端
    │
    ▼
Rust: crypto::encrypt_password(plaintext)
    │
    ├─► 1. 派生密钥
    │     derive_key()
    │     - 获取 hostname
    │     - 组合 hostname + 固定盐值
    │     - SHA-256 哈希 → 32 字节密钥
    │
    ├─► 2. 生成随机 nonce (12 字节)
    │
    ├─► 3. AES-256-GCM 加密
    │     cipher.encrypt(nonce, plaintext)
    │
    ├─► 4. 组合 nonce + ciphertext
    │
    └─► 5. Base64 编码
          返回: base64(nonce + ciphertext)
    │
    ▼
存储到 accounts.encrypted_password
```

### 4.2 密码解密使用

```
需要连接外部服务器时
    │
    ▼
从数据库读取 encrypted_password
    │
    ▼
Rust: crypto::decrypt_password(ciphertext)
    │
    ├─► 1. Base64 解码
    │
    ├─► 2. 分离 nonce 和 ciphertext
    │
    ├─► 3. 派生密钥（同加密时）
    │
    ├─► 4. AES-256-GCM 解密
    │     cipher.decrypt(nonce, ciphertext)
    │
    └─► 5. 转换为 UTF-8 字符串
          返回: 明文密码
    │
    ▼
用于 HTTP Basic 认证
```

---

## 6. 设置页面交互流程

### 5.1 日历管理界面

```
┌─────────────────────────────────────────────────┐
│  设置 > 日历管理                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  我的日历 (本地)                    [✓ 可见]    │
│                                                 │
│  工作日历 (Exchange)                [✓ 可见]    │
│    最后同步: 2026-03-24 10:30                   │
│    状态: 已同步                                 │
│    [立即同步]  [删除账号]                        │
│                                                 │
│  个人日历 (CalDAV)                  [✓ 可见]    │
│    最后同步: 2026-03-24 10:25                   │
│    状态: 同步中...                              │
│    [立即同步(禁用)]  [删除账号]                  │
│                                                 │
│  [+ 添加外部日历]                                │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 5.2 添加外部日历对话框

```
┌─────────────────────────────────────────────────┐
│  添加外部日历                          [×]      │
├─────────────────────────────────────────────────┤
│                                                 │
│  日历类型                                       │
│  [Exchange ▼]                                   │
│                                                 │
│  服务器地址                                     │
│  [https://mail.example.com/EWS/Exchange.asmx]  │
│                                                 │
│  用户名                                         │
│  [user@example.com]                             │
│                                                 │
│  密码                                          │
│  [********]                                     │
│                                                 │
│  [连接]                                         │
│                                                 │
│  ── 连接成功后显示 ──                           │
│                                                 │
│  发现的日历:                                    │
│  [✓] 日历                                       │
│  [✓] 工作日历                                   │
│  [ ] 生日                                       │
│                                                 │
│  [取消]  [添加选中的日历]                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 7. 错误处理流程

### 6.1 连接错误

```
连接失败
    │
    ├─► 网络错误 → 显示"网络连接失败，请检查网络"
    ├─► 认证失败 → 显示"用户名或密码错误"
    ├─► 超时 → 显示"连接超时，请检查服务器地址"
    └─► 服务器错误 → 显示"服务器错误，请稍后重试"
```

### 6.2 同步错误

```
同步失败
    │
    ├─► 部分失败 → 继续处理剩余事件，记录错误
    ├─► 全部失败 → 更新状态为 "error"，显示错误信息
    └─► 网络中断 → 静默失败，下次同步重试
```

---

## 8. 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `SYNC_DEFAULT_INTERVAL_MINUTES` | 15 | 自动同步间隔（分钟） |
| `SYNC_WINDOW_PAST_DAYS` | 30 | 同步过去多少天的事件 |
| `SYNC_WINDOW_FUTURE_DAYS` | 90 | 同步未来多少天的事件 |
| 请求超时 | 30 秒 | HTTP 请求超时时间 |

---

## 9. CalDAV 服务商兼容性

### 9.1 飞书 CalDAV 特殊处理

飞书 CalDAV 服务器有一些非标准行为，需要特殊处理：

#### Principal URL 格式

飞书使用 `/u_xxx/` 格式的用户路径，而非标准的 `/principals/users/xxx/`：

```
标准格式: /principals/users/username/
飞书格式: /u_xptl9894/
```

代码通过优先匹配 `current-user-principal` 元素内的 href，并使用 fallback 机制支持多种路径格式。

#### 日历主路径

飞书的 calendar-home-set 响应可能直接返回日历 URL，需要在解析时特别处理。

#### 事件获取 - 两阶段机制

飞书 CalDAV 服务器**不支持**通过 REPORT calendar-query 请求直接返回 `calendar-data` 内容：

```xml
<!-- 飞书返回的响应 -->
<D:propstat>
  <D:prop>
    <C:calendar-data/>
  </D:prop>
  <D:status>HTTP/1.1 404 Not Found</D:status>
</D:propstat>
```

因此需要实现**两阶段获取**：

```
阶段 1: REPORT calendar-query
    │
    ├─► 获取事件 href 列表
    │   /u_xptl9894/calendar-id/event-1.ics
    │   /u_xptl9894/calendar-id/event-2.ics
    │
    └─► 不返回 calendar-data 内容

阶段 2: GET 请求
    │
    ├─► 对每个事件 href 发送 GET 请求
    │
    └─► 获取完整的 iCal 数据
        BEGIN:VCALENDAR
        VERSION:2.0
        BEGIN:VEVENT
        UID:event-1
        SUMMARY:事件标题
        ...
        END:VEVENT
        END:VCALENDAR
```

### 9.2 兼容性测试

所有 CalDAV 实现都通过以下测试：

| 测试项 | 状态 |
|--------|------|
| 连接验证 (OPTIONS) | ✅ |
| Principal URL 发现 | ✅ |
| Calendar-home-set 获取 | ✅ |
| 日历列表获取 | ✅ |
| 事件列表获取 | ✅ |
| iCal 解析 | ✅ |
| 全天事件处理 | ✅ |
| 时区处理 | ✅ |

---

## 10. iCal 时间解析与时区处理

### 10.1 iCal 时间格式规范 (RFC 5545)

iCal 格式定义了三种日期时间格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| UTC 时间 | `20240320T090000Z` | 以 Z 结尾，表示 UTC 时间 |
| 本地/浮动时间 | `20240320T090000` | 不带 Z，表示用户本地时区的时间 |
| 日期（全天事件） | `20240320` | 仅日期，无时间 |

### 10.2 时区处理逻辑

```
parse_ical_datetime(datetime, all_day)
    │
    ├─► all_day = true
    │     │
    │     └─► 解析为 UTC 日期的 00:00:00
    │         例如: 20240320 → 2024-03-20 00:00:00 UTC
    │
    └─► all_day = false
          │
          ├─► datetime 以 'Z' 结尾
          │     │
          │     └─► 解析为 UTC 时间
          │         例如: 20240320T090000Z → 2024-03-20 09:00:00 UTC
          │
          └─► datetime 不带 'Z'
                │
                └─► 解析为本地时区时间，转换为 UTC 时间戳
                    例如（北京时间 UTC+8）:
                    20240320T090000 → 本地 09:00 = UTC 01:00
```

### 10.3 关键代码位置

时间解析的核心实现在 `src-tauri/src/caldav.rs` 的 `parse_ical_datetime` 函数：

```rust
fn parse_ical_datetime(&self, datetime: &str, all_day: bool) -> Result<i64, String> {
    if all_day {
        // 全天事件：按 UTC 日期处理
        let date = chrono::NaiveDate::parse_from_str(datetime, "%Y%m%d")?;
        Ok(date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp())
    } else if datetime.ends_with('Z') {
        // UTC 时间：直接转换
        let naive = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%SZ")?;
        Ok(naive.and_utc().timestamp())
    } else {
        // 本地时间：转换为本地时区后提取 UTC 时间戳
        let naive = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%S")?;
        let local = naive.and_local_timezone(chrono::Local).single()?;
        Ok(local.timestamp())
    }
}
```

### 10.4 时区问题修复记录

#### 问题描述

从 CalDAV 账户（如飞书）获取的日程事件时间对不上，存在时区偏差。

#### 根本原因

原代码将不带 `Z` 后缀的 iCal 时间错误地当作 UTC 时间处理：

```rust
// 错误的原代码
let res = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%S")?;
Ok(res.and_utc().timestamp())  // 强制当作 UTC，导致时区错误！
```

例如，飞书返回的北京时间 `09:00`（实际是 UTC+8）被错误当作 UTC `09:00`，导致 8 小时偏差。

#### 修复方案

按照 iCal 规范，将不带 `Z` 的时间解释为本地时区时间：

```rust
// 修复后的代码
let naive = chrono::NaiveDateTime::parse_from_str(datetime, "%Y%m%dT%H%M%S")?;
let local_datetime = naive.and_local_timezone(chrono::Local).single()?;
Ok(local_datetime.timestamp())  // 正确转换为 UTC 时间戳
```

#### 修复时间

2026-03-30

### 10.5 时间单位约定

系统内各层的时间单位约定：

| 层级 | 时间单位 | 说明 |
|------|----------|------|
| Rust 后端 (caldav.rs) | 秒 | Unix 时间戳（秒） |
| Tauri 命令接口 | 毫秒 | 输入/输出转换为毫秒 |
| 前端 TypeScript | 毫秒 | `Date.now()` 返回毫秒 |
| SQLite 数据库 | 毫秒 | 存储 `Date.now()` 值 |

转换示例（commands.rs）：

```rust
// 获取事件：输入毫秒 → 转秒
let events = client.fetch_events(&calendar_url, start_time / 1000, end_time / 1000)?;

// 返回事件：秒 → 转毫秒
start_time: e.start_time * 1000,
end_time: e.end_time * 1000,
```
