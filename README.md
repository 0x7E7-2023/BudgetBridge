# BudgetBridge

将多个含代金券的账号聚合为一个高可用的 API 代理服务，同时兼容 OpenAI 和 Anthropic 格式。

## 功能

- 🤖 同时兼容 OpenAI（`/v1/chat/completions`）和 Anthropic（`/v1/messages`）格式
- 🔄 账号池轮询，自动故障转移
- 💰 余额 API 监控（每 5 分钟），低于 ¥3.00 自动停用
- ⚡ 429 限流自动冷却 60s 并换号重试
- 🌊 Stream 流式无感重试（先确认 200 再转发给客户端）
- 🔧 模型名称覆盖（`model_override`），透明替换请求中的模型 ID
- 📊 React 看板：账号增删、余额查询、启停、测试、清空

## 快速开始

### 本地开发（推荐）

```powershell
# 1. 配置账号
copy backend\config.yaml.example config.yaml
# 编辑 config.yaml，填入真实的 api_key / ak_id / ak_secret

# 2. 编辑 config.yaml，填入真实的 api_key / ak_id / ak_secret
#    端口等配置均在 config.yaml 中设置（默认 :8080）

# 3. 一键启动（弹出两个终端窗口）
.\dev.ps1
# 前端: http://localhost:5173
# 后端: http://localhost:<config.yaml 中 listen 的端口>
```

> 需要先安装 [air](https://github.com/air-verse/air) 实现后端热重载：
> `go install github.com/air-verse/air@latest`
> 未安装时 `dev.ps1` 自动回退到 `go run .`

### Docker 部署

```bash
cp backend/config.yaml.example backend/config.yaml
# 编辑 config.yaml，设置 listen 端口和其他配置

docker compose up -d
# 前端: http://localhost:<前端端口>
# API:  http://localhost:<config.yaml 中配置的端口>/v1
```

#### 交互式部署（推荐）

```bash
./scripts/deploy.sh
```

脚本会引导填写配置（包括端口），可选自动配置 Nginx + HTTPS。所有配置会写入 `backend/config.yaml`，并自动同步到 Docker 和 Nginx 配置。

#### 生产环境

- Caddy 配置：`caddy/Caddyfile`
- 详细指南：[部署文档](docs/deployment.md)

## API 接入

前端顶栏会显示当前地址，点击按钮可在 OpenAI / Anthropic 格式间切换。

> 部署时建议在 `config.yaml` 中设置 `public_url`，前端会自动使用配置的地址，无需手动拼接。

### OpenAI 兼容客户端

Base URL 末尾带 `/v1`：

```
<public_url>/v1
```

Key 填任意值（后端转发时自动替换为真实 key）。

### Anthropic 兼容客户端

Base URL 末尾**不带** `/v1`：

```json
{
  "env": {
    "BASE_URL": "<public_url>",
    "API_KEY": "any-key"
  }
}
```

**工作原理：**
- 客户端发送 Anthropic 格式请求（`POST /v1/messages`）
- 代理自动转换为 OpenAI 格式转发给上游
- 支持流式输出、工具调用（Function Calling）、多轮对话

## Dashboard 操作说明

| 操作 | 位置 | 说明 |
|------|------|------|
| 添加账号 | 顶栏右侧 | 填入别名、API Key、AK，立即触发余额查询 |
| 清空账号 | 顶栏右侧 | 两次点击确认，写回 config.yaml |
| 端到端测试 | 顶栏"测试"按钮 | 直接向代理发送真实请求，无需配置外部工具 |
| 查余额 | 卡片底部 | 立即查询该账号代金券余额 |
| 启用/停用 | 卡片底部 | 手动控制账号是否参与轮询 |
| 解冻 | 卡片底部（冷却中时出现） | 提前解除 429 冷却 |

## 配置说明

所有配置均在 `backend/config.yaml` 中管理：

```yaml
listen: ":8080"              # 后端监听端口（按需修改）
upstream_url: "https://your-upstream-api.com/compatible-mode/v1"
public_url: "https://your-domain.com"  # 前端展示用的公开地址，留空则自动拼接为请求的 hostname:listen端口

accounts:
  - alias: "账号A"
    api_key: "sk-..."        # 模型调用密钥
    ak_id: "LTAI5..."        # AccessKey ID
    ak_secret: "..."         # AccessKey Secret
```

> **端口配置**：修改 `listen` 后，需同步更新 `docker-compose.yml` 和 nginx 配置中的端口映射。建议使用 `./scripts/deploy.sh` 交互式部署脚本，它会自动从 config.yaml 读取端口并同步到各配置文件中。

需要授予余额查询相关权限。

## Admin API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/accounts` | 账号池状态列表 |
| POST | `/admin/accounts` | 添加账号（JSON body） |
| DELETE | `/admin/accounts` | 清空所有账号 |
| POST | `/admin/accounts/:index/toggle` | 启用/停用 |
| POST | `/admin/accounts/:index/refresh` | 立即查询余额 |
| POST | `/admin/accounts/:index/cooldown/clear` | 解除冷却 |
