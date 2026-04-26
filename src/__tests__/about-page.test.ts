/**
 * AboutView 组件测试 - TDD RED 阶段
 * 测试 should FAIL 因为 AboutView.vue 尚未完整实现
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AboutView from '@/views/AboutView.vue'

describe('AboutView 组件', () => {
  // 每个测试前清理 DOM
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  // 每个测试后清理
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /**
   * 测试1: 渲染页面标题「小河日历」
   */
  it('应该渲染页面标题「小河日历」', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15')
    vi.stubGlobal('__GIT_HASH__', 'abc123')

    mount(AboutView, {
      attachTo: document.body
    })

    const titleEl = document.body.querySelector('h1')
    expect(titleEl).not.toBeNull()
    expect(titleEl!.textContent).toBe('小河日历')

    vi.unstubAllGlobals()
  })

  /**
   * 测试2: 展示版本号
   */
  it('应该展示版本号', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15')
    vi.stubGlobal('__GIT_HASH__', 'abc123')

    mount(AboutView, {
      attachTo: document.body
    })

    const versionEl = document.body.querySelector('.version')
    expect(versionEl).not.toBeNull()
    expect(versionEl!.textContent).toBe('1.0.0')

    vi.unstubAllGlobals()
  })

  /**
   * 测试3: 展示编译日期
   */
  it('应该展示编译日期', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15 10:30:00')
    vi.stubGlobal('__GIT_HASH__', 'abc123')

    mount(AboutView, {
      attachTo: document.body
    })

    const dateEl = document.body.querySelector('.build-date')
    expect(dateEl).not.toBeNull()
    expect(dateEl!.textContent).toBe('2024-01-15 10:30:00')

    vi.unstubAllGlobals()
  })

  /**
   * 测试4: 展示 git hash
   */
  it('应该展示 git hash', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15')
    vi.stubGlobal('__GIT_HASH__', 'abc123def456')

    mount(AboutView, {
      attachTo: document.body
    })

    const hashEl = document.body.querySelector('.git-hash')
    expect(hashEl).not.toBeNull()
    expect(hashEl!.textContent).toBe('abc123def456')

    vi.unstubAllGlobals()
  })

  /**
   * 测试5: git hash 为 'unknown' 时的降级展示
   */
  it('当 git hash 为 "unknown" 时应该降级展示', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15')
    vi.stubGlobal('__GIT_HASH__', 'unknown')

    mount(AboutView, {
      attachTo: document.body
    })

    const hashEl = document.body.querySelector('.git-hash')
    expect(hashEl).not.toBeNull()
    expect(hashEl!.textContent).toBe('unknown')

    vi.unstubAllGlobals()
  })

  /**
   * 测试6: 「返回设置」链接存在
   */
  it('应该存在「返回设置」链接', () => {
    vi.stubGlobal('__APP_VERSION__', '1.0.0')
    vi.stubGlobal('__BUILD_DATE__', '2024-01-15')
    vi.stubGlobal('__GIT_HASH__', 'abc123')

    mount(AboutView, {
      attachTo: document.body
    })

    const backLink = document.body.querySelector('.back-link')
    expect(backLink).not.toBeNull()
    expect(backLink!.textContent).toContain('返回设置')

    vi.unstubAllGlobals()
  })
})