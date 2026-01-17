# Research: 平台发布配置管理

**Feature**: 006-platform-publish-config  
**Phase**: 0 (Research & Technical Decisions)  
**Date**: 2026-01-17

## Overview

本文档记录平台发布配置管理功能的技术研究和决策过程。主要研究方向包括:
1. Prisma JSON 字段的类型安全存储策略
2. 各平台配置字段定义和 API 参数
3. 表单验证策略(Zod + React Hook Form)
4. 组件组合模式设计

---

## Research Topic 1: Prisma JSON 字段存储策略

### 问题陈述
不同社交媒体平台有不同的发布配置参数(如微信的author、contentSourceUrl,微博的visibility、allowComment等)。需要一种灵活且类型安全的方式存储这些平台特定配置。

### 调研发现

#### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **多表设计**<br/>(WechatConfig, WeiboConfig等) | 强类型,数据库层面约束 | 新增平台需要迁移,代码冗余 | 平台数量少且固定 |
| **JSON字段(无类型)** | 灵活,易扩展 | 失去类型安全,IDE无提示 | 快速原型 |
| **JSON字段+TypeScript类型映射** | 灵活+类型安全,易扩展 | 需要运行时验证 | **推荐方案** ✅ |
| **EAV模式**<br/>(Entity-Attribute-Value) | 极其灵活 | 查询复杂,性能差 | 配置项极其动态的场景 |

#### 决策: JSON 字段 + TypeScript 类型映射

**选择理由:**
1. **灵活性**: 新增平台无需数据库迁移,只需定义新的TypeScript接口
2. **类型安全**: 通过TypeScript接口+Zod validation实现编译时和运行时双重类型保护
3. **可维护性**: 代码结构清晰,平台配置集中管理
4. **性能**: PostgreSQL JSON字段支持索引和查询,性能可接受
5. **项目一致性**: 项目中已有JSON字段使用先例(虽然当前代码库未大量使用,但适合此场景)

#### 实现方案

