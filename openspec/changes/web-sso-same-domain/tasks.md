## 1. 类型与错误码扩展

- [x] 1.1 在 `src/platform/types/auth.repository.ts` 新增 `SsoSessionResult` 与 `SsoEvent` 联合类型定义（含 `import type`）
- [x] 1.2 在 `src/platform/types/platform-capabilities.ts`（或当前 `capabilities.ts`）的 `PlatformCapabilities` 接口新增 `hasSsoLogin: boolean` 字段
- [x] 1.3 在 `src/platform/errors.ts` 的 `RepoErrorCodes` 枚举中新增 `SSO_SESSION_EXPIRED = 'SSO_SESSION_EXPIRED'`

## 2. IAuthRepository 接口扩展

- [x] 2.1 在 `src/platform/types/auth.repository.ts` 的 `IAuthRepository` 接口中新增 `detectSsoSession(): Promise<SsoSessionResult>` 方法签名
- [x] 2.2 在 `IAuthRepository` 接口中新增 `notifySsoEvent(event: SsoEvent): Promise<void>` 方法签名
- [x] 2.3 在 `IAuthRepository` 接口中新增 `subscribeSsoEvents(callback: (event: SsoEvent) => void): () => void` 方法签名
- [x] 2.4 为三个新方法添加 JSDoc 中文注释，说明 Web/桌面端的实现差异

## 3. PlatformCapabilities 各平台实现

- [x] 3.1 在 `src/platform/web/capabilities.ts` 的 `WebCapabilities` 类中设置 `hasSsoLogin = true`
- [x] 3.2 在 `src/platform/tauri/capabilities.ts` 的 `TauriCapabilities` 类中设置 `hasSsoLogin = false`
- [x] 3.3 在 `src/platform/capabilities.ts` 的基类/默认实现中设置 `hasSsoLogin = false`（兜底）

## 4. WebAuthRepository 实现

- [x] 4.1 在 `src/platform/web/auth.repo.ts` 的 `WebAuthRepository` 类中实现 `detectSsoSession()`：调用 `GET /v1/user/profile` 带 `credentials: 'include'`，200 返 `{ loggedIn: true, user }`，401 返 `{ loggedIn: false }`，网络错误 catch 返 `{ loggedIn: false }`
- [x] 4.2 在 `WebAuthRepository` 中实现 401 + `wasLoggedIn=true` 时抛 `RepositoryError(code='SSO_SESSION_EXPIRED')`（通过 `authStore.wasLoggedIn` getter 注入或参数传入）
- [x] 4.3 在 `WebAuthRepository` 中实现 `notifySsoEvent()`：`BroadcastChannel('smart-river-calendar-sso').postMessage(event)`
- [x] 4.4 在 `WebAuthRepository` 中实现 `subscribeSsoEvents()`：创建 BroadcastChannel 实例，绑定 `onmessage` 触发 callback，返回取消订阅函数（关闭 channel + 移除监听）
- [x] 4.5 在 `WebAuthRepository.checkAuthStatus` 中调整检测优先级：先 `credentials: 'include'` 检测（`/user/profile`），回退到 localStorage Bearer

## 5. TauriAuthRepository No-Op 实现

- [x] 5.1 在 `src/platform/tauri/auth.repo.ts` 的 `TauriAuthRepository` 类中实现 `detectSsoSession()` 返回 `{ loggedIn: false }`
- [x] 5.2 在 `TauriAuthRepository` 中实现 `notifySsoEvent()` 为 no-op（直接 resolve）
- [x] 5.3 在 `TauriAuthRepository` 中实现 `subscribeSsoEvents()` 返回 no-op 取消函数

## 6. WebApiClient credentials 全局透传

- [x] 6.1 在 `src/platform/web/api-client.ts` 的 `WebApiClient.fetch()` 私有方法中，对所有同源 / 跨域请求设置 `credentials: 'include'`
- [x] 6.2 在 `WebApiClient` 401 响应处理中，新增 `SSO_SESSION_EXPIRED` 错误转换（按 `wasLoggedIn` 状态判断）
- [x] 6.3 在 `WebApiClient` 中处理 401 时增加对 `wasLoggedIn` 状态的依赖注入（通过构造参数或 setter），确保错误码准确

## 7. SsoCoordinator 模块

- [x] 7.1 在 `src/platform/web/` 目录下创建 `sso-coordinator.ts` 文件，导出 `SsoCoordinator` 类
- [x] 7.2 在 `SsoCoordinator` 类中实现 `start({ onSessionChange, pollIntervalMs })` 方法：注册 `document.visibilitychange` 监听 + 启动 `setInterval` 定时轮询 + 调用 `authRepo.subscribeSsoEvents()` 订阅
- [x] 7.3 在 `SsoCoordinator` 中实现 visibilitychange 200ms debounce + `AbortController` 取消上一次未完成请求
- [x] 7.4 在 `SsoCoordinator` 中实现标签页隐藏时暂停定时器、可见时恢复的逻辑（基于 `document.visibilityState`）
- [x] 7.5 在 `SsoCoordinator` 中实现 `stop()` 方法：清理所有监听器 + 清除定时器 + 调取消订阅函数
- [x] 7.6 在 `SsoCoordinator` 中实现 `pollIntervalMs` 默认值 30000，读取 `import.meta.env.VITE_SSO_POLL_INTERVAL_MS` 环境变量覆盖
- [x] 7.7 在 `sso-coordinator.ts` 顶部添加中文注释，说明跨子域 BroadcastChannel 降级策略

