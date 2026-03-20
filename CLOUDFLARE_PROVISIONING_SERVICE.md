# Cloudflare 一键开通服务说明

当前 `settings.html` 已经支持在扩展内直接通过 Cloudflare API 自动创建资源。

本文档对应的是**备用方案**：当你仍希望通过一个额外部署的开通服务来完成 Cloudflare 授权和资源创建时，可以使用这里的约定与模板。

## 目标

让最终用户只需要：

1. 在设置页填写一次开通服务地址。
2. 点击“一键开通（Beta）”。
3. 授权 / 完成服务侧引导。
4. 扩展自动回填 `workerUrl`、`accessToken`、`themeId`、`themeName` 并启用同步。

## 扩展侧约定

扩展会向以下地址发起请求：

- `GET {serviceBaseUrl}/health`
- `GET {serviceBaseUrl}/oauth/cloudflare/start?state=...&redirect_uri=...&theme_name=...`

扩展使用 `chrome.identity.launchWebAuthFlow()` 打开第二个地址，并期待服务最终重定向到传入的 `redirect_uri`。

## 回调契约

服务最终需要重定向到：

`{redirect_uri}?state=原始state&status=success&payload=BASE64URL_JSON`

其中 `payload` 解码后的 JSON 至少包含：

```json
{
  "workerUrl": "https://your-worker.workers.dev",
  "accessToken": "optional-worker-access-token",
  "themeId": "cf-1234567890",
  "themeName": "Cloudflare 工作区"
}
```

失败时重定向为：

`{redirect_uri}?state=原始state&status=error&message=错误信息`

## `GET /health` 返回示例

```json
{
  "ok": true,
  "provider": "cloudflare",
  "message": "service ready"
}
```

## 服务建议职责

服务侧建议完成以下动作：

- 引导用户完成 Cloudflare 账号授权或输入必要参数。
- 创建或复用一个 Worker。
- 创建并绑定 D1 数据库。
- 创建并绑定 R2 Bucket。
- 写入 Worker 脚本内容，可直接复用仓库中的 `cloudflare/cf-worker.js`。
- 调用 Worker 的 `/api/init` 完成 D1 建表。
- 生成并回传 Worker 访问地址与访问令牌。

## 当前仓库已提供的配套文件

- `cloudflare/cf-worker.js`：同步 Worker 模板
- `cf-d1-init.sql`：D1 初始化 SQL
- `js/core/cf-setup-manager.js`：扩展侧一键开通与资源初始化逻辑
- `settings.html`：服务地址配置、一键开通、模板复制入口
- `workers/worker.js`：可部署的一键开通服务模板
- `workers/README.md`：服务部署与使用说明
- `workers/wrangler.toml.example`：Wrangler 示例配置

## 当前状态

本次改动已补齐两部分：

- 扩展侧一键开通入口
- 配套开通服务模板

你现在可以直接：

1. 部署 `workers/worker.js`
2. 把服务地址填到 Card Tab 设置页
3. 点击“一键开通（Beta）”
4. 在服务引导页里填写 Cloudflare `Account ID` 和 `API Token`
5. 让服务自动创建 D1 / R2 / 同步 Worker，并回填扩展配置

## 仍需注意

由于服务模板调用的是 Cloudflare 官方 REST API，首次正式上线前，建议你用自己的 Cloudflare 账号做一次完整联调，确认：

- API Token 权限足够
- `workers.dev` 子域名已启用
- 你的账号接口字段与当前模板兼容