**Prisma Schema定义:**
```prisma
model PlatformPublishConfig {
  id           String   @id @default(uuid())
  userId       String
  platform     String   // WECHAT, WEIBO, DOUYIN, XIAOHONGSHU
  configName   String
  description  String?
  configData   Json     // 平台特定配置(类型安全通过TS接口保证)
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

**TypeScript类型定义(types/platform-config.types.ts):**
```typescript
// 基础配置接口
export interface PlatformPublishConfig {
  id: string
  userId: string
  platform: Platform
  configName: string
  description?: string
  configData: PlatformConfigData  // 平台特定配置的联合类型
  isDefault: boolean
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

// 平台配置数据的联合类型
export type PlatformConfigData =
  | WechatPublishConfigData
  | WeiboPublishConfigData
  | DouyinPublishConfigData
  | XiaohongshuPublishConfigData

// 微信平台配置
export interface WechatPublishConfigData {
  type: 'wechat'  // 判别属性,用于类型收窄
  author?: string
  contentSourceUrl?: string
  needOpenComment?: boolean
  onlyFansCanComment?: boolean
}

// 微博平台配置
export interface WeiboPublishConfigData {
  type: 'weibo'
  visibility?: 'public' | 'friends' | 'self'
  allowComment?: boolean
  allowRepost?: boolean
}

// ...其他平台配置
```

**类型安全的数据访问:**
```typescript
// lib/services/platform-config.service.ts
import { Prisma } from '@prisma/client'
import type { PlatformPublishConfig, WechatPublishConfigData } from '@/types/platform-config.types'

async function getConfig(configId: string): Promise<PlatformPublishConfig | null> {
  const config = await prisma.platformPublishConfig.findUnique({
    where: { id: configId }
  })
  
  if (!config) return null
  
  // Prisma返回的configData是Prisma.JsonValue类型
  // 需要通过类型断言+验证转换为我们的类型
  return {
    ...config,
    configData: config.configData as PlatformConfigData  // 类型断言
  }
}

// 类型收窄使用
function useWechatConfig(config: PlatformPublishConfig) {
  if (config.configData.type === 'wechat') {
    // TypeScript知道这里的configData是WechatPublishConfigData类型
    console.log(config.configData.author)  // ✅ 类型安全
  }
}
```

#### 类型安全保障策略

参考调研的最佳实践,我们采用**三层保障**:

1. **编译时类型检查**(TypeScript接口)
   - 定义明确的接口结构
   - IDE自动补全和错误提示

2. **运行时数据验证**(Zod Schema)
   - 在API层验证incoming data
   - 在service层验证configData
   - 参考: https://www.wking.dev/guides/a-backwards-compatible-type-safe-system-for-json-fields-in-prisma

3. **类型收窄**(Discriminated Unions)
   - 使用`type`字段作为判别属性
   - TypeScript自动推断具体类型

**示例Zod Schema:**
```typescript
// lib/validators/platform-config.validator.ts
import { z } from 'zod'

export const WechatConfigDataSchema = z.object({
  type: z.literal('wechat'),
  author: z.string().max(64, '作者名最多64字符').optional(),
  contentSourceUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  needOpenComment: z.boolean().optional(),
  onlyFansCanComment: z.boolean().optional()
})

export const WeiboConfigDataSchema = z.object({
  type: z.literal('weibo'),
  visibility: z.enum(['public', 'friends', 'self']).optional(),
  allowComment: z.boolean().optional(),
  allowRepost: z.boolean().optional()
})

export const PlatformConfigDataSchema = z.discriminatedUnion('type', [
  WechatConfigDataSchema,
  WeiboConfigDataSchema,
  // ...其他平台
])

// 验证函数
export function validateConfigData(
  platform: Platform,
  data: unknown
): { success: true; data: PlatformConfigData } | { success: false; error: string } {
  const result = PlatformConfigDataSchema.safeParse(data)
  
  if (!result.success) {
    return { success: false, error: result.error.message }
  }
  
  // 验证platform与configData.type匹配
  const typeMap = { WECHAT: 'wechat', WEIBO: 'weibo', /* ... */ }
  if (result.data.type !== typeMap[platform]) {
    return { success: false, error: 'Platform mismatch' }
  }
  
  return { success: true, data: result.data }
}
```

### 替代方案分析

**为什么不用prisma-json-types-generator?**
- 优点: 自动生成类型,零运行时开销
- 缺点: 增加构建复杂度,团队学习成本
- 结论: 当前方案(手动类型+Zod验证)已足够,可作为future enhancement

**为什么不用多表设计?**
- 替代方案: `WechatPublishConfig`, `WeiboPublishConfig` 等独立表
- 拒绝理由: 
  - 每个平台需要独立的表、service、API端点
  - 新增平台需要数据库迁移
  - 代码重复度高,不符合DRY原则
  - 未来10+平台时,维护成本指数级增长

### 参考资料
- Prisma JSON Type Safety: https://www.prisma.io/docs/orm/prisma-client/type-safety
- Type-Safe JSON in TypeScript: https://betterstack.com/community/guides/scaling-nodejs/typescript-json-type-safety/
- Backwards Compatible Type-Safe JSON Fields: https://www.wking.dev/guides/a-backwards-compatible-type-safe-system-for-json-fields-in-prisma
- ZenStack Typing JSON Fields: https://zenstack.dev/docs/guides/typing-json

---

## Research Topic 2: 平台配置字段定义

### 问题陈述
需要确定每个社交媒体平台支持的发布配置参数,以便设计统一的数据模型和UI表单。

### 调研方法
1. 查阅各平台官方API文档
2. 分析现有codebase中的平台集成代码
3. 参考竞品实现

### 平台配置字段汇总

#### 1. 微信公众号 (WECHAT)

**支持的发布类型:** 文章(article)

**配置字段:**

| 字段名 | 类型 | 必填 | 说明 | API参数名 |
|--------|------|------|------|-----------|
| author | string | ❌ | 作者名 | author |
| contentSourceUrl | string(URL) | ❌ | 原文链接(阅读原文) | content_source_url |
| needOpenComment | boolean | ❌ | 是否开启评论 | need_open_comment |
| onlyFansCanComment | boolean | ❌ | 是否只有粉丝可评论 | only_fans_can_comment |

**API参考:**
- 微信公众平台开发文档: https://developers.weixin.qq.com/doc/offiaccount/Draft_Box/Add_draft.html
- 发布接口文档: https://developers.weixin.qq.com/doc/offiaccount/Publish/Publish.html  
- 现有实现: `lib/platforms/wechat/wechat-adapter.ts`
- 类型定义: `lib/platforms/wechat/wechat-types.ts`

**发布流程(基于现有实现):**

```
1. 上传封面图片 → POST /cgi-bin/material/add_material?type=thumb
   请求: multipart/form-data with image buffer
   返回: { media_id: string }

2. 创建草稿 → POST /cgi-bin/draft/add?access_token=TOKEN
   请求体: {
     articles: [{
       title: string,              // 必填,最大64字符
       author?: string,            // 可选,来自配置
       digest?: string,            // 可选,最大120字符
       content: string,            // 必填,HTML,最大20000字符
       content_source_url?: string,// 可选,来自配置
       thumb_media_id: string,     // 必填,步骤1返回的media_id
       need_open_comment?: 0|1,    // 可选,来自配置
       only_fans_can_comment?: 0|1 // 可选,来自配置
     }]
   }
   返回: { media_id: string }  // 草稿media_id

3. 发布草稿 → POST /cgi-bin/freepublish/submit?access_token=TOKEN
   请求体: { media_id: string }
   返回: { publish_id: string, article_url?: string }
```

**代码示例(来自现有实现):**
```typescript
// lib/platforms/wechat/wechat-types.ts (Line 29-38)
export interface WechatDraftArticle {
  title: string
  author?: string  // 配置项: 作者名
  digest?: string
  content: string
  content_source_url?: string  // 配置项: 原文链接
  thumb_media_id: string
  need_open_comment?: 0 | 1  // 配置项: 是否开启留言
  only_fans_can_comment?: 0 | 1  // 配置项: 粉丝留言
}

// lib/platforms/wechat/wechat-adapter.ts (Line 288-301)
const requestBody = {
  articles: [
    {
      title: content.title,
      author: content.author || '',  // <-- 从配置读取
      digest: content.digest || '',
      content: content.content,
      content_source_url: content.contentSourceUrl || '',  // <-- 从配置读取
      thumb_media_id: content.thumbMediaId,
      need_open_comment: 0,  // <-- 需要从配置读取
      only_fans_can_comment: 0  // <-- 需要从配置读取
    }
  ]
}
```

**配置项集成点:**
在发布流程中,需要修改 `lib/services/publish.service.ts` 或 `lib/platforms/wechat/wechat-adapter.ts`,将配置项数据传入:

```typescript
// 修改前 (lib/services/publish.service.ts Line 214-223)
const publishContent: PublishContent = {
  text: content.content || content.title || '',
  images: content.images || []
}

// 修改后 (需要添加configId参数)
const config = await getPublishConfig(userId, Platform.WECHAT, configId)
const publishContent: PublishContent = {
  text: content.content || '',
  title: content.title,
  author: config?.configData.author,
  contentSourceUrl: config?.configData.contentSourceUrl,
  // 将boolean转换为API要求的0/1
  // need_open_comment和only_fans_can_comment在adapter中处理
}
```

#### 2. 微博 (WEIBO)

**支持的发布类型:** 图文(image_text), 纯文本(text)

**配置字段:**

| 字段名 | 类型 | 必填 | 说明 | API参数名 |
|--------|------|------|------|-----------|
| visibility | enum | ❌ | 可见范围: public(公开), friends(好友), self(仅自己) | visible |
| allowComment | boolean | ❌ | 是否允许评论 | - |
| allowRepost | boolean | ❌ | 是否允许转发 | - |

**API参考:**
- 微博开放平台: https://open.weibo.com/wiki/2/statuses/share
- 现有代码: `lib/platforms/weibo/client.ts`

#### 3. 抖音 (DOUYIN)

**支持的发布类型:** 视频(video), 图文(image_text)

**配置字段:**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| allowComment | boolean | ❌ | 是否允许评论 |
| allowDuet | boolean | ❌ | 是否允许合拍 |
| allowStitch | boolean | ❌ | 是否允许使用视频 |
| privacyLevel | enum | ❌ | 隐私设置: public, friends, self |

**注意:** 抖音API暂未集成,字段定义基于公开文档推测,后续需验证。

#### 4. 小红书 (XIAOHONGSHU)

**支持的发布类型:** 图文(image_text), 视频(video)

**配置字段:**

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| noteType | enum | ❌ | 笔记类型: normal(普通), video(视频) |
| allowComment | boolean | ❌ | 是否允许评论 |
| poiId | string | ❌ | 地理位置ID |

**注意:** 小红书API暂未集成,字段定义基于公开文档推测,后续需验证。

### 决策: 配置字段设计原则

1. **平台特定字段存储在configData(JSON)**
   - 不在主表添加平台特定列
   - 便于新增平台,无需数据库迁移

2. **只存储发布相关参数**
   - 不存储内容本身(title, content等)
   - 不存储OAuth凭证(由WechatAccountConfig等管理)

3. **使用平台官方API参数名**
   - 便于对接API时直接映射
   - 减少字段转换逻辑

4. **预留扩展空间**
   - 所有字段设为optional
   - 新增字段不影响现有配置

### 配置字段定义文件设计

**扩展config/platform.config.ts:**
```typescript
// config/platform.config.ts
export interface PlatformConfigField {
  key: string  // 字段key(对应configData中的属性名)
  label: string  // UI显示标签
  type: 'text' | 'url' | 'select' | 'switch'  // 输入类型
  required?: boolean  // 是否必填
  placeholder?: string  // 占位符
  helpText?: string  // 帮助文本
  options?: { label: string; value: string }[]  // select类型的选项
}

export interface PlatformCapability {
  supportedTypes: ('article' | 'image_text' | 'video')[]
  configFields: PlatformConfigField[]
}

// 扩展现有PLATFORM_CONFIGS
export const PLATFORM_CONFIGS: Record<Platform, PlatformInfo & { capability: PlatformCapability }> = {
  [Platform.WECHAT]: {
    // ...现有字段
    capability: {
      supportedTypes: ['article'],
      configFields: [
        {
          key: 'author',
          label: '作者',
          type: 'text',
          placeholder: '请输入作者名称',
          helpText: '发布文章时显示的作者名'
        },
        {
          key: 'contentSourceUrl',
          label: '原文链接',
          type: 'url',
          placeholder: 'https://example.com',
          helpText: '点击“阅读原文”的跳转链接'
        },
        {
          key: 'needOpenComment',
          label: '启用留言',
          type: 'switch',
          helpText: '是否开启留言功能'
        },
        {
          key: 'onlyFansCanComment',
          label: '仅粉丝可留言',
          type: 'switch',
          helpText: '开启后只有关注者可以留言'
        }
      ]
    }
  },
  // ...其他平台
}
```

### 参考资料
- 微信公众平台文档: https://developers.weixin.qq.com/doc/offiaccount/
- 微博开放平台: https://open.weibo.com/wiki/
- 现有代码: `lib/platforms/base/types.ts` (PublishContent接口)

---

## Research Topic 3: 表单验证策略

### 问题陈述
需要设计表单验证方案,实现:
1. 客户端验证(用户体验)
2. 服务端验证(安全性)
3. 类型安全(编译时+运行时)
4. 跨平台字段的动态验证

### 调研发现

#### 技术栈选择

**React Hook Form + Zod** ✅

**选择理由:**
1. **项目已使用**: 符合项目技术栈(见spec.md Dependencies)
2. **类型安全**: Zod schema可同时用于TypeScript类型推导和运行时验证
3. **性能优秀**: React Hook Form基于uncontrolled components,减少re-render
4. **开发体验**: 声明式API,代码简洁
5. **生态成熟**: 与shadcn/ui Form组件完美集成

#### 验证架构设计

**分层验证策略:**

```
┌─────────────────────────────────────┐
│  前端表单验证 (用户体验)              │
│  - React Hook Form + Zod            │
│  - 实时反馈,阻止提交                 │
├─────────────────────────────────────┤
│  API层验证 (安全防护)                │
│  - Zod schema验证请求体              │
│  - 返回详细错误信息                  │
├─────────────────────────────────────┤
│  Service层验证 (业务逻辑)            │
│  - 业务规则验证(如配置名唯一性)       │
│  - 平台特定规则验证                  │
└─────────────────────────────────────┘
```

#### 实现方案

**1. 共享Zod Schema (lib/validators/platform-config.validator.ts)**

```typescript
import { z } from 'zod'
import { Platform } from '@/types/platform.types'

// 基础配置验证schema
export const BaseConfigSchema = z.object({
  configName: z.string()
    .min(1, '配置名称不能为空')
    .max(50, '配置名称不能超过50个字符')
    .regex(/^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+$/, '配置名称只能包含中文、英文、数字、下划线和短横线'),
  description: z.string()
    .max(200, '配置描述不能超过200个字符')
    .optional()
})

// 微信配置数据schema
export const WechatConfigDataSchema = z.object({
  type: z.literal('wechat'),
  author: z.string()
    .max(20, '作者名不能超过20个字符')
    .optional(),
  contentSourceUrl: z.string()
    .url('请输入有效的URL')
    .optional()
    .or(z.literal('')),  // 允许空字符串
  originType: z.enum(['original', 'reprint', 'unknown'])
    .default('unknown'),
  needOpenComment: z.boolean().optional().default(false),
  onlyFansCanComment: z.boolean().optional().default(false)
})

// 微博配置数据schema
export const WeiboConfigDataSchema = z.object({
  type: z.literal('weibo'),
  visibility: z.enum(['public', 'friends', 'self']).default('public'),
  allowComment: z.boolean().default(true),
  allowRepost: z.boolean().default(true)
})

// 创建配置输入schema
export const CreateConfigInputSchema = BaseConfigSchema.extend({
  platform: z.nativeEnum(Platform),
  configData: z.discriminatedUnion('type', [
    WechatConfigDataSchema,
    WeiboConfigDataSchema
    // ...其他平台
  ])
})

// 更新配置输入schema
export const UpdateConfigInputSchema = BaseConfigSchema.partial().extend({
  configData: z.discriminatedUnion('type', [
    WechatConfigDataSchema,
    WeiboConfigDataSchema
  ]).optional()
})

// 类型推导(前端可直接使用)
export type CreateConfigInput = z.infer<typeof CreateConfigInputSchema>
export type UpdateConfigInput = z.infer<typeof UpdateConfigInputSchema>
```

**2. 前端表单集成**

```typescript
// components/dashboard/PlatformConfigForm.tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'

function PlatformConfigForm({ platform }: { platform: Platform }) {
  const form = useForm({
    resolver: zodResolver(CreateConfigInputSchema),
    defaultValues: {
      configName: '',
      description: '',
      platform,
      configData: {
        type: platform.toLowerCase(),  // 'wechat', 'weibo', etc.
        // ...平台默认值
      }
    }
  })

  const onSubmit = async (data: CreateConfigInput) => {
    // data已经通过Zod验证,类型安全
    const response = await fetch('/api/platforms/publish-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    // ...
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* shadcn/ui Form components */}
        <FormField
          control={form.control}
          name="configName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>配置名称</FormLabel>
              <FormControl>
                <Input {...field} placeholder="请输入配置名称" />
              </FormControl>
              <FormMessage />  {/* 自动显示验证错误 */}
            </FormItem>
          )}
        />
        {/* ...其他字段 */}
      </form>
    </Form>
  )
}
```

**3. API层验证**

```typescript
// app/api/platforms/publish-configs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request)  // 从JWT获取
  
  // 解析请求体
  const body = await request.json()
  
  // Zod验证
  const validation = CreateConfigInputSchema.safeParse(body)
  
  if (!validation.success) {
    return NextResponse.json(
      { 
        error: '输入验证失败',
        details: validation.error.flatten().fieldErrors  // 详细错误信息
      },
      { status: 400 }
    )
  }
  
  // 调用service层(数据已验证)
  const config = await platformConfigService.createConfig(
    userId,
    validation.data
  )
  
  return NextResponse.json(config, { status: 201 })
}
```

**4. Service层业务验证**

```typescript
// lib/services/platform-config.service.ts
async createConfig(userId: string, input: CreateConfigInput) {
  // 业务规则验证:配置名唯一性
  const existing = await prisma.platformPublishConfig.findFirst({
    where: {
      userId,
      platform: input.platform,
      configName: input.configName
    }
  })
  
  if (existing) {
    throw new Error(`配置名称"${input.configName}"已存在`)
  }
  
  // 验证platform与configData.type匹配
  const typeMap = { WECHAT: 'wechat', WEIBO: 'weibo' }
  if (input.configData.type !== typeMap[input.platform]) {
    throw new Error('平台类型不匹配')
  }
  
  // 创建配置
  return await prisma.platformPublishConfig.create({
    data: {
      userId,
      platform: input.platform,
      configName: input.configName,
      description: input.description,
      configData: input.configData as Prisma.InputJsonValue
    }
  })
}
```

### 动态字段验证

**问题:** 不同平台有不同的配置字段,如何在前端动态渲染表单并验证?

**解决方案:** 组件组合模式 + 条件验证

```typescript
// components/dashboard/platform-config-fields/WechatConfigFields.tsx
import { UseFormReturn } from 'react-hook-form'

