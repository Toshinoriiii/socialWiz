# Research: 微博平台接入（specs/main，2026-04-03）

**Feature**: 微博平台接入（主分支规划）  
**Canonical detail**: `specs/003-weibo-integration/research.md`  
**Purpose**: 收敛 Technical Context 中所有待定项，并记录**规范 vs 当前代码**的决策。

---

## 1. 凭证存放：用户维度 vs 环境变量

**Decision**: 以 **数据库中的用户维度应用配置** 为唯一真实来源（`WeiboAppConfig`：`appId` 明文、`appSecret` 加密）；生产路径下 **不依赖** `WEIBO_APP_KEY` / `WEIBO_APP_SECRET`。本地开发可保留「仅当未配置任何 WeiboAppConfig 时回退 env」作为可选 DX 手段，且必须在 UI/文档标明「多租户产品不适用」。

**Rationale**: 与 `003` 规范及 Constitution 中数据隔离、密钥管理一致；当前 `app/api/platforms/weibo/auth/route.ts` 使用全局 env 属于待偿还技术债。

**Alternatives considered**:

- 长期仅用环境变量：与规范冲突，多用户无法隔离。
- 仅用 `PlatformPublishConfig` JSON 存密钥：可行但与微信 `WechatAccountConfig` 模式不对称，且 JSON 内加密字段规范更难统一；独立表更清晰。

---

## 2. 同一用户多个微博账号

**Decision**: 调整 `PlatformAccount` 唯一性约束：由 `@@unique([userId, platform])` 改为允许同一 `userId + WEIBO` 多条记录，例如 **`@@unique([userId, platform, platformUserId])`**（或 `+ weiboAppConfigId` 若同一微博 uid 在不同 app 下仍唯一需再论 — 通常 `platformUserId` 全局唯一即可）。

**Rationale**: `003` 明确要求多账号；当前 schema 禁止同一用户绑定第二个微博账号。

**Alternatives considered**:

- 保留单账号：明确拒绝规范，不可取。

---

## 3. OAuth `state` 与 CSRF

**Decision**: 延续现有 `generateOAuthState` / 校验流程；若 state 存 Redis，需文档化 TTL；若无 Redis，使用已选存储并保证回调时一致校验。

**Rationale**: 与既有实现一致，降低改动面。

**Alternatives considered**:

- Session cookie only：在 Next.js 无 session 时需额外中间件；沿用现状即可。

---

## 4. 发布接口选型（纯文本）

**Decision**: 纯文本优先 **`statuses/update`**（与 `003` research 一致）；带图再走 `statuses/upload` 等多接口策略（后续迭代）。

**Rationale**: 规范当前范围仅强制纯文字（FR-013）。

**Alternatives considered**:

- `statuses/share`：面向链接分享，不作为默认纯文本路径。

---

## 5. Token 刷新

**Decision**: Web 场景 **不假设** `refresh_token`；实现 `tokenExpiry` / `get_token_info` 检测，过期则 `needsReauth` + 引导重新授权；若响应中偶发带 refresh 则「有则试刷，无则重授权」（与 `003` 一致）。

**Rationale**: 微博 Web 文档与既有调研结论一致。

---

## 6. 应用配置管理 API 形态

**Decision**: REST 资源 **`/api/platforms/weibo/app-configs`**（GET 列表、POST 创建、PATCH/DELETE 单条），请求体 Zod 校验；服务层封装加密写入与「轻量校验」（可选调用 token 接口或保留「保存后首次 OAuth 失败再提示」以降低调用成本）。

**Rationale**: API-First，与现有 `/api/platforms/weibo/*` 命名空间一致。

**Alternatives considered**:

- GraphQL：与项目 REST 现状不一致。

---

## 7. `config/platform.config.ts` 中 `icon: any`

**Decision**: 本次规划**不**作为强制交付项；若顺手重构，改为 `React.ComponentType` 或显式联合类型以符合 Constitution。

**Rationale**: 与微博接入主线无关，避免扩大 diff。

---

## 8. 用户主流程 vs 实现分层（2026-04 澄清）

**Status**: **已被 §16 取代（产品主路径）**。以下保留作 **`003` / 开放平台兼容轨道** 的决策记录。

**Decision（003 轨道）**: 站内 **绑定微博账号** → **跳转微博开放平台登录/授权** → **回到本站** 后使用官方 API 发布等。`WeiboAppConfig`、OAuth 与 `PlatformAccount` 不变；主流程 UI 可不展示终端用户填密钥（由租户配置）。

**Rationale（历史）**: 多租户隔离与官方 API 稳定性。

**Alternatives considered**:

- 主流程强制展示应用配置表单：与「点击绑定即走」冲突，仅适合高级入口或部署向导。

---

## 待实现侧仍可细化（非阻塞规划）

- 微博错误码完整映射表可在实现阶段按日志迭代补齐。
- 图片/视频发布参数以保持「后续迭代」。

---

## 9. 无官方 API 时的默认技术路线：发布引擎 + 可插拔 transport

