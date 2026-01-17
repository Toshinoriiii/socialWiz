# Feature Spec: 平台发布配置管理

**Feature ID**: 006-platform-publish-config  
**Status**: Planning  
**Created**: 2026-01-17  
**Last Updated**: 2026-01-17

## Overview

在平台管理页面实现平台发布配置管理功能,允许用户为每个已支持的发布平台创建和管理多个配置项。每个配置项包含平台特定的发布参数(如作者、原文链接、创作来源等),在发布内容时可以选择使用哪个配置。

## Clarifications

### Session 2026-01-17

- Q: 配置与账号的关联关系(用户可在一个平台绑定多个账号) → A: 配置在发布时需要同时选择"账号"和"配置",配置可以用于该平台的任意账号
- Q: 配置名称的唯一性约束范围 → A: 保持当前约束(userId + platform + configName唯一),同一平台下不能有同名配置
- Q: 默认配置的行为 → A: 默认配置仅作为标记,不影响发布行为,用户必须手动选择
- Q: 配置数据的验证时机 → A: 创建/更新时进行格式验证(如URL格式),发布时进行业务验证(如URL可访问性)
- Q: 删除配置时对已发布内容的影响 → A: 配置与发布记录完全解耦,删除配置不影响已发布内容,发布时存储配置快照

## Problem Statement

当前系统虽然支持微信、微博等平台的发布功能,但发布参数是在每次发布时手动填写的,缺乏预设配置功能。用户需要:

1. **配置复用**: 为常用的发布场景创建预设配置(如不同的作者名、不同的原文链接模板)
2. **批量管理**: 管理多个配置项,方便在不同场景下切换使用
3. **平台特定**: 不同平台有不同的配置项(微信有作者、原文链接,微博可能有其他参数)
4. **发布时选择**: 在发布内容时,可以选择使用哪个预设配置

## Goals

### Primary Goals
- [x] 在平台管理页面展示已支持的发布平台列表
- [x] 显示每个平台支持的发布类型(文章、图文、视频等)
- [x] 提供配置按钮打开平台专属配置弹窗
- [x] 支持创建、编辑、删除平台配置项
- [x] 一个平台可以有多个配置项
- [x] 配置项包含名称和描述,便于识别

### Secondary Goals
- [x] 配置项设为默认(作为UI标记,便于用户识别常用配置)
- [ ] 配置项统计使用次数
- [ ] 配置项导入导出功能

## User Stories

### Story 1: 查看平台列表
**作为** 内容管理员  
**我想要** 在平台管理页面看到所有已支持的发布平台  
**以便于** 了解当前系统支持哪些平台,以及每个平台支持的发布类型

**验收标准**:
- 显示平台图标、名称
- 显示平台支持的发布类型(文章、图文、视频等)
- 显示该平台当前配置项数量
- 显示配置按钮

### Story 2: 创建平台配置
**作为** 内容管理员  
**我想要** 为微信公众号创建发布配置  
**以便于** 设置常用的作者名、原文链接等参数,下次发布时直接使用

**验收标准**:
- 点击配置按钮打开配置弹窗
- 弹窗显示该平台所有已有配置项
- 可以创建新配置项
- 配置项包含:
  - 配置名称(必填,如"技术文章配置")
  - 配置描述(可选,说明用途)
  - 平台特定字段(如微信的作者、原文链接、创作来源等)
- 保存后配置项出现在列表中

### Story 3: 管理配置项
**作为** 内容管理员  
**我想要** 编辑或删除已有的配置项  
**以便于** 更新配置参数或移除不再使用的配置

**验收标准**:
- 配置列表显示所有配置项
- 每个配置项显示名称、描述、创建时间
- 可以编辑配置项(修改名称、描述、字段值)
- 可以删除配置项(需确认)
- 删除配置项不影响已发布的内容(发布时存储配置快照,与源配置解耦)

### Story 4: 发布时使用配置
**作为** 内容管理员  
**我想要** 在发布内容时选择使用哪个预设配置  
**以便于** 快速填充发布参数,无需每次手动输入

**验收标准**:
- 发布页面先选择要发布到的账号(如果用户在该平台绑定了多个账号)
- 显示该平台的配置选择器(配置是平台级别的,可用于任意账号)
- 选择配置后自动填充对应字段
- 可以在填充后继续手动修改
- 不选择配置时可以完全手动填写

## Technical Requirements

### Functional Requirements

