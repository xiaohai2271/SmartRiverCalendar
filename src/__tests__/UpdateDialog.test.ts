/**
 * UpdateDialog 组件测试
 * 按照 TDD 流程编写
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UpdateDialog from '@/components/update/UpdateDialog.vue'
import type { UpdateInfo } from '@/types'

describe('UpdateDialog 组件', () => {
  // 测试数据 - 使用 Markdown 格式的更新日志
  const mockUpdateInfo: UpdateInfo = {
    version: '1.1.0',
    body: '### 新增功能\n\n- 支持深色模式\n- 优化性能\n\n### 修复\n\n- 修复已知问题',
    date: '2024-01-15'
  }

  // 每个测试前清理 DOM
  beforeEach(() => {
    // 清理可能残留的 teleport 内容
    document.body.innerHTML = ''
  })

  // 每个测试后清理
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /**
   * 测试1: visible=true 时显示对话框
   */
  it('当 visible=true 时应该显示对话框', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    // Teleport 渲染到 body，需要查询 document
    expect(document.body.querySelector('.dialog-overlay')).not.toBeNull()
    expect(document.body.querySelector('.update-dialog')).not.toBeNull()
  })

  /**
   * 测试2: visible=false 时不显示对话框
   */
  it('当 visible=false 时不应该显示对话框', () => {
    mount(UpdateDialog, {
      props: {
        visible: false,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    // Teleport 不应该渲染内容
    expect(document.body.querySelector('.dialog-overlay')).toBeNull()
    expect(document.body.querySelector('.update-dialog')).toBeNull()
  })

  /**
   * 测试3: 版本号正确渲染
   */
  it('应该正确渲染版本号', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const versionEl = document.body.querySelector('.version')
    expect(versionEl).not.toBeNull()
    expect(versionEl!.textContent).toBe('1.1.0')
  })

  /**
   * 测试4: 更新日志正确渲染（Markdown → HTML）
   */
  it('应该将 Markdown 格式的更新日志渲染为 HTML', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const logContent = document.body.querySelector('.update-log')
    expect(logContent).not.toBeNull()
    // 验证 Markdown 标题转换为 HTML 标题
    expect(logContent!.innerHTML).toContain('<h3')
    expect(logContent!.textContent).toContain('新增功能')
    // 验证 Markdown 列表转换为 HTML 列表
    expect(logContent!.innerHTML).toContain('<li>支持深色模式</li>')
    expect(logContent!.innerHTML).toContain('<li>优化性能</li>')
    expect(logContent!.innerHTML).toContain('<li>修复已知问题</li>')
  })

  /**
   * 测试5: body 为空时显示"暂无更新日志"
   */
  it('当 body 为空时应该显示"暂无更新日志"', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: {
          version: '1.1.0',
          body: '',
          date: '2024-01-15'
        }
      },
      attachTo: document.body
    })

    const emptyLog = document.body.querySelector('.empty-log')
    expect(emptyLog).not.toBeNull()
    expect(emptyLog!.textContent?.trim()).toBe('暂无更新日志')
  })

  /**
   * 测试6: body 为 undefined 时显示"暂无更新日志"
   */
  it('当 body 为 undefined 时应该显示"暂无更新日志"', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: {
          version: '1.1.0',
          date: '2024-01-15'
        } as UpdateInfo
      },
      attachTo: document.body
    })

    const emptyLog = document.body.querySelector('.empty-log')
    expect(emptyLog).not.toBeNull()
    expect(emptyLog!.textContent?.trim()).toBe('暂无更新日志')
  })

  /**
   * 测试7: "现在升级"按钮触发 upgrade 事件
   */
  it('点击"现在升级"按钮应该触发 upgrade 事件', async () => {
    const wrapper = mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const upgradeBtn = document.body.querySelector('.btn-accent')
    expect(upgradeBtn).not.toBeNull()
    expect(upgradeBtn!.textContent).toBe('现在升级')

    await upgradeBtn!.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('upgrade')).toBeTruthy()
    expect(wrapper.emitted('upgrade')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试8: "稍后"按钮触发 later 事件
   */
  it('点击"稍后"按钮应该触发 later 事件', async () => {
    const wrapper = mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const secondaryBtns = document.body.querySelectorAll('.btn-secondary')
    expect(secondaryBtns.length).toBeGreaterThanOrEqual(1)

    const laterBtn = secondaryBtns[0]
    expect(laterBtn.textContent?.trim()).toBe('稍后')

    await laterBtn.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('later')).toBeTruthy()
    expect(wrapper.emitted('later')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试9: "不再提示"按钮触发 skip 事件
   */
  it('点击"不再提示"按钮应该触发 skip 事件', async () => {
    const wrapper = mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const secondaryBtns = document.body.querySelectorAll('.btn-secondary')
    expect(secondaryBtns.length).toBeGreaterThanOrEqual(2)

    const skipBtn = secondaryBtns[1]
    expect(skipBtn.textContent?.trim()).toBe('不再提示')

    await skipBtn.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('skip')).toBeTruthy()
    expect(wrapper.emitted('skip')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试10: 点击关闭按钮触发 close 事件
   */
  it('点击关闭按钮应该触发 close 事件', async () => {
    const wrapper = mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const closeBtn = document.body.querySelector('.close-btn')
    expect(closeBtn).not.toBeNull()

    await closeBtn!.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试11: 点击遮罩层触发 close 事件
   */
  it('点击遮罩层应该触发 close 事件', async () => {
    const wrapper = mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    const overlay = document.body.querySelector('.dialog-overlay')
    expect(overlay).not.toBeNull()

    // 触发点击事件
    await overlay!.dispatchEvent(new Event('click'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')!.length).toBe(1)

    wrapper.unmount()
  })

  /**
   * 测试12: loading=true 时所有按钮禁用
   */
  it('当 loading=true 时所有按钮应该禁用', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo,
        loading: true
      },
      attachTo: document.body
    })

    // 检查所有按钮是否禁用
    const accentBtn = document.body.querySelector('.btn-accent') as HTMLButtonElement
    const secondaryBtns = document.body.querySelectorAll('.btn-secondary') as NodeListOf<HTMLButtonElement>
    const closeBtn = document.body.querySelector('.close-btn') as HTMLButtonElement

    expect(accentBtn.disabled).toBe(true)
    secondaryBtns.forEach(btn => {
      expect(btn.disabled).toBe(true)
    })
    expect(closeBtn.disabled).toBe(true)
  })

  /**
   * 测试13: loading=true 时"现在升级"按钮显示"下载中..."
   */
  it('当 loading=true 时"现在升级"按钮应该显示"下载中..."', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo,
        loading: true
      },
      attachTo: document.body
    })

    const upgradeBtn = document.body.querySelector('.btn-accent')
    expect(upgradeBtn).not.toBeNull()
    expect(upgradeBtn!.textContent).toBe('下载中...')
  })

  /**
   * 测试14: loading=false 时按钮不禁用
   */
  it('当 loading=false 时按钮不应该禁用', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo,
        loading: false
      },
      attachTo: document.body
    })

    // 检查所有按钮不禁用
    const accentBtn = document.body.querySelector('.btn-accent') as HTMLButtonElement
    const secondaryBtns = document.body.querySelectorAll('.btn-secondary') as NodeListOf<HTMLButtonElement>
    const closeBtn = document.body.querySelector('.close-btn') as HTMLButtonElement

    expect(accentBtn.disabled).toBe(false)
    secondaryBtns.forEach(btn => {
      expect(btn.disabled).toBe(false)
    })
    expect(closeBtn.disabled).toBe(false)
  })

  /**
   * 测试15: updateInfo 为 null 时正确处理
   */
  it('当 updateInfo 为 null 时应该正确渲染', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: null
      },
      attachTo: document.body
    })

    // 对话框应该仍然渲染
    expect(document.body.querySelector('.dialog-overlay')).not.toBeNull()
    expect(document.body.querySelector('.update-dialog')).not.toBeNull()

    // 版本号应该为空
    const versionEl = document.body.querySelector('.version')
    expect(versionEl).not.toBeNull()
    expect(versionEl!.textContent).toBe('')

    // 应该显示空日志
    expect(document.body.querySelector('.empty-log')).not.toBeNull()
  })

  /**
   * 测试16: 对话框使用 Teleport 到 body
   */
  it('应该使用 Teleport 将对话框渲染到 body', () => {
    mount(UpdateDialog, {
      props: {
        visible: true,
        updateInfo: mockUpdateInfo
      },
      attachTo: document.body
    })

    // 检查是否渲染到 body
    expect(document.body.querySelector('.dialog-overlay')).not.toBeNull()
    expect(document.body.querySelector('.update-dialog')).not.toBeNull()
  })
})
