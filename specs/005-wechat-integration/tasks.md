# Tasks: 微信公众号平台接入

**Feature Branch**: `005-wechat-integration`  
**Input**: Design documents from `/specs/005-wechat-integration/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/wechat-api.yaml ✅, quickstart.md ✅

**Generated**: 2026-01-17  
**Total Estimated Time**: 11-16 工作日

---

## Task Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖关系）
- **[Story]**: 任务所属用户故事（US1, US2, US3, US4, US5）
- 所有任务包含精确的文件路径

---

## Phase 1: Setup (项目初始化)

**目的**: 项目初始化和基础结构搭建

- [X] T001 [P] 更新Prisma Schema，添加WechatAccountConfig模型 in `prisma/schema.prisma`
- [X] T002 [P] 更新ContentPlatform模型，添加wechatConfigId外键 in `prisma/schema.prisma`
- [X] T003 执行数据库迁移，应用Schema变更（运行 `pnpm db:generate` 和 `pnpm db:push`）
- [X] T004 [P] 创建微信类型定义文件 in `types/wechat.types.ts`
- [X] T005 [P] 创建加密工具模块 in `lib/utils/encryption.ts`
- [X] T006 [P] 创建分布式锁工具模块 in `lib/utils/distributed-lock.ts`
- [X] T007 验证环境变量配置，确保ENCRYPTION_KEY已设置

**预计时间**: 1-2天

---

## Phase 2: Foundational (阻塞性基础设施)

**目的**: 核心基础设施，必须完成后才能开始任何用户故事

**⚠️ 关键**: 所有用户故事的实施都必须等待此阶段完成

- [X] T008 实现加密/解密函数（AES-256-GCM） in `lib/utils/encryption.ts`
- [X] T009 实现分布式锁（Redis SETNX + TTL） in `lib/utils/distributed-lock.ts`
- [X] T010 [P] 创建微信平台类型接口和枚举 in `lib/platforms/wechat/wechat-types.ts`
- [X] T011 [P] 创建微信API客户端基础类 in `lib/platforms/wechat/wechat-client.ts`
- [X] T012 [P] 创建微信工具函数（内容验证等） in `lib/platforms/wechat/wechat-utils.ts`
- [X] T013 实现微信API错误码映射和友好提示 in `lib/platforms/wechat/wechat-utils.ts`
- [ ] T014 配置测试环境（Jest配置，Mock Redis和Prisma）

**预计时间**: 2-3天

**检查点**: 基础设施就绪 - 用户故事实施可以并行开始

---

## Phase 3: User Story 1 - 微信公众号手动配置 (Priority: P1) 🎯 MVP

**目标**: 用户可以手动输入AppID和Secret，系统验证配置并保存到数据库

**独立测试**: 用户在配置表单输入AppID/Secret，系统调用微信API验证，保存配置并显示成功状态

### 实现任务

- [X] T015 [P] [US1] 创建WechatConfigService服务类基础结构 in `lib/services/wechat-config.service.ts`
- [X] T016 [US1] 实现createConfig方法（验证、加密、保存） in `lib/services/wechat-config.service.ts`
- [X] T017 [US1] 实现getConfigsByUserId方法（查询用户所有配置） in `lib/services/wechat-config.service.ts`
- [X] T018 [US1] 实现getConfigById方法（查询单个配置） in `lib/services/wechat-config.service.ts`
- [X] T019 [US1] 实现updateConfig方法（更新配置） in `lib/services/wechat-config.service.ts`
- [X] T020 [US1] 实现deleteConfig方法（删除配置并清除Redis缓存） in `lib/services/wechat-config.service.ts`
- [X] T021 [P] [US1] 创建POST /api/wechat/config路由（创建配置） in `app/api/wechat/config/route.ts`
- [X] T022 [P] [US1] 创建GET /api/wechat/config路由（获取配置列表） in `app/api/wechat/config/route.ts`
- [X] T023 [P] [US1] 创建GET /api/wechat/config/[configId]/route.ts（获取单个配置） in `app/api/wechat/config/[configId]/route.ts`
- [X] T024 [P] [US1] 创建PUT /api/wechat/config/[configId]/route.ts（更新配置） in `app/api/wechat/config/[configId]/route.ts`
- [X] T025 [P] [US1] 创建DELETE /api/wechat/config/[configId]/route.ts（删除配置） in `app/api/wechat/config/[configId]/route.ts`
- [X] T026 [US1] 实现API路由的权限控制（确保用户只能访问自己的配置）
- [X] T027 [US1] 实现配置验证时的微信API调用（/cgi-bin/token） in `lib/services/wechat-config.service.ts`
- [X] T028 [US1] 实现错误处理和友好提示（40001、40164等错误码） in `app/api/wechat/config/route.ts`

**预计时间**: 2-3天

**检查点**: 用户故事1应完全功能化，可独立测试（通过API或测试页面）

---

## Phase 4: User Story 2 - 公众号配置指引 (Priority: P1)

**目标**: 提供详细的配置指引，帮助用户完成微信公众号后台配置

**独立测试**: 用户查看配置指引，按步骤完成IP白名单和安全域名配置

### 实现任务

- [X] T029 [P] [US2] 创建配置指引React组件 in `components/dashboard/platforms/WechatConfigGuide.tsx`
- [X] T030 [P] [US2] 创建配置指引CSS模块 in `components/dashboard/platforms/WechatConfigGuide.module.css`
- [X] T031 [US2] 实现获取服务器公网IP的API端点（内部使用） in `app/api/wechat/server-info/route.ts`
- [X] T032 [US2] 实现配置指引内容（AppID获取、IP白名单、安全域名、主体类型） in `components/dashboard/platforms/WechatConfigGuide.tsx`
- [X] T033 [US2] 实现个人主体警告提示（检测到个人主体时显示） in `components/dashboard/platforms/WechatConfigGuide.tsx`
- [X] T034 [US2] 集成配置指引到配置表单页面 in `app/(dashboard)/test-wechat/page.tsx`

**预计时间**: 1-2天

**检查点**: 用户可以查看完整的配置指引，IP白名单错误时显示帮助信息

---

## Phase 5: User Story 5 - Access Token自动管理机制 (Priority: P2)

**目标**: 系统在后端自动管理access_token生命周期，前端透明使用

**独立测试**: 系统自动获取、缓存、刷新token，API调用前自动注入，前端无感知

### 实现任务

- [X] T035 [P] [US5] 创建WechatTokenService服务类基础结构 in `lib/services/wechat-token.service.ts`
- [X] T036 [US5] 实现getOrRefreshToken方法（获取或刷新token） in `lib/services/wechat-token.service.ts`
- [X] T037 [US5] 实现fetchAccessToken方法（调用微信/cgi-bin/token接口） in `lib/services/wechat-token.service.ts`
- [X] T038 [US5] 实现cacheToken方法（存储到Redis，TTL 7000秒） in `lib/services/wechat-token.service.ts`
- [X] T039 [US5] 实现getCachedToken方法（今Redis读取） in `lib/services/wechat-token.service.ts`
- [X] T040 [US5] 实现shouldRefreshToken方法（检查剩余有效期<300秒） in `lib/services/wechat-token.service.ts`
- [X] T041 [US5] 实现分布式锁逻辑，防止并发token获取 in `lib/services/wechat-token.service.ts`
- [X] T042 [US5] 实现deleteToken方法（删除配置时清除Redis缓存） in `lib/services/wechat-token.service.ts`
- [X] T043 [P] [US5] 创建微信API中间件（透明代理模式） in `lib/middleware/wechat-token-middleware.ts`
- [X] T044 [US5] 实现中间件的token自动注入逻辑 in `lib/middleware/wechat-token-middleware.ts`
- [X] T045 [US5] 实现中间件的错误处理（token失效时自动重试） in `lib/middleware/wechat-token-middleware.ts`
- [X] T046 [US5] 集成中间件到微信API客户端 in `lib/platforms/wechat/wechat-client.ts`

**预计时间**: 3-4天

**检查点**: Token自动管理工作正常，Redis中可见缓存，API调用无需手动传token

**测试功能**: ✅ 已在 `app/(dashboard)/test-wechat/page.tsx` 中添加Token测试功能
- 添加"测试获取Access Token"按钮
- 显示Token信息（token、过期时间、剩余时间）
- 创建GET /api/wechat/token/[configId]测试路由

---

## Phase 6: User Story 3 - 发布内容到微信公众号 (Priority: P1)

**目标**: 用户可以将内容发布到微信公众号，系统自动处理token和API调用

**独立测试**: 用户选择微信公众号并发布内容，系统使用自动管理的token调用发布API，成功或失败时显示结果

### 实现任务

- [X] T047 [P] [US3] 创庺WechatPublishService服务类基础结构 in `lib/services/wechat-publish.service.ts`
- [X] T048 [US3] 实现publishContent方法（发布草稿） in `lib/services/wechat-publish.service.ts`
- [X] T049 [US3] 实现内容验证逻辑（标题长度、内容长度、thumb_media_id） in `lib/services/wechat-publish.service.ts`
- [X] T050 [US3] 实现个人主体公众号阻止发布逻辑 in `lib/services/wechat-publish.service.ts`
- [X] T051 [US3] 实现微信草稿创建API调用（/cgi-bin/draft/add） in `lib/services/wechat-publish.service.ts`
- [ ] T052 [US3] 实现发布结果保存到ContentPlatform表 in `lib/services/wechat-publish.service.ts`
- [X] T053 [P] [US3] 创建POST /api/wechat/publish路由 in `app/api/wechat/publish/route.ts`
- [X] T054 [US3] 实现发布API的错误处理（48001、87014等错误码） in `app/api/wechat/publish/route.ts`
- [X] T055 [US3] 实现重试机制（网络错误重试3次，指数退避） in `lib/services/wechat-publish.service.ts`
- [X] T056 [US3] 实现发布日志记录 in `lib/services/wechat-publish.service.ts`

**预计时间**: 2-3天

**检查点**: 用户可以成功发布内容到微信公众号，错误时显示友好提示

---

## Phase 7: User Story 4 - 测试页面验证功能 (Priority: P1)

**目标**: 开发团队可以在测试页面验证所有微信公众号功能

**独立测试**: 在测试页面完成配置、token获取、发布等功能的端到端测试

### 实现任务

- [ ] T057 [P] [US4] 创建测试页面路由 in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T058 [P] [US4] 创建测试页面CSS模块 in `app/(dashboard)/test-wechat/page.module.css`
- [ ] T059 [US4] 实现配置添加测试表单 in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T060 [US4] 实现配置列表显示（查询所有配置） in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T061 [US4] 实现配置删除按钮和确认对话框 in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T062 [US4] 实现内容发布测试表单（标题、内容、thumb_media_id） in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T063 [US4] 实现发布结果显示（成功/失败消息） in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T064 [US4] 实现错误场景测试（错误的AppID、IP白名单、个人主体） in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T065 [US4] 添加Redis缓存查看功能（显示当前token状态） in `app/(dashboard)/test-wechat/page.tsx`
- [ ] T066 [US4] 添加日志显示区域（显示API调用日志） in `app/(dashboard)/test-wechat/page.tsx`

**预计时间**: 2-3天

**检查点**: 测试页面可以完整验证所有功能，开发团队可以端到端测试

---

## Phase 8: 前端配置页面 (Priority: P2)

**目标**: 为用户提供生产级的微信公众号配置界面

**独立测试**: 用户在生产页面完成配置管理操作

### 实现任务

- [ ] T067 [P] 创建配置表单组件 in `components/dashboard/platforms/WechatConfigForm.tsx`
- [ ] T068 [P] 创建配置表单CSS模块 in `components/dashboard/platforms/WechatConfigForm.module.css`
- [ ] T069 [P] 创建配置列表组件 in `components/dashboard/platforms/WechatConfigList.tsx`
- [ ] T070 [P] 创建配置列表CSS模块 in `components/dashboard/platforms/WechatConfigList.module.css`
- [ ] T071 实现配置表单验证（Zod schema） in `components/dashboard/platforms/WechatConfigForm.tsx`
- [ ] T072 实现配置表单提交逻辑（React Hook Form） in `components/dashboard/platforms/WechatConfigForm.tsx`
- [ ] T073 实现配置列表展示（AppID部分隐藏） in `components/dashboard/platforms/WechatConfigList.tsx`
- [ ] T074 实现配置编辑和删除按钮 in `components/dashboard/platforms/WechatConfigList.tsx`
- [ ] T075 实现配置状态显示（激活/未激活、企业/个人主体） in `components/dashboard/platforms/WechatConfigList.tsx`
- [ ] T076 [P] 创建配置管理主页面 in `app/(dashboard)/settings/platforms/wechat/page.tsx`
- [ ] T077 [P] 创建单个配置详情页面 in `app/(dashboard)/settings/platforms/wechat/[configId]/page.tsx`
- [ ] T078 实现删除确认对话框组件 in `components/dashboard/platforms/WechatConfigList.tsx`
- [ ] T079 集成配置指引组件到配置页面 in `app/(dashboard)/settings/platforms/wechat/page.tsx`

**预计时间**: 2-3天

**检查点**: 用户可以在生产页面完整管理微信公众号配置

---

## Phase 9: Polish & Cross-Cutting Concerns

**目的**: 跨用户故事的改进和优化

- [ ] T080 [P] 编写WechatConfigService单元测试 in `tests/unit/wechat-config.service.test.ts`
- [ ] T081 [P] 编写WechatTokenService单元测试 in `tests/unit/wechat-token.service.test.ts`
- [ ] T082 [P] 编写WechatPublishService单元测试 in `tests/unit/wechat-publish.service.test.ts`
- [ ] T083 [P] 编写配置API集成测试 in `tests/integration/wechat-config-api.test.ts`
- [ ] T084 [P] 编写发布API集成测试 in `tests/integration/wechat-publish-api.test.ts`
- [ ] T085 [P] 编写加密工具单元测试 in `tests/unit/encryption.test.ts`
- [ ] T086 [P] 编写分布式锁单元测试 in `tests/unit/distributed-lock.test.ts`
- [ ] T087 代码审查和重构（消除重复代码）
- [ ] T088 性能优化（确保API响应时间<500ms p95）
- [ ] T089 安全审查（AppSecret加密、权限控制）
- [ ] T090 日志系统优化（结构化日志、错误监控）
- [ ] T091 验证quickstart.md的所有步骤
- [ ] T092 更新README.md，添加微信公众号接入说明
- [ ] T093 生成API文档（基于OpenAPI规范）
- [ ] T094 端到端测试（完整用户流程）

**预计时间**: 2-3天

---

## Dependencies & Execution Order

### Phase依赖关系

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← 阻塞所有用户故事
    ↓
┌───────────┬───────────┬───────────┬───────────┐
│   US1     │   US2     │   US5     │   US3     │
│  配置管理  │  配置指引  │ Token管理 │   发布    │
│  (P1)     │  (P1)     │   (P2)    │  (P1)     │
└─────┬─────┴───────────┴─────┬─────┴─────┬─────┘
      │                       │           │
      └───────────────────────┴───────────┘
                    ↓
              Phase 7 (US4)
              测试页面 (P1)
                    ↓
              Phase 8
              前端页面 (P2)
                    ↓
              Phase 9
              Polish
```

