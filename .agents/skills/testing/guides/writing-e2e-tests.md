# E2E 测试编写指南

## 核心原则

1. **零后端依赖**：所有 API 通过 Playwright Route 拦截 mock
2. **用户流程**：测试完整的用户操作路径
3. **数据验证**：通过 `window.__pinia__` 验证 Store 状态
4. **环境标识**：E2E 模式通过 `VITE_E2E=true` 启用 Pinia 暴露

## API Mock 封装

`e2e/helpers/api-mock.ts` 提供了完整的 API mock 函数：

```typescript
import { mockAllApi, mockAuthApi, mockUnauthorized, mockNetworkError } from '../helpers/api-mock'

// mock 所有 API（默认 fixture 数据）
await mockAllApi(page)

// 仅 mock 认证 API
await mockAuthApi(page)

// 模拟 401 未授权
await mockUnauthorized(page)

// 模拟网络错误
await mockNetworkError(page)
```

## 自定义 Fixtures

`e2e/helpers/test-fixtures.ts` 提供了带认证模式的测试 fixture：

```typescript
import { test, expect } from '../helpers/test-fixtures'

// 默认 authenticated 模式
test('登录后测试', async ({ page, mockApi }) => {
  await mockApi()
  // ...
})
```

## 数据验证

```typescript
import { getStoreState, injectLocalStorage } from '../helpers/data-verify'

// 读取 Store 状态
const authState = await getStoreState(page, 'auth')

// 注入 localStorage
await injectLocalStorage(page, { access_token: 'mock-token' })
```

## Web 端 E2E

```bash
pnpm e2e          # 运行所有
pnpm e2e:headed   # 有头模式（调试用）
pnpm e2e:ui       # Playwright UI 模式
```

## 桌面端 E2E

桌面端使用 WebDriverIO + tauri-driver，需要先构建 Tauri 应用：

```bash
pnpm tauri:build
pnpm e2e:tauri
```

## 注意事项

- E2E 测试文件位置：`e2e/web/`（Web 端）、`e2e/tauri/`（桌面端）
- 每个 `beforeEach` 中必须调用 `mockAllApi(page)` 或具体 mock
- 使用 `page.waitForLoadState('networkidle')` 等待页面加载完成
- Web 端测试不应出现桌面专属功能（托盘、自启动等）
- 桌面端测试需要构建好的 release 二进制文件
