# 多端数据架构与开发约定设计

> 日期：2026-05-16
> 状态：设计文档
> 作者：Sisyphus (AI Agent)

## 1. 背景与目标

### 1.1 现状

小河日历当前已完成 Windows 桌面端（Tauri 2.x + Vue 3），Web 端正在开发适配中。现有代码存在以下问题：

- **Store 直接调用 Tauri invoke**：`calendar.ts`、`todo.ts`、`settings.ts` 等 Store 硬编码调用 `invokeGetXxx` / `invokeCreateXxx`，Web 端无法复用
- **平台分支散布各处**：`AuthService` 中 `isTauri()` if/else 模式随功能增长代码膨胀，改一端需逐个文件修改
- **部分服务无 Web 降级**：`settings.ts` 服务在非 Tauri 环境直接返回 null，`reminder.ts` 和 `updater.ts` 完全依赖 Tauri API
- **数据转换分散**：snake_case ↔ camelCase 转换集中在 `utils/tauri.ts`，Web 端没有对应处理

### 1.2 目标

设计一套平台无关的数据架构和开发约定，确保：

1. **一端改动不破坏另一端**：数据层通过接口隔离，平台实现独立
2. **Store 不感知平台**：Store 只依赖 Repository 接口，不知道数据来源
3. **组件按能力判断**：组件使用语义化的能力声明判断功能可用性，而非 `isTauri()`
4. **可扩展**：新增平台（如 Android）只需添加新的 Repository 实现

### 1.3 约束

| 维度 | 桌面端 (Tauri) | Web 端 |
|------|---------------|--------|
| 数据策略 | 离线优先，本地 SQLite，适时同步远端 | 远程优先，无本地数据库 |
| 后端 API | 同一套远端 API | 同一套远端 API |
| 功能范围 | 全功能 | 核心日历/待办 + 认证 + 外部日历集成 |
| 提醒方式 | 应用内弹窗 + 系统通知 | 浏览器原生通知 |
| 重构容忍度 | 可以大规模重构 | — |

## 2. 架构设计

### 2.1 分层架构

```
┌──────────────────────────────────────┐
│         Vue 组件 / 视图层             │  ← 按能力判断渲染
├──────────────────────────────────────┤
│           Pinia Store                │  ← 只依赖 Repository 接口
├──────────────────────────────────────┤
│    Repository 接口 + PlatformCaps    │  ← 平台无关的契约
├──────────┬───────────────────────────┤
│ Tauri 实现│       Web 实现            │  ← 各自独立，互不影响
│ invoke()  │     fetch(API)           │
│ SQLite    │     远端 API              │
└──────────┴───────────────────────────┘
```

### 2.2 目录结构

```
src/
├── platform/                    # 平台抽象层（新增）
│   ├── types/                   # Repository 接口定义
│   │   ├── calendar.repository.ts   # ICalendarRepository
│   │   ├── event.repository.ts      # IEventRepository
│   │   ├── todo.repository.ts       # ITodoRepository
│   │   ├── settings.repository.ts   # ISettingsRepository
│   │   ├── auth.repository.ts       # IAuthRepository
│   │   ├── sync.repository.ts       # ISyncRepository
│   │   └── index.ts                 # 统一导出
│   ├── capabilities.ts          # PlatformCapabilities 类型定义
│   ├── provider.ts              # PlatformProvider + 注入机制
│   ├── errors.ts                # RepositoryError 统一错误类型
│   ├── tauri/                   # Tauri 平台实现
│   │   ├── calendar.repo.ts
│   │   ├── event.repo.ts
│   │   ├── todo.repo.ts
│   │   ├── settings.repo.ts
│   │   ├── auth.repo.ts
│   │   ├── sync.repo.ts
│   │   ├── transforms.ts        # snake_case → camelCase 转换（从 utils/tauri.ts 迁移）
│   │   ├── capabilities.ts      # 桌面端能力声明
│   │   ├── index.ts             # createTauriProvider()
│   │   └── platform-utils.ts    # safeInvoke 等仅 Tauri 平台内部使用的工具
│   └── web/                     # Web 平台实现
│       ├── calendar.repo.ts
│       ├── event.repo.ts
│       ├── todo.repo.ts
│       ├── settings.repo.ts
│       ├── auth.repo.ts
│       ├── sync.repo.ts
│       ├── api-client.ts        # Web API 客户端（从 services/webApi.ts 迁移）
│       ├── transforms.ts        # API 响应 → 前端类型转换
│       ├── capabilities.ts      # Web 端能力声明
│       └── index.ts             # createWebProvider()
├── stores/                      # Pinia Store（保留路径，改内部实现）
├── services/                    # 业务逻辑服务（保留，改为依赖 Repository）
│   ├── reminder.ts              # 保留，通过能力判断降级
│   └── ...                      # 其余 Service 按迁移映射处理
├── utils/                       # 纯工具函数（保留）
│   ├── date.ts
│   ├── lunar.ts
│   ├── helpers.ts
│   └── ...                      # tauri.ts 逐步废弃，database.ts 迁移
├── types/                       # 共享类型定义（不动）
└── ...
```