**Decision**: 以 **非官方发布引擎 + 平台插件** 为架构核心；**默认 transport** 仍为 **Playwright + 按用户隔离的 storage state + Node 脚本**（与 [social-auto-upload](https://github.com/dreammis/social-auto-upload) 一致）。**允许**在单平台插件内实现 **`http_replay`（对站内接口的受控复现 / 逆向）** 作为替代 transport，**封装在插件内部**，由 manifest 声明能力与降级策略。

**Rationale**:

- 产品目标（§16）要求 **统一站内「点击发布」**，不强制用户走开放平台；Playwright 最稳作为默认；单平台在维护成本可接受时可换 HTTP 复现以降低资源占用或提升速度。
- 逆向细节不进入全局契约，避免全站与未文档化接口强耦合。

**Alternatives considered**:

- **仅 OAuth**：与当前产品主路径（§16）冲突。
- **全站强制仅 Playwright**：排除部分平台优化空间；改为插件可选 transport。

---

## 10. 执行拓扑：会话文件与 API 同机

**Decision**: 规划期假定 **Next.js API 与 Playwright 子进程能读写同一套会话目录**（如 `scripts/weibo-playwright/sessions/`）；多机部署时 **浏览器 uploader 不在默认支持矩阵内**，需单独 worker + 共享卷或队列，列为后续 ADR。

**Rationale**: 与当前 `playwright-bind` + 站内 HTTP 复现（`compose-runner`）一致；避免规划阶段过度设计分布式执行。

**Alternatives considered**:

- 容器内无头统一跑：需隔离用户会话与资源配额，复杂度高，延后。

---

## 11. 与 OAuth 发布的关系（产品与技术）

**Decision**: **主路径**：**会话型账号** → 统一 **Publish** → **非官方发布引擎**（对用户不区分 Playwright 与 HTTP 复现）。**兼容路径**（可选、可 feature-flag）：OAuth 型账号 → `WeiboAdapter` 等官方 API。**禁止**会话 sentinel 误走开放平台 `publish` 实现。

**Rationale**: UX 上用户只点「发布」；技术分支收敛在服务层。Constitution「平台无关」通过 **插件接口 + 统一任务模型** 满足。

**Alternatives considered**:

- OAuth 与会话双按钮：增加认知负担，与「一键发布」目标不符。

---

## 12. Uploader 注册表（manifest）

**Decision**: 引入轻量 **manifest**（代码内常量或 JSON，随实现定稿）：字段包含 `platform`、`scriptDir`、`saveSessionEntry`、`composeEntry`、支持 `contentKinds`（text/image/video）、`supportsHeadless`（bool）、`minPlaywrightVersion`（可选）。新增平台 = 新目录 + manifest 注册 +（可选）`app/api/platforms/<slug>/playwright-*` 薄路由复用泛型 handler。

**Rationale**: 对标 sau 的 `uploader/` 分平台目录；避免每个平台复制一套 HTTP 样板逻辑。

**Alternatives considered**:

- 每平台独立微服务：超出当前单体范围。

---

## 13. 任务模型与 UX

**Decision**: 绑定与发布均采用 **异步**：POST 启动子进程 → 客户端轮询 GET 状态（与现有 `playwright-bind` 一致）；可选后续增加 `BrowserUploadJob` 表持久化 `status` / `lastError` / `finishedAt` 以支持多 Tab 与审计。

**Rationale**: 浏览器冷启动与页面加载耗时不稳定，同步 HTTP 易超时。

**Alternatives considered**:

- SSE/WebSocket：可增强，非 MVP。

---

## 14. 安全与隐私

**Decision**: 会话文件视为 **高敏感凭据**；路径按 `userId` 隔离；文件权限遵循操作系统最小权限；**禁止**在 API 响应或日志中返回完整 cookie；文档说明备份与删除策略。加密-at-rest（可选）作为实现任务单独立项。

**Rationale**: 会话等效于登录用户，泄露等同账号接管风险。

**Alternatives considered**:

- 存 DB BLOB：可行，与文件方案二选一，由实现阶段权衡运维与备份。

---

## 15. 参考仓库对照（social-auto-upload）

**Decision**: 借鉴其 **CLI 化、多账号会话文件、按平台分 uploader、向无头推进** 的产品方向；**不**依赖其 Python 技术栈，以免分裂运行时。

**Rationale**: 仓库 README 明确 **不包含微博**；可学结构与运维叙事，不可复制具体逆向代码。

**Alternatives considered**:

- 内嵌 sau 子进程：双运行时与依赖管理成本过高。

---

## 16. 产品主路径：避开开放平台接入认证（2026-04-03）

**Decision**: SocialWiz **默认不要求**用户完成各平台 **开放平台应用注册、OAuth 授权页、App Key/Secret 配置**；用户仅在站内完成 **连接账号**（网页会话采集）与 **发布**。后台通过 **非官方发布引擎** 落地；开放平台相关能力仅作 **兼容或运维开关**，不在主 UI 引导。

**Rationale**: 用户明确诉求：后续大量接入无官方 API；体验上「本平台一点发布 = 目标平台可见」，与开发者式接入流程解耦。

**实现要点**:

- **统一发布 API**：入队异步任务，引擎选插件；前端只展示任务状态与结果文案。
- **会话刷新**：登录态过期时引导用户重新走 **会话采集**（仍非开放平台认证）。
- **生产拓扑**：须规划 worker、会话存储与队列；同机子进程仅为开发/单机方案。
- **风险披露**：非官方路径受页面改版、风控、条款影响，需在运维/文档中显性说明。

**Alternatives considered**:

- **坚持 OAuth 为主**：与当前产品目标不一致。
- **仅 HTTP 逆向、无浏览器兜底**：全平台统一过脆；采用插件级可选 transport（§9）。
