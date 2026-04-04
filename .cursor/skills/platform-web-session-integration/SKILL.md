---
name: platform-web-session-integration
description: Guides integrating social or content platforms via browser session reuse and reverse-engineered web APIs when official APIs are missing or insufficient. Covers Playwright binding, Cookie/XSRF, HAR-aligned publish flows, insights extraction, PlatformPublishConfig (types, Zod, UI, publish-config API, publishConfigId wiring), and avoiding wrong capability downgrades. Use when adding a new platform, platform-specific publish settings, or debugging session-based publish.
---

# 平台接入：浏览器会话 + 逆向网页接口

在无官方 API、或开放平台能力与**站内真实产品**不一致时，用「用户登录态 + 复现浏览器请求」接发布、阅读数等能力。本 skill 将微博迭代中的做法抽象为可迁移流程。

## 适用边界

- **走这条路径**：PC/H5 编辑器、创作者中心、独立域名编辑器；响应依赖 Cookie、`st` / `X-Xsrf-Token`、站内 JSON 接口。
- **不走这条路径**：已有稳定 OAuth/REST 且能力与需求一致（单独模块，勿与会话逆向混在同一入口）。
- **形态先分清**：例如信息流发帖与「长文章 / 专栏」常为**不同域名、不同接口**；不可把 A 类产品降级成 B 类接口（会导致草稿/链接/数据体系错误）。

## 1. 绑定账号（会话落盘）

1. **用真实浏览器链路的登录态**：Playwright 登录后导出 `storageState`（或等价 Cookie 存储），服务端请求时拼 `Cookie` 头。
2. **域名与 Cookie**：
   - 主站、CDN、API 子域可能**各有一套 Cookie**；抓包确认请求实际发往的 host，并在代码里对 `https://主业务域/`、`https://api 域/` 分别拼 `cookieHeaderForUrl` 同类逻辑。
   - `.com` / `.cn` / 备用域名并存时，尽量**兼容多端**（同一用户可能_cookie 只在一端完整）。
3. **Profile / uid**：从页面或接口解析出的 **uid、昵称** 写入本地 profile，供构造接口 query（`uid=…`）与最终链接拼接。
4. **复核**：用已存 Cookie 请求一个**轻量、需登录**的接口（如首页 HTML、`/passport` 相关校验），避免「以为绑上了其实已失效」。

## 2. 逆向接口：通用步骤

1. **产品路径走一遍**：在**正式编辑器**完成「新建 → 填内容 → 保存草稿 → 发布」；必要时分开测「仅图文」「仅文章」。
2. **DevTools 抓包**：
   - 记录 **Method、URL（含 query）、Request Headers（Referer、Origin、X-Requested-With、X-Xsrf-Token）**。
   - **Payload**：区分 `application/x-www-form-urlencoded`（扁平 `a=1&b[x]=2`）与 `application/json`；很多国内站编辑器用**扁平表单**，与 `{ data: JSON.stringify(...) }` 互换并**不等价**。
3. **流水线拆分**：
   - 常见：`create 草稿` → `load` → `save` → `publish`，或为「单接口 saveorupdate」。  
   - **publish 不一定等于 save + 某一字段**；可能为**另一套表单**（例如「同步到动态」的 `text`、`rank`、`follow_to_read` 等），须以抓包为准。
4. **对齐实现**：
   - Query 里的 `_rid`、时间戳、随机串与线上一致（长度与字符集按需照抄）。
   - `load` 失败（如未带 Cookie 报 `100001`）时：区分「真失败」与「**浏览器外复制 URL 无 Cookie**」；实现上可用重试、POST 带 `st`、或受控的**最小草稿壳**（字段与线上一致）再 `save`。
5. **最小闭环再扩展**：先跑通一条成功路径，再删探索期多余分支，保留与业务相关的**一层**回退（如旧版路径）即可。

## 3. 发布类能力

| 目标 | 注意点 |
|------|--------|
| **图文 / 短内容** | 常为信息流接口；图床与正文分离时先上传得好 `pid`/`media_id`，再与正文一起提交。 |
| **长文 / 文章** | 常为独立编辑器；正文多为 **HTML**（Markdown 需先转 HTML）；`save` 与 `publish` **分开抓包**。 |
| **链接与 ID** | 成功响应里可能有 `mid`、`object_id`、`article_id`、详情 URL；需区分「时间线帖子 id」与「文章 object id」，统一封装 `publishedUrl` / `platformPostId`。 |

## 4. 阅读量 / 互动等「insights」

1. **优先找与站内页一致的接口**（个人时间线、数据中心、创作者后台）；常有**多个候选**，需 **Cookie + Referer** 与 PC 端一致。
2. **解析**：`code` / `retcode` / `ok` 等成功判断因站而异；失败时看 `msg` 是否是**业务限制**（如发文额度），便于向上抛出可读错误。
3. **兜底**：若 JSON 结构不稳定，可受控使用正则从 HTML/JSON 字符串中提取链接与长数字 id（仅作最后手段，并限制截断长度防日志爆炸）。

## 5. 安全与维护

- **密钥与 Cookie**：不落日志明文；错误 `detail` 截断展示。
- **接口漂移**：网页改版即变；关键链路的**抓包说明**可写在模块顶注释或 `ARTICLE_VS_FEED` 类文档里，标明「无官方文档、以抓包为准」。
- **测试**：本地媒体 URL 需可被服务端拉取（如配置 `INTERNAL_MEDIA_BASE_URL`）；与用户最终线上域名一致时再验证一遍。

