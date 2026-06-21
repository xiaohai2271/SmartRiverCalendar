# 组件测试编写指南

## 核心原则

1. **用户视角**：测试用户看到和交互的内容，而非实现细节
2. **最小 mock**：只 mock 外部依赖，组件内部逻辑不 mock
3. **flushPromises**：异步操作后使用 `flushPromises()` 等待更新
4. **data-testid**：优先使用 `data-testid` 定位元素

## 基本模式

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MyComponent from '@/components/MyComponent.vue'

describe('MyComponent', () => {
  let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    wrapper = mount(MyComponent, {
      props: {
        title: '测试标题',
      },
      global: {
        stubs: {
          ChildComponent: true, // 存根子组件
        },
      },
    })
  })

  it('应显示标题', () => {
    expect(wrapper.find('[data-testid="title"]').text()).toBe('测试标题')
  })

  it('点击按钮应触发事件', async () => {
    await wrapper.find('[data-testid="submit-btn"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
```

## 带有 Pinia Store 的组件

```typescript
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})
```

## 注意事项

- 不要测试私有方法或内部状态
- 使用 `data-testid` 而非 CSS 类名定位元素
- 组件测试位置：`src/__tests__/`
