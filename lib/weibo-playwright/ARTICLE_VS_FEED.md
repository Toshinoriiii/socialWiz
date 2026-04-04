# 微博：信息流发帖 vs「头条文章」

## 本仓库当前实现（浏览器会话 / 逆向网页）

| 形态 | 服务端行为 | 说明 |
|------|------------|------|
| 纯文案 / 长文 / 九图 | `picupload` 图床 + `weibo.com/aj/mblog/add` | 与 PC 端首页发博同属**信息流**，长文用 `is_longtext` 等参数；**不是**独立文章详情页产品。 |
| 本站 `contentType: article` | `card.weibo.com/article/v3/idea/ajax/saveorupdate`：Markdown→HTML 头条文章 | 见 `weibo-headline-article-publish.ts`；接口无官方文档，若失败需按当前微博前端抓包修正。 |

相对路径图片（如 `/content-images/...`）由 `INTERNAL_MEDIA_BASE_URL` / `NEXT_PUBLIC_BASE_URL` 补全后，由服务端拉取再上传图床。

## 开放平台 OAuth（另一套）

- `statuses/update`、`statuses/upload`、`statuses/upload_url_text` 等：面向移动/开放平台的 **博文**，同样归为信息流能力，**不提供**完整「头条文章」排版与独立 URL 体系。
- 需应用审核、access_token；与 Playwright 会话无共用代码路径。

## 「头条文章 / 专栏」类能力（调研结论）

- **产品侧**：微博创作者中心的「文章」多在 **独立域名/编辑器**（富文本或结构化 HTML），发帖流程与 `aj/mblog/add` **不是同一套前端与后端**。
- **接口侧**：无稳定公开文档；历史上存在 `card.weibo.com`、`creator.weibo.com` 等下的 `aj/...` 草稿、发布、素材接口，依赖登录 Cookie 与频繁变更的前端参数，**需自行抓包维护**。
- **与 Markdown**：头条侧通常吃 **HTML**，Markdown 需在发布前转为 HTML 并适配其编辑器 DOM 或对应保存接口字段。
- **建议**：若必须「真·头条文章」，单独开 `weibo-column-article` 模块：Playwright 仅登录鉴权、或固定抓包一层发布 API；**不要**与 `tryPublishWeiboTextViaWebAjax` 混用同一入口。

## 测试本地图文

- 微博测试页：本地上传 → 得到 `http(s)://当前站点/content-images/...` → 与正文一并 `POST .../weibo/[id]/publish`。
- 环境变量：`NEXT_PUBLIC_BASE_URL=http://localhost:3000`；若服务端无法用 localhost 回环，设 `INTERNAL_MEDIA_BASE_URL=http://127.0.0.1:3000`。
