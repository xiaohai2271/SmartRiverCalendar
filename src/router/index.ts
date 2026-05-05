import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue')
    },
    {
      path: '/calendar',
      name: 'calendar',
      component: () => import('../views/CalendarView.vue')
    },
    {
      path: '/todos',
      name: 'todos',
      component: () => import('../views/TodosView.vue')
    },
    {
      path: '/schedules',
      name: 'schedules',
      component: () => import('../views/ScheduleView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue')
    },
    {
      path: '/calendar-popup',
      name: 'calendar-popup',
      component: () => import('../views/CalendarPopupView.vue')
    },
    {
      path: '/reminder-popup',
      name: 'reminder-popup',
      component: () => import('../views/ReminderPopupView.vue')
    },
    // 隐藏的调试页面（不在导航中显示）
    {
      path: '/debug',
      name: 'debug',
      component: () => import('../views/DebugView.vue')
    }
  ]
})

// 调试：路由导航完成后打印当前路由
router.afterEach((to) => {
  console.log('[Router] 导航完成 →', to.fullPath, '| 路由名:', to.name, '| BASE_URL:', import.meta.env.BASE_URL)
})

export default router