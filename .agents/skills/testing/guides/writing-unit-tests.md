# 单元测试编写指南

## 核心原则

1. **AAA 模式**：Arrange-Act-Assert，每个测试结构清晰
2. **单一职责**：每个测试只验证一个行为
3. **Mock Repository**：Store 测试通过 mock Repository 接口，不依赖平台
4. **中文描述**：测试描述使用中文，清晰表达意图

## Store 测试模式

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { usePlatform } from '@/platform/provider'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

// mock 平台 Provider
vi.mock('@/platform/provider')

describe('Auth Store', () => {
  const mockAuthRepo = {
    login: vi.fn(),
    logout: vi.fn(),
    detectSsoSession: vi.fn(),
    notifySsoEvent: vi.fn(),
    subscribeSsoEvents: vi.fn(),
  }

  const mockCapabilities = {
    hasSsoLogin: true,
    hasOAuthLogin: true,
  }

  beforeEach(() => {
    vi.mocked(usePlatform).mockReturnValue({
      authRepo: mockAuthRepo as any,
      capabilities: mockCapabilities as any,
    } as any)
    vi.clearAllMocks()
  })

  it('登录成功应更新用户状态', async () => {
    mockAuthRepo.login.mockResolvedValue({ user: { id: 1, email: 'test@example.com' } })
    const store = useAuthStore()
    await store.login('test@example.com', 'password')
    expect(store.user?.email).toBe('test@example.com')
  })

  it('登录失败应抛出 RepositoryError', async () => {
    mockAuthRepo.login.mockRejectedValue(
      new RepositoryError({ code: RepoErrorCodes.AUTH_FAILED, message: '登录失败', platform: 'web' })
    )
    const store = useAuthStore()
    await expect(store.login('test', 'wrong')).rejects.toThrow(RepositoryError)
  })
})
```

## 工具函数测试

```typescript
import { describe, it, expect } from 'vitest'
import { formatDate } from '@/utils/date'

describe('formatDate', () => {
  it('应正确格式化日期', () => {
    const date = new Date(2026, 5, 21) // 2026-06-21
    expect(formatDate(date)).toBe('2026-06-21')
  })

  it('边界：应处理时间戳 0', () => {
    expect(formatDate(0)).toBe('1970-01-01')
  })
})
```

## 注意事项

- 不要在 Store 测试中直接调用 `invoke`/`safeInvoke`
- 不要在 Store 测试中直接调用 `webApi.xxx`
- 不要在 Store 测试中使用 `isTauri()` 做逻辑分支
- Repository mock 返回 camelCase 格式（与接口契约一致）
- 测试文件位置：`src/__tests__/`