interface WechatConfigFieldsProps {
  form: UseFormReturn<CreateConfigInput>
}

export function WechatConfigFields({ form }: WechatConfigFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="configData.author"
        render={({ field }) => (
          <FormItem>
            <FormLabel>作者</FormLabel>
            <FormControl>
              <Input {...field} placeholder="请输入作者名称" />
            </FormControl>
            <FormDescription>发布文章时的作者名</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="configData.originType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>创作来源</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择创作来源" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="original">原创</SelectItem>
                <SelectItem value="reprint">转载</SelectItem>
                <SelectItem value="unknown">不声明</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* ...其他微信特定字段 */}
    </>
  )
}

// 在主表单中使用
function PlatformConfigForm({ platform }: { platform: Platform }) {
  const form = useForm({ /* ... */ })
  
  return (
    <Form {...form}>
      {/* 通用字段 */}
      <FormField name="configName" /* ... */ />
      
      {/* 平台特定字段(动态渲染) */}
      {platform === Platform.WECHAT && <WechatConfigFields form={form} />}
      {platform === Platform.WEIBO && <WeiboConfigFields form={form} />}
    </Form>
  )
}
```

### 错误处理和用户反馈

**最佳实践:**

1. **字段级错误**: 在输入框下方显示(FormMessage)
2. **表单级错误**: 在顶部显示Alert组件
3. **API错误**: Toast通知(使用sonner)

```typescript
const onSubmit = async (data: CreateConfigInput) => {
  try {
    const response = await fetch('/api/platforms/publish-configs', {
      method: 'POST',
      body: JSON.stringify(data)
    })
    
    if (!response.ok) {
      const error = await response.json()
      
      if (error.details) {
        // Zod验证错误:设置字段错误
        Object.entries(error.details).forEach(([field, messages]) => {
          form.setError(field as any, {
            message: (messages as string[])[0]
          })
        })
      } else {
        // 业务逻辑错误:显示toast
        toast.error(error.error || '保存失败')
      }
      return
    }
    
    toast.success('配置保存成功')
    onClose()
  } catch (error) {
    toast.error('网络错误,请重试')
  }
}
```

### 参考资料
- React Hook Form: https://react-hook-form.com/
- Zod: https://zod.dev/
- shadcn/ui Form: https://ui.shadcn.com/docs/components/form
- 现有代码: `components/dashboard/*` (已使用React Hook Form)

---

## Research Topic 4: 组件组合模式设计

### 问题陈述
需要设计可复用的组件架构,支持:
1. 平台特定字段的动态渲染
2. 配置列表和表单的复用
3. 易于新增平台
4. 符合React最佳实践

### 调研发现

#### 组件架构设计

**分层设计原则:**

```
┌─────────────────────────────────────────┐
│  Page Components (app/(dashboard)/)     │
│  - platforms/page.tsx                   │
│  职责:路由、数据获取、状态管理            │
├─────────────────────────────────────────┤
│  Feature Components (components/dashboard/) │
│  - PlatformConfigDialog.tsx             │
│  - PlatformConfigForm.tsx               │
│  职责:业务逻辑、UI组合                   │
├─────────────────────────────────────────┤
│  Platform-Specific Components           │
│  - WechatConfigFields.tsx               │
│  - WeiboConfigFields.tsx                │
│  职责:平台特定字段渲染                   │
├─────────────────────────────────────────┤
│  UI Primitives (components/ui/)         │
│  - Dialog, Form, Input, Select...      │
│  职责:基础UI组件                         │
└─────────────────────────────────────────┘
```

#### 组件设计方案

**1. 平台管理页面 (app/(dashboard)/platforms/page.tsx)**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlatformConfigDialog } from '@/components/dashboard/PlatformConfigDialog'
import { PLATFORM_CONFIGS } from '@/config/platform.config'

export default function PlatformsPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [configCounts, setConfigCounts] = useState<Record<Platform, number>>({})
  
  // 加载配置数量
  useEffect(() => {
    loadConfigCounts()
  }, [])
  
  const loadConfigCounts = async () => {
    // 并行获取各平台配置数量
    const counts = await Promise.all(
      Object.keys(PLATFORM_CONFIGS).map(async (platform) => {
        const res = await fetch(`/api/platforms/publish-configs?platform=${platform}`)
        const data = await res.json()
        return [platform, data.length]
      })
    )
    setConfigCounts(Object.fromEntries(counts))
  }
  
  return (
    <div>
      <h1>平台管理</h1>
      
      {/* 平台卡片网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Object.values(PLATFORM_CONFIGS).map((platform) => (
          <Card key={platform.id}>
            <div className="platform-icon">{/* 平台图标 */}</div>
            <h3>{platform.name}</h3>
            <p>支持: {platform.capability.supportedTypes.join('、')}</p>
            <p>配置: {configCounts[platform.id] || 0}个</p>
            <Button onClick={() => setSelectedPlatform(platform.id)}>
              配置
            </Button>
          </Card>
        ))}
      </div>
      
      {/* 配置管理弹窗 */}
      {selectedPlatform && (
        <PlatformConfigDialog
          platform={selectedPlatform}
          open={selectedPlatform !== null}
          onClose={() => setSelectedPlatform(null)}
          onConfigsChange={loadConfigCounts}
        />
      )}
    </div>
  )
}
```

**2. 配置管理弹窗 (components/dashboard/PlatformConfigDialog.tsx)**

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/Button'
import { PlatformConfigForm } from './PlatformConfigForm'

interface PlatformConfigDialogProps {
  platform: Platform
  open: boolean
  onClose: () => void
  onConfigsChange: () => void
}

export function PlatformConfigDialog({
  platform,
  open,
  onClose,
  onConfigsChange
}: PlatformConfigDialogProps) {
  const [configs, setConfigs] = useState<PlatformPublishConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<PlatformPublishConfig | null>(null)
  
  // 加载配置列表
  useEffect(() => {
    if (open) loadConfigs()
  }, [open, platform])
  
  const loadConfigs = async () => {
    const res = await fetch(`/api/platforms/publish-configs?platform=${platform}`)
    const data = await res.json()
    setConfigs(data)
  }
  
  const platformConfig = PLATFORM_CONFIGS[platform]
  
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {platformConfig.name} - 平台配置
          </DialogTitle>
        </DialogHeader>
        
        {!showForm ? (
          <>
            {/* 配置列表视图 */}
            <div className="space-y-4">
              <Button onClick={() => setShowForm(true)}>
                + 创建配置
              </Button>
              
              {configs.map((config) => (
                <Card key={config.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold">{config.configName}</h4>
                      <p className="text-sm text-gray-600">{config.description}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        创建于: {new Date(config.createdAt).toLocaleDateString()}
                        {config.isDefault && <Badge>默认</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        setEditingConfig(config)
                        setShowForm(true)
                      }}>
                        编辑
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDelete(config.id)}>
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
              
              {configs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  暂无配置,点击"创建配置"开始
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* 配置表单视图 */}
            <Button variant="ghost" onClick={() => {
              setShowForm(false)
              setEditingConfig(null)
            }}>
              ← 返回列表
            </Button>
            
            <PlatformConfigForm
              platform={platform}
              initialData={editingConfig}
              onSuccess={() => {
                setShowForm(false)
                setEditingConfig(null)
                loadConfigs()
                onConfigsChange()
              }}
              onCancel={() => {
                setShowForm(false)
                setEditingConfig(null)
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**3. 配置表单组件 (components/dashboard/PlatformConfigForm.tsx)**

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { WechatConfigFields } from './platform-config-fields/WechatConfigFields'
import { WeiboConfigFields } from './platform-config-fields/WeiboConfigFields'

interface PlatformConfigFormProps {
  platform: Platform
  initialData?: PlatformPublishConfig | null
  onSuccess: () => void
  onCancel: () => void
}

export function PlatformConfigForm({
  platform,
  initialData,
  onSuccess,
  onCancel
}: PlatformConfigFormProps) {
  const isEditing = !!initialData
  const schema = isEditing ? UpdateConfigInputSchema : CreateConfigInputSchema
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: initialData || {
      configName: '',
      description: '',
      platform,
      configData: getDefaultConfigData(platform)
    }
  })
  
  const onSubmit = async (data) => {
    const url = isEditing
      ? `/api/platforms/publish-configs/${initialData.id}`
      : `/api/platforms/publish-configs`
    
    const method = isEditing ? 'PUT' : 'POST'
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (res.ok) {
      toast.success(isEditing ? '配置更新成功' : '配置创建成功')
      onSuccess()
    } else {
      const error = await res.json()
      toast.error(error.error || '操作失败')
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 通用字段 */}
        <FormField name="configName" /* ... */ />
        <FormField name="description" /* ... */ />
        
        <Separator />
        
        {/* 平台特定字段(组件组合) */}
        {platform === Platform.WECHAT && <WechatConfigFields form={form} />}
        {platform === Platform.WEIBO && <WeiboConfigFields form={form} />}
        {/* 通过条件渲染实现平台特定字段的动态渲染 */}
        
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">
            {isEditing ? '更新配置' : '保存配置'}
          </Button>
        </div>
      </form>
    </Form>
  )
}

// 辅助函数:获取平台默认配置数据
function getDefaultConfigData(platform: Platform): PlatformConfigData {
  const typeMap = { WECHAT: 'wechat', WEIBO: 'weibo' }
  const type = typeMap[platform]
  
  switch (platform) {
    case Platform.WECHAT:
      return {
        type: 'wechat',
        originType: 'unknown',
        needOpenComment: false,
        onlyFansCanComment: false
      }
    case Platform.WEIBO:
      return {
        type: 'weibo',
        visibility: 'public',
        allowComment: true,
        allowRepost: true
      }
    // ...其他平台
  }
}
```

