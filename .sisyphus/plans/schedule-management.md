# 日程管理功能实现计划

## TL;DR

> **快速总结**：为小河日历添加完整的日程管理功能，包括周视图/日视图点击创建日程弹窗、拖拽选择时间段、独立的日程管理页面。
>
> **交付物**：
> - 修改 WeekView.vue：实现拖拽创建日程功能
> - 修改 DayView.vue：实现点击创建日程功能
> - 修改 CalendarView.vue：接收创建事件并打开弹窗
> - 创建 ScheduleView.vue：日程管理页面
> - 修改 App.vue：添加日程导航入口
> - 修改 router/index.ts：添加 /schedules 路由
>
> **预计工作量**：中等
> **并行执行**：是 - 2个并行波次
> **关键路径**：WeekView → CalendarView → ScheduleView

---

## Context

### 原始需求
用户希望添加完整的日程管理功能：
1. 在日历界面新建的就是日程
2. 在周视图中可以点击时间段创建日程弹窗
3. 弹窗自动填充对应的日期和时间
4. 支持拖拽选择时间段
5. 单独的日程管理页面

### 访谈总结
**关键讨论**：
- 用户确认需要两者：周视图点击弹窗 + 单独的日程管理页面
- 支持拖拽选择时间段，默认1小时
- 日视图也支持点击创建日程
- 日程管理页面需要增强版：日期范围筛选、日历筛选、搜索功能

**研究发现**：
- WeekView.vue 已有拖拽状态定义和 `emit('create-event')` 声明
- DayView.vue 有 `handleCellClick` 函数，需要修改
- CalendarView.vue 有完整的事件弹窗实现
- App.vue 有导航菜单，需要添加"日程"入口
- 路由器需要添加 `/schedules` 路由

---

## Work Objectives

### 核心目标
实现完整的日程管理功能，包括：
1. 周视图/日视图点击创建日程弹窗
2. 拖拽选择时间段
3. 独立的日程管理页面
4. 左侧导航栏入口

### 具体交付物
- 修改后的 WeekView.vue（支持拖拽创建）
- 修改后的 DayView.vue（支持点击创建）
- 修改后的 CalendarView.vue（接收事件并打开弹窗）
- 新建的 ScheduleView.vue（日程管理页面）
- 修改后的 App.vue（添加导航入口）
- 修改后的 router/index.ts（添加路由）

### 完成定义
- [ ] 周视图点击时间段可以创建日程弹窗
- [ ] 周视图支持拖拽选择多个时间段
- [ ] 日视图点击时间段可以创建日程弹窗
- [ ] 弹窗自动填充日期和时间
- [ ] 左侧导航栏有"日程"入口
- [ ] 日程管理页面可以查看、编辑、删除日程
- [ ] 日程管理页面支持日期范围筛选、日历筛选、搜索

### 必须功能
- 周视图点击/拖拽时间段创建日程弹窗
- 日视图点击时间段创建日程弹窗
- 弹窗自动填充日期和时间
- 单独的日程管理页面
- 左侧导航栏新增"日程"入口
- 日期范围筛选、日历筛选、搜索功能

### 不该有的功能（护栏）
- 不修改现有的事件数据结构
- 不修改现有的弹窗组件逻辑
- 不影响现有的日历视图功能

---

## Verification Strategy (MANDATORY)

### 测试决策
- **基础设施存在**：是（Vitest）
- **自动化测试**：测试后添加
- **框架**：Vitest
- **如果 TDD**：每个任务遵循 RED（失败测试）→ GREEN（最小实现）→ REFACTOR

### QA 策略
每个任务必须包含代理执行的 QA 场景（见下方 TODO 模板）。
证据保存到 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **前端/UI**：使用 Playwright（playwright 技能）— 导航、交互、断言 DOM、截图
- **TUI/CLI**：使用 interactive_bash（tmux）— 运行命令、发送按键、验证输出
- **API/后端**：使用 Bash（curl）— 发送请求、断言状态 + 响应字段
- **库/模块**：使用 Bash（bun/node REPL）— 导入、调用函数、比较输出

---

## Execution Strategy

### 并行执行波次

