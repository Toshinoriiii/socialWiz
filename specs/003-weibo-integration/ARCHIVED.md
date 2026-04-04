# 003-weibo-integration — 归档标记

- **归档日期**: 2026-04-04  
- **说明**: 本目录为微博接入功能的**历史规格与任务记录**。实现与契约的**现行标准**见 **`specs/main/`**（特别是 `quickstart.md`、`spec.md`、`contracts/browser-uploader-api.yaml`、`contracts/weibo-api.yaml`）。
- **与初版规格的主要演进**（不在此重复全文，仅列差异要点）:
  - 除 **OAuth + 开放平台 API** 外，新增 **浏览器会话**连接（`playwright-bind` + 会话文件落盘）。
  - 会话型账号发博走 **`lib/weibo-playwright/compose-runner.ts`**（站内 **HTTP 复现**，非独立 `playwright-compose` API）。
  - 产品侧统一发布：**`POST /api/platforms/publish`**；作品发布与 **`PublishJob` / `ContentPlatform`** 行为以 `specs/main` 为准。
  - 原 **`/test-weibo` 调试页已删除**；OAuth 与绑定自测在 **`/accounts`** 等页面完成。
- **`STATUS.md`**: 已按上述标准做过修订，仍可能保留阶段性措辞；冲突时以 **`specs/main`** 为准。
