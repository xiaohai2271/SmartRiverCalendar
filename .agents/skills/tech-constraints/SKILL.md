---
name: tech-constraints
description: SmartRiverCalendar项目技术约束文档。当需要了解架构约束、数据库规范、日志排查约定、或进行技术方案设计时使用。包含数据视图分离架构、数据库字段规范、问题排查约定等核心技术约束。
---

# 技术约束文档

## 概述

本 skill 记录小河日历项目的核心技术约束，所有开发人员（包括 AI 智能体）必须遵守。

## 约束列表

### 1. 架构约束：数据与视图分离
- **原则**: 展示层不直接操作数据库
- **数据流**: 前端 → Tauri invoke → Rust 后端 → SQLite
- **详细文档**: 参考 [references/architecture-constraints.md](references/architecture-constraints.md)

### 2. 数据库规范
- **字段命名**: 数据库使用 snake_case，前端使用 camelCase
- **必要字段**: 每张表必须包含 id、created_at、updated_at
- **详细文档**: 参考 [references/database-conventions.md](references/database-conventions.md)

### 3. 日志与问题排查规范
- **关键节点日志**: 业务流程关键节点必须输出日志
- **日志级别**: 区分 info、warn、error
- **清理策略**: 合理的日志清理策略，避免日志文件过大
- **详细文档**: 参考 [references/logging-conventions.md](references/logging-conventions.md)

## 快速参考

### 架构分层
| 层级 | 技术 | 职责 |
|------|------|------|
| 展示层 | Vue 3 + Pinia | UI 渲染、用户交互、状态管理 |
| 服务层 | TypeScript Services | 业务逻辑封装、数据转换 |
| API 层 | Tauri invoke() | 前后端通信桥梁 |
| 数据层 | Rust + SQLite | 数据持久化、数据库操作 |

### 数据流方向
```
Vue 组件 → Pinia Store → Service → Tauri invoke() → Rust Command → Repository → SQLite
```