### 用户故事依赖关系

- **US1 (配置管理)**: Phase 2完成后可开始 - 无其他故事依赖
- **US2 (配置指引)**: Phase 2完成后可开始 - 无其他故事依赖（可与US1并行）
- **US5 (Token管理)**: Phase 2完成后可开始 - 无其他故事依赖（可与US1、US2并行）
- **US3 (内容发布)**: 需要US1（配置）和US5（Token管理）完成
- **US4 (测试页面)**: 建议所有核心功能（US1、US2、US5、US3）完成后再实施

### 故事内任务依赖

- **US1**: T015→T016-T020（服务层先于API路由）→T021-T025（API路由可并行）→T026-T028
- **US2**: T029-T030可并行 → T031 → T032-T033 → T034
- **US5**: T035→T036-T042（TokenService方法顺序实现）→T043→T044-T045→T046
- **US3**: T047→T048-T050 → T051（微信客户端） → T052 → T053 → T054-T056
- **US4**: T057-T058可并行 → T059-T066（顺序实现测试功能）

### 并行执行机会

**Phase 1内并行**:
- T001、T002（Prisma Schema更新）可同时修改不同部分
- T004、T005、T006（类型、加密、锁）完全独立，可完全并行

**Phase 2内并行**:
- T010、T011、T012（微信类型、客户端、工具）可并行

