# 技术设计：feat: 集成 OpenSpec 规格驱动开发框架

## Context

此设计文档从 GitHub 迁移而来。

**实现概述：**

- 初始化 OpenSpec v1.3.0 到项目中，为 AI 编码助手添加规格驱动开发能力
- 配置 `openspec/config.yaml` 包含项目技术栈（Tauri + Vue 3 + TypeScript）和开发约定
- 添加 Claude Code 和 OpenCode 的 OpenSpec 技能和命令（/opsx:propose, /opsx:apply, /opsx:archive, /opsx:explore）
- 更新 `.gitignore` 支持 `.claude` 和 `.opencode` 目录的 whitelist 规则

## Goals

- 完成功能需求
- 保证代码质量
- 更新文档

## Non-Goals

- 不引入不相关变更
- 不破坏现有功能

## Decisions

遵循项目规范实现。

## Risks / Trade-offs

- 需要充分测试验证