## 3. Repository 接口定义

### 3.1 设计原则

1. **接口使用 camelCase**：Repository 接口是前端内部契约，统一 camelCase
2. **返回前端类型**：接口返回 `src/types/index.ts` 中定义的类型（Calendar、CalendarEvent 等）
3. **数据转换封装在实现内**：snake_case ↔ camelCase 转换由各平台实现内部处理
4. **错误统一抛出**：Repository 方法失败时抛出 `RepositoryError`，不返回 null

### 3.2 ICalendarRepository

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

### 3.3 IEventRepository

```typescript
// src/platform/types/event.repository.ts

import type { CalendarEvent } from '@/types'

export interface IEventRepository {
  /** 获取所有事件 */
  getAll(): Promise<CalendarEvent[]>

  /** 按日历 ID 获取事件 */
  getByCalendarId(calendarId: number): Promise<CalendarEvent[]>

  /** 按时间范围获取事件 */
  getByTimeRange(startTime: number, endTime: number): Promise<CalendarEvent[]>

  /** 创建事件 */
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

  /** 更新事件 */
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

  /** 删除事件 */
  delete(id: number): Promise<void>
}
```

### 3.4 ITodoRepository

```typescript
// src/platform/types/todo.repository.ts

import type { Todo } from '@/types'

export interface ITodoRepository {
  /** 获取所有待办 */
  getAll(): Promise<Todo[]>

  /** 按日历 ID 获取待办 */
  getByCalendarId(calendarId: number): Promise<Todo[]>

  /** 创建待办 */
  create(params: {
    title: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId: number
  }): Promise<Todo>

  /** 更新待办 */
  update(params: {
    id: number
    title?: string
    description?: string
    dueDate?: number
    completed?: boolean
    priority?: string
    calendarId?: number
  }): Promise<Todo>

  /** 删除待办 */
  delete(id: number): Promise<void>
}
```

### 3.5 ISettingsRepository

```typescript
// src/platform/types/settings.repository.ts

import type { AppSettings, PopupSettings, UserHolidayEntry } from '@/types'

export interface ISettingsRepository {
  /** 加载应用设置 */
  loadAppSettings(): Promise<AppSettings>

  /** 保存应用设置 */
  saveAppSettings(settings: AppSettings): Promise<void>

  /** 加载弹出面板设置 */
  loadPopupSettings(): Promise<PopupSettings>

  /** 保存弹出面板设置 */
  savePopupSettings(settings: PopupSettings): Promise<void>

  /** 获取用户自定义节假日 */
  getUserHolidays(): Promise<UserHolidayEntry[]>

  /** 添加用户自定义节假日 */
  addUserHoliday(date: string, name: string, category: 'holiday' | 'makeup', source?: 'custom' | 'api'): Promise<void>

  /** 移除用户自定义节假日 */
  removeUserHoliday(date: string, category: 'holiday' | 'makeup'): Promise<boolean>

  /** 执行 localStorage → 数据库迁移（仅桌面端有意义） */
  migrateFromLocalStorage?(): Promise<void>
}
```

### 3.6 IAuthRepository

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
  /** 登录 */
  login(email: string, encryptedPassword: string): Promise<AuthResult | null>

  /** 注册 */
  register(email: string, encryptedPassword: string, displayName: string): Promise<AuthResult | null>

  /** 登出 */
  logout(): Promise<void>

  /** 获取当前用户资料 */
  getCurrentUser(): Promise<User | null>

  /** 检查认证状态 */
  checkAuthStatus(): Promise<boolean>

  /** 刷新访问令牌 */
  refreshToken(): Promise<boolean>

  /** 获取 RSA 公钥 */
  getPublicKey(): Promise<string | null>
}
```

### 3.7 ISyncRepository

```typescript
// src/platform/types/sync.repository.ts