**跨Phase并行**（Phase 2完成后）:
- US1、US2、US5可由3个开发者并行实施
- US1完成后，可同时进行US3（依赖US1和US5）

**Phase 8内并行**:
- T067-T070（前端组件）可并行开发

**Phase 9内并行**:
- T080-T086（所有测试）可完全并行执行

---

## Parallel Example: User Story 1

### 并行启动模型创建
```bash
# Phase 1并行任务
Task T001: "更新Prisma Schema，添加WechatAccountConfig模型"
Task T002: "更新ContentPlatform模型，添加wechatConfigId外键"
Task T004: "创建微信类型定义文件"
Task T005: "创建加密工具模块"
Task T006: "创建分布式锁工具模块"
```

### 并行启动API路由
```bash
# US1并行任务（T016-T020完成后）
Task T021: "创建POST /api/wechat/config路由"
Task T022: "创建GET /api/wechat/config路由"
Task T023: "创建GET /api/wechat/config/[configId]/route.ts"
Task T024: "创建PUT /api/wechat/config/[configId]/route.ts"
Task T025: "创建DELETE /api/wechat/config/[configId]/route.ts"
```

---

## Implementation Strategy

### MVP First (仅User Story 1 + 5 + 3)

**最小可行产品路径**:

1. ✅ **Phase 1**: Setup (1-2天)
2. ✅ **Phase 2**: Foundational (2-3天)
3. ✅ **Phase 3**: US1 - 配置管理 (2-3天)
4. ✅ **Phase 5**: US5 - Token管理 (3-4天)
5. ✅ **Phase 6**: US3 - 内容发布 (2-3天)
6. **STOP and VALIDATE**: 在测试页面端到端验证（/test-wechat）
7. **Deploy/Demo**: MVP可以演示和部署

