# Git 提交与分支规范

## 目录
1. [提交规范 (Angular Commit)](#提交规范-angular-commit)
2. [分支管理](#分支管理)
3. [开发流程](#开发流程)
4. [常见场景示例](#常见场景示例)

## 提交规范 (Angular Commit)

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type (提交类型)

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加周视图` |
| `fix` | Bug 修复 | `fix: 修复日期计算错误` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `style` | 代码格式 (不影响功能) | `style: 统一缩进格式` |
| `refactor` | 代码重构 | `refactor: 提取事件处理逻辑` |
| `perf` | 性能优化 | `perf: 优化日历渲染速度` |
| `test` | 测试相关 | `test: 添加日期工具函数测试` |
| `chore` | 构建/工具/依赖 | `chore: 升级 Tauri 到 2.x` |
| `ci` | CI/CD 流水线 | `ci: 添加自动测试流程` |
| `build` | 构建系统变更 | `build: 更新构建配置` |

### Scope (可选，影响范围)

```
feat(calendar): 添加事件拖拽功能
fix(todo): 修复重复提醒问题
docs(api): 更新事件接口文档
```

### Subject (标题)

- 使用祈使句 (动词开头)
- 首字母小写
- 结尾不加句号
- 不超过 50 字符
- 使用中文

```bash
# ✅ 正确
feat: 添加周视图组件
fix: 修复月份切换时日期计算错误
docs: 补充开发环境配置说明
refactor: 将事件处理逻辑提取为 composable

# ❌ 错误
feat: 添加了周视图。          # 结尾有句号，"添加了"不是祈使句
Fix: 修复日期计算错误          # 首字母应小写
```

### Body (详细描述，可选)

- 说明修改的原因和具体内容
- 每行不超过 72 字符
- 与 subject 空一行

```
fix: 修复月份切换时日期溢出问题

跨月切换时，setDate 可能导致日期溢出到下个月。
通过先设置日期为1号，再进行月份加减来解决。

Closes #42
```

### Footer (关联 Issue)

```bash
# 关闭 Issue
Closes #12
Closes #12, #23, #34
Fixes #42

# 破坏性变更
BREAKING CHANGE: 事件接口字段名由 startTime 改为 start_time
```

### 提交说明要求

- **内容单一**: 一次提交只做一件事
- **清晰明了**: 从 subject 就能知道做了什么改动
- **提交前验证**: 必须先执行单元测试通过

## 分支管理

### 分支结构

```
main                       # 受保护，正式发布版本
├── feature/{描述}         # 功能开发
└── bugfix/{描述}          # 问题修复
```

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 功能开发 | `feature/{action}-{target}` | `feature/add-week-view` |
| 问题修复 | `bugfix/{action}-{target}` | `bugfix/fix-date-calculation` |
| 文档更新 | `feature/update-{target}` | `feature/update-tech-constraints` |

### 分支操作规范

```bash
# 1. 从 origin/main 创建新分支
git checkout -b feature/add-week-view origin/main

# 2. 开发过程中保持与 main 同步
git fetch origin
git rebase origin/main

# 3. 完成后创建 PR 合并到 main
gh pr create --base main --head feature/add-week-view

# 4. 禁止直接提交到 main
```

### 保护规则

| 分支 | 保护状态 | 合并方式 |
|------|----------|----------|
| `main` | 受保护 | PR Review 通过后合并 |

## 开发流程

### 标准流程
1. 从 `origin/main` 分支创建 `feature/xxx` 或 `bugfix/xxx` 分支
2. 在分支上进行开发
3. 提交代码 (遵循 Angular Commit 规范)
4. 执行测试验证
5. Push 到远程仓库
6. 创建 Pull Request 到 `main` 分支
7. Code Review
8. 合并到 `main`

### GitHub Issue 驱动流程
```
Issue → 创建分支 → 开发 → Commit (多次) → Push → 创建 PR (Closes #X) → Review → Merge
```

## 常见场景示例

### 添加新功能
```bash
git checkout -b feature/add-reminder origin/main
# ... 开发 ...
git add src/components/reminder/ src/stores/reminder.ts
git commit -m "feat(reminder): 添加事件提醒功能

支持以下提醒方式:
- 系统通知
- 弹窗提醒
- 托盘通知

Closes #15"
pnpm test:run
git push -u origin feature/add-reminder
gh pr create --base main --title "feat(reminder): 添加事件提醒功能 Closes #15"
```

### 修复 Bug
```bash
git checkout -b bugfix/fix-calendar-sync origin/main
# ... 修复 ...
git add src/services/sync.ts
git commit -m "fix(sync): 修复日历同步时时间转换时区错误

前后端时间戳转换未考虑本地时区，导致事件偏移8小时。
修改为统一使用 UTC 时间戳。

Fixes #28"
pnpm test:run
git push -u origin bugfix/fix-calendar-sync
```

### 更新文档
```bash
git checkout -b feature/update-tech-constraints origin/main
# ... 文档更新 ...
git add .agents/skills/ AGENTS.md
git commit -m "docs: 更新技术约束文档，整理 AGENTS.md

- 新增 tech-constraints、coding-style、fluent-design 技能文档
- 精简 AGENTS.md，将技术规范迁移为技能按需加载

Closes #12"
```