#### FR1: 平台配置数据模型
```typescript
interface PlatformPublishConfig {
  id: string
  userId: string
  platform: 'WECHAT' | 'WEIBO' | 'DOUYIN' | 'XIAOHONGSHU'
  configName: string          // 配置名称
  description?: string        // 配置描述
  configData: Record<string, any>  // 平台特定配置数据
  isDefault: boolean         // 是否为默认配置(仅作UI标记,不影响发布行为)
  usageCount: number         // 使用次数
  createdAt: Date
  updatedAt: Date
}

// 注意: 配置是平台级别的,不绑定到具体账号
// 发布时需要同时选择: 1) 该平台下的哪个账号, 2) 使用哪个配置
// 这样一个配置可以在用户的多个账号间复用

// 微信平台配置数据结构
interface WechatPublishConfigData {
  author?: string             // 作者
  contentSourceUrl?: string   // 原文链接
  originType?: 'original' | 'reprint' | 'unknown'  // 创作来源
  needOpenComment?: boolean   // 开启评论
  onlyFansCanComment?: boolean // 仅粉丝评论
}

// 微博平台配置数据结构(示例)
interface WeiboPublishConfigData {
  visibility?: 'public' | 'friends' | 'self'  // 可见范围
  allowComment?: boolean      // 允许评论
  allowRepost?: boolean       // 允许转发
}
```

#### FR2: API 端点
- `GET /api/platforms/publish-configs` - 获取用户的所有平台配置
- `GET /api/platforms/publish-configs?platform=WECHAT` - 获取特定平台的配置
- `POST /api/platforms/publish-configs` - 创建新配置
- `PUT /api/platforms/publish-configs/:id` - 更新配置
- `DELETE /api/platforms/publish-configs/:id` - 删除配置
- `POST /api/platforms/publish-configs/:id/set-default` - 设为默认配置

#### FR3: 前端组件
- **平台管理页面** (`app/(dashboard)/platforms/page.tsx`):
  - 展示平台列表卡片
  - 显示平台支持的发布类型
  - 显示配置数量
  - 配置按钮
  
- **配置管理弹窗** (`components/dashboard/PlatformConfigDialog.tsx`):
  - 配置列表展示
  - 创建/编辑配置表单
  - 删除确认

- **配置字段组件**(按平台):
  - `WechatConfigFields.tsx` - 微信特定字段
  - `WeiboConfigFields.tsx` - 微博特定字段
  - 等...

#### FR4: 平台能力定义
```typescript
// config/platform.config.ts
interface PlatformCapability {
  id: string
  name: string
  supportedTypes: ('article' | 'image' | 'video')[]
  configFields: PlatformConfigField[]
}

interface PlatformConfigField {
  key: string
  label: string
  type: 'text' | 'select' | 'switch' | 'url'
  required?: boolean
  options?: { label: string, value: string }[]
  placeholder?: string
  helpText?: string
}
```

### Non-Functional Requirements

#### NFR1: 性能
- 配置列表加载时间 < 500ms
- 配置保存响应时间 < 1s
- 支持 100+ 配置项无性能问题

#### NFR2: 安全
- 配置项与用户绑定,只能访问自己的配置
- API 端点需要认证
- 配置数据验证策略:
  - 创建/更新时: 格式验证(Zod schema,如URL格式、字符串长度)
  - 发布时: 业务验证(如URL可访问性、图片资源有效性)

#### NFR3: 可用性
- 配置名称不能重复(同一用户同一平台)
- 删除配置需要确认
- 表单验证友好提示

## Design Considerations

### UI/UX Design

#### 平台管理页面布局
```
┌─────────────────────────────────────────────┐
│ 平台管理                                      │
├─────────────────────────────────────────────┤
│                                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ 📱           │  │ 📝           │        │
│  │ 微信公众号    │  │ 微博          │        │
│  │ 支持: 文章    │  │ 支持: 图文     │        │
│  │ 配置: 3个     │  │ 配置: 1个      │        │
│  │ [配置]       │  │ [配置]        │        │
│  └──────────────┘  └──────────────┘        │
│                                              │
└─────────────────────────────────────────────┘
```

#### 配置弹窗布局(以微信为例)
```
┌──────────────────────────────────────────────┐
│ 微信公众号 - 平台配置          [X]           │
├──────────────────────────────────────────────┤
│ 管理微信公众号的发布配置项,每个配置可以...    │
│                                               │
│ [+ 创建配置]                                  │
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 技术文章配置          [默认]  [编辑] [删除]│ │
│ │ 用于发布技术类文章                         │ │
│ │ 作者: 张三 | 来源: 原创 | 创建: 2026-01-15 │ │
│ └──────────────────────────────────────────┘ │
│                                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 转载文章配置                [编辑] [删除]  │ │
│ │ 用于转载其他来源的文章                     │ │
│ │ 作者: 编辑部 | 来源: 转载 | 创建: ...     │ │
│ └──────────────────────────────────────────┘ │
│                                               │
└──────────────────────────────────────────────┘
```

