# Quickstart: 平台接入开发与联调（specs/main）

**规划目录**: `specs/main`  
**详细任务**: 见 `tasks.md`（`/speckit.tasks`）

## 0. 用户主流程（验收视角 — 与 `spec.md` 一致）

**主路径（非官方发布引擎）**

1. 登录 SocialWiz。  
2. 在账户/平台页 **连接微博**（启动会话采集，非开放平台授权页）。  
3. 在浏览器中完成 **微博网页登录**；回到本站后列表显示已连接。  
4. 在 **作品 → 发布流程** 中选择该微博账号并 **发布** → 统一接口创建 `PublishJob` 并启动本机 compose；响应含 `jobId` 时可 **轮询** `GET /api/platforms/publish/jobs/{jobId}` 直至 `SUCCESS` 或 `FAILED`（作品发布页已内置轮询）。  

**兼容路径（OAuth / 003）**

1. 配置 `WeiboAppConfig` 或环境变量后，走 `GET /api/platforms/weibo/auth` 授权回调，得到 token 型 `PlatformAccount`。  
2. 发布可走官方 API（与主路径在 UI 上宜收敛为同一「发布」按钮，由服务层分支）。

## 1. 前置条件

- PostgreSQL 与 `DATABASE_URL`；`npx prisma migrate dev` 可执行。  
- **主路径**：`pnpm exec playwright install chromium`；API 与会话目录同机可写。  
- **OAuth 联调（可选）**：微博开放平台网站应用、回调域与 `WEIBO_*` 或 `WeiboAppConfig`。

## 2. 当前（迁移前）本地联调 — 环境变量方式

在实现 `WeiboAppConfig` 前，现有路由依赖：

- `WEIBO_APP_KEY`
- `WEIBO_APP_SECRET`
- `WEIBO_REDIRECT_URI`（可选；未设则用 `NEXT_PUBLIC_BASE_URL` + `/api/platforms/weibo/auth/callback`）

启动应用后：

1. 登录 SocialWiz，在设置页触发「连接微博」（或调用 `GET /api/platforms/weibo/auth`，带 Bearer）。
2. 浏览器完成微博授权，回调由 `auth/callback` 处理并写入 `PlatformAccount`。
3. 使用 `POST /api/platforms/weibo/{platformAccountId}/publish` 试发纯文本（需与现网路由请求体字段一致）。

## 3. 目标（迁移后）联调 — 用户配置方式

1. 调用 `POST /api/platforms/weibo/app-configs`（实现后）创建配置，或使用设置页表单。
2. `GET /api/platforms/weibo/auth?weiboAppConfigId=<uuid>` 使用**该条** App Key/Secret 生成授权 URL。
3. 其余 OAuth / 发布流程不变，但 token 与 `weiboAppConfigId` 关联。

## 4. 验证清单

- [ ] 未登录请求返回 401。
- [ ] `state` 篡改或过期回调拒绝。
- [ ] 超长正文在发布前被业务校验拦截。
- [ ] Token 过期时接口返回可引导「重新连接」的语义（401/4xx + 明确 message）。

## 5. 参考文档

- 实现状态摘要：`specs/003-weibo-integration/STATUS.md`
- 架构说明：`docs/platform-integration/technical-plan/integration-architecture.md`

---

## 6. 浏览器会话 Uploader（无官方 API）

**规划**: [plan.md](./plan.md)、[research.md](./research.md) 第 9–15 节、[contracts/browser-uploader-api.yaml](./contracts/browser-uploader-api.yaml)。

### 前置

- 已安装 Chromium：`pnpm exec playwright install chromium`（或项目文档等价命令）。
- API 进程与脚本 **能访问同一会话目录**（默认本机开发）。

### 微博（当前参考实现）

1. 登录 SocialWiz，在 **账号管理**（`/accounts`）或等价入口触发 **Playwright 绑定**（`POST /api/platforms/weibo/playwright-bind`），轮询 `GET` 直至会话文件存在或失败见响应 `detail`。
2. 确认 `scripts/weibo-playwright/sessions/<userId>.json` 生成且账号列表出现对应 Playwright 行。
3. **浏览器会话发布**：站内 **POST /api/platforms/publish**（或 `POST /api/platforms/weibo/{accountId}/publish`）；服务端经 `compose-runner` HTTP 复现发博（不需单独 `playwright-compose` 路由）。
4. **勿**对 Playwright 账号调用 OAuth 发布路由 — 应返回明确错误；与 [data-model.md](./data-model.md) 中连接模式一致。

### 新增平台（开发者）

1. 在 `scripts/<slug>-playwright/` 增加会话采集脚本（可参考微博侧 `save-session` / `open-weibo`）；发博侧优先在 `lib/<slug>-playwright/` 用 **HTTP 复现** 接入 `compose-runner` 模式，而非单独 `try-compose` 路由。
2. 注册 `UploaderManifest`（实现阶段落地具体文件）。
3. 添加或复用泛型 `app/api/platforms/...` 路由，契约对齐 OpenAPI。

### 验证清单（Uploader）

- [ ] Playwright 账号在发布 UI 中与 OAuth 账号文案区分。
- [ ] 子进程异常退出时 API 返回可读 `hint`，日志无 cookie 明文。
- [ ] 并发绑定锁生效（同用户重复绑定不损坏会话文件）。
- [ ] `NEXT_PUBLIC_ENABLE_WEIBO_OAUTH_UI=true` 时账号页出现「开放平台授权」按钮；未设或为 `false` 时仅主路径浏览器连接。

### jobId 轮询（作品发布）

1. `POST /api/platforms/publish`（FormData，含 `contentId`、微博 `accountId`）对 **会话型** 账号返回 `success`、`jobId`、`requiresJobPolling: true`。
2. `GET /api/platforms/publish/jobs/{jobId}`，`Authorization: Bearer <jwt>`，直至 `status` 为 `SUCCESS`（已尝试打开 compose）或 `FAILED`。
3. 契约见 `specs/main/contracts/publish-job-api.yaml`。
