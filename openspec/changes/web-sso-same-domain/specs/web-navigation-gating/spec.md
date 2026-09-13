## ADDED Requirements

### Requirement: Web 端未登录时隐藏"我的"导航项

Web 端 `src/App.vue` 侧边栏 SHALL 在 `authStore.isAuthenticated === false` 时不渲染指向 `/profile` 的 `<router-link>` 元素。导航项 SHALL 通过 `v-if="!capabilities.hasSsoLogin || authStore.isAuthenticated"` 条件控制：Web 端 (`hasSsoLogin=true`) 仅在已登录时显示，桌面端 Tauri (`hasSsoLogin=false`) 始终显示。

#### Scenario: Web 端未登录状态
- **WHEN** Web 端应用启动且 `authStore.isAuthenticated === false`
- **THEN** 侧边栏导航不渲染"我的"链接，DOM 中无对应 `<router-link to="/profile">` 元素

#### Scenario: Web 端已登录状态
- **WHEN** Web 端用户完成登录，`authStore.isAuthenticated` 变为 `true`
- **THEN** 侧边栏导航渲染"我的"链接，DOM 中存在 `<router-link to="/profile">` 元素

#### Scenario: Web 端登出后
- **WHEN** Web 端用户登出，`authStore.isAuthenticated` 变为 `false`
- **THEN** 侧边栏导航自动移除"我的"链接（响应式）

#### Scenario: 桌面端 Tauri 始终显示
- **WHEN** 桌面端 Tauri 应用启动，无论 `authStore.isAuthenticated` 为何值
- **THEN** 侧边栏导航始终渲染"我的"链接（`!false || X === true`）

#### Scenario: 直接 URL 访问 /profile 仍允许
- **WHEN** 用户在 Web 端未登录时通过地址栏直接访问 `/profile`
- **THEN** 路由正常跳转，ProfileView 渲染登录表单（不重定向、不拦截）

### Requirement: 复用现有平台能力与认证状态

系统 SHALL 复用现有 `useCapabilities()` 返回的 `hasSsoLogin` 能力声明与 `useAuthStore()` 返回的 `isAuthenticated` 状态，不新增平台能力字段或 Store 状态，避免能力/状态膨胀。

#### Scenario: 无新增能力字段
- **WHEN** `PlatformCapabilities` 接口被检查
- **THEN** `hasSsoLogin` 已在 `web-sso-integration` capability 中定义，本 capability 不新增字段

#### Scenario: 无新增 Store 状态
- **WHEN** `AuthStore` 被检查
- **THEN** `isAuthenticated` 已是标准字段，导航门控不新增任何响应式状态

### Requirement: 不影响现有导航守卫与路由结构

Web 端导航门控 SHALL 仅修改 `src/App.vue` 侧边栏模板，不修改 `src/router/index.ts` 路由表，不新增 `router.beforeEach` 守卫，不为 `/profile` 添加 `meta.requiresAuth` 字段。ProfileView 内部已支持未登录态渲染（显示登录表单），无路由级拦截需求。

#### Scenario: 路由表不变
- **WHEN** 开发者检查 `src/router/index.ts`
- **THEN** `/profile` 路由定义未变，无 `meta.requiresAuth` 字段

#### Scenario: 无新增路由守卫
- **WHEN** 开发者检查 `src/router/index.ts` 全局守卫
- **THEN** 未新增 `beforeEach` 守卫处理 `/profile` 路径

## MODIFIED Requirements

（无）
