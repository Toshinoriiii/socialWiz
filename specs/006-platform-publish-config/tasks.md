# Tasks: 平台发布配置管理

**Feature**: 006-platform-publish-config  
**Input**: Design documents from `/specs/006-platform-publish-config/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml, quickstart.md

**Tests**: 本功能不包含测试任务(spec未明确要求TDD)

**Organization**: 任务按用户故事分组,支持独立实现和测试

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行(不同文件,无依赖)
- **[Story]**: 任务所属用户故事(US1, US2, US3, US4)
- 包含精确的文件路径

---

## Phase 1: Setup (共享基础设施)

**目的**: 项目初始化和数据库准备

- [X] T001 添加PlatformPublishConfig模型到prisma/schema.prisma
- [X] T002 创建数据库迁移: npx prisma migrate dev --name add_platform_publish_config
- [X] T003 [P] 创建types/platform-config.types.ts(类型定义)
- [X] T004 [P] 创建lib/validators/platform-config.validator.ts(Zod schemas)

---

## Phase 2: Foundational (阻塞性前置条件)

**目的**: 核心基础设施,必须在任何用户故事之前完成

**⚠️ 关键**: 在此阶段完成前,无法开始任何用户故事

- [X] T005 创建lib/services/platform-config.service.ts(核心CRUD+权限校验)
- [X] T006 [P] 创建config/platform-fields.config.ts(平台字段配置)
- [X] T007 [P] 创建lib/utils/config-mapper.ts(配置数据映射工具)
- [X] T008 [P] 创建lib/hooks/use-platform-config.ts(React Hook)
- [ ] T009 测试服务层CRUD操作(可选,开发环境已验证Prisma Client可用)

**检查点**: 基础完成 - 用户故事实现可以开始

---

## Phase 3: User Story 1 - 查看平台列表 (优先级: P1) 🎯 MVP

**目标**: 在平台管理页面展示所有已支持的发布平台,包括平台信息和配置数量

**独立测试**: 
1. 启动开发服务器: `npx next dev`
2. 登录后访问 `/platforms` 页面
3. 验证显示平台卡片(微信、微博等)
4. 验证每个卡片显示: 图标、名称、支持类型、配置数量、配置按钮

### 实现User Story 1

- [X] T010 [P] [US1] 创建app/(dashboard)/platforms/page.tsx页面框架
- [ ] T011 [P] [US1] 创建app/(dashboard)/platforms/page.module.css样式文件
- [X] T012 [US1] 在app/(dashboard)/platforms/page.tsx中实现平台列表获取逻辑
- [X] T013 [US1] 在app/(dashboard)/platforms/page.tsx中实现平台卡片渲染
- [X] T014 [US1] 添加平台图标和发布类型显示(使用config/platform.config.ts)
- [X] T015 [US1] 实现配置数量动态显示(调用GET /api/platforms/publish-configs?platform=X)

**检查点**: 此时User Story 1应完全可用且可独立测试

---

## Phase 4: User Story 2 - 创建平台配置 (优先级: P1) 🎯 MVP

**目标**: 允许用户为微信公众号创建发布配置,包含平台特定字段

**独立测试**:
1. 在平台管理页点击"微信"的配置按钮
2. 打开配置弹窗,点击"创建配置"
3. 填写配置名称、描述和微信特定字段(作者、原文链接、留言设置)
4. 保存后验证配置出现在列表中
5. 刷新页面验证配置持久化成功

### 实现User Story 2

#### API层实现

- [X] T016 [P] [US2] 创建app/api/platforms/publish-configs/route.ts(GET和POST端点)
- [X] T017 [US2] 实现POST /api/platforms/publish-configs的请求验证(Zod)
- [X] T018 [US2] 实现POST /api/platforms/publish-configs的业务逻辑调用
- [X] T019 [US2] 实现GET /api/platforms/publish-configs的查询逻辑(支持platform过滤)
- [X] T020 [US2] 添加API错误处理和响应格式化

#### 前端组件实现

- [X] T021 [P] [US2] 创建components/dashboard/PlatformConfigDialog.tsx配置弹窗组件
- [ ] T022 [P] [US2] 创建components/dashboard/PlatformConfigDialog.module.css样式文件
- [ ] T023 [P] [US2] 创建components/dashboard/PlatformConfigForm.tsx通用配置表单
- [ ] T024 [P] [US2] 创建components/dashboard/PlatformConfigForm.module.css样式文件
- [X] T025 [US2] 创建components/dashboard/platform-config-fields/目录
- [X] T026 [US2] 创建components/dashboard/platform-config-fields/WechatConfigFields.tsx微信字段组件
- [X] T027 [US2] 创建components/dashboard/platform-config-fields/index.ts导出文件
- [X] T028 [US2] 在PlatformConfigDialog中实现配置列表展示
- [X] T029 [US2] 在PlatformConfigDialog中实现"创建配置"按钮和表单切换
- [X] T030 [US2] 在PlatformConfigForm中集成React Hook Form + Zod验证
- [X] T031 [US2] 在PlatformConfigForm中实现表单提交逻辑(调用POST API)
- [X] T032 [US2] 在WechatConfigFields中实现作者输入框(最多64字符验证)
- [X] T033 [US2] 在WechatConfigFields中实现原文链接输入框(URL格式验证)
- [X] T034 [US2] 在WechatConfigFields中实现留言开关(needOpenComment)
- [X] T035 [US2] 在WechatConfigFields中实现粉丝留言开关(onlyFansCanComment)

#### 集成

- [X] T036 [US2] 在app/(dashboard)/platforms/page.tsx中集成PlatformConfigDialog组件
- [X] T037 [US2] 实现配置按钮点击打开弹窗逻辑
- [X] T038 [US2] 实现创建成功后刷新配置数量显示

**检查点**: 此时User Stories 1和2都应完全可用且可独立测试

---

## Phase 5: User Story 3 - 管理配置项 (优先级: P2)

**目标**: 允许用户编辑、删除和设置默认配置

**独立测试**:
1. 打开微信配置弹窗,查看已有配置列表
2. 点击配置的"编辑"按钮,修改配置名称或字段值
3. 保存后验证更新成功
4. 点击"设为默认"按钮,验证默认标记显示
5. 点击"删除"按钮,确认后验证配置被删除

### 实现User Story 3

#### API层实现

- [ ] T039 [P] [US3] 创建app/api/platforms/publish-configs/[configId]/route.ts(GET/PUT/DELETE)
- [ ] T040 [P] [US3] 创建app/api/platforms/publish-configs/[configId]/set-default/route.ts(POST)
- [ ] T041 [US3] 实现GET /api/platforms/publish-configs/:id(权限校验)
- [ ] T042 [US3] 实现PUT /api/platforms/publish-configs/:id的更新逻辑
- [ ] T043 [US3] 实现DELETE /api/platforms/publish-configs/:id的删除逻辑
- [ ] T044 [US3] 实现POST /api/platforms/publish-configs/:id/set-default的默认配置切换

#### 服务层增强

- [ ] T045 [US3] 在lib/services/platform-config.service.ts中实现updateConfig方法
- [ ] T046 [US3] 在lib/services/platform-config.service.ts中实现deleteConfig方法
- [ ] T047 [US3] 在lib/services/platform-config.service.ts中实现setDefaultConfig方法(取消其他默认)
- [ ] T048 [US3] 在lib/services/platform-config.service.ts中实现getConfigById方法(权限校验)

#### 前端组件增强

- [ ] T049 [US3] 在PlatformConfigDialog中添加配置列表项的编辑按钮
- [ ] T050 [US3] 在PlatformConfigDialog中添加配置列表项的删除按钮
- [ ] T051 [US3] 在PlatformConfigDialog中添加配置列表项的默认标记和设置按钮
- [ ] T052 [US3] 实现编辑模式的表单预填充逻辑
- [ ] T053 [US3] 实现编辑提交逻辑(调用PUT API)
- [ ] T054 [US3] 实现删除确认对话框(使用shadcn/ui Dialog)
- [ ] T055 [US3] 实现删除逻辑(调用DELETE API)
- [ ] T056 [US3] 实现设为默认逻辑(调用POST set-default API)
- [ ] T057 [US3] 实现操作成功后的列表刷新

**检查点**: 此时User Stories 1、2和3都应完全可用且可独立测试

---

## Phase 6: User Story 4 - 发布时使用配置 (优先级: P2)

**目标**: 在发布内容时选择预设配置,自动填充发布参数

**独立测试**:
1. 创建一个微信配置(如果没有)
2. 进入发布页面,选择微信平台
3. 从配置下拉框中选择刚创建的配置
4. 验证作者、原文链接等字段自动填充
5. 手动修改某些字段,验证可以覆盖配置值
6. 发布内容,验证发布成功

### 实现User Story 4

#### 发布流程增强

- [ ] T058 [US4] 分析现有发布页面结构(app/(dashboard)/publish/page.tsx或相关文件)
- [ ] T059 [P] [US4] 创建components/dashboard/ConfigSelector.tsx配置选择器组件
- [ ] T060 [P] [US4] 创建components/dashboard/ConfigSelector.module.css样式文件
- [ ] T061 [US4] 在ConfigSelector中实现配置列表加载(GET /api/platforms/publish-configs?platform=X)
- [ ] T062 [US4] 在ConfigSelector中实现下拉选择UI(使用shadcn/ui Select)
- [ ] T063 [US4] 在ConfigSelector中实现配置选择后的回调函数
- [ ] T064 [US4] 在发布页面中集成ConfigSelector组件
- [ ] T065 [US4] 实现配置选择后的表单字段自动填充逻辑
- [ ] T066 [US4] 确保填充后用户仍可手动修改字段值

#### 发布服务集成

- [ ] T067 [US4] 修改lib/services/publish.service.ts接受configId参数(可选)
- [ ] T068 [US4] 在publish.service.ts中实现配置数据获取逻辑
- [ ] T069 [US4] 在publish.service.ts中实现配置快照存储到ContentPlatform
- [ ] T070 [US4] 在publish.service.ts中实现配置使用次数(usageCount)自动递增

#### 适配器层增强

- [ ] T071 [US4] 修改lib/platforms/wechat/wechat-adapter.ts的publish方法接受配置参数
- [ ] T072 [US4] 在wechat-adapter.ts中将配置的needOpenComment和onlyFansCanComment转换为API要求的0/1
- [ ] T073 [US4] 更新lib/platforms/base/types.ts的PublishContent接口(如需要)

**检查点**: 此时所有User Stories都应完全可用且可独立测试

---

## Phase 7: Polish & 跨功能优化

**目的**: 影响多个用户故事的改进

- [ ] T074 [P] 在PlatformConfigDialog中添加创建时间格式化显示
- [ ] T075 [P] 在PlatformConfigDialog中添加使用次数统计显示
- [ ] T076 [P] 在PlatformConfigForm中添加表单字段的helpText提示
- [ ] T077 [P] 优化所有API端点的错误消息友好性
- [ ] T078 [P] 添加配置名称重复时的友好错误提示
- [ ] T079 [P] 优化配置列表的加载性能(如需要)
- [ ] T080 [P] 添加配置删除前的二次确认提示内容优化
- [ ] T081 为微博平台添加配置字段定义(config/platform.config.ts)
- [ ] T082 创建components/dashboard/platform-config-fields/WeiboConfigFields.tsx(参考微信)
- [ ] T083 [P] 代码清理: 移除console.log和调试代码
- [ ] T084 [P] 代码格式化: 运行prettier/eslint
- [ ] T085 运行quickstart.md中的API测试验证功能完整性

---

## Dependencies & 执行顺序

### Phase 依赖关系

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖Setup完成 - 阻塞所有用户故事
- **User Stories (Phase 3-6)**: 全部依赖Foundational完成
  - 用户故事可以并行进行(如有多人)
  - 或按优先级顺序执行(US1 → US2 → US3 → US4)
- **Polish (Phase 7)**: 依赖所需用户故事完成

### User Story 依赖关系

- **User Story 1 (P1)**: 可在Foundational后开始 - 无其他故事依赖
- **User Story 2 (P1)**: 可在Foundational后开始 - 依赖US1的页面结构,但可独立测试
- **User Story 3 (P2)**: 可在Foundational后开始 - 依赖US2的API和组件,建议US2完成后开始
- **User Story 4 (P2)**: 可在Foundational后开始 - 建议US2完成后开始(需要有配置可选)

### 每个User Story内部

- API层和前端组件层可以并行开发
- 同一层内标记[P]的任务可并行
- 服务层方法按依赖顺序实现
- 集成任务在组件完成后执行

### 并行机会

- Setup阶段所有[P]任务可并行
- Foundational阶段T005-T009可部分并行(T005/T006/T007顺序,T008/T009并行)
- Foundational完成后,US1和US2可并行开发
- US2内部: T016-T020(API)和T021-T035(前端)可并行
- US3内部: T039-T044(API)和T049-T057(前端)可部分并行
- US4内部: T059-T060(组件)和T067-T070(服务)可并行
- Polish阶段所有[P]任务可并行

---

## 并行示例: User Story 2

```bash
# 并行轨道1: API层
Task: "T016 [P] [US2] 创建app/api/platforms/publish-configs/route.ts"

