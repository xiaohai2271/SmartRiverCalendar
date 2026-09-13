# 后端 API 需求：健康检查接口

> 日期：2026-06-14
> 关联设计：[2026-06-14-api-config-refactor-design.md](./2026-06-14-api-config-refactor-design.md)
> 状态：已实现（前端降级方案已部署，待后端 /health 接口上线）

## 背景

小河日历客户端（桌面端 + Web 端）调试界面支持切换 API 接口地址和平台地址。切换前需要验证目标地址是否可达，以便用户及时发现配置错误。

## 需求列表

### 1. 健康检查接口

| 项目 | 说明 |
|------|------|
| **路径** | `GET /health` |
| **认证** | 无需认证 |
| **调用方** | 桌面端 / Web 端前端（`src/utils/connectivity.ts`） |
| **用途** | 供客户端检测 API 服务是否可达及基本运行状态 |

**请求**：无请求体，无查询参数

**成功响应**（HTTP 200）：

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "version": "1.2.0",
    "timestamp": 1718352000
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | integer | 是 | 业务码，0 表示成功 |
| `data.status` | string | 是 | 固定值 `"ok"` |
| `data.version` | string | 否 | 后端服务版本号，便于客户端展示 |
| `data.timestamp` | integer | 否 | 当前 Unix 时间戳（秒） |

**错误响应**：无特殊错误码，服务不可达时客户端收不到响应（超时/连接拒绝）。

### 2. 现有接口确认

以下接口在本次变更中**不需要修改**，但需确认其行为：

| 接口 | 说明 | 确认项 |
|------|------|--------|
| `POST /auth/client/session` | 创建 OAuth session | 使用 `api_url` 拼接路径，不受影响 |
| `GET /auth/client/session/{id}` | 轮询 session 状态 | 使用 `api_url` 拼接路径，不受影响 |
| `GET /auth/oauth/{provider}/authorize-url` | Web 端获取授权 URL | 由后端返回完整 URL，不受影响 |

## 客户端降级方案

如果后端暂未提供 `/health` 接口，客户端回退为 `HEAD {api_url}` 检测 HTTP 层连通性：

- 任何 2xx / 3xx / 4xx 响应 → 视为可达
- 仅超时 / DNS 失败 / 连接拒绝 → 视为不可达

降级时无法获取 `version` 和 `timestamp` 信息，但连通性判断不受影响。
