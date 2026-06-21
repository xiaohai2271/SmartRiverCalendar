# 多端数据架构重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小河日历项目从 Store 直接调用 Tauri invoke 的模式，重构为 Repository + 平台能力声明架构，使桌面端和 Web 端代码完全隔离、互不破坏。

**Architecture:** 引入 `src/platform/` 平台抽象层，定义 Repository 接口（ICalendarRepository 等）和 PlatformCapabilities 能力声明。Tauri 和 Web 各自实现接口，应用启动时注入。Store 只依赖接口，组件按能力判断功能可用性。

**Tech Stack:** Vue 3 + TypeScript + Pinia + Tauri 2.x (桌面) / fetch API (Web)

**设计文档:** `docs/superpowers/specs/2026-05-16-multi-platform-data-architecture-design.md`

---

## 文件结构映射

### 新建文件

| 文件路径 | 职责 |
|----------|------|
| `src/platform/types/calendar.repository.ts` | ICalendarRepository 接口 |
| `src/platform/types/event.repository.ts` | IEventRepository 接口 |
| `src/platform/types/todo.repository.ts` | ITodoRepository 接口 |
| `src/platform/types/settings.repository.ts` | ISettingsRepository 接口 |
| `src/platform/types/auth.repository.ts` | IAuthRepository 接口 |
| `src/platform/types/sync.repository.ts` | ISyncRepository 接口 |
| `src/platform/types/index.ts` | 统一导出所有接口 |
| `src/platform/capabilities.ts` | PlatformCapabilities 类型定义 |
| `src/platform/provider.ts` | PlatformProvider + 注入机制 |
| `src/platform/errors.ts` | RepositoryError 统一错误类型 |
| `src/platform/tauri/capabilities.ts` | 桌面端能力声明 |
| `src/platform/tauri/transforms.ts` | snake_case → camelCase 数据转换 |
| `src/platform/tauri/calendar.repo.ts` | TauriCalendarRepository |
| `src/platform/tauri/event.repo.ts` | TauriEventRepository |
| `src/platform/tauri/todo.repo.ts` | TauriTodoRepository |
| `src/platform/tauri/settings.repo.ts` | TauriSettingsRepository |
| `src/platform/tauri/auth.repo.ts` | TauriAuthRepository |
| `src/platform/tauri/sync.repo.ts` | TauriSyncRepository |
| `src/platform/tauri/index.ts` | createTauriProvider() |
| `src/platform/web/capabilities.ts` | Web 端能力声明 |
| `src/platform/web/api-client.ts` | Web API 客户端 |
| `src/platform/web/transforms.ts` | API 响应 → 前端类型转换 |
| `src/platform/web/calendar.repo.ts` | WebCalendarRepository |
| `src/platform/web/event.repo.ts` | WebEventRepository |
| `src/platform/web/todo.repo.ts` | WebTodoRepository |
| `src/platform/web/settings.repo.ts` | WebSettingsRepository |
| `src/platform/web/auth.repo.ts` | WebAuthRepository |
| `src/platform/web/sync.repo.ts` | WebSyncRepository |
| `src/platform/web/index.ts` | createWebProvider() |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/main.ts` | 添加平台初始化逻辑 |
| `src/stores/calendar.ts` | invoke 调用替换为 calendarRepo/eventRepo/syncRepo |
| `src/stores/todo.ts` | invoke 调用替换为 todoRepo |
| `src/stores/settings.ts` | settingsService 调用替换为 settingsRepo |
| `src/stores/auth.ts` | authService 调用替换为 authRepo |
| `src/stores/popupSettings.ts` | settingsService 调用替换为 settingsRepo |
| `src/services/reminder.ts` | isTauri() 替换为能力判断 |
| `src/services/rsa.ts` | isTauri() 替换为 authRepo.getPublicKey() |

### 废弃文件（重构完成后）

| 文件路径 | 说明 |
|----------|------|
| `src/utils/tauri.ts` | invokeXxx 函数迁移到 platform/tauri/，isTauri/safeInvoke 仅内部使用 |
| `src/utils/database.ts` | 迁移到 platform/tauri/database.ts |
| `src/services/webApi.ts` | 迁移到 platform/web/api-client.ts |
| `src/services/auth.ts` | 拆分到 platform/tauri/auth.repo.ts + platform/web/auth.repo.ts |
| `src/services/settings.ts` | 拆分到 platform/tauri/settings.repo.ts + platform/web/settings.repo.ts |
| `src/services/sync.ts` | 合并到 platform/tauri/sync.repo.ts + platform/web/sync.repo.ts |
| `src/services/cloudSync.ts` | 合并到 sync.repo.ts |
| `src/services/updater.ts` | 迁移到 platform/tauri/updater.ts |

---

## Phase 0: 平台抽象层基础设施

### Task 1: 创建 RepositoryError 统一错误类型

**Files:**
- Create: `src/platform/errors.ts`
- Test: `src/__tests__/platform/errors.test.ts`

- [ ] **Step 1: 编写 RepositoryError 测试**

```typescript
// src/__tests__/platform/errors.test.ts
import { describe, it, expect } from 'vitest'
import { RepositoryError, RepoErrorCodes } from '@/platform/errors'