**4. 平台特定字段组件 (components/dashboard/platform-config-fields/WechatConfigFields.tsx)**

```typescript
import { UseFormReturn } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface WechatConfigFieldsProps {
  form: UseFormReturn<any>  // 可以根据需要更精确的类型
}

export function WechatConfigFields({ form }: WechatConfigFieldsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">微信公众号配置</h3>
      
      <FormField
        control={form.control}
        name="configData.author"
        render={({ field }) => (
          <FormItem>
            <FormLabel>作者</FormLabel>
            <FormControl>
              <Input {...field} placeholder="请输入作者名称" />
            </FormControl>
            <FormDescription>发布文章时的作者名</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="configData.contentSourceUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>原文链接</FormLabel>
            <FormControl>
              <Input {...field} type="url" placeholder="https://example.com" />
            </FormControl>
            <FormDescription>点击"阅读原文"的跳转链接</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="configData.originType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>创作来源 <span className="text-red-500">*</span></FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择创作来源" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="original">原创</SelectItem>
                <SelectItem value="reprint">转载</SelectItem>
                <SelectItem value="unknown">不声明</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="configData.needOpenComment"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div>
              <FormLabel>启用留言</FormLabel>
              <FormDescription>是否开启留言功能</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="configData.onlyFansCanComment"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between">
            <div>
              <FormLabel>仅粉丝可留言</FormLabel>
              <FormDescription>开启后只有关注者可以留言</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  )
}
```

