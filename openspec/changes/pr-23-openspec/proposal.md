# 提案：feat: 集成 OpenSpec 规格驱动开发框架并迁移历史记录

## Why

此变更记录从 GitHub 迁移而来。

- **GitHub PR**: #23

**原始需求：**

## Summary

- 初始化 OpenSpec v1.3.0 到项目中，为 AI 编码助手添加规格驱动开发能力
- 迁移 GitHub Issue/PR 历史记录到 OpenSpec 文档格式

## OpenSpec 集成

### 新增文件
- openspec/config.yaml - OpenSpec 配置，包含项目上下文和制品规则
- .claude/commands/opsx/*.md - 4 个 OpenSpec 命令定义
- .claude/skills/openspec-*/SKILL.md - 4 个 OpenSpec 技能定义
- .opencode/commands/opsx-*.md - 4 个 OpenCode 命令定义
- .opencode/skills/openspec-*/SKILL.md - 4 个 OpenCode 技能定义

### 工作流
/opsx:propose 创建变更提案
/opsx:apply 执行实现
/opsx:archive 归档变更

## GitHub 历史记录迁移

### 迁移统计
- Issue 总数: 8
- PR 总数: 14
- Dependabot PR（跳过）: 5
- 已归档变更: 7
- 活跃变更: 5

### 新增文件
- scripts/migrate-to-openspec.ts - 迁移脚本
- .agents/.../github-to-openspec-migration.md - 迁移文档
- openspec/changes/archive/ - 7 个已归档变更
- openspec/changes/ - 5 个活跃变更

## 测试结果

- 单元测试：无需测试（配置文件和文档）
- 构建验证：无影响

## 相关资源

- OpenSpec 官网: https://openspec.dev/
- GitHub 仓库: https://github.com/Fission-AI/OpenSpec

## What Changes

详见设计文档。

## Capabilities

### New Capabilities

- 功能实现

### Modified Capabilities

- 相关模块改进

## Impact

- 状态：进行中
