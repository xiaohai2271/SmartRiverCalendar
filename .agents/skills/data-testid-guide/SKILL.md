---
name: data-testid-guide
description: 小河日历项目 data-testid 标注规范。当编写新 Vue 组件、修改现有组件模板、或编写 E2E 测试时使用。包含命名规范、标注清单、变更守则和完整已标注元素索引。
---

# data-testid 标注规范

## 命名规范

| 元素类型 | 命名格式 | 示例 |
|----------|----------|------|
| 按钮 | `btn-动作` | `btn-add-todo`、`btn-today`、`btn-delete-todo` |
| 输入框 | `xxx-input` | `event-title-input`、`login-email-input` |
| 弹窗/模态框 | `xxx-modal` | `event-modal`、`todo-modal` |
| 列表项 | `xxx-item` | `todo-item`、`day-cell` |
| 表单 | `xxx-form` | `login-form` |
| 导航链接 | `nav-页面` | `nav-calendar`、`nav-settings` |
| 切换/开关 | `toggle-功能` | `toggle-show-lunar` |
| 选择器 | `xxx-select` | `theme-select` |
| 空状态 | `xxx-empty` | `todos-empty` |

**格式统一用 kebab-case**，如 `btn-add-todo` 而非 `btnAddTodo`。

## v-for 元素的区分属性

循环渲染的元素，除 `data-testid` 外还需加区分属性：

```
todo-item → data-todo-id="xxx"
day-cell  → data-date="2026-06-21"
filter-tab → data-filter="all|pending|completed"
view-btn  → data-view="day|week|month|year"
event-calendar-option → data-calendar-id="xxx"
priority-pill → data-priority="low|medium|high"
settings-tab → data-tab-key="display|popup|..."
```

## 标注守则

### 必须标注

- **所有可交互元素**：按钮、链接、输入框、选择器、复选框、开关
- **弹窗/模态框**：遮罩层、弹窗容器、标题、提交/取消按钮
- **条件渲染的两个分支**：有数据列表 + 空状态提示
- **导航元素**：侧边栏链接、标签页切换

### 无需标注

- 纯装饰元素（图标、分隔线）
- 仅用于布局的容器 div
- 文本展示元素（除非需要验证内容）

### 变更守则

1. **不随意删除/重命名** — 改 testid 必须同步更新 E2E 测试
2. **新组件必须标注** — 想一下"E2E 要不要点/填/验证这个元素"，要就加
3. **不加注释** — testid 是工具属性，保持模板简洁
4. **条件渲染要全覆盖** — 登录/未登录、有数据/空状态，两边都要有

## 已标注元素索引

完整清单见 [references/testid-registry.md](references/testid-registry.md)

## E2E 测试中的使用方式

```typescript
// 普通元素
await page.getByTestId('btn-add-todo').click()
await expect(page.getByTestId('todo-modal')).toBeVisible()

// 带区分属性的循环元素
const checkbox = page.getByTestId('todo-checkbox').first()
const specificDay = page.locator('[data-testid="day-cell"][data-date="2026-06-21"]')
const filterAll = page.locator('[data-testid="filter-tab"][data-filter="all"]')

// 验证元素不存在（如桌面专属功能不在 Web 端出现）
expect(await page.getByTestId('auto-start').count()).toBe(0)
```