```
Wave 1（立即开始 - 基础 + 脚手架）：
├── Task 1: 修改 WeekView.vue - 实现拖拽创建日程 [deep]
├── Task 2: 修改 DayView.vue - 实现点击创建日程 [deep]
├── Task 3: 修改 CalendarView.vue - 接收事件并打开弹窗 [deep]
└── Task 4: 修改 router/index.ts - 添加 /schedules 路由 [quick]

Wave 2（Wave 1 完成后 - 核心功能）：
├── Task 5: 创建 ScheduleView.vue - 日程管理页面 [deep]
└── Task 6: 修改 App.vue - 添加日程导航入口 [quick]

Wave FINAL（所有任务完成后）：
├── Task F1: 计划合规性审计（oracle）
├── Task F2: 代码质量审查（unspecified-high）
├── Task F3: 真实手动 QA（unspecified-high）
└── Task F4: 范围保真度检查（deep）
```

### 依赖矩阵
- **Task 1**: 无依赖 → 可立即开始
- **Task 2**: 无依赖 → 可立即开始
- **Task 3**: 依赖 Task 1 和 Task 2 的 emit 定义
- **Task 4**: 无依赖 → 可立即开始
- **Task 5**: 依赖 Task 4（路由）
- **Task 6**: 依赖 Task 5（页面存在）

### 代理分发摘要
- **Wave 1**: 4 个任务 — T1-T3 → `deep`，T4 → `quick`
- **Wave 2**: 2 个任务 — T5 → `deep`，T6 → `quick`
- **FINAL**: 4 个任务 — F1 → `oracle`，F2-F4 → `unspecified-high`

---

## TODOs

---

- [x] 1. 修改 WeekView.vue - 实现拖拽创建日程功能

  **做什么**：
  - 实现 mousedown → mousemove → mouseup 的拖拽逻辑
  - 修改 `handleCellClick` 触发 `emit('create-event', date, startHour, endHour)`
  - 添加拖拽选择的视觉反馈（高亮选中的时间段）
  - 支持点击默认1小时，拖拽选择多个小时

  **不能做什么**：
  - 不修改现有的事件显示逻辑
  - 不修改现有的事件点击编辑功能

  **推荐代理配置文件**：
  - **类别**：`deep`
    - 原因：需要深入理解现有的拖拽状态定义和事件处理逻辑
  - **技能**：[`calendar-business-flows`]
    - `calendar-business-flows`：了解日历业务流程和事件处理

  **并行化**：
  - **可并行运行**：是
  - **并行组**：Wave 1（与 Task 2, 3, 4 并行）
  - **阻塞**：Task 3（需要 emit 定义）
  - **被阻塞**：无（可立即开始）

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/components/calendar/WeekView.vue:86-90` - 现有拖拽状态定义（isDragging, dragStartDay, dragStartHour, dragEndHour）
  - `src/components/calendar/WeekView.vue:221-225` - 现有 handleCellClick 函数实现
  - `src/components/calendar/WeekView.vue:78-81` - emit 定义（已有 create-event 声明）

  **API/类型参考**（要实现的契约）：
  - `src/types/index.ts:CalendarEvent` - 事件数据结构（startTime, endTime 为 Unix 时间戳）

  **外部参考**（库和框架）：
  - Vue 3 组合式 API：https://vuejs.org/guide/essentials/event-handling.html - 事件处理和拖拽实现

  **每个参考的重要性说明**：
  - `WeekView.vue:86-90`：现有的拖拽状态 ref 定义，需要在此基础上实现完整的拖拽逻辑
  - `WeekView.vue:221-225`：当前的 handleCellClick 只选中日期，需要改为触发创建事件
  - `WeekView.vue:78-81`：emit 已定义 create-event，只需在实际逻辑中触发

  **验收标准**：

  **如果 TDD（测试启用）：**
  - [ ] 测试文件创建：src/__tests__/WeekView-drag.test.ts
  - [ ] pnpm vitest run src/__tests__/WeekView-drag.test.ts → PASS

  **QA 场景（强制性 - 任务不完整则无此）：**

  **这是可选的。没有 QA 场景的任务将被拒绝。**

  编写验证实际构建内容行为的场景测试。
  最少：1 个正常路径 + 1 个失败/边缘案例 每个任务。
  每个场景 = 确切工具 + 确切步骤 + 确切断言 + 证据路径。

  **执行代理必须在实现后运行这些场景。**
  **编排器将在标记任务完成之前验证证据文件是否存在。**

  ```
  场景：周视图点击时间段创建日程
    工具：Playwright
    前置条件：应用已启动，切换到周视图
    步骤：
      1. 点击某个时间段（如上午10点）
      2. 断言：弹窗打开
      3. 断言：开始时间自动填充为10:00
      4. 断言：结束时间自动填充为11:00
      5. 断言：日期自动填充为当天
    预期结果：弹窗正确显示，日期和时间自动填充
    失败指标：弹窗未打开、时间未自动填充
    证据：.sisyphus/evidence/task-1-click-create.png

  场景：周视图拖拽选择多个时间段
    工具：Playwright
    前置条件：应用已启动，切换到周视图
    步骤：
      1. 从上午9点按下鼠标
      2. 拖拽到上午12点
      3. 释放鼠标
      4. 断言：弹窗打开
      5. 断言：开始时间为9:00
      6. 断言：结束时间为12:00
      7. 断言：拖拽期间有视觉反馈（高亮）
    预期结果：弹窗正确显示，时间范围为3小时
    失败指标：弹窗未打开、时间范围不正确、无视觉反馈
    证据：.sisyphus/evidence/task-1-drag-select.png
  ```

  **要捕获的证据：**
  - [ ] 每个证据文件命名：task-1-{scenario-slug}.{ext}
  - [ ] UI 截图

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(calendar): 实现周视图拖拽创建日程功能`
  - 文件：`src/components/calendar/WeekView.vue`
  - 提交前：`pnpm test:run`