**MVP总耗时**: 10-15工作日

### Incremental Delivery（增量交付）

1. **Foundation** (Setup + Foundational) → 3-5天 → 基础就绪
2. **+US1** (配置管理) → +2-3天 → 可管理公众号配置
3. **+US5** (Token管理) → +3-4天 → Token自动化
4. **+US3** (发布功能) → +2-3天 → 可发布内容（MVP! 🎯）
5. **+US2** (配置指引) → +1-2天 → 用户体验改进
6. **+US4** (测试页面) → +2-3天 → 开发调试工具
7. **+Phase 8** (生产页面) → +2-3天 → 生产级UI
8. **+Phase 9** (测试和优化) → +2-3天 → 质量保证

**完整功能总耗时**: 15-21工作日

### Parallel Team Strategy（多人并行策略）

**两人团队建议**:

1. **阶段1-2**（5天）: 两人协作完成Setup和Foundational
2. **阶段3**（并行）:
   - Developer A: US1（配置管理）+ US2（配置指引） - 3-5天
   - Developer B: US5（Token管理） - 3-4天
3. **阶段4**（并行）:
   - Developer A: US3（内容发布） - 2-3天
   - Developer B: US4（测试页面） - 2-3天
4. **阶段5**（并行）:
   - Developer A: Phase 8（前端页面） - 2-3天
   - Developer B: Phase 9（测试） - 2-3天