## 8. AuthStore 集成 SSO

- [x] 8.1 在 `src/stores/auth.ts` 的 AuthStore 中新增 `wasLoggedIn: Ref<boolean>` 响应式状态
- [x] 8.2 在 AuthStore 中新增 `ssoCoordinator` 实例（仅 Web 端按 `hasSsoLogin` 能力创建）
- [x] 8.3 在 AuthStore 中新增 `lastKnownLoggedIn` 状态持久化到 `localStorage`，登录成功后置 `true`，登出后置 `false`
- [x] 8.4 修改 `AuthStore.initialize()`：在 `getCurrentUser()` 失败后调 `authRepo.detectSsoSession()`，200 时直接进入已登录态
- [x] 8.5 在 `AuthStore.initialize()` 末尾，若 `hasSsoLogin === true` 则启动 `ssoCoordinator.start({ onSessionChange: handleSessionChange })`
- [x] 8.6 在 AuthStore 中实现 `handleSessionChange(result)`：当 `loggedIn: false` 时清空本地态 + Pinia 状态 + 广播登出
- [x] 8.7 修改 `AuthStore.logout()`：在末尾调 `authRepo.notifySsoEvent({ type: 'logout' })`（仅 Web 端）
- [x] 8.8 在 AuthStore 中实现 SSO 事件订阅回调：收到 `{ type: 'logout' }` 清本地态不调后端；收到 `{ type: 'login' }` 调 `getCurrentUser()` 同步用户
- [x] 8.9 在 AuthStore 中新增 `SSO_SESSION_EXPIRED` catch 逻辑：清空 `localStorage` + Pinia 状态 + 提示 UI "会话已过期"

## 9. AuthStore SsoCoordinator 生命周期

- [x] 9.1 在 `src/main.ts` 或应用根组件的 `onUnmounted` 钩子中调 `authStore.cleanup()`（新增方法）
- [x] 9.2 在 `AuthStore.cleanup()` 中调 `ssoCoordinator.stop()`，确保所有监听器、定时器、订阅被清理
- [x] 9.3 在 `AuthStore` 中确保桌面端不创建 SsoCoordinator（用 `hasSsoLogin` 判断）

## 10. 环境变量与配置

- [x] 10.1 在 `.env.development` 添加注释：`# VITE_SSO_POLL_INTERVAL_MS=30000`（默认 30 秒）
- [x] 10.2 在 `.env.production` 添加注释：`# VITE_SSO_POLL_INTERVAL_MS=30000` + `# VITE_SSO_DISABLED=false`
- [x] 10.3 在 `.env.example`（如有）补充上述两个环境变量说明
- [x] 10.4 在 `vite.config.ts` 确认 `server.proxy` 配置支持 Cookie 透传（`changeOrigin: true` + `secure: false` 仅 dev 模式）

## 11. 单元测试

- [x] 11.1 在 `src/platform/web/__tests__/auth.repo.test.ts` 新增 `detectSsoSession()` 测试：200 路径、401 路径、网络错误路径
- [x] 11.2 在 `auth.repo.test.ts` 新增 `notifySsoEvent()` 测试：验证 BroadcastChannel.postMessage 被调用
- [x] 11.3 在 `auth.repo.test.ts` 新增 `subscribeSsoEvents()` 测试：验证 onmessage 触发 callback + 取消订阅清理
- [x] 11.4 在 `src/platform/web/__tests__/sso-coordinator.test.ts` 新增 SsoCoordinator 测试：visibilitychange 触发检测、轮询触发检测、隐藏暂停轮询、stop 清理资源
- [x] 11.5 在 `src/platform/web/__tests__/sso-coordinator.test.ts` 新增 debounce 测试：200ms 内多次 visibilitychange 只触发一次检测
- [x] 11.6 在 `src/platform/web/__tests__/sso-coordinator.test.ts` 新增 AbortController 测试：上一次未完成请求被取消
- [x] 11.7 在 `src/__tests__/auth-store-sso.test.ts` 新增 `initialize()` SSO 检测路径测试：detectSsoSession 返 `{ loggedIn: true, user }` 时进入已登录态
- [x] 11.8 在 `auth-store-sso.test.ts` 新增 `logout()` 广播测试：调 `notifySsoEvent({ type: 'logout' })`
- [x] 11.9 在 `auth-store-sso.test.ts` 新增 `wasLoggedIn` 状态测试：localStorage 恢复、登录后置 true
- [x] 11.10 在 `auth-store-sso.test.ts` 新增 `SSO_SESSION_EXPIRED` catch 测试：清空 localStorage + Pinia 状态
- [x] 11.11 在 `src/platform/__tests__/capabilities.test.ts` 新增 `hasSsoLogin` 字段测试：Web 端 true、Tauri 端 false
- [x] 11.12 在 `src/platform/tauri/__tests__/auth.repo.test.ts` 新增 no-op 测试：detectSsoSession/notifySsoEvent/subscribeSsoEvents 均 no-op