#### 组件注册机制(可选,用于更动态的扩展)

**当前方案(条件渲染):**
```typescript
{platform === Platform.WECHAT && <WechatConfigFields form={form} />}
{platform === Platform.WEIBO && <WeiboConfigFields form={form} />}
```

**优化方案(组件映射):**
```typescript
// components/dashboard/platform-config-fields/index.ts
import { Platform } from '@/types/platform.types'
import { WechatConfigFields } from './WechatConfigFields'
import { WeiboConfigFields } from './WeiboConfigFields'

export const PlatformConfigFieldsMap: Record<Platform, React.ComponentType<any>> = {
  [Platform.WECHAT]: WechatConfigFields,
  [Platform.WEIBO]: WeiboConfigFields,
  [Platform.DOUYIN]: DouyinConfigFields,  // 未来添加
  [Platform.XIAOHONGSHU]: XiaohongshuConfigFields
}

// 在表单中使用
const PlatformFields = PlatformConfigFieldsMap[platform]
return (
  <Form {...form}>
    {/* 通用字段 */}
    <PlatformFields form={form} />  {/* 动态渲染 */}
  </Form>
)
```

**决策:** 初期使用条件渲染,简单直观。如果平台数量超过5个,迁移到组件映射方案。

### 组件设计原则总结

