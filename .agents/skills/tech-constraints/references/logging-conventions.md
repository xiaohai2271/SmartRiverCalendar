# 日志与问题排查规范

## 目录
1. [日志原则](#日志原则)
2. [日志级别](#日志级别)
3. [关键节点日志](#关键节点日志)
4. [日志清理策略](#日志清理策略)
5. [问题排查工具](#问题排查工具)

## 日志原则

1. **关键节点必记录**: 业务流程关键节点必须有日志输出，方便问题排查
2. **量级可控**: 控制日志输出量，避免日志文件过大影响性能
3. **信息有效**: 日志应包含足够的上线文信息（操作、参数、结果）
4. **分级明确**: 使用合理的日志级别区分信息重要程度

## 日志级别

### 前端 (TypeScript)

| 级别 | 方法 | 使用场景 | 示例 |
|------|------|----------|------|
| debug | `console.debug` | 开发调试信息，生产环境不输出 | 变量值、中间状态 |
| info | `console.log` | 关键业务流程节点 | 事件创建成功、数据同步完成 |
| warn | `console.warn` | 潜在问题、降级处理 | API 超时重试、数据格式兼容 |
| error | `console.error` | 错误和异常 | 网络请求失败、数据操作异常 |

### 后端 (Rust)

| 级别 | 宏 | 使用场景 |
|------|-----|----------|
| debug | `log::debug!` | 开发调试 |
| info | `log::info!` | 关键操作记录 |
| warn | `log::warn!` | 可恢复的异常 |
| error | `log::error!` | 不可恢复的错误 |

## 关键节点日志

### 前端必须记录日志的节点

```typescript
// 1. 数据操作
console.log(`[EventService] 创建事件: title="${event.title}", calendarId=${event.calendarId}`)
console.log(`[EventService] 事件创建成功: id=${result.id}`)
console.error(`[EventService] 创建事件失败:`, error)

// 2. Tauri invoke 调用
console.log(`[invoke] 调用 create_event, 参数:`, { title, startTime })
console.error(`[invoke] create_event 调用失败:`, error)

// 3. 状态变更
console.log(`[CalendarStore] 切换视图: ${oldView} → ${newView}`)
console.log(`[CalendarStore] 导航日期: ${formatDate(newDate)}`)

// 4. 外部服务调用
console.log(`[SyncService] 开始同步日历: calendarId=${id}`)
console.log(`[SyncService] 同步完成: 新增${added}条, 更新${updated}条`)
console.error(`[SyncService] 同步失败:`, error)

// 5. 生命周期事件
console.log(`[App] 应用启动完成, 耗时: ${elapsed}ms`)
console.log(`[App] 应用即将关闭`)
```

### Rust 后端必须记录日志的节点

```rust
// 1. Command 入口
log::info!("[create_event] 收到请求: title={}", event.title);

// 2. 数据库操作
log::info!("[create_event] 写入数据库: id={}", event.id);
log::error!("[create_event] 数据库写入失败: {}", err);

// 3. 外部 API 调用
log::info!("[sync] 开始从服务器拉取数据: url={}", url);
log::error!("[sync] API 请求失败: status={}, body={}", status, body);

// 4. 系统事件
log::info!("[tray] 系统托盘已创建");
log::info!("[update] 检测到新版本: v{}", new_version);
```

### 日志格式规范

```
[{模块名}] {操作描述}: {关键参数}={值}
```

```typescript
// ✅ 好的日志
console.log(`[CalendarStore] 切换视图: month → week`)
console.log(`[EventService] 创建事件成功: id=abc123, calendarId=cal_1`)
console.error(`[SyncService] 同步失败: 网络超时, retryCount=3`)

// ❌ 不好的日志
console.log('切换了')                    // 信息不足，无法定位
console.log(event)                       // 对象无结构化标识
console.error('error')                   // 无上下文信息
```

## 日志清理策略

### 前端日志
- **开发环境**: 保留所有级别日志
- **生产环境**: 仅保留 warn 和 error 级别
- 可通过环境变量控制日志级别: `VITE_LOG_LEVEL=info`

### 后端日志 (Rust)
- 日志文件路径: `{app_data_dir}/logs/`
- 日志文件命名: `app_{date}.log` (如 `app_2026-04-26.log`)
- **保留策略**: 保留最近 7 天日志，超过 7 天的自动删除
- **大小限制**: 单日日志文件不超过 10MB，超过自动轮转
- 启动时执行日志清理

### 实现方案参考

```rust
// 日志轮转配置示例
use log4rs::config::{Appender, Config, Root};
use log4rs::append::rolling_file::{
    RollingFileAppender,
    policy::compound::CompoundPolicy,
    policy::compound::trigger::size::SizeTrigger,
    policy::compound::roll::fixed_window::FixedWindowRoller,
};

// 配置日志轮转: 单文件最大 10MB，保留 7 个文件
let roller = FixedWindowRoller::builder()
    .build("logs/app_{}.log", 7)
    .unwrap();
let size_trigger = SizeTrigger::new(10 * 1024 * 1024); // 10MB
let policy = CompoundPolicy::new(Box::new(size_trigger), Box::new(roller));
```

## 问题排查工具

### 调试页面
- 项目已内置隐藏调试页面（访问方式见 feature/add-debug-page）
- 可查看应用状态、Store 数据、日志信息

### 排查步骤
1. **检查浏览器控制台**: 前端日志 (F12 打开开发者工具)
2. **检查 Rust 日志**: 查看 `logs/` 目录下的日志文件
3. **使用调试页面**: 查看运行时状态
4. **复现问题**: 记录完整的操作步骤和环境信息
5. **收集信息**: 日志、截图、系统信息 (OS 版本、应用版本)

### Bug 报告模板
```
## 问题描述
[简要描述问题]

## 复现步骤
1.
2.
3.

## 期望行为
[期望的正确行为]

## 实际行为
[实际的错误行为]

## 环境信息
- 应用版本:
- 操作系统:
- 相关日志:
```