## 6. 平台发布配置（新平台必接）

站内用 **`PlatformPublishConfig`**（多模板、按账号可选）承载「发到该平台时除了要带的正文/图以外，还需哪些**稳定参数**」。发布接口通过 **`publishConfigId`** 选中一条配置，服务端再读出 `configData` 交给插件或适配器。

**与作品内容的分工**

- **放在作品 / 统一发布请求里**：标题、正文、封面、多图、内容类型等（用户编辑一次，全平台共用）。
- **放在平台配置模板里**：可见范围、内容声明、同步文案模版、专栏名、POI 等与**接口字段一一对应**、且用户希望**多套预设**的项。
- **不要**把「单次发布才确定的资产」塞进平台配置（例如头条封面应以作品封面/组图为准，而不是微博配置里再上传一张）。

**接入 checklist（按仓库现行模式）**

| 步骤 | 做什么 | 本仓库参考 |
|------|--------|------------|
| 1 | 在 `types/platform-config.types.ts` 为该平台增加 `XxxPublishConfigData`（含 `type: 'xxx'` 字面量），并并入 `PlatformConfigData` 联合 | 见 `WeiboPublishConfigData` / `WechatPublishConfigData` |
| 2 | 在 `lib/validators/platform-config.validator.ts` 增加 `XxxConfigDataSchema`，并加入 `PlatformConfigDataSchema` 的 `discriminatedUnion('type', [...])`；`validateConfigData` 里 `typeMap` 与 `Platform` 枚举对齐 | 与 `CreateConfigInputSchema` 一致 |
| 3 | 新增或扩展 `components/dashboard/platform-config-fields/XxxConfigFields.tsx`，用 `react-hook-form` 编辑 `configData` | `WeiboConfigFields.tsx`、`WechatConfigFields.tsx` |
| 4 | 在 `PlatformConfigDialog.tsx` 里：该平台分支使用新 Fields、`resetForm`/`defaultValues` 提供完整默认 `configData` | 对齐 `Platform.WEIBO` / `WECHAT` 分支 |
| 5 | 在 `app/(dashboard)/platforms/page.tsx` 把该平台加入 **`platformsWithConfigUi`**（否则点「配置」只会 toast「开发中」） | 当前为 `[WECHAT, WEIBO]` |
| 6 | 发布链路：`PublishService`（或等价入口）在存在 `publishConfigId` 时 `PlatformConfigService.getConfigById`，校验 `platform` 与账号一致后，将 **`configData` 传入插件 extras**（微博已走 `weiboPublishConfig` → `pickWeiboHeadlinePublish` 等） | `lib/services/publish.service.ts`、`lib/platforms/publish-plugins/types.ts` |
| 7 | API 通常**无需**为新平台单独加 CRUD：`GET/POST/PUT/DELETE /api/platforms/publish-configs` 已按 `platform` + 校验器工作 | `lib/services/platform-config.service.ts` |

**字段映射约定**：每加一个配置项，在逆向发博模块里写明对应抓包字段名（如「→ `mblog_statement`」「→ `follow_to_read`」），避免 UI 与 HTTP 体脱节。

**账号绑定上限（本仓库现行产品策略）**：**每个平台仅允许用户绑定一个账号**（多账号换绑须先解绑）。后端需拦截第二条（如微博 OAuth 与浏览器会话二选一、微信配置表仅一条）；账号管理页对已满平台禁用「添加账号」中的对应行。

## 7. 本仓库参考映射（微博）

| 主题 | 主要代码 |
|------|----------|
| 绑定 / 存储 Cookie、发业务 API | `playwright-bind` 路由、`weibo-storage-cookies.ts`、`session-files` |
| 头条文章 v5 | `weibo-headline-article-publish.ts`（`draft/create` → `load` → 扁平 `save` → `publish` 同步表单） |
| 信息流图文 | `weibo-web-publish.ts`、`weibo-web-pic-upload.ts` |
| XSRF | `weibo-xsrf.ts` |
| 阅读量 / 规范化链接 | `weibo-status-cookie.ts`、`weibo-profile-status-url.ts` |
| 产品形态说明 | `lib/weibo-playwright/ARTICLE_VS_FEED.md` |
| 平台配置类型 / 校验 / 弹窗 | `types/platform-config.types.ts`、`lib/validators/platform-config.validator.ts`、`PlatformConfigDialog.tsx`、`platform-config-fields/` |

新平台建议新建独立目录（如 `lib/foo-playwright/`），**不要**与现有平台的条件分支搅在同一巨型函数里。

## 8. 交付前自检清单

- [ ] 绑定后 Cookie 覆盖**实际请求域**  
- [ ] 图文与文章是否**走错接口**（是否错误降级）  
- [ ] `save` / `publish` 是否与抓包 **Content-Type 与字段** 一致  
- [ ] 成功后的 **URL / postId** 是否可被下游统计与展示使用  
- [ ] 失败信息是否区分 **登录失效 / 业务拒绝 / 参数错误**  
- [ ] **平台配置**：类型 + Zod + 弹窗 + `platformsWithConfigUi` + `publishConfigId` → 插件 **全链路贯通**  
- [ ] 配置项是否错误放入「单次发布的作品资源」（应用 **§6 分工**）  

---

详细背景与子案例可后续拆到 `reference.md`；平常实现只读本 SKILL 即可。
