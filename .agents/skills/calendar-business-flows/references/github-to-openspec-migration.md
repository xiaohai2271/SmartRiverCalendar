# GitHub Issue/PR 到 OpenSpec 迁移指南

## 背景

在项目接入 OpenSpec 规格驱动开发框架之前，所有需求和变更都通过 GitHub Issue + PR 的方式进行记录。为了保持历史记录的完整性，并让后续开发能够追溯历史变更，我们创建了迁移脚本将这些历史记录转换为 OpenSpec 文档格式。

## 迁移统计

| 类型 | 数量 |
|------|------|
| 总 Issue 数 | 8 |
| 总 PR 数 | 14 |
| Dependabot PR（跳过） | 5 |
| 已归档变更 | 7 |
| 活跃变更 | 5 |

## 目录结构

迁移后的 OpenSpec 文档结构：

```
openspec/
├── config.yaml                    # 项目配置
├── changes/                       # 活跃变更
│   ├── issue-6-新增一个调试页面/
│   ├── issue-12-更新技术约束性文档/
│   ├── issue-19-系统时钟区域唤醒精简日历窗口/
│   ├── issue-21-启动页面会白屏很久.../
│   └── issue-5-关闭所有页面的默认右键菜单.../
└── archive/                       # 已归档变更
    ├── issue-4-首页展示当前的实时时间.../
    ├── issue-11-检查数据存储，数据和视图进行分离/
    ├── issue-17-无法创建日程事件和代办事件/
    ├── pr-8-(caldav)-修复飞书-CalDAV-日历同步问题/
    ├── pr-10-添加-GitHub-协作规范到-AGENTS.md/
    ├── pr-16-Hook系统时钟实现程序显隐切换/
    └── pr-22-集成-OpenSpec-规格驱动开发框架/
```

## 迁移脚本

脚本位置：`scripts/migrate-to-openspec.ts`

### 使用方法

```bash
# 预览迁移操作（不实际创建文件）
pnpm tsx scripts/migrate-to-openspec.ts --dry-run

# 执行完整迁移
pnpm tsx scripts/migrate-to-openspec.ts

# 只迁移已归档的变更
pnpm tsx scripts/migrate-to-openspec.ts --status=archived

# 只迁移活跃的变更
pnpm tsx scripts/migrate-to-openspec.ts --status=active
```

### 字段映射

| GitHub 字段 | OpenSpec 字段 | 说明 |
|-------------|---------------|------|
| Issue #xxx | `issue-xxx-{slug}` | 变更名称 |
| Issue title | proposal.md 标题 | 提案标题 |
| Issue body | proposal.md 需求描述 | 需求详情 |
| PR title (Closes #xxx) | 关联 Issue | 自动匹配关联 |
| PR body Summary | design.md 实现概述 | 技术方案 |
| PR body Files Changed | tasks.md 相关文件 | 变更文件 |
| PR mergedAt | archive/ | 归档目录 |

### 跳过规则

以下 PR 会被自动跳过：
- Dependabot 依赖更新 PR（标题包含 `chore(deps` 或 `bump `）

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

### 历史记录同步

如果需要在 GitHub Issue 上补充信息：
1. 更新 GitHub Issue 描述或评论
2. 重新运行迁移脚本更新对应的 OpenSpec 文档

### PR 关联 Issue

如果 PR 标题包含 `Closes #xxx`，迁移脚本会自动：
1. 将 Issue 和 PR 关联为同一条变更记录
2. 使用 Issue 的标题和描述作为 proposal
3. 使用 PR 的描述作为 design

## 参考链接

- [OpenSpec 官方文档](https://openspec.dev/)
- [项目 OpenSpec 配置](../../../openspec/config.yaml)
- [OpenSpec 工作流 Skill](../../../.opencode/skills/openspec-propose/SKILL.md)