**并行总耗时**: 12-17工作日（比顺序执行节省3-4天）

---

## Testing Strategy

### 单元测试覆盖

- **WechatConfigService**: 配置CRUD、权限控制、加密逻辑
- **WechatTokenService**: Token获取、缓存、刷新、分布式锁
- **WechatPublishService**: 内容验证、发布逻辑、错误处理
- **EncryptionUtils**: 加密/解密算法
- **DistributedLock**: 锁获取/释放逻辑

### 集成测试覆盖

- **配置API**: POST/GET/PUT/DELETE /api/wechat/config
- **发布API**: POST /api/wechat/publish
- **微信API Mock**: 模拟微信token和发布接口
- **权限控制**: 用户只能访问自己的配置

### 端到端测试场景

1. 新用户添加微信公众号配置（成功场景）
2. IP白名单未配置（错误场景40164）
3. AppID/Secret错误（错误场景40001）
4. Token自动刷新（过期场景）
5. 并发请求Token（分布式锁测试）
6. 发布内容到微信公众号（成功场景）
7. 个人主体公众号发布（错误场景48001）
8. 删除配置并清除Redis缓存

---

## Success Metrics

完成所有任务后，验证以下指标：

- ✅ 配置验证成功率 > 95%（排除用户配置错误）
- ✅ Token自动刷新成功率 > 99%
- ✅ API响应时间 < 500ms (p95)
- ✅ 发布成功率 > 90%（排除企业主体限制）
- ✅ 错误提示覆盖所有常见错误码
- ✅ 测试覆盖率 > 80%（核心服务）
- ✅ Quickstart文档可执行通过
- ✅ 所有用户故事独立测试通过

---

## Notes

- **[P]标记**: 不同文件，无依赖关系，可并行执行
- **[Story]标记**: 任务归属用户故事，便于追踪
- **独立性**: 每个用户故事应该可独立完成和测试
- **增量交付**: 在任何检查点停止验证都不影响已完成功能
- **提交频率**: 每完成1-2个任务提交一次代码
- **避免**: 模糊任务描述、同文件冲突、破坏独立性的跨故事依赖

---

**任务分解完成！准备开始实施 🚀**
