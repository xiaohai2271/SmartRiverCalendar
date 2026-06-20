// 组件测试模板 — 用于 Vue 组件渲染和交互测试
// 位置：src/__tests__/<component-name>.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
// import ComponentName from '@/components/xxx/ComponentName.vue'

describe('<ComponentName>', () => {
  // let wrapper: ReturnType<typeof mount>

  beforeEach(() => {
    // wrapper = mount(ComponentName, {
    //   props: { ... },
    //   global: {
    //     provide: { ... },  // 提供 Pinia/Router 等依赖
    //     stubs: { ... },     // 存根子组件
    //   },
    // })
  })

  // afterEach(() => {
  //   wrapper?.unmount()
  // })

  describe('渲染', () => {
    it('应正确渲染默认状态', () => {
      // 验证组件渲染的 DOM 结构
      // expect(wrapper.find('.title').text()).toBe('预期文本')
    })

    it('应根据 props 显示不同内容', () => {
      // 验证 props 对渲染的影响
    })
  })

  describe('交互', () => {
    it('点击按钮应触发事件', async () => {
      // await wrapper.find('button').trigger('click')
      // await flushPromises()
      // expect(wrapper.emitted('click')).toBeTruthy()
    })

    it('表单输入应更新模型', async () => {
      // const input = wrapper.find('input')
      // await input.setValue('测试值')
      // expect(wrapper.vm.modelValue).toBe('测试值')
    })
  })

  describe('条件渲染', () => {
    it('loading 状态应显示加载指示器', () => {
      // 验证条件渲染逻辑
    })
  })
})
