/**
 * 路由配置测试 - 弹出窗口路由
 */
import { describe, it, expect } from 'vitest'
import router from '@/router'

describe('弹出窗口路由配置', () => {
  it('应该包含 /calendar-popup 路由', () => {
    const routes = router.getRoutes()
    const popupRoute = routes.find(route => route.path === '/calendar-popup')

    expect(popupRoute).toBeDefined()
    expect(popupRoute?.name).toBe('calendar-popup')
  })

  it('弹出窗口路由应该使用懒加载', () => {
    const routes = router.getRoutes()
    const popupRoute = routes.find(route => route.path === '/calendar-popup')

    // 懒加载的组件应该是一个函数
    expect(typeof popupRoute?.components?.default).toBe('function')
  })

  it('所有路由配置应该有效', () => {
    const routes = router.getRoutes()
    const paths = routes.map(route => route.path)

    // 验证基础路由存在
    expect(paths).toContain('/')
    expect(paths).toContain('/calendar')
    expect(paths).toContain('/todos')
    expect(paths).toContain('/settings')
    expect(paths).toContain('/calendar-popup')
  })
})
