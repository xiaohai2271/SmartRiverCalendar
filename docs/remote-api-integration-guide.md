# SmartRiver Calendar 远程数据服务对接指南

> **版本:** v1.0
> **状态:** 规划中
> **目的:** 指导当前基于本地 SQLite 的 Tauri 应用，如何平滑接入 `backend-api-guideline.md` 定义的云端远程接口，实现多端同步和用户体系。

---

## 1. 架构定位：本地优先 (Local-First)

为了保证桌面日历应用的核心体验（极速响应、离线可用），我们在接入远程 API 时，必须坚持 **“本地优先 (Local-First)”** 架构。

### 1.1 数据流向变更

**当前架构 (单机版)：**
`Vue Components` <-> `Pinia Stores` <-> `Tauri IPC (tauri.ts)` <-> `Rust Commands` <-> `SQLite (Local)`

**目标架构 (云端同步版)：**
`Vue Components` <-> `Pinia Stores` <-> `Tauri IPC` <-> `Rust Commands` <-> `SQLite (Local)`
                                                                  |
                                                           `Rust Sync Engine` (新增)
                                                                  |
                                                    `Remote API & WebSocket` (云端)

### 1.2 核心原则
1. **前端无感知**：Vue 和 Pinia 层**不直接**调用远程 HTTP API。它们仍然只与 Tauri IPC 交互。
2. **异步同步**：增删改查操作优先写入本地 SQLite，成功后立即返回前端更新 UI。后台 Sync Engine 负责将变更排队并推送到云端。
3. **离线可用**：断网时应用功能完全正常，恢复网络后自动触发合并同步。

---

## 2. 核心改造步骤划分

对接工作建议分为四个阶段进行：

### 阶段一：认证体系与基础结构改造
1. **UI 层**：新增登录/注册页面，增加 OAuth 授权（GitHub/WeChat等）的 Webview 弹窗逻辑。
2. **Rust 层**：
   - 引入 `reqwest` 用于发起 HTTP 请求。
   - 实现 OAuth 流程的回调处理。
   - 安全存储：获取到 JWT Token 后，使用操作系统级安全存储（如 Windows Credential Manager，可使用 `keyring` crate）保存 Access Token 和 Refresh Token。
3. **数据库层**：修改本地 SQLite 表结构，对齐云端规范：
   - 所有核心表增加 `updated_at`, `deleted_at` 字段（支持软删除）。
   - `events` 表补充 `timezone` 字段。
   - 增加本地的 `sync_log` 表，用于记录待同步的操作队列。

### 阶段二：全量与批量同步引擎构建
1. **启动同步**：应用启动且用户已登录时，触发一次 `POST /batch/sync`。
2. **上报变更**：查询本地 `sync_log` 中未同步的增删改记录，打包上报。
3. **拉取云端**：将请求中返回的 `server_changes` 写入本地 SQLite，并更新本地的 `sync_token`。
4. **触发 UI 更新**：Rust 端完成数据库合并后，通过 Tauri Event (如 `sync-complete`) 通知前端 Pinia 重新 `invokeGetEvents()` 加载数据。

### 阶段三：实时推送 (WebSocket) 接入
1. **长连接维护**：在 Rust 侧建立并维护 WebSocket 连接（推荐使用 `tokio-tungstenite`）。
2. **心跳保活**：实现 30 秒 Ping/Pong 机制，断线自动指数退避重连。
3. **消息处理**：收到 `event.created` / `event.updated` 等消息时：
   - 直接修改本地 SQLite。
   - 发送 Tauri Event 给前端，前端只做增量 DOM 更新，避免全量刷新。

### 阶段四：外部日历（CalDAV/Exchange）的云端接管
*当前外部日历由本地 Rust 客户端直接请求第三方服务器。*
* **迁移策略**：将 CalDAV/Exchange 的凭据通过 `POST /accounts/connect` 托管给云端。云端负责去拉取第三方事件，并统一通过我们自己的 WebSocket 推送给客户端。
* **好处**：降低客户端耗电，实现“一次绑定，多端同步”。客户端只需关注自身的一套标准 API。

---

## 3. 关键技术难点与解决方案

### 3.1 ID 映射冲突问题
**问题**：当前 SQLite 使用自增整型 `id`。在离线状态下创建了事件 A（本地 ID: 10），同步到云端后，云端分配了全局唯一 ID（如 105）。
**解决方案**：
* **方案 A（推荐）**：彻底废弃本地自增 ID。前端或 Rust 在创建记录时，直接生成 UUID v4 作为主键存入 SQLite，并上报云端。前后端 ID 统一为 String (UUID)。
* **方案 B**：保留本地自增 ID 作为主键，新增 `remote_id` 字段。UI 绑定 `remote_id`，同步逻辑负责维护映射表。相对复杂。

### 3.2 冲突解决策略
当本地离线修改了事件 A，同时云端另一台设备也修改了事件 A：
* 依靠 `updated_at` 时间戳。
* 客户端在执行 `POST /batch/sync` 时，云端进行校验：如果云端的 `updated_at` > 客户端提交的 `updated_at`，则以云端为准，云端在响应的 `server_changes` 中下发最新覆盖版本。本地收到后静默覆盖。

### 3.3 Token 自动刷新机制
Rust 侧的网络请求模块 (HTTP Client Wrapper) 需要实现拦截器逻辑：
1. 请求接口返回 `401 Unauthorized`。
2. 拦截器挂起当前请求，自动调用 `POST /auth/refresh` 换取新 Token。
3. 如果刷新成功，更新本地 Keychain，并携带新 Token 重试原请求。
4. 如果 Refresh Token 也失效，触发退出登录逻辑，通过 Tauri Event 通知前端弹回登录页。

---

## 4. 前端 (Vue/Pinia) 需配合的改动

尽管网络请求在 Rust 层，前端仍需配合以下改动：
1. **Store 逻辑解耦**：当前 `useCalendarStore` 中的 `loadExternalEvents` 包含大量直接连接 CalDAV 的逻辑。未来这部分代码将大幅精简，前端不再区分“本地”和“外部”，统一调用 `invokeGetEvents()`，复杂性交由后台 Sync Engine 屏蔽。
2. **状态感知**：在顶部导航栏增加“同步状态指示器”（云朵图标）。监听 Rust 发出的同步状态事件（同步中、同步成功、离线、Token 过期），提供良好的用户反馈。
3. **时区处理**：引入 `date-fns-tz` 或类似库。在创建/编辑事件时，UI 需要明确带上系统的当前时区标识（如 `Asia/Shanghai`）传给 Tauri。

---

## 5. 最小可行性验证 (MVP) 路径

建议按以下路径进行渐进式开发：
1. **Mock 阶段**：搭建后端服务，先实现单纯的 OAuth 登录和用户信息展示，跑通前后端通信与 Token 存储。
2. **单向同步**：实现手动点击“同步”按钮，将本地数据全量推送到云端。
3. **双向同步**：实现增量双向合并（Batch Sync）。
4. **实时响应**：最后加入 WebSocket。
