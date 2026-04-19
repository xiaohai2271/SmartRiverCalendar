# 提案：feat: 集成 OpenSpec 规格驱动开发框架

## Why

此变更记录从 GitHub 迁移而来。

- **GitHub PR**: #22

**原始需求：**

## Summary

- 初始化 OpenSpec v1.3.0 到项目中，为 AI 编码助手添加规格驱动开发能力
- 配置 `openspec/config.yaml` 包含项目技术栈（Tauri + Vue 3 + TypeScript）和开发约定
- 添加 Claude Code 和 OpenCode 的 OpenSpec 技能和命令（/opsx:propose, /opsx:apply, /opsx:archive, /opsx:explore）
- 更新 `.gitignore` 支持 `.claude` 和 `.opencode` 目录的 whitelist 规则

## 变更详情

### 新增文件
- `openspec/config.yaml` - OpenSpec 配置，包含项目上下文和制品规则
- `.claude/commands/opsx/*.md` - 4 个 OpenSpec 命令定义
- `.claude/skills/openspec-*/SKILL.md` - 4 个 OpenSpec 技能定义
- `.opencode/commands/opsx-*.md` - 4 个 OpenCode 命令定义
- `.opencode/skills/openspec-*/SKILL.md` - 4 个 OpenCode 技能定义

### 修改文件
- `.gitignore` - 添加 `.omc/` 和 whitelist 规则

## OpenSpec 介绍

OpenSpec 是一个开源的规格驱动开发 (SDD) 框架，通过在 AI 编码助手和开发者之间建立规格文档层，确保需求在编码前被明确定义和追踪。

### 核心功能
- **规格库 (Specs)** - `openspec/specs/` 作为系统行为的唯一真相来源
- **变更管理 (Changes)** - 每个新功能一个独立目录，包含 proposal、design、tasks、delta specs
- **OPSX 工作流** - `/opsx:propose` → `/opsx:apply` → `/opsx:archive` 三步走

### 使用方式
```
/opsx:propose 添加周视图拖拽功能  # 创建变更提案
/opsx:apply                    # 执行实现
/opsx:archive                  # 归档变更
```

## 测试结果

- 单元测试：无需测试（配置文件和技能定义）
- 构建验证：无影响

## 相关资源

- [OpenSpec 官网](https://openspec.dev/)
- [GitHub 仓库](https://github.com/Fission-AI/OpenSpec)

## What Changes

详见设计文档。

## Capabilities

### New Capabilities

- 功能实现

### Modified Capabilities

- 相关模块改进

## Impact

- 状态：已完成归档
