## MODIFIED Requirements

### Requirement: PlatformCapabilities 声明 SSO 能力

PlatformCapabilities SHALL 新增 `hasSsoLogin: boolean` 字段，表示平台是否支持跨应用同根域 SSO 登录。Web 端 SHALL 设置为 `true`，桌面端 SHALL 设置为 `false`。组件 SHALL 通过 `useCapabilities().hasSsoLogin` 判断是否启用 SSO 检测逻辑。

#### Scenario: Web 端 SSO 能力启用
- **WHEN** Web 端 `WebCapabilities` 初始化
- **THEN** `hasSsoLogin === true`，组件可启用 SsoCoordinator 和静默检测

#### Scenario: 桌面端 SSO 能力禁用
- **WHEN** 桌面端 `TauriCapabilities` 初始化
- **THEN** `hasSsoLogin === false`，SsoCoordinator 不启动，detectSsoSession 返回 no-op

#### Scenario: 组件按能力渲染
- **WHEN** 组件通过 `useCapabilities()` 读取 SSO 状态
- **THEN** 根据 `hasSsoLogin` 决定是否显示 "已通过 RiverCalenderWeb 登录" 提示 UI

## ADDED Requirements

（无）
