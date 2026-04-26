# 测试规范

## 目录
1. [测试框架](#测试框架)
2. [文件组织](#文件组织)
3. [测试编写规范](#测试编写规范)
4. [覆盖率要求](#覆盖率要求)
5. [常用命令](#常用命令)

## 测试框架

- **框架**: Vitest + Vue Test Utils
- **断言**: Vitest 内置断言 (兼容 Jest API)
- **模拟**: vi.mock(), vi.fn()

## 文件组织

### 测试文件位置
```
src/
├── __tests__/
│   ├── stores/               # Store 测试
│   │   └── calendar.test.ts
│   ├── utils/                # 工具函数测试
│   │   ├── date.test.ts
│   │   └── lunar.test.ts
│   ├── services/             # Service 测试
│   │   └── updater.test.ts
│   ├── components/           # 组件测试
│   │   └── DayView.test.ts
│   └── views/                # 视图测试
│       └── CalendarView.test.ts
```

### 测试文件命名
- 格式: `{被测文件名}.test.ts`
- 示例: `date.test.ts`, `calendarStore.test.ts`, `DayView.test.ts`

## 测试编写规范

### 测试结构
使用 `describe` 和 `it` 组织，描述使用中文：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'

describe('formatDate', () => {
  // 正常情况
  it('应正确格式化日期为 YYYY-MM-DD 格式', () => {
    const date = new Date(2024, 0, 15) // 2024-01-15
    expect(formatDate(date)).toBe('2024-01-15')
  })

  // 边界条件
  it('应正确处理跨年日期', () => {
    const date = new Date(2024, 11, 31) // 2024-12-31
    expect(formatDate(date)).toBe('2024-12-31')
  })

  // 异常情况
  it('传入无效日期时应返回空字符串', () => {
    expect(formatDate(new Date('invalid'))).toBe('')
  })
})
```

### 测试原则
1. **测试公共接口**: 不要测试私有实现细节
2. **覆盖边界**: 空值、零值、最大值、最小值
3. **覆盖异常**: 错误输入、异常状态
4. **每个测试保持独立**: 不依赖其他测试的执行顺序
5. **使用 beforeEach 重置状态**: 确保测试隔离

### 组件测试示例
```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DayView from '@/components/calendar/DayView.vue'

describe('DayView', () => {
  it('应正确渲染日期标题', () => {
    const wrapper = mount(DayView, {
      props: { date: new Date(2024, 0, 15) }
    })
    expect(wrapper.find('.day-header').text()).toContain('1月15日')
  })

  it('应正确触发事件创建', async () => {
    const wrapper = mount(DayView)
    await wrapper.find('.add-event-btn').trigger('click')
    expect(wrapper.emitted('create-event')).toBeTruthy()
  })
})
```

### Store 测试示例
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCalendarStore } from '@/stores/calendar'

describe('useCalendarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('应正确切换视图', () => {
    const store = useCalendarStore()
    expect(store.currentView).toBe('month')

    store.setView('week')
    expect(store.currentView).toBe('week')
  })
})
```

## 覆盖率要求

- **目标**: 整体 60%-70% 有效覆盖率 (必须 > 50%)
- **范围**: 覆盖所有核心业务逻辑和工具函数
- **工具**: `pnpm test:coverage`
- **新功能**: 必须同步编写对应的单元测试

### 不需要测试的代码
- 纯模板/Vue SFC 的 template 和 style 部分
- 第三方库的简单包装 (如直接导出的常量)
- 配置文件 (vite.config.ts, vitest.config.ts)

## 常用命令

```bash
# 运行所有测试 (监听模式)
pnpm test

# 运行所有测试 (单次)
pnpm test:run

# 生成覆盖率报告
pnpm test:coverage

# 运行指定文件
pnpm vitest run src/__tests__/utils/date.test.ts

# 运行指定测试用例
pnpm vitest run -t "应正确格式化日期"

# 运行所有工具函数测试
pnpm vitest run src/__tests__/utils/

# UI 模式 (可视化)
pnpm vitest --ui
```
