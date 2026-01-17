# Implementation Plan: 微信公众号平台接入

**Branch**: `005-wechat-integration` | **Date**: 2026-01-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/005-wechat-integration/spec.md`

## Summary

实现微信公众号平台接入功能，采用用户维度配置架构。由于个人开发者限制，无法使用标准OAuth流程，用户需手动输入AppID和Secret。系统通过后端Token服务 + API中间件模式，实现透明代理的access_token管理，前端无需关心token状态。核心功能包括：公众号手动配置、Token自动管理、内容发布、错误处理和配置指引。

**技术方案**：
- 数据库存储用户级公众号配置（AppSecret加密存储）
- Redis缓存access_token（key: `wechat:token:{userId}:{configId}`，TTL: 7000秒）
- WechatTokenService服务类管理token生命周期
- API中间件透明注入token
- 分布式锁防止并发token刷新
- 提前300秒主动刷新token策略

## Technical Context

**Language/Version**: TypeScript 5.9+ (Next.js 14+ App Router)  
**Primary Dependencies**: 
- Framework: Next.js 14+ (App Router)
- ORM: Prisma (PostgreSQL)
- Cache: Redis 6+
- HTTP Client: Axios/Fetch API
- Validation: Zod
- Encryption: crypto (Node.js built-in) or bcryptjs

**Storage**: 
- PostgreSQL: WechatAccountConfig表（用户配置）
- Redis: Token缓存 + 分布式锁

**Testing**: Jest + React Testing Library (单元测试 + 集成测试)  
**Target Platform**: Web应用（Next.js服务端 + React客户端）  
**Project Type**: Web (Full-stack Next.js)  
**Performance Goals**: 
- Token获取/刷新 < 1秒
- API响应时间 < 500ms (p95)
- 支持并发请求（通过分布式锁）

**Constraints**: 
- 个人开发者限制：无法使用OAuth流程
- Token唯一性：重复获取会导致之前token失效
- Token有效期：7200秒（2小时）
- 提前刷新阈值：300秒（5分钟）
- IP白名单：用户必须在微信后台配置
- 企业主体限制：个人公众号无发布权限

**Scale/Scope**: 
- 支持多用户（每用户独立配置）
- 支持多账号（同一用户可配置多个公众号）
- 预计初期用户：< 100
- 预计公众号配置：< 500

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证以下 Constitution 原则的合规性：

- ✅ **Type-Safety First**: 所有代码使用TypeScript，定义完整类型（WechatAccountConfig, WechatTokenCache, WechatApiResponse等），避免any类型
- ✅ **Service Layer Architecture**: 业务逻辑在WechatTokenService和WechatPublishService中实现，API路由仅处理请求/响应
- ❌ **AI Model Abstraction**: 不涉及AI功能（N/A）
- ✅ **Platform Agnostic Design**: 遵循Platform接口契约，实现WechatPlatformAdapter，易于扩展其他平台
- ✅ **API-First Development**: 先定义API端点（/api/wechat/config、/api/wechat/publish），再实现前端组件
- ✅ **Testing Discipline**: 包含单元测试（TokenService、ConfigService）和集成测试（API端点、发布流程）

**Violations**: 无违反原则的情况

## Project Structure

### Documentation (this feature)

```text
specs/005-wechat-integration/
├── spec.md              # Feature specification (已存在)
├── plan.md              # This file (当前文件)
├── research.md          # Phase 0 output (待生成)
├── data-model.md        # Phase 1 output (已存在，需补充)
├── quickstart.md        # Phase 1 output (待生成)
├── contracts/           # Phase 1 output (待生成)
│   └── wechat-api.yaml  # 微信API契约定义
├── WECHAT_CONFIG_GUIDE.md  # 配置指引文档 (已存在)
└── tasks.md             # Phase 2 output (待 /speckit.tasks 生成)
```

### Source Code (repository root)

```text
# Next.js 全栈应用结构
app/
├── (dashboard)/
│   └── settings/
│       └── platforms/
│           └── wechat/
│               ├── page.tsx              # 微信公众号配置页面
│               └── [configId]/
│                   └── page.tsx          # 单个公众号详情页
├── api/
│   └── wechat/
│       ├── config/
│       │   ├── route.ts                  # GET/POST/DELETE 配置管理
│       │   └── [configId]/
│       │       └── route.ts              # GET/PUT/DELETE 单个配置
│       ├── token/
│       │   └── route.ts                  # Token管理接口（内部使用）
│       └── publish/
│           └── route.ts                  # POST 内容发布
└── test-wechat/
    └── page.tsx                          # 测试页面