#### 创建/编辑配置表单
```
┌──────────────────────────────────────────────┐
│ 创建配置 - 微信公众号          [← 返回]      │
├──────────────────────────────────────────────┤
│                                               │
│ 配置名称 *                                    │
│ ┌──────────────────────────────────────────┐ │
│ │ 请输入配置名称                            │ │
│ └──────────────────────────────────────────┘ │
│ 为这个配置起一个易识别的名称                  │
│                                               │
│ 配置描述                                      │
│ ┌──────────────────────────────────────────┐ │
│ │ 请输入配置描述(可选)                       │ │
│ └──────────────────────────────────────────┘ │
│ 描述这个配置的用途和特点                      │
│                                               │
│ 作者                                          │
│ ┌──────────────────────────────────────────┐ │
│ │ 请输入作者名称                            │ │
│ └──────────────────────────────────────────┘ │
│ 发布文章时的作者名                            │
│                                               │
│ 原文链接                                      │
│ ┌──────────────────────────────────────────┐ │
│ │ 请输入原文链接                            │ │
│ └──────────────────────────────────────────┘ │
│ 点击阅读原文的跳转链接                        │
│                                               │
│ 创作来源 *                                    │
│ ⚫ 原创    ○ 转载    ○ 不声明                │
│                                               │
│ 留言                                          │
│ ☑ 启用留言    ☐ 仅粉丝可留言                 │
│ 是否开启留言功能                              │
│                                               │
│            [取消]  [保存配置]                 │
└──────────────────────────────────────────────┘
```

### Architecture

#### 数据库 Schema
```prisma
model PlatformPublishConfig {
  id           String   @id @default(uuid())
  userId       String
  platform     String   // WECHAT, WEIBO, etc.
  configName   String
  description  String?
  configData   Json     // 平台特定配置
  isDefault    Boolean  @default(false)
  usageCount   Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, platform, configName])
  @@index([userId, platform])
  @@map("platform_publish_configs")
}
```

#### 服务层设计
```typescript
// lib/services/platform-config.service.ts
class PlatformConfigService {
  // 获取用户的平台配置列表
  async getConfigs(userId: string, platform?: string): Promise<PlatformPublishConfig[]>
  
  // 创建配置
  async createConfig(userId: string, data: CreateConfigInput): Promise<PlatformPublishConfig>
  
  // 更新配置
  async updateConfig(configId: string, userId: string, data: UpdateConfigInput): Promise<PlatformPublishConfig>
  
  // 删除配置
  async deleteConfig(configId: string, userId: string): Promise<void>
  
  // 设为默认配置
  async setDefault(configId: string, userId: string, platform: string): Promise<void>
  
  // 增加使用次数
  async incrementUsage(configId: string): Promise<void>
  
  // 验证配置数据
  validateConfigData(platform: string, data: any): { valid: boolean, errors?: string[] }
  // 注意: 此方法仅进行格式验证(Zod schema)
  // 业务验证(如URL可访问性)在发布时由发布服务执行
}
```

## Success Metrics

- **功能完整性**: 实现所有主要用户故事(Story 1-3)
- **用户体验**: 配置创建流程 < 5 步操作
- **性能**: 配置列表加载 < 500ms, 保存响应 < 1s
- **数据完整性**: 配置与用户正确绑定,无数据泄露
- **代码质量**: 通过 TypeScript 类型检查,核心逻辑有单元测试

## Dependencies

### Internal Dependencies
- 用户认证系统(`lib/services/auth.service.ts`)
- 平台配置(`config/platform.config.ts`)
- 数据库 Prisma Client(`lib/db/prisma.ts`)

### External Dependencies
- shadcn/ui 组件库(Dialog, Form, Select 等)
- Zod 用于表单验证
- React Hook Form 用于表单管理

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| 不同平台配置字段差异大,难以统一 | High | 使用 JSON 存储平台特定数据,前端使用组合组件模式 |
| 配置数据验证复杂 | Medium | 为每个平台定义 Zod Schema,统一验证 |
| 配置项过多导致性能问题 | Low | 实现分页和搜索功能,限制单用户配置数量 |
| 删除配置影响已发布内容 | Low | 配置与发布记录解耦,发布时存储配置快照(JSON),删除源配置不影响历史记录 |

## Future Enhancements

1. **配置模板**: 提供官方推荐的配置模板
2. **配置分享**: 用户间分享配置(团队功能)
3. **配置版本**: 记录配置修改历史,支持回滚
4. **批量操作**: 批量导入/导出配置
5. **智能推荐**: 根据发布内容自动推荐合适的配置
6. **配置分组**: 为配置项创建分类/标签

## References

- 微信公众平台文档: https://developers.weixin.qq.com/doc/offiaccount/
- 微博开放平台文档: https://open.weibo.com/wiki/
- Prisma JSON 字段文档: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#json
- shadcn/ui Dialog: https://ui.shadcn.com/docs/components/dialog