---

- [x] 2. 修改 DayView.vue - 实现点击创建日程功能

  **做什么**：
  - 实现 mousedown → mousemove → mouseup 的拖拽逻辑
  - 修改 `handleCellClick` 触发 `emit('create-event', startHour, endHour)`
  - 添加拖拽选择的视觉反馈（高亮选中的时间段）
  - 支持点击默认1小时，拖拽选择多个小时

  **不能做什么**：
  - 不修改现有的事件显示逻辑
  - 不修改现有的事件点击编辑功能

  **推荐代理配置文件**：
  - **类别**：`deep`
    - 原因：需要深入理解现有的事件处理逻辑
  - **技能**：[`calendar-business-flows`]
    - `calendar-business-flows`：了解日历业务流程和事件处理

  **并行化**：
  - **可并行运行**：是
  - **并行组**：Wave 1（与 Task 1, 3, 4 并行）
  - **阻塞**：Task 3（需要 emit 定义）
  - **被阻塞**：无（可立即开始）

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/components/calendar/DayView.vue:56-58` - 现有 emit 定义（需要添加 create-event）
  - `src/components/calendar/DayView.vue:31` - 现有 hour-cell 点击事件
  - `src/components/calendar/WeekView.vue:86-90` - 拖拽状态定义参考

  **每个参考的重要性说明**：
  - `DayView.vue:56-58`：当前只有 edit-event emit，需要添加 create-event
  - `DayView.vue:31`：当前的点击事件需要修改为触发创建
  - `WeekView.vue:86-90`：拖拽状态定义的参考实现

  **验收标准**：

  **QA 场景（强制性）：**

  ```
  场景：日视图点击时间段创建日程
    工具：Playwright
    前置条件：应用已启动，切换到日视图
    步骤：
      1. 点击某个时间段（如下午3点）
      2. 断言：弹窗打开
      3. 断言：开始时间自动填充为15:00
      4. 断言：结束时间自动填充为16:00
      5. 断言：日期自动填充为当天
    预期结果：弹窗正确显示，日期和时间自动填充
    失败指标：弹窗未打开、时间未自动填充
    证据：.sisyphus/evidence/task-2-click-create.png

  场景：日视图拖拽选择多个时间段
    工具：Playwright
    前置条件：应用已启动，切换到日视图
    步骤：
      1. 从下午2点按下鼠标
      2. 拖拽到下午5点
      3. 释放鼠标
      4. 断言：弹窗打开
      5. 断言：开始时间为14:00
      6. 断言：结束时间为17:00
      7. 断言：拖拽期间有视觉反馈（高亮）
    预期结果：弹窗正确显示，时间范围为3小时
    失败指标：弹窗未打开、时间范围不正确、无视觉反馈
    证据：.sisyphus/evidence/task-2-drag-select.png
  ```

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(calendar): 实现日视图点击创建日程功能`
  - 文件：`src/components/calendar/DayView.vue`
  - 提交前：`pnpm test:run`

