# GitHub Issue/PR 到 OpenSpec 迁移记录

## 背景

在项目接入 OpenSpec 规格驱动开发框架之前，所有需求和变更都通过 GitHub Issue + PR 的方式进行记录。为了保持历史记录的完整性，我们分析了有价值的 Issue/PR，转换为符合 OpenSpec v1.3.0 规范的高质量文档。

## 迁移策略

### 两阶段迁移

1. **初版（已废弃）**：使用脚本自动化迁移，生成的文档为空洞模板，无实际价值
2. **最终版**：使用子 agent 分析 Issue/PR 内容，结合项目参考文档生成高质量文档

### 选型标准

仅保留有实质内容的 Issue/PR：

| 标准 | 说明 |
|------|------|
| 有明确需求描述 | Issue body 包含具体功能需求 |
| 有技术设计记录 | PR body 或项目文档中有实现方案 |
| 有测试验证记录 | PR 包含测试结果或覆盖率数据 |
| 有学习价值 | 变更过程中有可复用的经验 |

## 迁移结果

### 活跃变更

| 变更名称 | Issue | PR | 说明 |
|----------|-------|-----|------|
| issue-19-simplified-calendar-popup | #19 | #20 | 精简日历弹出窗口（85% 进度） |
| issue-5-context-menu | #5 | #13 | 右键菜单功能实现 |

### 已归档变更

| 变更名称 | Issue | PR | 说明 |
|----------|-------|-----|------|
| issue-11-data-layer-migration | #11 | #14 | 数据层迁移 - 数据和视图分离 |
| issue-4-home-time-display | #4 | #9 | 首页时间显示组件 |
| pr-8-caldav-feishu-fix | - | #8 | 飞书 CalDAV 日历同步修复 |

### 跳过的 Issue/PR

| 类型 | 原因 |
|------|------|
| Dependabot PR | 依赖更新，无业务价值 |
| 无实质内容 Issue | 仅占位或简单描述 |
| 重复/已关闭 Issue | 无实际实现 |

## 目录结构

```
openspec/changes/
├── issue-19-simplified-calendar-popup/    # 活跃
│   ├── .openspec.yaml
│   ├── proposal.md
│   ├── design.md
│   ├── tasks.md
│   └── specs/calendar-popup/spec.md
├── issue-5-context-menu/                  # 活跃
│   ├── .openspec.yaml
│   ├── proposal.md
│   ├── design.md
│   ├── tasks.md
│   └── specs/context-menu/spec.md
└── archive/
    ├── issue-11-data-layer-migration/     # 已归档
    ├── issue-4-home-time-display/         # 已归档
    └── pr-8-caldav-feishu-fix/            # 已归档
```

## 文档规范

每个变更包含以下制品：

| 制品 | 内容要求 |
|------|----------|
| `.openspec.yaml` | 变更元信息、关联资源、变更范围、统计信息 |
| `proposal.md` | Why（背景）、What Changes（变更内容）、Capabilities（能力）、Impact（影响） |
| `design.md` | Context（技术背景）、Goals/Non-Goals（目标）、Decisions（决策）、Risks（风险） |
| `tasks.md` | 任务分组、进度记录、验收结果 |
| `specs/*/spec.md` | ADDED Requirements + Scenario（GIVEN-WHEN-THEN 格式） |

## 后续维护

### 新需求处理

从现在开始，所有新需求应使用 OpenSpec 工作流：

```bash
# 创建新变更
/opsx:propose <变更描述>

# 实现变更
/opsx:apply

# 归档变更
/opsx:archive
```

### 校验命令

```bash
# 校验活跃变更
npx openspec validate --changes

# 查看变更列表
npx openspec list
```

## 参考链接

- [OpenSpec 官方文档](https://openspec.dev/)
- [项目 OpenSpec 配置](../../../openspec/config.yaml)