import type { ExternalAccount, SyncStatus } from '@/types'

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

export interface ISyncRepository {
  /** 连接 Exchange 服务器 */
  connectExchange(serverUrl: string | null, username: string, password: string): Promise<ConnectResult>

  /** 连接 CalDAV 服务器 */
  connectCalDAV(serverUrl: string, username: string, password: string): Promise<ConnectResult>

  /** 获取所有外部账号 */
  getAllAccounts(): Promise<ExternalAccount[]>

  /** 删除外部账号 */
  deleteAccount(accountId: string): Promise<void>

  /**
   * 获取外部日历事件
   * 注意：Web 端实现中 serverUrl/username/encryptedPassword 等参数由后端代理，
   * 传入时可为空字符串，后端根据 accountId 查找凭据
   */
  getExternalEvents(params: {
    accountId: string
    accountType: string
    serverUrl: string
    username: string
    encryptedPassword: string
    calendarUrl: string
    calendarId: string
    startTime: number
    endTime: number
  }): Promise<CalendarEvent[]>

  /** 创建外部日历事件（Web 端凭据参数同上由后端代理） */
  createExternalEvent(params: {
    accountId: string
    accountType: string
    serverUrl: string
    username: string
    encryptedPassword: string
    calendarUrl: string
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

  /** 更新外部日历事件（Web 端凭据参数同上由后端代理） */
  updateExternalEvent(params: {
    accountId: string
    accountType: string
    serverUrl: string
    username: string
    encryptedPassword: string
    calendarUrl: string
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

  /** 删除外部日历事件（Web 端凭据参数同上由后端代理） */
  deleteExternalEvent(params: {
    accountId: string
    accountType: string
    serverUrl: string
    username: string
    encryptedPassword: string
    calendarUrl: string
    eventId: string
  }): Promise<{ success: boolean; error?: string }>

  /** 触发云同步 */
  triggerCloudSync(): Promise<boolean>

  /** 获取同步状态 */
  getSyncStatus(): Promise<{ status: string; lastSyncAt: number | null; pendingChanges: number }>

  /** 启动自动同步 */
  startAutoSync(intervalMinutes: number): void

  /** 停止自动同步 */
  stopAutoSync(): void
}
```

## 4. 平台能力声明

### 4.1 类型定义

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

### 4.2 桌面端能力

```typescript
// src/platform/tauri/capabilities.ts

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

### 4.3 Web 端能力

```typescript
// src/platform/web/capabilities.ts

export const webCapabilities: PlatformCapabilities = {
  hasLocalDatabase: false,
  hasOfflineMode: false,
  dataPriority: 'remote-first',
  hasReminderPopup: false,
  hasSystemNotification: true,   // 浏览器 Notification API
  hasSnoozeReminder: false,
  hasExchangeSupport: true,      // 通过远端 API 代理
  hasCalDavSupport: true,        // 通过远端 API 代理
  hasExternalSync: true,         // 由后端处理
  hasSystemTray: false,
  hasAutoStart: false,
  hasClockHook: false,
  hasMultiWindow: false,
  hasAutoUpdate: false,
  hasAlwaysOnTop: false,
  hasMinimizeToTray: false,
  hasProxySettings: false,
  hasOAuthCallback: false,       // Web 端用 redirect 方式
}
```

## 5. 平台 Provider 与注入机制

### 5.1 PlatformProvider

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
```

### 5.2 应用入口初始化

```typescript
// src/main.ts

import { isTauri } from '@/utils/tauri'
import { initPlatform } from '@/platform/provider'

async function bootstrap() {
  // 初始化平台 Provider
  if (isTauri()) {
    const { createTauriProvider } = await import('@/platform/tauri')
    initPlatform(createTauriProvider())
  } else {
    const { createWebProvider } = await import('@/platform/web')
    initPlatform(createWebProvider())
  }

  // 创建 Vue 应用...
}

bootstrap()
```

### 5.3 平台工厂函数

```typescript
// src/platform/tauri/index.ts

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

```typescript
// src/platform/web/index.ts

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

## 6. 统一错误处理

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

// 常用错误码
export const RepoErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  PLATFORM_UNAVAILABLE: 'PLATFORM_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const
```

**关键决策**：当前 `safeInvoke` 在 Tauri 不可用时静默返回 null，改为抛出 `RepositoryError`。Store 层统一捕获处理。

## 7. Store 改造

### 7.1 改造原则

- Store 中**禁止**出现 `isTauri()`、`safeInvoke`、`invokeXxx`、`webApi` 等平台相关调用
- Store 中**禁止**出现 `@tauri-apps/api` 的直接 import
- 所有平台差异通过 `useCapabilities()` 处理

### 7.2 改造示例

**改造前**：
```typescript
import { invokeGetCalendars, invokeCreateCalendar } from '../utils/tauri'

export const useCalendarStore = defineStore('calendar', () => {
  async function initialize() {
    const loadedCalendars = await invokeGetCalendars()  // 硬编码 Tauri
    // ...
  }
})
```

**改造后**：
```typescript
import { usePlatform } from '@/platform/provider'

export const useCalendarStore = defineStore('calendar', () => {
  const { calendarRepo, eventRepo, syncRepo } = usePlatform()

  async function initialize() {
    const loadedCalendars = await calendarRepo.getAll()  // 平台无关
    // ...
  }
})
```

## 8. 组件中的能力判断

### 8.1 改造原则

- 组件中**禁止**使用 `isTauri()` 做条件渲染
- 用语义化的能力名替代平台判断：`hasSystemTray` > `isTauri()`
- 不存在的功能直接不渲染，不需要"降级占位"

### 8.2 改造示例

**改造前**：
```vue
<template>
  <button v-if="isTauri()" @click="minimizeToTray">最小化到托盘</button>
</template>
```

**改造后**：
```vue
<template>
  <button v-if="capabilities.hasMinimizeToTray" @click="minimizeToTray">最小化到托盘</button>
</template>

<script setup lang="ts">
import { useCapabilities } from '@/platform/provider'
const capabilities = useCapabilities()
</script>
```

## 9. 现有文件迁移映射

| 现有文件 | 迁移目标 | 说明 |
|----------|----------|------|
| `src/utils/tauri.ts` 中的 `invokeGetXxx`/`invokeCreateXxx` 等 | → `src/platform/tauri/*.repo.ts` | 数据操作迁移到 Tauri Repository 实现 |
| `src/utils/tauri.ts` 中的 `transformCalendar`/`transformEvent` 等 | → `src/platform/tauri/transforms.ts` | 数据转换函数归入 Tauri 平台层 |
| `src/utils/tauri.ts` 中的 `isTauri`/`safeInvoke` | 保留，仅供 `src/platform/tauri/` 内部使用 | 不再被 Store/Service 直接引用 |
| `src/services/webApi.ts` | → `src/platform/web/api-client.ts` | Web API 客户端归入 Web 平台层 |
| `src/services/auth.ts` 中的 if/else 分支 | → 拆分为 `tauri/auth.repo.ts` + `web/auth.repo.ts` | 消除 Service 内的平台分支 |
| `src/services/settings.ts` | → `tauri/settings.repo.ts` + `web/settings.repo.ts` | Web 端实现远端设置 API |
| `src/services/reminder.ts` | → `src/services/reminder.ts`（保留，通过能力判断降级） | 提醒逻辑通用，`hasReminderPopup` 控制弹窗 |
| `src/services/updater.ts` | → `src/platform/tauri/updater.ts` | 仅桌面端功能 |
| `src/services/sync.ts` + `src/services/cloudSync.ts` | → `tauri/sync.repo.ts` + `web/sync.repo.ts` | 合并到统一同步 Repository |
| `src/services/rsa.ts` | → `src/platform/rsa.ts`（共享，两端都用 Web Crypto API） | RSA 加密是平台无关的 |
| `src/utils/database.ts` | → `src/platform/tauri/database.ts` | 仅桌面端使用 |
| `src/types/index.ts` | **不动** | 前端类型定义是共享的，两端一致 |
| `src/stores/*.ts` | **保留路径，改内部实现** | 去掉 invoke 直调，改用 `usePlatform()` |

## 10. 开发约定

### 10.1 禁止清单

| 禁止事项 | 原因 |
|----------|------|
| Store 中直接调用 `invoke`/`safeInvoke`/`invokeXxx` | 违反数据层隔离 |
| Store/组件中直接调用 `webApi.xxx` | 违反数据层隔离 |
| 组件/Store 中使用 `isTauri()` 做逻辑分支 | 违反能力声明机制 |
| 在 `src/platform/` 之外 import `@tauri-apps/api` | 平台 API 应封装在平台层内 |
| Repository 接口返回后端原始格式（snake_case） | 接口契约统一为 camelCase |
| 一个 Repository 方法内部混合 Tauri 和 Web 逻辑 | 违反单一实现原则 |
| Repository 方法静默返回 null 吞掉错误 | 错误应抛出 RepositoryError |

### 10.2 新增功能开发流程

```
1. 在 src/platform/types/ 定义或扩展 Repository 接口
2. 在 src/platform/tauri/ 实现 Tauri 版本
3. 在 src/platform/web/ 实现 Web 版本
4. 在 src/stores/ 使用 Repository 接口
5. 在 src/views/components/ 使用能力判断
6. 补充两端测试
```

### 10.3 数据格式约定

| 层级 | 命名风格 | 示例 |
|------|----------|------|
| Rust 后端返回 | snake_case | `{ start_time: 1234, all_day: true }` |
| Web API 请求/响应 | snake_case | `{ start_time: 1234 }` |
| Repository 接口输入/输出 | camelCase | `{ startTime: 1234, allDay: true }` |
| Pinia Store 状态 | camelCase | `event.startTime` |
| 组件 prop/event | camelCase | `:start-time`（Vue 模板自动转换） |

数据格式转换发生在 Repository 实现内部（`transforms.ts`），对外透明。

### 10.4 测试约定

- **Repository 接口**：编写 mock 实现，Store 测试不依赖真实平台
- **Tauri Repository**：mock `safeInvoke` 返回值，验证参数和转换逻辑
- **Web Repository**：mock `fetch` 返回值，验证请求格式和数据转换
- **能力声明**：组件测试中注入不同能力组合
- **Store**：通过 mock Repository 测试，不依赖平台环境

### 10.5 错误处理约定

- Repository 方法统一抛出 `RepositoryError`（含 code、message、platform）
- Store 捕获 `RepositoryError`，统一处理（展示 toast、重试等）
- 不允许在 Repository 实现中静默吞掉错误
- `safeInvoke` 的 null 返回模式需改为抛出 `RepositoryError`

### 10.6 设置数据约定

- 桌面端：设置存本地 SQLite → 优先本地读取，云端同步
- Web 端：设置存远端 API → 直接远端读写，无本地缓存
- Store 层：调用 `settingsRepo.loadAppSettings()` / `settingsRepo.saveAppSettings()`，不关心存储位置

## 11. 提醒服务适配

提醒服务（`reminder.ts`）作为跨平台业务逻辑保留在 `src/services/`，但通过能力声明降级：

```typescript
// src/services/reminder.ts（改造后）

import { useCapabilities } from '@/platform/provider'

async function sendReminderNotification(...) {
  const capabilities = useCapabilities()

  if (mode === 'strong') {
    if (capabilities.hasReminderPopup) {
      // 桌面端：使用应用内弹窗
      enqueueReminder(...)
      processNextReminder()
      startBlinkTitle(title)
    } else if (capabilities.hasSystemNotification) {
      // Web 端：降级为浏览器通知
      await sendBrowserNotification(title, body)
    }
  } else if (mode === 'standard') {
    if (capabilities.hasSystemNotification) {
      // 通用：系统/浏览器通知
      await sendNotification({ title, body })
    }
  }
  // silent 模式：都不展示
}
```

## 12. 实施优先级

1. **P0 — 平台抽象层基础设施**：capabilities、provider、errors、接口定义
2. **P1 — 核心数据 Repository**：calendar、event、todo（迁移 Tauri 实现 + 新建 Web 实现）
3. **P2 — Store 改造**：calendar store、todo store、settings store
4. **P3 — 认证 Repository**：auth（拆分现有 AuthService 双分支）
5. **P4 — 同步 Repository**：sync + cloudSync 合并
6. **P5 — 设置 Repository**：settings（Web 端远端存储实现）
7. **P6 — 提醒服务适配**：reminder 服务通过能力判断降级
8. **P7 — 组件清理**：替换所有 `isTauri()` 为能力判断
9. **P8 — 旧代码清理**：废弃 `utils/tauri.ts` 中的 invokeXxx 函数，移除旧 Service 中的平台分支