1. **单一职责**: 每个组件只负责一个功能层面
2. **Props明确**: 使用TypeScript接口定义Props
3. **可测试性**: 组件逻辑独立,易于单元测试
4. **可扩展性**: 新增平台只需添加一个字段组件
5. **代码复用**: 通用逻辑抽取为hooks或utils

### 参考资料
- React Component Patterns: https://react.dev/learn/passing-props-to-a-component
- Composition vs Inheritance: https://react.dev/learn/thinking-in-react
- shadcn/ui源码: https://github.com/shadcn/ui (学习组件组合模式)

---

## Summary: 技术决策汇总

| 决策点 | 选择方案 | 理由 |
|--------|---------|------|
| **数据存储** | JSON字段 + TypeScript类型映射 | 灵活、类型安全、易扩展 |
| **类型安全** | TypeScript接口 + Zod验证 + Discriminated Unions | 编译时+运行时双重保障 |
| **表单管理** | React Hook Form + Zod | 项目技术栈,性能优秀 |
| **组件架构** | 分层设计 + 组件组合模式 | 职责清晰,易于扩展 |
| **字段渲染** | 条件渲染(初期) → 组件映射(后期) | 循序渐进,避免过度设计 |
| **验证策略** | 三层验证(前端/API/Service) | 用户体验+安全性平衡 |

## Next Steps

Phase 0 研究完成 ✅,进入 Phase 1: Design & Contracts

1. 生成 `data-model.md` - 详细数据模型设计
2. 生成 `contracts/api.yaml` - OpenAPI规范
3. 生成 `quickstart.md` - 快速开始指南
4. 更新 agent context
5. Re-check Constitution 合规性