describe('RepositoryError', () => {
  it('应正确构造错误对象', () => {
    const error = new RepositoryError({
      code: RepoErrorCodes.NETWORK_ERROR,
      message: '网络连接失败',
      platform: 'web',
    })
    expect(error.name).toBe('RepositoryError')
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toBe('网络连接失败')
    expect(error.platform).toBe('web')
    expect(error.cause).toBeUndefined()
  })

  it('应支持传入原始错误', () => {
    const cause = new Error('原始错误')
    const error = new RepositoryError({
      code: RepoErrorCodes.UNKNOWN,
      message: '未知错误',
      platform: 'tauri',
      cause,
    })
    expect(error.cause).toBe(cause)
  })

  it('RepoErrorCodes 应包含所有常用错误码', () => {
    expect(RepoErrorCodes.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(RepoErrorCodes.NOT_FOUND).toBe('NOT_FOUND')
    expect(RepoErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(RepoErrorCodes.AUTH_EXPIRED).toBe('AUTH_EXPIRED')
    expect(RepoErrorCodes.PLATFORM_UNAVAILABLE).toBe('PLATFORM_UNAVAILABLE')
    expect(RepoErrorCodes.UNKNOWN).toBe('UNKNOWN')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/__tests__/platform/errors.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 实现 RepositoryError**

```typescript
// src/platform/errors.ts

/** Repository 统一错误类型 */
export class RepositoryError extends Error {
  /** 错误码 */
  readonly code: string
  /** 来源平台 */
  readonly platform: 'tauri' | 'web'
  /** 原始错误 */
  readonly cause?: unknown

  constructor(params: {
    code: string
    message: string
    platform: 'tauri' | 'web'
    cause?: unknown
  }) {
    super(params.message)
    this.name = 'RepositoryError'
    this.code = params.code
    this.platform = params.platform
    this.cause = params.cause
  }
}

/** 常用错误码 */
export const RepoErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PLATFORM_UNAVAILABLE: 'PLATFORM_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/__tests__/platform/errors.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/platform/errors.ts src/__tests__/platform/errors.test.ts
git commit -m "feat: 添加 RepositoryError 统一错误类型"
```

---

### Task 2: 创建 PlatformCapabilities 类型定义

**Files:**
- Create: `src/platform/capabilities.ts`
- Test: `src/__tests__/platform/capabilities.test.ts`

- [ ] **Step 1: 编写能力类型测试**

```typescript
// src/__tests__/platform/capabilities.test.ts
import { describe, it, expect } from 'vitest'
import type { PlatformCapabilities } from '@/platform/capabilities'

describe('PlatformCapabilities', () => {
  it('应包含数据存储相关能力', () => {
    const caps: PlatformCapabilities = {
      hasLocalDatabase: true,
      hasOfflineMode: true,
      dataPriority: 'local-first',
      hasReminderPopup: true,
      hasSystemNotification: true,
      hasSnoozeReminder: true,
      hasExchangeSupport: true,
      hasCalDavSupport: true,
      hasExternalSync: true,
      hasSystemTray: true,
      hasAutoStart: true,
      hasClockHook: true,
      hasMultiWindow: true,
      hasAutoUpdate: true,
      hasAlwaysOnTop: true,
      hasMinimizeToTray: true,
      hasProxySettings: true,
      hasOAuthCallback: true,
    }
    expect(caps.hasLocalDatabase).toBe(true)
    expect(caps.dataPriority).toBe('local-first')
  })

  it('Web 端能力应合理降级', () => {
    const caps: PlatformCapabilities = {
      hasLocalDatabase: false,
      hasOfflineMode: false,
      dataPriority: 'remote-first',
      hasReminderPopup: false,
      hasSystemNotification: true,
      hasSnoozeReminder: false,
      hasExchangeSupport: true,
      hasCalDavSupport: true,
      hasExternalSync: true,
      hasSystemTray: false,
      hasAutoStart: false,
      hasClockHook: false,
      hasMultiWindow: false,
      hasAutoUpdate: false,
      hasAlwaysOnTop: false,
      hasMinimizeToTray: false,
      hasProxySettings: false,
      hasOAuthCallback: false,
    }
    expect(caps.hasLocalDatabase).toBe(false)
    expect(caps.hasSystemNotification).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/__tests__/platform/capabilities.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 PlatformCapabilities 类型**

```typescript
// src/platform/capabilities.ts

/** 平台能力定义 */
export interface PlatformCapabilities {
  // ─── 数据存储 ───
  /** 是否有本地数据库（离线可用） */
  hasLocalDatabase: boolean
  /** 是否支持离线模式 */
  hasOfflineMode: boolean
  /** 数据优先级 */
  dataPriority: 'local-first' | 'remote-first'

  // ─── 提醒系统 ───
  /** 是否支持应用内提醒弹窗 */
  hasReminderPopup: boolean
  /** 是否支持系统/浏览器原生通知 */
  hasSystemNotification: boolean
  /** 是否支持稍后提醒（snooze） */
  hasSnoozeReminder: boolean

  // ─── 外部日历 ───
  /** 是否支持 Exchange EWS 连接 */
  hasExchangeSupport: boolean
  /** 是否支持 CalDAV 连接 */
  hasCalDavSupport: boolean
  /** 是否支持外部日历实时同步 */
  hasExternalSync: boolean

  // ─── 系统集成 ───
  /** 是否支持系统托盘 */
  hasSystemTray: boolean
  /** 是否支持开机自启 */
  hasAutoStart: boolean
  /** 是否支持时钟点击检测 */
  hasClockHook: boolean
  /** 是否支持多窗口 */
  hasMultiWindow: boolean
  /** 是否支持自动更新 */
  hasAutoUpdate: boolean
  /** 是否支持始终置顶 */
  hasAlwaysOnTop: boolean
  /** 是否支持最小化到托盘 */
  hasMinimizeToTray: boolean
  /** 是否支持代理设置 */
  hasProxySettings: boolean

  // ─── 认证 ───
  /** 是否支持 OAuth 本地回调（需要本地 HTTP 服务器） */
  hasOAuthCallback: boolean
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/__tests__/platform/capabilities.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/platform/capabilities.ts src/__tests__/platform/capabilities.test.ts
git commit -m "feat: 添加 PlatformCapabilities 类型定义"
```

---

### Task 3: 创建 Repository 接口定义

**Files:**
- Create: `src/platform/types/calendar.repository.ts`
- Create: `src/platform/types/event.repository.ts`
- Create: `src/platform/types/todo.repository.ts`
- Create: `src/platform/types/settings.repository.ts`
- Create: `src/platform/types/auth.repository.ts`
- Create: `src/platform/types/sync.repository.ts`
- Create: `src/platform/types/index.ts`

- [ ] **Step 1: 创建 ICalendarRepository 接口**

```typescript
// src/platform/types/calendar.repository.ts

import type { Calendar } from '@/types'

export interface ICalendarRepository {
  /** 获取所有日历 */
  getAll(): Promise<Calendar[]>

  /** 创建日历 */
  create(params: {
    name: string
    color: string
    type: string
    accountId?: number
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar>

  /** 更新日历 */
  update(params: {
    id: number
    name?: string
    color?: string
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar>

  /** 删除日历 */
  delete(id: number): Promise<void>
}
```

- [ ] **Step 2: 创建 IEventRepository 接口**

```typescript
// src/platform/types/event.repository.ts

import type { CalendarEvent } from '@/types'

export interface IEventRepository {
  getAll(): Promise<CalendarEvent[]>
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>

  create(params: {
    title: string
    description?: string
    startTime: number
    endTime: number
    allDay: boolean
    calendarId: number
    color?: string
    reminder?: number
    repeatRule?: string
    location?: string
    externalId?: string
  }): Promise<CalendarEvent>

  update(params: {
    id: number
    title: string
    description?: string
    startTime: number
    endTime: number
    allDay: boolean
    calendarId: number
    color?: string
    reminder?: number
    repeatRule?: string
    location?: string
    externalId?: string
  }): Promise<CalendarEvent>

  delete(id: number): Promise<void>
}
```

- [ ] **Step 3: 创建 ITodoRepository 接口**

```typescript
// src/platform/types/todo.repository.ts

import type { Todo } from '@/types'

export interface ITodoRepository {
  getAll(): Promise<Todo[]>
  getByCalendarId(calendarId: number): Promise<Todo[]>

  create(params: {
    title: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId: number
  }): Promise<Todo>

  update(params: {
    id: number
    title?: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId?: number
  }): Promise<Todo>

  delete(id: number): Promise<void>
}
```

- [ ] **Step 4: 创建 ISettingsRepository 接口**

```typescript
// src/platform/types/settings.repository.ts

import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'

export interface ISettingsRepository {
  loadAppSettings(): Promise<AppSettings>
  saveAppSettings(settings: AppSettings): Promise<void>
  loadPopupSettings(): Promise<PopupSettings>
  savePopupSettings(settings: PopupSettings): Promise<void>
  getUserHolidays(): Promise<UserHolidayEntry[]>
  addUserHoliday(date: string, name: string, category: 'holiday' | 'makeup', source?: 'custom' | 'api'): Promise<void>
  removeUserHoliday(date: string, category: 'holiday' | 'makeup'): Promise<boolean>
  migrateFromLocalStorage?(): Promise<void>
}
```

- [ ] **Step 5: 创建 IAuthRepository 接口**

```typescript
// src/platform/types/auth.repository.ts

import type { User } from '@/types/auth'

export interface AuthResult {
  userId: number
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface IAuthRepository {
  login(email: string, encryptedPassword: string): Promise<AuthResult | null>
  register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult | null>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
  checkAuthStatus(): Promise<boolean>
  refreshToken(): Promise<boolean>
  getPublicKey(): Promise<string | null>
}
```

- [ ] **Step 6: 创建 ISyncRepository 接口**

```typescript
// src/platform/types/sync.repository.ts

import type { CalendarEvent, ExternalAccount } from '@/types'

export interface ConnectResult {
  success: boolean
  error?: string
  account?: ExternalAccount
  calendars?: Array<{
    id: string
    name: string
    color?: string
    url: string
    readOnly: boolean
  }>
}

export interface ExternalEventParams {
  accountId: string
  accountType: string
  serverUrl: string
  username: string
  encryptedPassword: string
  calendarUrl: string
}

export interface ISyncRepository {
  connectExchange(serverUrl: string | null, username: string, password: string): Promise<ConnectResult>
  connectCalDAV(serverUrl: string, username: string, password: string): Promise<ConnectResult>
  getAllAccounts(): Promise<ExternalAccount[]>
  deleteAccount(accountId: string): Promise<void>

  getExternalEvents(params: ExternalEventParams & {
    calendarId: string
    startTime: number
    endTime: number
  }): Promise<CalendarEvent[]>

  createExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }>

  updateExternalEvent(params: ExternalEventParams & {
    event: {
      id: string
      title: string
      description?: string
      startTime: number
      endTime: number
      allDay: boolean
      location?: string
    }
  }): Promise<{ success: boolean; externalId?: string; error?: string }>

  deleteExternalEvent(params: ExternalEventParams & {
    eventId: string
  }): Promise<{ success: boolean; error?: string }>

  triggerCloudSync(): Promise<boolean>
  getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }>
  startAutoSync(intervalMinutes: number): void
  stopAutoSync(): void
}
```

- [ ] **Step 7: 创建统一导出**

```typescript
// src/platform/types/index.ts

export type { ICalendarRepository } from './calendar.repository'
export type { IEventRepository } from './event.repository'
export type { ITodoRepository } from './todo.repository'
export type { ISettingsRepository } from './settings.repository'
export type { IAuthRepository, AuthResult } from './auth.repository'
export type { ISyncRepository, ConnectResult, ExternalEventParams } from './sync.repository'
```

- [ ] **Step 8: 运行类型检查确认无错误**

Run: `pnpm vue-tsc --noEmit 2>&1 | Select-String "platform/types"`
Expected: 无输出（无错误）或有预期的其他文件错误

- [ ] **Step 9: 提交**

```bash
git add src/platform/types/
git commit -m "feat: 定义所有 Repository 接口"
```

---

### Task 4: 创建 PlatformProvider 注入机制

**Files:**
- Create: `src/platform/provider.ts`
- Test: `src/__tests__/platform/provider.test.ts`

- [ ] **Step 1: 编写 Provider 测试**

```typescript
// src/__tests__/platform/provider.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { initPlatform, usePlatform, useCapabilities } from '@/platform/provider'
import type { PlatformProvider } from '@/platform/provider'
import type { PlatformCapabilities } from '@/platform/capabilities'
import type {
  ICalendarRepository,
  IEventRepository,
  ITodoRepository,
  ISettingsRepository,
  IAuthRepository,
  ISyncRepository,
} from '@/platform/types'

// 测试用 mock
const mockCaps: PlatformCapabilities = {
  hasLocalDatabase: false,
  hasOfflineMode: false,
  dataPriority: 'remote-first',
  hasReminderPopup: false,
  hasSystemNotification: true,
  hasSnoozeReminder: false,
  hasExchangeSupport: false,
  hasCalDavSupport: false,
  hasExternalSync: false,
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasAlwaysOnTop: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,
}

const mockProvider: PlatformProvider = {
  capabilities: mockCaps,
  calendarRepo: {} as ICalendarRepository,
  eventRepo: {} as IEventRepository,
  todoRepo: {} as ITodoRepository,
  settingsRepo: {} as ISettingsRepository,
  authRepo: {} as IAuthRepository,
  syncRepo: {} as ISyncRepository,
}

describe('PlatformProvider', () => {
  // 每个测试前需要重置单例 — 因为模块级变量无法直接重置
  // 通过重新 import 模块来隔离测试

  it('usePlatform 在未初始化时应抛出错误', () => {
    // 注意：如果其他测试已初始化，此测试可能不稳定
    // 实际项目中需要更好的隔离策略
    expect(() => usePlatform()).toThrow()
  })

  it('initPlatform 应正确初始化', () => {
    initPlatform(mockProvider)
    const provider = usePlatform()
    expect(provider.capabilities.dataPriority).toBe('remote-first')
  })

  it('useCapabilities 应返回能力声明', () => {
    const caps = useCapabilities()
    expect(caps.hasLocalDatabase).toBe(false)
    expect(caps.hasSystemNotification).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/__tests__/platform/provider.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 PlatformProvider**

```typescript
// src/platform/provider.ts

import type { PlatformCapabilities } from './capabilities'
import type {
  ICalendarRepository,
  IEventRepository,
  ITodoRepository,
  ISettingsRepository,
  IAuthRepository,
  ISyncRepository,
} from './types'

/** 平台 Provider：聚合所有 Repository 实现和能力声明 */
export interface PlatformProvider {
  readonly capabilities: PlatformCapabilities
  readonly calendarRepo: ICalendarRepository
  readonly eventRepo: IEventRepository
  readonly todoRepo: ITodoRepository
  readonly settingsRepo: ISettingsRepository
  readonly authRepo: IAuthRepository
  readonly syncRepo: ISyncRepository
}

// 全局单例
let _provider: PlatformProvider | null = null

/** 初始化平台 Provider（应用启动时调用一次） */
export function initPlatform(provider: PlatformProvider): void {
  if (_provider) {
    console.warn('[Platform] Provider 已初始化，忽略重复调用')
    return
  }
  _provider = provider
  console.info('[Platform] 平台初始化完成:', provider.capabilities.dataPriority)
}

/** 获取当前平台 Provider */
export function usePlatform(): PlatformProvider {
  if (!_provider) {
    throw new Error('[Platform] Provider 未初始化，请先调用 initPlatform()')
  }
  return _provider
}

/** 获取平台能力（快捷方式） */
export function useCapabilities(): PlatformCapabilities {
  return usePlatform().capabilities
}

/** 重置 Provider（仅供测试使用） */
export function _resetProvider(): void {
  _provider = null
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/__tests__/platform/provider.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/platform/provider.ts src/__tests__/platform/provider.test.ts
git commit -m "feat: 添加 PlatformProvider 注入机制"
```

---

## Phase 1: Tauri 平台实现

### Task 5: 创建 Tauri 数据转换函数

**Files:**
- Create: `src/platform/tauri/transforms.ts`
- Test: `src/__tests__/platform/tauri/transforms.test.ts`

- [ ] **Step 1: 编写转换函数测试**

测试用例从现有 `src/utils/tauri.ts` 中的 `transformCalendar`、`transformEvent`、`transformTodo`、`transformAccount` 行为提取，确保新实现与旧行为一致。

```typescript
// src/__tests__/platform/tauri/transforms.test.ts
import { describe, it, expect } from 'vitest'
import { transformCalendar, transformEvent, transformTodo, transformAccount } from '@/platform/tauri/transforms'

describe('Tauri 数据转换', () => {
  describe('transformCalendar', () => {
    it('应将 snake_case 原始数据转换为 camelCase', () => {
      const raw = {
        id: 1,
        name: '我的日历',
        color: '#4A90D9',
        type: 'local',
        account_id: null,
        visible: true,
        sync_enabled: false,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformCalendar(raw)
      expect(result.id).toBe('1')
      expect(result.name).toBe('我的日历')
      expect(result.color).toBe('#4A90D9')
      expect(result.type).toBe('local')
      expect(result.accountId).toBeUndefined()
      expect(result.visible).toBe(true)
      expect(result.syncEnabled).toBe(false)
    })

    it('应处理 account_id 存在的情况', () => {
      const raw = {
        id: 2,
        name: '工作日历',
        color: '#FF0000',
        type: 'exchange',
        account_id: 10,
        visible: true,
        sync_enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformCalendar(raw)
      expect(result.accountId).toBe('10')
    })
  })

  describe('transformEvent', () => {
    it('应正确转换事件数据', () => {
      const raw = {
        id: 1,
        title: '会议',
        description: '团队周会',
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: 15,
        repeat_rule: null,
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformEvent(raw)
      expect(result.id).toBe('1')
      expect(result.title).toBe('会议')
      expect(result.description).toBe('团队周会')
      expect(result.startTime).toBe(1700000000000)
      expect(result.allDay).toBe(false)
      expect(result.calendarId).toBe('1')
      expect(result.color).toBeUndefined()
      expect(result.reminder).toBe(15)
    })

    it('应解析 repeat_rule JSON', () => {
      const raw = {
        id: 1,
        title: '重复事件',
        description: null,
        start_time: 1700000000000,
        end_time: 1700003600000,
        all_day: false,
        calendar_id: 1,
        color: null,
        reminder: null,
        repeat_rule: '{"frequency":"weekly","interval":1}',
        location: null,
        external_id: null,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformEvent(raw)
      expect(result.repeatRule).toEqual({ frequency: 'weekly', interval: 1 })
    })
  })

  describe('transformTodo', () => {
    it('应正确转换待办数据', () => {
      const raw = {
        id: 1,
        title: '买牛奶',
        description: null,
        due_date: 1700000000000,
        completed: false,
        priority: 'medium',
        calendar_id: 1,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformTodo(raw)
      expect(result.id).toBe('1')
      expect(result.title).toBe('买牛奶')
      expect(result.dueDate).toBe(1700000000000)
      expect(result.completed).toBe(false)
      expect(result.priority).toBe('medium')
    })
  })

  describe('transformAccount', () => {
    it('应正确转换账号数据', () => {
      const raw = {
        id: 1,
        type: 'exchange',
        server_url: 'https://mail.example.com',
        username: 'user@example.com',
        encrypted_password: 'encrypted123',
        display_name: null,
        enabled: true,
        created_at: 1700000000,
        updated_at: 1700000000,
      }
      const result = transformAccount(raw)
      expect(result.id).toBe('1')
      expect(result.type).toBe('exchange')
      expect(result.serverUrl).toBe('https://mail.example.com')
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/__tests__/platform/tauri/transforms.test.ts`
Expected: FAIL

- [ ] **Step 3: 从 utils/tauri.ts 迁移转换函数到 platform/tauri/transforms.ts**

将 `src/utils/tauri.ts` 中的 `RawCalendar`、`RawEvent`、`RawTodo`、`RawAccount` 接口和 `transformCalendar`、`transformEvent`、`transformTodo`、`transformAccount` 函数复制到 `src/platform/tauri/transforms.ts`，并导出 Raw 类型供 Repository 使用。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/__tests__/platform/tauri/transforms.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/platform/tauri/transforms.ts src/__tests__/platform/tauri/transforms.test.ts
git commit -m "feat: 迁移 Tauri 数据转换函数到平台层"
```

---

### Task 6: 创建 Tauri 能力声明和核心 Repository 实现

**Files:**
- Create: `src/platform/tauri/capabilities.ts`
- Create: `src/platform/tauri/calendar.repo.ts`
- Create: `src/platform/tauri/event.repo.ts`
- Create: `src/platform/tauri/todo.repo.ts`
- Create: `src/platform/tauri/settings.repo.ts`
- Create: `src/platform/tauri/auth.repo.ts`
- Create: `src/platform/tauri/sync.repo.ts`
- Create: `src/platform/tauri/index.ts`

- [ ] **Step 1: 创建 Tauri 能力声明**

```typescript
// src/platform/tauri/capabilities.ts

import type { PlatformCapabilities } from '../capabilities'

export const tauriCapabilities: PlatformCapabilities = {
  hasLocalDatabase: true,
  hasOfflineMode: true,
  dataPriority: 'local-first',
  hasReminderPopup: true,
  hasSystemNotification: true,
  hasSnoozeReminder: true,
  hasExchangeSupport: true,
  hasCalDavSupport: true,
  hasExternalSync: true,
  hasSystemTray: true,
  hasAutoStart: true,
  hasClockHook: true,
  hasMultiWindow: true,
  hasAutoUpdate: true,
  hasAlwaysOnTop: true,
  hasMinimizeToTray: true,
  hasProxySettings: true,
  hasOAuthCallback: true,
}
```

- [ ] **Step 2: 创建 TauriCalendarRepository**

从 `src/utils/tauri.ts` 中的 `invokeGetCalendars`、`invokeCreateCalendar`、`invokeUpdateCalendar`、`invokeDeleteCalendar` 迁移逻辑。使用 `safeInvoke` 调用 Tauri 命令，用 `transformCalendar` 转换数据，失败时抛出 `RepositoryError`。

```typescript
// src/platform/tauri/calendar.repo.ts

import type { ICalendarRepository } from '../types/calendar.repository'
import type { Calendar } from '@/types'
import { safeInvoke } from '@/utils/tauri'
import { transformCalendar, type RawCalendar } from './transforms'
import { RepositoryError, RepoErrorCodes } from '../errors'

export class TauriCalendarRepository implements ICalendarRepository {
  private readonly platform = 'tauri' as const

  async getAll(): Promise<Calendar[]> {
    const result = await safeInvoke<RawCalendar[]>('get_calendars')
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法获取日历列表：Tauri 环境不可用',
        platform: this.platform,
      })
    }
    return result.map(transformCalendar)
  }

  async create(params: {
    name: string
    color: string
    type: string
    accountId?: number
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const result = await safeInvoke<RawCalendar>('create_calendar', {
      name: params.name,
      color: params.color,
      calendarType: params.type,
      accountId: params.accountId ?? null,
      visible: params.visible ?? true,
      syncEnabled: params.syncEnabled ?? false,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法创建日历',
        platform: this.platform,
      })
    }
    return transformCalendar(result)
  }

  async update(params: {
    id: number
    name?: string
    color?: string
    visible?: boolean
    syncEnabled?: boolean
  }): Promise<Calendar> {
    const result = await safeInvoke<RawCalendar>('update_calendar', {
      id: params.id,
      name: params.name ?? null,
      color: params.color ?? null,
      visible: params.visible ?? null,
      syncEnabled: params.syncEnabled ?? null,
    })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法更新日历',
        platform: this.platform,
      })
    }
    return transformCalendar(result)
  }

  async delete(id: number): Promise<void> {
    const result = await safeInvoke<void>('delete_calendar', { id })
    if (result === null) {
      throw new RepositoryError({
        code: RepoErrorCodes.PLATFORM_UNAVAILABLE,
        message: '无法删除日历',
        platform: this.platform,
      })
    }
  }
}
```

- [ ] **Step 3: 创建 TauriEventRepository**

从 `src/utils/tauri.ts` 中的 `invokeGetEvents`、`invokeGetEventsByCalendar`、`invokeCreateEvent`、`invokeUpdateEvent`、`invokeDeleteEvent` 迁移逻辑。

- [ ] **Step 4: 创建 TauriTodoRepository**

从 `src/utils/tauri.ts` 中的 `invokeGetTodos`、`invokeCreateTodo`、`invokeUpdateTodo`、`invokeDeleteTodo` 迁移逻辑。

- [ ] **Step 5: 创建 TauriSettingsRepository**

从 `src/services/settings.ts` 迁移逻辑。Tauri 实现调用 `invoke('get_setting', ...)` 等命令，包含数据库降级到 localStorage 的逻辑。

- [ ] **Step 6: 创建 TauriAuthRepository**

从 `src/services/auth.ts` 中的 Tauri 分支迁移逻辑。调用 `safeInvoke('auth_login', ...)` 等命令。

- [ ] **Step 7: 创建 TauriSyncRepository**

从 `src/services/sync.ts` 和 `src/services/cloudSync.ts` 中的 Tauri 逻辑合并迁移。包含外部日历连接、事件 CRUD、云同步等。

- [ ] **Step 8: 创建 createTauriProvider 工厂函数**

```typescript
// src/platform/tauri/index.ts

import type { PlatformProvider } from '../provider'
import { tauriCapabilities } from './capabilities'
import { TauriCalendarRepository } from './calendar.repo'
import { TauriEventRepository } from './event.repo'
import { TauriTodoRepository } from './todo.repo'
import { TauriSettingsRepository } from './settings.repo'
import { TauriAuthRepository } from './auth.repo'
import { TauriSyncRepository } from './sync.repo'

export function createTauriProvider(): PlatformProvider {
  return {
    capabilities: tauriCapabilities,
    calendarRepo: new TauriCalendarRepository(),
    eventRepo: new TauriEventRepository(),
    todoRepo: new TauriTodoRepository(),
    settingsRepo: new TauriSettingsRepository(),
    authRepo: new TauriAuthRepository(),
    syncRepo: new TauriSyncRepository(),
  }
}
```

- [ ] **Step 9: 运行类型检查**

Run: `pnpm vue-tsc --noEmit 2>&1 | Select-String "platform/tauri"`
Expected: 无错误

- [ ] **Step 10: 提交**

```bash
git add src/platform/tauri/
git commit -m "feat: 实现 Tauri 平台 Repository 层"
```

---

## Phase 2: Web 平台实现

### Task 7: 创建 Web API 客户端和数据转换

**Files:**
- Create: `src/platform/web/api-client.ts`
- Create: `src/platform/web/transforms.ts`
- Create: `src/platform/web/capabilities.ts`

- [ ] **Step 1: 从 services/webApi.ts 迁移 WebApiClient**

将 `src/services/webApi.ts` 中的 `webApi` 对象重构为 `WebApiClient` 类，保留 Token 管理、自动刷新、Bearer 认证等逻辑。增加通用请求方法供 Repository 使用。

- [ ] **Step 2: 创建 Web 端数据转换函数**

创建 `src/platform/web/transforms.ts`，实现从 Web API 响应格式（`{ code, data, message }`）到前端类型的转换。处理 snake_case → camelCase。

- [ ] **Step 3: 创建 Web 端能力声明**

```typescript
// src/platform/web/capabilities.ts

import type { PlatformCapabilities } from '../capabilities'

export const webCapabilities: PlatformCapabilities = {
  hasLocalDatabase: false,
  hasOfflineMode: false,
  dataPriority: 'remote-first',
  hasReminderPopup: false,
  hasSystemNotification: true,
  hasSnoozeReminder: false,
  hasExchangeSupport: true,
  hasCalDavSupport: true,
  hasExternalSync: true,
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasAlwaysOnTop: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,
}
```

- [ ] **Step 4: 提交**

```bash
git add src/platform/web/api-client.ts src/platform/web/transforms.ts src/platform/web/capabilities.ts
git commit -m "feat: 创建 Web 平台基础设施"
```

---

### Task 8: 创建 Web Repository 实现

**Files:**
- Create: `src/platform/web/calendar.repo.ts`
- Create: `src/platform/web/event.repo.ts`
- Create: `src/platform/web/todo.repo.ts`
- Create: `src/platform/web/settings.repo.ts`
- Create: `src/platform/web/auth.repo.ts`
- Create: `src/platform/web/sync.repo.ts`
- Create: `src/platform/web/index.ts`

- [ ] **Step 1: 创建 WebCalendarRepository**

通过 `WebApiClient` 调用远端 API，将响应数据从 `code/data` 格式转换为前端类型。

- [ ] **Step 2: 创建 WebEventRepository**

- [ ] **Step 3: 创建 WebTodoRepository**

- [ ] **Step 4: 创建 WebSettingsRepository**

Web 端设置直接从远端 API 读写，无本地缓存。

- [ ] **Step 5: 创建 WebAuthRepository**

从 `src/services/auth.ts` 中的 Web 分支迁移逻辑，使用 `WebApiClient` 替代 `webApi`。

- [ ] **Step 6: 创建 WebSyncRepository**

Web 端外部日历操作通过远端 API 代理，不直接连接 Exchange/CalDAV。

- [ ] **Step 7: 创建 createWebProvider 工厂函数**

```typescript
// src/platform/web/index.ts

import type { PlatformProvider } from '../provider'
import { webCapabilities } from './capabilities'
import { WebApiClient } from './api-client'
import { WebCalendarRepository } from './calendar.repo'
import { WebEventRepository } from './event.repo'
import { WebTodoRepository } from './todo.repo'
import { WebSettingsRepository } from './settings.repo'
import { WebAuthRepository } from './auth.repo'
import { WebSyncRepository } from './sync.repo'

export function createWebProvider(): PlatformProvider {
  const apiClient = new WebApiClient()
  return {
    capabilities: webCapabilities,
    calendarRepo: new WebCalendarRepository(apiClient),
    eventRepo: new WebEventRepository(apiClient),
    todoRepo: new WebTodoRepository(apiClient),
    settingsRepo: new WebSettingsRepository(apiClient),
    authRepo: new WebAuthRepository(apiClient),
    syncRepo: new WebSyncRepository(apiClient),
  }
}
```

- [ ] **Step 8: 运行类型检查**

Run: `pnpm vue-tsc --noEmit 2>&1 | Select-String "platform/web"`
Expected: 无错误

- [ ] **Step 9: 提交**

```bash
git add src/platform/web/
git commit -m "feat: 实现 Web 平台 Repository 层"
```

---

## Phase 3: 应用初始化与 Store 改造

### Task 9: 修改应用入口添加平台初始化

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: 在 main.ts 中添加平台初始化**

在创建 Vue 应用之前，根据 `isTauri()` 注入对应的 PlatformProvider：

```typescript
// 在 main.ts 的 createApp 之前添加
import { isTauri } from '@/utils/tauri'
import { initPlatform } from '@/platform/provider'

async function bootstrap() {
  if (isTauri()) {
    const { createTauriProvider } = await import('@/platform/tauri')
    initPlatform(createTauriProvider())
  } else {
    const { createWebProvider } = await '@/platform/web'
    initPlatform(createWebProvider())
  }

  // 原有的 createApp 逻辑...
}

bootstrap()
```

- [ ] **Step 2: 验证应用启动正常**

Run: `pnpm dev`
Expected: 应用正常启动，控制台显示 `[Platform] 平台初始化完成: local-first`

- [ ] **Step 3: 提交**

```bash
git add src/main.ts
git commit -m "feat: 应用入口添加平台 Provider 初始化"
```

---

### Task 10: 改造 Calendar Store

**Files:**
- Modify: `src/stores/calendar.ts`

- [ ] **Step 1: 替换所有 invoke 直调为 Repository 接口**

将 `invokeGetCalendars` → `calendarRepo.getAll()`，`invokeCreateCalendar` → `calendarRepo.create()` 等。移除对 `src/utils/tauri.ts` 中 invokeXxx 函数的 import，改用 `usePlatform()`。

- [ ] **Step 2: 移除 Store 中的 isTauri/safeInvoke 调用**

Calendar Store 中的外部日历操作（`safeInvoke('get_external_events', ...)` 等）改为通过 `syncRepo` 调用。

- [ ] **Step 3: 运行测试确认 Store 行为一致**

Run: `pnpm vitest run`
Expected: 所有现有测试通过

- [ ] **Step 4: 提交**

```bash
git add src/stores/calendar.ts
git commit -m "refactor: Calendar Store 使用 Repository 接口"
```

---

### Task 11: 改造 Todo Store

**Files:**
- Modify: `src/stores/todo.ts`

- [ ] **Step 1: 替换 invoke 直调**

`invokeGetTodos` → `todoRepo.getAll()`，`invokeCreateTodo` → `todoRepo.create()` 等。

- [ ] **Step 2: 运行测试**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/todo.ts
git commit -m "refactor: Todo Store 使用 Repository 接口"
```

---

### Task 12: 改造 Settings Store 和 PopupSettings Store

**Files:**
- Modify: `src/stores/settings.ts`
- Modify: `src/stores/popupSettings.ts`

- [ ] **Step 1: 替换 settingsService 调用**

`settingsService.getAllSettings('app.')` → `settingsRepo.loadAppSettings()` 等。

- [ ] **Step 2: 运行测试**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/settings.ts src/stores/popupSettings.ts
git commit -m "refactor: Settings Store 使用 Repository 接口"
```

---

### Task 13: 改造 Auth Store

**Files:**
- Modify: `src/stores/auth.ts`

- [ ] **Step 1: 替换 authService 调用**

`authService.login()` → `authRepo.login()`，`authService.getCurrentUser()` → `authRepo.getCurrentUser()` 等。

- [ ] **Step 2: 运行测试**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/stores/auth.ts
git commit -m "refactor: Auth Store 使用 Repository 接口"
```

---

## Phase 4: 服务层适配

### Task 14: 适配 Reminder 服务

**Files:**
- Modify: `src/services/reminder.ts`

- [ ] **Step 1: 替换 isTauri() 为能力判断**

将 `sendReminderNotification` 中的平台判断改为使用 `useCapabilities()`：
- `mode === 'strong'` + `capabilities.hasReminderPopup` → 应用内弹窗
- `mode === 'strong'` + `!capabilities.hasReminderPopup` + `capabilities.hasSystemNotification` → 降级浏览器通知
- `mode === 'standard'` + `capabilities.hasSystemNotification` → 系统/浏览器通知

- [ ] **Step 2: 替换 Tauri API 调用**

`WebviewWindow.getByLabel`、`tauriEmit` 等 Tauri API 调用用 `capabilities.hasMultiWindow` 守卫。

- [ ] **Step 3: 运行测试**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/services/reminder.ts
git commit -m "refactor: Reminder 服务使用能力声明降级"
```

---

### Task 15: 适配 RSA 服务

**Files:**
- Modify: `src/services/rsa.ts`

- [ ] **Step 1: 替换 isTauri() 为 authRepo**

将 `fetchPublicKey` 中的 `safeInvoke` / `webApi` 分支改为使用 `authRepo.getPublicKey()`。

- [ ] **Step 2: 运行测试**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/services/rsa.ts
git commit -m "refactor: RSA 服务使用 Repository 接口"
```

---

## Phase 5: 组件清理

### Task 16: 替换组件中的 isTauri() 判断

**Files:**
- 搜索所有 `.vue` 文件中的 `isTauri()` 调用
- 逐个替换为 `useCapabilities()` 对应的能力判断

- [ ] **Step 1: 搜索所有 isTauri() 使用点**

Run: `Select-String -Path "src\**\*.vue" -Pattern "isTauri" | Select-Object -Property Path, LineNumber, Line`

- [ ] **Step 2: 逐个替换为能力判断**

每个 `isTauri()` 替换为对应的语义化能力：
- 系统托盘操作 → `capabilities.hasSystemTray`
- 多窗口操作 → `capabilities.hasMultiWindow`
- 自动更新 → `capabilities.hasAutoUpdate`
- 自启动设置 → `capabilities.hasAutoStart`
- 时钟钩子 → `capabilities.hasClockHook`
- 代理设置 → `capabilities.hasProxySettings`
- OAuth → `capabilities.hasOAuthCallback`

- [ ] **Step 3: 确认无残留 isTauri()**

Run: `Select-String -Path "src\**\*.vue" -Pattern "isTauri"`
Expected: 无结果

- [ ] **Step 4: 提交**

```bash
git add src/
git commit -m "refactor: 组件使用能力声明替代 isTauri()"
```

---

## Phase 6: 清理与验证

### Task 17: 清理旧代码

**Files:**
- Modify: `src/utils/tauri.ts` — 移除已迁移的 invokeXxx 函数
- 删除或标记废弃: `src/services/auth.ts`、`src/services/settings.ts`、`src/services/sync.ts`、`src/services/cloudSync.ts`、`src/services/webApi.ts`
- 移动: `src/services/updater.ts` → `src/platform/tauri/updater.ts`
- 移动: `src/utils/database.ts` → `src/platform/tauri/database.ts`

- [ ] **Step 1: 确认 Store 不再引用旧 Service/Utils**

Run: `Select-String -Path "src\stores\*.ts" -Pattern "invokeGet|invokeCreate|invokeUpdate|invokeDelete|safeInvoke|isTauri|webApi|authService|settingsService|syncService"`
Expected: 无结果

- [ ] **Step 2: 清理 utils/tauri.ts**

保留 `isTauri()` 和 `safeInvoke()`（仅供 `platform/tauri/` 内部使用），移除所有 `invokeXxx` 函数和 `transformXxx` 函数（已迁移）。

- [ ] **Step 3: 标记旧 Service 文件为废弃**

在文件头部添加 `@deprecated` 注释，说明迁移目标。

- [ ] **Step 4: 提交**

```bash
git add src/utils/tauri.ts src/services/
git commit -m "refactor: 清理旧代码，标记废弃文件"
```

---

### Task 18: 最终验证

- [ ] **Step 1: 运行完整测试套件**

Run: `pnpm test:run`
Expected: 所有测试通过

- [ ] **Step 2: 运行类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 启动桌面应用验证**

Run: `pnpm tauri:dev`
Expected: 应用正常启动，日历/待办/设置/认证功能正常

- [ ] **Step 4: 启动 Web 开发服务器验证**

Run: `pnpm dev`
Expected: Web 应用正常启动，核心日历/待办/认证功能正常（桌面专属功能不显示）

- [ ] **Step 5: 确认 Store 中无平台硬编码**

Run: `Select-String -Path "src\stores\*.ts" -Pattern "isTauri|safeInvoke|invoke|@tauri-apps|webApi"`
Expected: 无结果

- [ ] **Step 6: 确认组件中无 isTauri()**

Run: `Select-String -Path "src\**\*.vue" -Pattern "isTauri"`
Expected: 无结果

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "chore: 多端数据架构重构完成"
```
