# socialwiz Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-03

## Active Technologies
- PostgreSQL（Prisma）；Redis（OAuth `state`，与现网 `lib/utils/oauth-state.ts` 一致） (main)
- TypeScript 5.9+、Node.js（与 Next.js 一致） + Next.js 14+ App Router、Prisma、Playwright（Chromium）、Zod (main)
- PostgreSQL（`PlatformAccount`、可选未来 `BrowserUploadJob`）、本机文件系统（按 `userId` 隔离的会话 JSON，路径约定见 [data-model.md](./data-model.md)） (main)

- TypeScript 5.9+ + Next.js 14+（App Router）、Prisma、React、Zod（校验） (main)

## Project Structure

```text
lib/platforms/weibo/     # 微博适配器
lib/services/            # 业务逻辑
app/api/platforms/weibo/ # 微博 API 路由
config/platform.config.ts
types/platform.types.ts
prisma/schema.prisma
```

## Commands

npm test; npm run lint

## Code Style

TypeScript 5.9+: Follow standard conventions

## Recent Changes
- main: Added TypeScript 5.9+、Node.js（与 Next.js 一致） + Next.js 14+ App Router、Prisma、Playwright（Chromium）、Zod
- main: Added TypeScript 5.9+ + Next.js 14+（App Router）、Prisma、React、Zod

- main: Added TypeScript 5.9+ + Next.js 14+（App Router）、Prisma、React、Zod（校验）

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
