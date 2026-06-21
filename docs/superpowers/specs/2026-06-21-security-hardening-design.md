# 安全加固设计：CSP 策略 + 权限收窄

> 来源：[#54 项目安全性、架构设计与性能优化综合审计报告](https://github.com/xiaohai2271/SmartRiverCalender/issues/54)
> 日期：2026-06-21

## 背景

当前应用存在两个安全问题：

1. **CSP 缺失**：`tauri.conf.json` 中 `"csp": null`，未设置任何内容安全策略，增加 XSS 攻击面
2. **权限过宽**：`capabilities/default.json` 授予 `fs:default`（递归读取应用目录）和 `fs:allow-write-text-file`（无 scope 限制，可写任意路径），违反最小权限原则

## 设计

### 1. CSP 策略配置

#### 生产环境 CSP

在 `src-tauri/tauri.conf.json` 的 `app.security.csp` 中设置：

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com; connect-src 'self' https://api.upgrade.toolsetlink.com; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'
```

各指令说明：

| 指令 | 值 | 理由 |
|------|-----|------|
| `default-src` | `'self'` | 默认只允许同源资源 |
| `script-src` | `'self'` | 无 eval/new Function，Vue 3 生产构建不需要 unsafe-eval |
| `style-src` | `'self' 'unsafe-inline'` | Vue scoped styles + Fluent UI Web Components 需要内联样式 |
| `img-src` | `'self' data: blob: https://avatars.githubusercontent.com` | 应用内图片 + 动态图片 + GitHub 用户头像 |
| `connect-src` | `'self' https://api.upgrade.toolsetlink.com` | 同源 API + 自动更新端点（Tauri IPC 走自定义协议，不受 connect-src 管控） |
| `font-src` | `'self'` | 无外部字体 |
| `frame-src` | `'none'` | 不嵌入任何 iframe |
| `object-src` | `'none'` | 禁止 Flash/Java 等插件 |
| `base-uri` | `'self'` | 防止 base 标签劫持 |
| `form-action` | `'self'` | 防止表单提交到外部域 |

#### 开发环境 CSP

开发环境需要 Vite HMR 正常工作，CSP 保持 `null`（不设置）。Tauri 2.x 支持通过 `app.security.csp` 与 `app.security.devCsp` 分别配置生产和开发环境：

- `csp`：生产构建生效
- `devCsp`：开发模式生效（设为 `null` 或包含 `'unsafe-eval'`）

#### CSP 白名单依据

| 域名 | 指令 | 用途 | 来源 |
|------|------|------|------|
| `avatars.githubusercontent.com` | `img-src` | GitHub OAuth 用户头像 | `UserProfile.vue` 的 `user.avatarUrl` |
| `api.upgrade.toolsetlink.com` | `connect-src` | Tauri 自动更新 API | `tauri.conf.json` endpoints |

其余资源均为同源或本地加载，无需额外白名单。

#### 不需要 unsafe-eval / unsafe-inline(script) 的依据

- `eval()` / `new Function()`：源码中无使用，Vue 3 生产构建使用预编译模板
- 内联脚本：Vite 构建后所有脚本通过文件引用加载
- `v-html` 用途：`UpdateDialog.vue`（`marked` + `DOMPurify` 净化）、`OAuthLoginButton.vue`（硬编码 SVG），不影响 CSP

### 2. 文件系统权限收窄

#### 当前权限问题

| 权限 | 授予范围 | 实际使用 | 问题 |
|------|---------|---------|------|
| `fs:default` | 递归读取应用特定目录 | **前端从未使用** | 过度供给 |
| `fs:allow-write-text-file` | 可写入文件系统任意路径 | 仅 DebugView 导出日志/数据 | 无 scope 限制 |

前端数据访问全部通过 Rust → SQLite 路径，不经过 fs plugin。Rust 端的 `std::fs` 操作不受 Tauri 权限系统管控。

#### 修改方案

**移除**：`fs:default` — 前端不需要读取应用目录

**替换** `fs:allow-write-text-file` 为带 scope 的配置：

```json
{
  "identifier": "fs:allow-write-text-file",
  "allow": [
    { "path": "$DESKTOP/**" },
    { "path": "$DOWNLOAD/**" },
    { "path": "$DOCUMENT/**" }
  ]
}
```

使用 Tauri 语义化目录变量（`$DESKTOP`/`$DOWNLOAD`/`$DOCUMENT`），这些变量自动解析为当前操作系统的本地化路径（如中文 Windows 上 `$DESKTOP` 解析为 `C:\Users\zheng\桌面`），无需硬编码中文目录名。

仅 DebugView 的导出功能（`writeTextFile`）使用此权限，路径来自用户 `save()` 对话框选择的导出位置。注意：`save()` 对话框允许用户浏览到任何目录，如果选择了 scope 外的路径，`writeTextFile` 会抛出权限错误。当前 DebugView 仅 `console.error` 处理，需添加 `toast.error()` 用户可见提示，说明"所选路径不在允许的目录范围内"。

#### 唯一使用点

| 文件 | 行号 | 用途 | 路径来源 |
|------|------|------|---------|
| `src/views/DebugView.vue` | 396 | 导出日志 | `save()` 对话框用户选择 |
| `src/views/DebugView.vue` | 646 | 导出数据库表数据 | `save()` 对话框用户选择 |

### 3. 补充安全改进

#### shell:default 权限收窄

当前 `capabilities/default.json` 包含 `shell:default`。经查 Tauri 2.x ACL 清单，`shell:default` 仅包含 `shell:allow-open`（打开 URL），**不包含** `shell:allow-spawn`。前端代码无 `@tauri-apps/plugin-shell` 的直接 import，OAuth 流程中打开浏览器由 Rust 端处理。

**方案**：将 `shell:default` 替换为显式的 `shell:allow-open`，提高权限声明可读性和明确性（功能等价，但显式声明优于隐式默认）。

#### mcp-bridge:default 权限清理

`mcp-bridge` 插件仅在 `#[cfg(debug_assertions)]` 下注册，但 `mcp-bridge:default` 权限在所有构建的 `default.json` 中声明。生产构建中插件未注册，权限声明无实际效果但造成混淆。

**方案**：将 `mcp-bridge:default` 从 `default.json` 移至单独的 debug-only capability 文件（如 `debug.json`），或直接移除。

#### style-src unsafe-inline 风险说明

`style-src 'self' 'unsafe-inline'` 是 Vue scoped styles + Fluent UI Web Components 的硬性要求。`unsafe-inline` 在 style-src 中的风险低于 script-src（CSS 无法执行 JS），但攻击者仍可用 CSS 属性选择器进行数据外泄。当前应用无敏感表单输入，此风险可接受。

#### VITE_API_BASE_URL 与 CSP 一致性

Web 端的 `VITE_API_BASE_URL` 在生产环境中为 `/v1`（同源），不受 `connect-src` 限制。桌面端数据走 Rust → SQLite，不经过 WebView fetch。但如果 DebugView 的 API 配置切换功能将 API 地址改为非白名单域名，请求会被 CSP 阻断——这是预期行为，生产环境不允许连接未授权的 API 端点。

## 影响范围

| 修改项 | 影响文件 | 向后兼容 |
|--------|---------|---------|
| CSP 配置 | `src-tauri/tauri.conf.json` | ✅ 无破坏性变更 |
| 权限移除 `fs:default` | `src-tauri/capabilities/default.json` | ✅ 前端不使用此权限 |
| 权限 scope 限制 | `src-tauri/capabilities/default.json` | ⚠️ 用户导出路径必须在 Desktop/Documents/Downloads 下 |
| `shell:default` → `shell:allow-open` | `src-tauri/capabilities/default.json` | ✅ 前端不直接调用 shell |
| `mcp-bridge:default` 移除/迁移 | `src-tauri/capabilities/default.json` 或新建 `debug.json` | ✅ 仅影响 debug 构建 |

## 验证方案

1. **CSP 验证**：启动应用，打开 DevTools Console，确认无 CSP 违规警告
2. **功能回归**：验证 GitHub 登录头像加载、自动更新检查、外部日历同步等网络功能正常
3. **权限验证**：DebugView 导出日志到桌面/文档/下载目录成功；尝试导出到其他路径应失败
4. **XSS 防护**：在 DevTools Console 中尝试注入外部脚本（如 `fetch('https://evil.com')`），应被 CSP 阻止
5. **开发模式**：`pnpm tauri:dev` 正常启动，Vite HMR 无异常
6. **shell 权限验证**：确认 OAuth 登录流程中打开浏览器正常（Rust 端调用 `shell:allow-open`）
7. **mcp-bridge 验证**：生产构建中无 mcp-bridge 权限声明；debug 模式下 MCP 功能正常

## 延后项

- SQLite 全库加密（SQLCipher）：已单独创建 [#80](https://github.com/xiaohai2271/SmartRiverCalender/issues/80)
- `app.proxyPassword` 明文存储：随 SQLCipher 一起在 #80 中修复
