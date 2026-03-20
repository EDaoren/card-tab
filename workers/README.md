# Cloudflare Provisioning Service

这是给 `Card Tab` 扩展使用的“一键开通服务”模板。

它实现了扩展侧已经接好的这条链路：

1. 扩展访问 `/oauth/cloudflare/start`
2. 服务展示一个简单引导页
3. 用户填写 `Account ID` 和 `API Token`
4. 服务自动创建 D1 / R2 / 同步 Worker
5. 服务调用新建 Worker 的 `/api/init`
6. 服务把 `workerUrl`、`accessToken` 等信息重定向回扩展

## 文件

- `worker.js`：Cloudflare Worker 服务模板
- `wrangler.toml.example`：部署示例配置

## 当前实现说明

这个模板的目标是：

- 尽量减少用户手动操作
- 不要求用户自己创建 D1 / R2 / Worker
- 不在服务端持久化保存用户的 Cloudflare API Token

用户仍需要提供两项 Cloudflare 信息：

- `Account ID`
- 一个具备资源创建权限的 `API Token`

相比手动方案，已经把“创建 Worker、创建 D1、创建 R2、部署脚本、初始化数据表”全部自动化了。

## 建议 Token 权限

建议至少包含：

- `Account Settings:Read`
- `Workers Scripts:Edit`
- `D1:Edit`
- `R2:Edit`

如果你的账号尚未启用 `workers.dev`，请先在 Cloudflare 控制台完成一次启用。

## 部署

1. 安装 Wrangler
2. 复制 `wrangler.toml.example` 为 `wrangler.toml`
3. 修改 `name` 为你的服务名称
4. 执行 `wrangler deploy`
5. 将部署后的 Worker URL 填入 Card Tab 设置页的“开通服务地址”

## 与扩展侧契约

扩展侧要求以下接口：

- `GET /health`
- `GET /oauth/cloudflare/start`
- `POST /oauth/cloudflare/complete`

服务最终必须重定向回扩展传入的 `redirect_uri`，并在 URL 中附带：

- `state`
- `status=success`
- `payload=BASE64URL_JSON`

或者：

- `state`
- `status=error`
- `message=错误信息`

## 注意

`worker.js` 中调用的是 Cloudflare 官方 REST API。由于 Cloudflare API 可能会在字段名或上传细节上有小幅变化，首次正式部署前建议你用自己的账号做一次完整联调。