---

- [x] 3. 修改 CalendarView.vue - 接收事件并打开弹窗

  **做什么**：
  - 新增 `openAddEventModalWithTime(date, startHour, endHour)` 函数
  - 在 WeekView 和 DayView 组件上监听 `@create-event` 事件
  - 调用弹窗并自动填充日期和时间
  - 确保弹窗正确显示日期和时间

  **不能做什么**：
  - 不修改现有的弹窗组件逻辑
  - 不修改现有的事件编辑功能

  **推荐代理配置文件**：
  - **类别**：`deep`
    - 原因：需要深入理解现有的弹窗实现和事件处理
  - **技能**：[`calendar-business-flows`]
    - `calendar-business-flows`：了解日历业务流程和事件处理

  **并行化**：
  - **可并行运行**：否（依赖 Task 1 和 Task 2 的 emit 定义）
  - **并行组**：Wave 1（可与其他任务并行，但逻辑上依赖）
  - **阻塞**：无
  - **被阻塞**：Task 1, Task 2

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/views/CalendarView.vue:344-359` - 现有 openAddEventModal 函数实现
  - `src/views/CalendarView.vue:362-376` - 现有 openEditEventModal 函数实现
  - `src/views/CalendarView.vue:30-33` - 现有视图组件的事件监听

  **每个参考的重要性说明**：
  - `CalendarView.vue:344-359`：现有的打开弹窗逻辑，需要参考其模式
  - `CalendarView.vue:362-376`：现有的编辑弹窗逻辑，了解如何填充数据
  - `CalendarView.vue:30-33`：现有的事件监听模式，需要添加 create-event 监听

  **验收标准**：

  **QA 场景（强制性）：**

  ```
  场景：从周视图创建日程弹窗
    工具：Playwright
    前置条件：应用已启动，切换到周视图
    步骤：
      1. 在周视图点击某个时间段
      2. 断言：CalendarView 的弹窗打开
      3. 断言：弹窗标题为"新建事件"
      4. 断言：日期和时间正确填充
    预期结果：弹窗正确打开并填充数据
    失败指标：弹窗未打开、数据未填充
    证据：.sisyphus/evidence/task-3-week-create.png

  场景：从日视图创建日程弹窗
    工具：Playwright
    前置条件：应用已启动，切换到日视图
    步骤：
      1. 在日视图点击某个时间段
      2. 断言：CalendarView 的弹窗打开
      3. 断言：弹窗标题为"新建事件"
      4. 断言：日期和时间正确填充
    预期结果：弹窗正确打开并填充数据
    失败指标：弹窗未打开、数据未填充
    证据：.sisyphus/evidence/task-3-day-create.png
  ```

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(calendar): 接收创建事件并打开弹窗`
  - 文件：`src/views/CalendarView.vue`
  - 提交前：`pnpm test:run`

---

