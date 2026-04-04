# 规格归档说明

本目录用于说明 **历史功能包** 与 **现行标准** 的关系。

## 现行标准（维护时以这里为准）

| 内容 | 路径 |
|------|------|
| 产品级主规格与迭代 | `specs/main/`（`spec.md`、`plan.md`、`tasks.md`、`quickstart.md`、`research.md`、`data-model.md`） |
| 统一发布、PublishJob、浏览器会话契约 | `specs/main/contracts/`（`publish-job-api.yaml`、`browser-uploader-api.yaml`、`weibo-api.yaml` 等） |

## 历史功能包（已对齐后归档）

以下目录中的 `spec.md` / `STATUS.md` 等为 **阶段性记录**，文末或 `ARCHIVED.md` 标明归档时间；若与 `specs/main` 冲突，**以 `specs/main` 为准**。

- `specs/003-weibo-integration/` — OAuth 与微博接入起点规格；**现行**含浏览器会话绑定、统一 `POST /api/platforms/publish`、`compose-runner` HTTP 复现发博等，见 `specs/main`。
- `specs/004-page-refactor-shadcn/` — shadcn 重构范围；**现行**无独立「微博测试」调试页，侧栏以 `/accounts` 等为产品入口。

将旧包整体搬入 `specs/archive/` 下会破坏历史链接与工具链，故 **保留原路径**，通过本 README 与各包内 `ARCHIVED.md` 标明归档策略。
