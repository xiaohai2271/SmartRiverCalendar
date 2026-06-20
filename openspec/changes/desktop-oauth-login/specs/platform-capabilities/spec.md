## MODIFIED Requirements

### Requirement: PlatformCapabilities OAuth 能力声明

PlatformCapabilities SHALL 使用 `hasOAuthLogin: boolean` 替代 `hasOAuthCallback: boolean`，表示平台是否支持 OAuth 第三方登录。桌面端和 Web 端均设为 true。

#### Scenario: 桌面端 OAuth 登录能力
- **WHEN** 桌面端初始化 PlatformCapabilities
- **THEN** hasOAuthLogin 为 true（支持 session 中转轮询）

#### Scenario: Web 端 OAuth 登录能力
- **WHEN** Web 端初始化 PlatformCapabilities
- **THEN** hasOAuthLogin 为 true（支持页面跳转 OAuth）

## REMOVED Requirements

### Requirement: hasOAuthCallback
**Reason**: localhost HTTP 回调服务器模式已被废弃，改用 Session 中转轮询模式。名称 `hasOAuthCallback` 不再反映实际机制。
**Migration**: 所有使用 `capabilities.hasOAuthCallback` 的代码改为 `capabilities.hasOAuthLogin`