components/
├── dashboard/
│   └── platforms/
│       ├── WechatConfigForm.tsx          # 配置表单组件
│       ├── WechatConfigList.tsx          # 配置列表组件
│       └── WechatConfigGuide.tsx         # 配置指引组件
└── ui/                                   # 通用UI组件

lib/
├── services/
│   ├── wechat-token.service.ts           # Token生命周期管理服务
│   ├── wechat-config.service.ts          # 配置管理服务
│   └── wechat-publish.service.ts         # 内容发布服务
├── platforms/
│   └── wechat/
│       ├── wechat-adapter.ts             # 微信平台适配器
│       ├── wechat-client.ts              # 微信API客户端
│       ├── wechat-types.ts               # 微信相关类型定义
│       └── wechat-utils.ts               # 工具函数
├── db/
│   ├── prisma.ts                         # Prisma客户端（已存在）
│   └── redis.ts                          # Redis客户端（已存在）
├── middleware/
│   └── wechat-token-middleware.ts        # Token注入中间件
└── utils/
    ├── encryption.ts                     # 加密/解密工具
    └── distributed-lock.ts               # 分布式锁实现

prisma/
└── schema.prisma                         # 添加WechatAccountConfig模型

types/
└── wechat.types.ts                       # 微信公众号类型定义

tests/
├── unit/
│   ├── wechat-token.service.test.ts      # Token服务单元测试
│   └── wechat-config.service.test.ts     # 配置服务单元测试
└── integration/
    ├── wechat-config-api.test.ts         # 配置API集成测试
    └── wechat-publish-api.test.ts        # 发布API集成测试