# 并行轨道2: 前端组件 - 弹窗
Task: "T021 [P] [US2] 创建components/dashboard/PlatformConfigDialog.tsx"
Task: "T022 [P] [US2] 创建components/dashboard/PlatformConfigDialog.module.css"

# 并行轨道3: 前端组件 - 表单
Task: "T023 [P] [US2] 创建components/dashboard/PlatformConfigForm.tsx"
Task: "T024 [P] [US2] 创建components/dashboard/PlatformConfigForm.module.css"
```

---

## 实施策略

### MVP优先 (仅User Story 1 + 2)

1. 完成Phase 1: Setup (T001-T004)
2. 完成Phase 2: Foundational (T005-T009) - **关键阻塞点**
3. 完成Phase 3: User Story 1 (T010-T015)
4. **停止并验证**: 测试平台列表显示功能
5. 完成Phase 4: User Story 2 (T016-T038)
6. **停止并验证**: 测试配置创建功能
7. 部署/演示 - 此时已有完整的配置创建能力

### 增量交付

1. 完成Setup + Foundational → 基础就绪
2. 添加User Story 1 → 独立测试 → 部署/演示(查看平台)
3. 添加User Story 2 → 独立测试 → 部署/演示(创建配置) 🎯 **MVP**
4. 添加User Story 3 → 独立测试 → 部署/演示(管理配置)
5. 添加User Story 4 → 独立测试 → 部署/演示(发布使用) ✨ **完整功能**
6. 每个故事增加价值而不破坏之前的功能

### 并行团队策略

有多个开发者时:

1. 团队共同完成Setup + Foundational
2. Foundational完成后:
   - 开发者A: User Story 1 + User Story 2(前端)
   - 开发者B: User Story 2(API) + User Story 3(API)
   - 开发者C: User Story 3(前端) + User Story 4
3. 故事独立完成并集成

---

## 任务统计

**总任务数**: 85个任务

**按Phase分类**:
- Phase 1 (Setup): 4个任务
- Phase 2 (Foundational): 5个任务 🔥 **阻塞点**
- Phase 3 (US1): 6个任务
- Phase 4 (US2): 23个任务 🎯 **核心功能**
- Phase 5 (US3): 19个任务
- Phase 6 (US4): 16个任务
- Phase 7 (Polish): 12个任务

**可并行任务**: 38个任务标记为[P]

**MVP范围建议**: Phase 1 + Phase 2 + Phase 3 + Phase 4 (共38个任务)

---

## 重点: 微信配置器实现

作为首个平台实现,微信配置器涉及以下关键任务:

**数据模型** (Phase 1):
- T001: Prisma schema添加PlatformPublishConfig模型
- T003: types/platform-config.types.ts定义WechatPublishConfigData接口
- T004: Zod schema验证微信配置数据

**平台定义** (Phase 2):
- T009: 在config/platform.config.ts中定义微信平台的capability和configFields

**微信专属组件** (Phase 4):
- T026: WechatConfigFields.tsx实现作者、原文链接、留言设置字段
- T032-T035: 各字段的具体实现和验证

**适配器集成** (Phase 6):
- T071-T072: wechat-adapter.ts接受配置参数并转换为API格式

---

## Notes

- [P] 任务 = 不同文件,无依赖
- [Story] 标签映射任务到特定用户故事,便于追踪
- 每个用户故事应可独立完成和测试
- 在每个检查点验证故事独立性
- 每完成一个任务或逻辑组提交代码
- 避免: 模糊任务、同文件冲突、破坏独立性的跨故事依赖

---

**生成时间**: 2026-01-17  
**状态**: Ready for implementation  
**建议起点**: Phase 1 → Phase 2 → Phase 3 → Phase 4 (MVP)