- [x] 4. 修改 router/index.ts - 添加 /schedules 路由

  **做什么**：
  - 新增 `/schedules` 路由配置
  - 使用懒加载方式引入 ScheduleView.vue
  - 路由名称为 'schedules'

  **不能做什么**：
  - 不修改现有的路由配置
  - 不修改现有的视图组件

  **推荐代理配置文件**：
  - **类别**：`quick`
    - 原因：简单的路由配置修改
  - **技能**：[]
    - 无需特殊技能

  **并行化**：
  - **可并行运行**：是
  - **并行组**：Wave 1（与 Task 1, 2, 3 并行）
  - **阻塞**：Task 5（需要路由存在）
  - **被阻塞**：无（可立即开始）

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/router/index.ts:18-21` - 现有待办路由配置（模式参考）

  **每个参考的重要性说明**：
  - `router/index.ts:18-21`：待办路由的配置模式，需要遵循相同的结构

  **验收标准**：

  **QA 场景（强制性）：**

  ```
  场景：访问 /schedules 路由
    工具：Playwright
    前置条件：应用已启动
    步骤：
      1. 导航到 /schedules
      2. 断言：页面正确加载
      3. 断言：页面标题包含"日程"
    预期结果：路由正确配置，页面可以访问
    失败指标：404 错误、页面未加载
    证据：.sisyphus/evidence/task-4-route-access.png
  ```

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(router): 添加日程管理页面路由`
  - 文件：`src/router/index.ts`
  - 提交前：无

---

- [x] 5. 创建 ScheduleView.vue - 日程管理页面

  **做什么**：
  - 创建新的 ScheduleView.vue 组件
  - 参考 TodosView.vue 的模式
  - 功能：日程列表、筛选、搜索、编辑、删除
  - 按日期分组排序
  - 支持日期范围筛选、日历筛选

  **不能做什么**：
  - 不修改现有的事件数据结构
  - 不修改现有的弹窗组件逻辑

  **推荐代理配置文件**：
  - **类别**：`deep`
    - 原因：需要深入理解现有的待办页面模式和事件数据结构
  - **技能**：[`calendar-business-flows`]
    - `calendar-business-flows`：了解日历业务流程和事件处理

  **并行化**：
  - **可并行运行**：否（依赖 Task 4 的路由）
  - **并行组**：Wave 2（与 Task 6 并行）
  - **阻塞**：无
  - **被阻塞**：Task 4

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/views/TodosView.vue` - 待办页面的完整实现（模式参考）
  - `src/stores/calendar.ts` - 日历状态管理（事件数据访问）

  **每个参考的重要性说明**：
  - `TodosView.vue`：待办页面的实现模式，需要参考其结构、样式和功能
  - `calendar.ts`：日历状态管理，需要了解如何访问和操作事件数据

  **验收标准**：

  **QA 场景（强制性）：**

  ```
  场景：查看日程列表
    工具：Playwright
    前置条件：应用已启动，导航到 /schedules
    步骤：
      1. 断言：页面显示日程列表
      2. 断言：日程按日期分组显示
      3. 断言：每个日程显示标题和时间
    预期结果：日程列表正确显示
    失败指标：列表为空、显示错误
    证据：.sisyphus/evidence/task-5-list-view.png

  场景：筛选日程
    工具：Playwright
    前置条件：应用已启动，导航到 /schedules，有多个日程
    步骤：
      1. 选择日期范围筛选
      2. 断言：只显示选定日期范围内的日程
      3. 选择日历筛选
      4. 断言：只显示选定日历的日程
      5. 输入搜索关键词
      6. 断言：只显示匹配的日程
    预期结果：筛选功能正常工作
    失败指标：筛选无效、结果不正确
    证据：.sisyphus/evidence/task-5-filter.png

  场景：编辑和删除日程
    工具：Playwright
    前置条件：应用已启动，导航到 /schedules，有日程
    步骤：
      1. 点击某个日程的编辑按钮
      2. 断言：编辑弹窗打开
      3. 修改标题并保存
      4. 断言：日程标题已更新
      5. 点击删除按钮
      6. 断言：日程已删除
    预期结果：编辑和删除功能正常工作
    失败指标：弹窗未打开、修改未保存、删除失败
    证据：.sisyphus/evidence/task-5-edit-delete.png
  ```

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(schedules): 创建日程管理页面`
  - 文件：`src/views/ScheduleView.vue`
  - 提交前：`pnpm test:run`

---

