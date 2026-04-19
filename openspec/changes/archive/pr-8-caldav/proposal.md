# 提案：fix(caldav): 修复飞书 CalDAV 日历同步问题

## Why

此变更记录从 GitHub 迁移而来。

- **GitHub PR**: #8

**原始需求：**

问题修复:
1. 修复 parse_principal_url 匹配逻辑过于严格的问题
   - 支持飞书非标准的 /u_xxx/ 路径格式
   - 优先匹配 current-user-principal 元素内的 href
   - 添加 fallback 机制支持多种路径格式

2. 实现事件获取的两阶段机制
   - 飞书 CalDAV 不支持 REPORT calendar-query 直接返回 calendar-data
   - 先获取事件 href 列表，再逐个 GET 获取 iCal 内容
   - 新增 EventRef 结构体和 fetch_event_ical 方法

其他改进:
- 自动规范化服务器 URL (添加 https:// 前缀)
- 增强调试日志，记录 HTTP 请求/响应详情
- 新增飞书 CalDAV 集成测试 (7 个测试用例)
- 新增单元测试覆盖事件解析 (24 个测试用例)
- 更新外部日历集成文档，记录飞书兼容性

测试结果:
- 单元测试: 67 passed
- 集成测试: 飞书 CalDAV 连接、日历列表、事件获取全部通过

## What Changes

详见设计文档。

## Capabilities

### New Capabilities

- 功能实现

### Modified Capabilities

- 相关模块改进

## Impact

- 状态：已完成归档