## 12. 类型与 Lint 检查

- [x] 12.1 运行 `pnpm tsc --noEmit` 确保新增类型无 TypeScript 错误
- [x] 12.2 运行 `pnpm lint` 确保无 ESLint 错误（特别是禁止 `as any` / `@ts-ignore`）
- [x] 12.3 运行 `pnpm test:run` 确保所有测试通过且覆盖率 ≥ 60%

## 13. 集成验证

- [ ] 13.1 手动验证 dev 模式：本地 `pnpm dev` + 模拟 RiverCalenderWeb 已登录状态，确认自动登录
- [ ] 13.2 手动验证 visibilitychange：切到 RiverCalenderWeb 登出，再切回当前项目，确认 30 秒内自动登出
- [ ] 13.3 手动验证 BroadcastChannel：同源两个标签页，一个登出，确认另一个立即登出
- [ ] 13.4 手动验证桌面端无影响：`pnpm tauri:dev` 启动桌面端，确认登录流程不变
- [ ] 13.5 手动验证 OAuth 登录：GitHub OAuth 走完整流程，确认 Cookie + Bearer 双通道都正常

## 14. 文档与 PR

- [ ] 14.1 在 `AGENTS.md`（如有）补充 SSO 模块的注意事项（HttpOnly Cookie、跨子域降级）
- [ ] 14.2 在 `openspec/changes/web-sso-same-domain/` 下补充 README（如有），描述开发/部署注意事项
- [ ] 14.3 创建 PR：`feature/web-sso-same-domain` → `main`，标题格式 `feat(web): 接入 RiverCalenderWeb 同根域 SSO 集成`
- [ ] 14.4 PR 描述引用 `proposal.md` + `design.md` + 关键 specs

## 15. 导航栏登录态门控（Web 端）

- [x] 15.1 在 `src/App.vue` 的 `<script setup>` 中新增 `import { useCapabilities }` 与 `import { useAuthStore }`（已有依赖无需安装）
- [x] 15.2 在 `src/App.vue` 中调用 `const capabilities = useCapabilities()` 与 `const authStore = useAuthStore()`，挂载到 setup 作用域
- [x] 15.3 在 `src/App.vue` 侧边栏（line 71-79）的"我的"路由链接 `<router-link to="/profile">` 上添加 `v-if="!capabilities.hasSsoLogin || authStore.isAuthenticated"`
- [x] 15.4 验证 `src/router/index.ts` 的 `/profile` 路由未变（无 `meta.requiresAuth`）
- [x] 15.5 验证未新增 `router.beforeEach` 守卫处理 `/profile` 路径
- [x] 15.6 新增 `src/__tests__/app-navigation.test.ts` 测试：mock `useCapabilities` 返回 `{ hasSsoLogin: true }` + `authStore.isAuthenticated = false`，断言 `findByText('我的').exists() === false`
- [x] 15.7 新增 `src/__tests__/app-navigation.test.ts` 测试：mock `{ hasSsoLogin: true }` + `isAuthenticated = true`，断言"我的"链接存在
- [x] 15.8 新增 `src/__tests__/app-navigation.test.ts` 测试：mock `{ hasSsoLogin: false }`（Tauri），断言无论 `isAuthenticated` 为何值"我的"链接都存在
- [ ] 15.9 手动验证 dev 模式：未登录启动应用，浏览器 DevTools 检查 DOM 无"我的"链接
- [ ] 15.10 手动验证：直接访问 `/profile` URL，确认显示登录表单（无重定向）

## 16. 最终验证与归档

- [ ] 16.1 运行 `npx openspec validate web-sso-same-domain --strict` 确保制品仍通过校验
- [x] 16.2 运行 `pnpm tsc --noEmit` 确保新增能力与导航修改无 TypeScript 错误
- [x] 16.3 运行 `pnpm lint` 确保无 ESLint 错误
- [x] 16.4 运行 `pnpm test:run` 确保所有测试通过（auth.repo、sso-coordinator、auth-store-sso、app-navigation）
- [ ] 16.5 测试覆盖率 ≥ 60%（重点覆盖 sso-coordinator.ts、auth.repo.ts 三个新方法）
- [ ] 16.6 实施完成后归档：`npx openspec archive web-sso-same-domain`
