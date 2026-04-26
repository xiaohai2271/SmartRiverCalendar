---
name: coding-style
description: SmartRiverCalendar项目代码风格规范。当需要编写代码、进行代码审查、或了解项目的TypeScript/Vue规范、命名约定、状态管理模式、测试规范、Git提交规范时使用。涵盖Vue 3 Composition API、TypeScript类型规范、Pinia Store模式等。
---

# 代码风格规范

## 概述

本 skill 定义小河日历项目的代码风格和编程规范，确保代码质量和一致性。

## 规范列表

### 1. TypeScript / Vue 规范
- Vue 3 Composition API (`<script setup lang="ts">`)
- 组件风格、类型定义、命名约定、导入路径、状态管理
- **详细文档**: 参考 [references/vue-typescript-conventions.md](references/vue-typescript-conventions.md)

### 2. 测试规范
- Vitest + Vue Test Utils
- 测试文件组织、命名、覆盖率要求
- **详细文档**: 参考 [references/testing-conventions.md](references/testing-conventions.md)

### 3. Git 提交与分支规范
- Angular Commit 规范 (Conventional Commits)
- 分支管理: feature / bugfix / develop / main
- **详细文档**: 参考 [references/git-conventions.md](references/git-conventions.md)

## 快速参考

### 文件命名
| 类型 | 命名风格 | 示例 |
|------|----------|------|
| Vue 组件 | PascalCase | `DayView.vue` |
| Store/工具/Service | camelCase | `calendar.ts`, `date.ts` |
| 类型/接口 | PascalCase | `CalendarEvent` |
| CSS 类名 | kebab-case | `.calendar-header` |

### 导入路径
```typescript
// ✅ 使用 @ 别名指向 src/
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarEvent } from '@/types'

// ✅ 类型导入使用 import type
import type { Ref } from 'vue'

// ❌ 避免
import { useCalendarStore } from '../../stores/calendar'
```

### 常见模式
```vue
<script setup lang="ts">
// 组件模板 (顺序: script → template → style)
import { ref, computed } from 'vue'
import type { CalendarEvent } from '@/types'

const props = defineProps<{ event: CalendarEvent }>()
const emit = defineEmits<{ update: [event: CalendarEvent] }>()
</script>
```