- [x] 6. 修改 App.vue - 添加日程导航入口

  **做什么**：
  - 在导航菜单中添加"日程"入口
  - 位置在"待办"后面
  - 使用 router-link 组件
  - 添加日程图标

  **不能做什么**：
  - 不修改现有的导航结构
  - 不修改现有的样式

  **推荐代理配置文件**：
  - **类别**：`quick`
    - 原因：简单的导航菜单修改
  - **技能**：[]
    - 无需特殊技能

  **并行化**：
  - **可并行运行**：否（依赖 Task 5 的页面存在）
  - **并行组**：Wave 2（与 Task 5 并行）
  - **阻塞**：无
  - **被阻塞**：Task 5

  **参考文献**：

  **模式参考**（要遵循的现有代码）：
  - `src/App.vue:29-32` - 现有待办导航项（模式参考）

  **每个参考的重要性说明**：
  - `App.vue:29-32`：待办导航项的实现模式，需要遵循相同的结构

  **验收标准**：

  **QA 场景（强制性）：**

  ```
  场景：导航到日程页面
    工具：Playwright
    前置条件：应用已启动
    步骤：
      1. 点击左侧导航栏的"日程"入口
      2. 断言：页面导航到 /schedules
      3. 断言：日程页面正确显示
    预期结果：导航功能正常工作
    失败指标：导航失败、页面未加载
    证据：.sisyphus/evidence/task-6-navigation.png
  ```

  **提交**：是 | 否（与 N 组）
  - 消息：`feat(navigation): 添加日程管理入口`
  - 文件：`src/App.vue`
  - 提交前：无

---

## Final Verification Wave (MANDATORY - after ALL implementation tasks)

- [x] F1. **计划合规性审计** — `oracle`
  阅读整个计划。对于每个"必须功能"：验证实现是否存在（读取文件、运行命令）。对于每个"不该有的功能"：搜索代码库中是否有禁止的模式——如果发现则拒绝并提供文件:行号。检查证据文件是否存在于 .sisyphus/evidence/。比较交付物与计划。

- [x] F2. **代码质量审查** — `unspecified-high`
  运行 `pnpm test:run` + linter。审查所有更改的文件：是否有 `as any`/`@ts-ignore`、空 catch、生产环境中的 console.log、注释掉的代码、未使用的导入。检查 AI 问题：过度注释、过度抽象、通用名称（data/result/item/temp）。

- [x] F3. **真实手动 QA** — `unspecified-high`（+ `playwright` 技能，如果有 UI）
  从干净状态开始。执行每个任务的每个 QA 场景——按照确切步骤、捕获证据。测试跨任务集成（功能一起工作，而不是隔离）。测试边缘案例：空状态、无效输入、快速操作。保存到 `.sisyphus/evidence/final-qa/`。

- [x] F4. **范围保真度检查** — `deep`
  对于每个任务：读取"做什么"，读取实际差异（git log/diff）。验证 1:1 — 规范中的所有内容都已构建（无遗漏），未构建规范之外的内容（无扩展）。检查"不能做什么"合规性。检测跨任务污染：任务 N 触及任务 M 的文件。标记未解释的更改。

---

## Commit Strategy

- **1**: `feat(calendar): 实现周视图拖拽创建日程功能` — `src/components/calendar/WeekView.vue`, `pnpm test:run`
- **2**: `feat(calendar): 实现日视图点击创建日程功能` — `src/components/calendar/DayView.vue`, `pnpm test:run`
- **3**: `feat(calendar): 接收创建事件并打开弹窗` — `src/views/CalendarView.vue`, `pnpm test:run`
- **4**: `feat(router): 添加日程管理页面路由` — `src/router/index.ts`, 无
- **5**: `feat(schedules): 创建日程管理页面` — `src/views/ScheduleView.vue`, `pnpm test:run`
- **6**: `feat(navigation): 添加日程管理入口` — `src/App.vue`, 无

---

## Success Criteria

### 验证命令
```bash
pnpm test:run  # 预期：所有测试通过
pnpm build     # 预期：构建成功
```

### 最终检查清单
- [x] 周视图点击时间段可以创建日程弹窗
- [x] 周视图支持拖拽选择多个时间段
- [x] 日视图点击时间段可以创建日程弹窗
- [x] 弹窗自动填充日期和时间
- [x] 左侧导航栏有"日程"入口
- [x] 日程管理页面可以查看、编辑、删除日程
- [x] 日程管理页面支持日期范围筛选、日历筛选、搜索
- [x] 所有测试通过
- [x] 构建成功