```

**Structure Decision**: 采用Next.js App Router结构，服务层（lib/services/）实现业务逻辑，API路由（app/api/）处理HTTP请求。微信平台相关代码集中在lib/platforms/wechat/目录，遵循平台适配器模式，易于扩展其他平台。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无需填写，所有Constitution原则均已遵循。

## Phase 0: Research & Technical Decisions

**Status**: ⏳ Pending

### Research Tasks

1. **Token管理最佳实践**
   - Redis缓存策略（TTL、键设计）
   - 分布式锁实现方案（Redlock算法 vs 简单SETNX）
   - Token提前刷新时机计算

2. **微信公众号API调研**
   - `/cgi-bin/token` 接口详细规范
   - `/cgi-bin/draft/add` 草稿创建接口（需要media_id）
   - 错误码完整列表和处理策略
   - IP白名单配置要求

3. **加密存储方案**
   - AppSecret加密算法选择（AES-256-GCM vs bcrypt）
   - 加密密钥管理（环境变量 vs KMS）
   - 解密性能考虑

4. **API中间件设计**
   - Next.js中间件 vs 自定义HOF
   - Token注入时机和错误处理
   - 请求日志和监控

5. **测试策略**
   - Mock微信API响应
   - 模拟token过期场景
   - 并发请求测试

**Output**: `research.md` - 记录所有技术决策和理由

## Phase 1: Design & Contracts

**Status**: ⏳ Pending

**Prerequisites**: Phase 0 research.md complete

### 1.1 Data Model Design

**Output**: `data-model.md`

更新现有的data-model.md，补充以下内容：

**核心实体**：
1. **WechatAccountConfig** (Prisma模型)
   - id, userId, appId, appSecret (加密), accountName, accountType, subjectType, canPublish
   - 验证规则：userId + appId唯一

2. **WechatAccessToken** (Redis缓存)
   - Key: `wechat:token:{userId}:{configId}`
   - Value: JSON {accessToken, expiresAt, appId, userId, configId, createdAt}
   - TTL: 7000秒

3. **WechatDistributedLock** (Redis锁)
   - Key: `wechat:lock:{userId}:{configId}`
   - Value: 锁持有者ID
   - TTL: 30秒

4. **ContentPlatform** (Prisma模型，需扩展)
   - 添加wechatConfigId字段（外键到WechatAccountConfig）

**状态转换**：
- 配置：未验证 → 验证中 → 已激活 / 验证失败
- Token：不存在 → 获取中 → 已缓存 → 即将过期 → 刷新中 → 已缓存
- 发布：待发布 → 发布中 → 发布成功 / 发布失败

### 1.2 API Contracts

**Output**: `contracts/wechat-api.yaml`

OpenAPI 3.0规范，定义以下端点：

**配置管理API**：
- `POST /api/wechat/config` - 创建公众号配置
- `GET /api/wechat/config` - 获取用户的所有配置
- `GET /api/wechat/config/{configId}` - 获取单个配置
- `PUT /api/wechat/config/{configId}` - 更新配置
- `DELETE /api/wechat/config/{configId}` - 删除配置

**内容发布API**：
- `POST /api/wechat/publish` - 发布内容到微信公众号

**错误响应**：
- 400: 参数错误
- 401: 未认证
- 403: 无权访问（非自己的配置）
- 404: 配置不存在
- 500: 服务器错误
- 502: 微信API调用失败

### 1.3 Quickstart Guide

**Output**: `quickstart.md`

开发快速启动指南，包含：
1. 环境准备（PostgreSQL、Redis、微信测试账号）
2. 数据库迁移（`pnpm db:push`）
3. 环境变量配置（ENCRYPTION_KEY）
4. 启动开发服务器（`pnpm dev`）
5. 访问测试页面（/test-wechat）
6. 配置微信公众号
7. 测试发布功能

### 1.4 Agent Context Update

**Action**: Run `.specify/scripts/powershell/update-agent-context.ps1 -AgentType claude`

更新AI agent的上下文文件，添加本次计划中的新技术决策：
- 微信公众号API规范
- Token管理策略
- 加密方案
- 中间件设计

## Phase 2: Task Breakdown

**Status**: ⏸️ Not Started (requires `/speckit.tasks` command)

**Note**: Phase 2 is executed by the `/speckit.tasks` command, NOT by `/speckit.plan`. The task breakdown will be generated after Phase 1 design is complete and approved.

## Implementation Order

建议的实施顺序（Phase 2 tasks.md生成后执行）：

### Sprint 1: 基础设施（2-3天）
1. 数据库Schema更新（WechatAccountConfig模型）
2. 加密/解密工具实现
3. Redis Token缓存实现
4. 分布式锁实现

### Sprint 2: 配置管理（2-3天）
1. WechatConfigService服务类
2. 配置管理API端点（CRUD）
3. 配置表单前端组件
4. 配置验证（调用微信API）

### Sprint 3: Token管理（3-4天）
1. WechatTokenService服务类
2. Token获取/刷新逻辑
3. 提前刷新策略实现
4. API中间件（透明代理）
5. 并发控制（分布式锁）

### Sprint 4: 内容发布（2-3天）
1. WechatPublishService服务类
2. 发布API端点
3. 内容验证逻辑
4. 错误处理和重试

### Sprint 5: 测试与文档（2-3天）
1. 单元测试（Services）
2. 集成测试（API endpoints）
3. 测试页面实现
4. 配置指引文档优化
5. Quickstart文档验证

**总计**: 11-16个工作日

## Risk Assessment

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Token频繁失效 | 高 | 分布式锁 + Redis缓存 + 提前刷新策略 |
| IP白名单配置错误 | 高 | 明确的错误提示 + 详细配置指引 |
| AppSecret泄露 | 高 | 加密存储 + 访问权限控制 |
| 微信API限流 | 中 | 重试机制 + 指数退避 + 错误日志 |
| 并发竞争导致token失效 | 中 | 分布式锁确保同一时间只有一个请求获取token |
| 用户误删配置 | 低 | 删除确认对话框 + 级联清理Redis缓存 |

## Success Metrics

- ✅ 配置验证成功率 > 95%
- ✅ Token自动刷新成功率 > 99%
- ✅ API响应时间 < 500ms (p95)
- ✅ 发布成功率 > 90%（排除企业主体限制）
- ✅ 错误提示友好度：用户能根据提示解决问题
- ✅ 测试覆盖率 > 80%（核心服务）

## Next Steps

1. ✅ 运行 `/speckit.plan` - 生成本计划文档 (DONE)
2. ⏳ 完成 Phase 0 - 生成 research.md
3. ⏳ 完成 Phase 1 - 生成 data-model.md, contracts/, quickstart.md
4. ⏸️ 运行 `/speckit.tasks` - 生成详细任务分解
5. ⏸️ 开始实施 - 按Sprint顺序执行任务

---

**Plan Status**: ✅ Complete  
**Generated**: 2026-01-17  
**Ready for**: Phase 0 Research
