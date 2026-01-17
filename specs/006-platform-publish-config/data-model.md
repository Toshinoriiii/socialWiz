# Data Model: 平台发布配置管理

**Feature**: 006-platform-publish-config  
**Phase**: 1 (Design & Contracts)  
**Date**: 2026-01-17

## Overview

本文档定义平台发布配置管理功能的详细数据模型,包括数据库表结构、TypeScript类型定义、关系约束和数据验证规则。

---

## 1. Database Schema (Prisma)

### 1.1 PlatformPublishConfig Model

```prisma
model PlatformPublishConfig {
  id           String   @id @default(uuid())
  userId       String
  platform     String   // WECHAT, WEIBO, DOUYIN, XIAOHONGSHU
  configName   String
  description  String?  @db.VarChar(500)
  configData   Json     // 平台特定配置(类型安全通过TS接口保证)
  isDefault    Boolean  @default(false)
  usageCount   Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  // Relations
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Constraints
  @@unique([userId, platform, configName], name: "unique_user_platform_config")
  @@index([userId, platform], name: "idx_user_platform")
  @@map("platform_publish_configs")
}
```

### 1.2 字段说明

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | String(UUID) | 主键 | 配置唯一标识 |
| `userId` | String(UUID) | 外键,NOT NULL | 关联到User表,配置所属用户 |
| `platform` | String(Enum) | NOT NULL | 平台类型: WECHAT, WEIBO, DOUYIN, XIAOHONGSHU |
| `configName` | String | NOT NULL | 配置名称(1-50字符) |
| `description` | String | NULL | 配置描述(最多500字符) |
| `configData` | JSON | NOT NULL | 平台特定配置数据(格式由platform决定) |
| `isDefault` | Boolean | DEFAULT false | 是否为默认配置(仅UI标记) |
| `usageCount` | Int | DEFAULT 0 | 配置使用次数统计 |
| `createdAt` | DateTime | DEFAULT now() | 创建时间 |
| `updatedAt` | DateTime | AUTO UPDATE | 更新时间 |

### 1.3 约束和索引

**唯一性约束**:
```sql
UNIQUE (userId, platform, configName)
```
- 同一用户在同一平台下不能有重名配置
- 允许不同用户或不同平台有同名配置

**索引**:
```sql
INDEX idx_user_platform (userId, platform)
```
- 优化查询: "获取用户在某平台的所有配置"
- 覆盖最常见的查询模式

**级联删除**:
```sql
ON DELETE CASCADE (userId → User)
```
- 用户删除时,其所有配置自动删除
- 保证数据一致性

### 1.4 数据迁移

```typescript
// prisma/migrations/XXX_add_platform_publish_config/migration.sql
CREATE TABLE "platform_publish_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "configName" TEXT NOT NULL,
  "description" TEXT,
  "configData" JSONB NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "platform_publish_configs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "unique_user_platform_config" 
  ON "platform_publish_configs"("userId", "platform", "configName");

CREATE INDEX "idx_user_platform" 
  ON "platform_publish_configs"("userId", "platform");
```

---

## 2. TypeScript Type Definitions

### 2.1 Core Types

```typescript
// types/platform-config.types.ts

import { Platform } from '@/types/platform.types'

/**
 * 平台发布配置基础接口
 */
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

/**
 * 平台配置数据联合类型(使用 Discriminated Unions)
 */
export type PlatformConfigData =
  | WechatPublishConfigData
  | WeiboPublishConfigData
  | DouyinPublishConfigData
  | XiaohongshuPublishConfigData

/**
 * 微信公众号发布配置
 */
export interface WechatPublishConfigData {
  type: 'wechat'  // 判别属性
  author?: string  // 作者名(最多64字符)
  contentSourceUrl?: string  // 原文链接(阅读原文按钮)
  needOpenComment?: boolean  // 是否开启留言(对应API的0/1)
  onlyFansCanComment?: boolean  // 是否只有粉丝可留言(对应API的0/1)
}

/**
 * 微博发布配置
 */
export interface WeiboPublishConfigData {
  type: 'weibo'
  visibility?: 'public' | 'friends' | 'self'  // 可见范围
  allowComment?: boolean  // 允许评论
  allowRepost?: boolean  // 允许转发
}

/**
 * 抖音发布配置(待实现)
 */
export interface DouyinPublishConfigData {
  type: 'douyin'
  allowComment?: boolean
  allowDuet?: boolean  // 允许合拍
  allowStitch?: boolean  // 允许使用视频
  privacyLevel?: 'public' | 'friends' | 'self'
}

/**
 * 小红书发布配置(待实现)
 */
export interface XiaohongshuPublishConfigData {
  type: 'xiaohongshu'
  noteType?: 'normal' | 'video'
  allowComment?: boolean
  poiId?: string  // 地理位置ID
}
```

### 2.2 Input/Output Types

```typescript
/**
 * 创建配置输入(API请求体)
 */
export interface CreateConfigInput {
  platform: Platform
  configName: string
  description?: string
  configData: PlatformConfigData
}

/**
 * 更新配置输入(API请求体)
 */
export interface UpdateConfigInput {
  configName?: string
  description?: string
  configData?: PlatformConfigData
}

/**
 * 查询参数
 */
export interface GetConfigsParams {
  platform?: Platform  // 过滤平台
  isDefault?: boolean  // 只返回默认配置
}

/**
 * 配置列表响应
 */
export interface ConfigListResponse {
  configs: PlatformPublishConfig[]
  total: number
}
```

### 2.3 Type Guards (类型收窄)

```typescript
/**
 * 类型守卫函数
 */
export function isWechatConfig(
  data: PlatformConfigData
): data is WechatPublishConfigData {
  return data.type === 'wechat'
}

export function isWeiboConfig(
  data: PlatformConfigData
): data is WeiboPublishConfigData {
  return data.type === 'weibo'
}

// 使用示例:
function processConfig(config: PlatformPublishConfig) {
  if (isWechatConfig(config.configData)) {
    // TypeScript知道这里configData是WechatPublishConfigData
    console.log(config.configData.author)  // ✅ 类型安全
  }
}
```

---

## 3. Data Validation (Zod Schemas)

### 3.1 Platform-Specific Schemas

```typescript
// lib/validators/platform-config.validator.ts

import { z } from 'zod'
import { Platform } from '@/types/platform.types'

/**
 * 基础配置验证(所有平台通用)
 */
export const BaseConfigSchema = z.object({
  configName: z.string()
    .min(1, '配置名称不能为空')
    .max(50, '配置名称不能超过50个字符')
    .regex(
      /^[\u4e00-\u9fa5a-zA-Z0-9_\-\s]+$/,
      '配置名称只能包含中文、英文、数字、下划线和短横线'
    ),
  description: z.string()
    .max(500, '配置描述不能超过500个字符')
    .optional()
})

/**
 * 微信配置数据验证
 */
export const WechatConfigDataSchema = z.object({
  type: z.literal('wechat'),
  author: z.string()
    .max(64, '作者名不能超过64个字符')
    .optional(),
  contentSourceUrl: z.string()
    .url('请输入有效的URL')
    .optional()
    .or(z.literal('')),  // 允许空字符串
  needOpenComment: z.boolean().optional().default(false),
  onlyFansCanComment: z.boolean().optional().default(false)
})

/**
 * 微博配置数据验证
 */
export const WeiboConfigDataSchema = z.object({
  type: z.literal('weibo'),
  visibility: z.enum(['public', 'friends', 'self']).default('public'),
  allowComment: z.boolean().default(true),
  allowRepost: z.boolean().default(true)
})

/**
 * 平台配置数据联合验证
 */
export const PlatformConfigDataSchema = z.discriminatedUnion('type', [
  WechatConfigDataSchema,
  WeiboConfigDataSchema
  // 其他平台schema...
])

/**
 * 创建配置输入验证
 */
export const CreateConfigInputSchema = BaseConfigSchema.extend({
  platform: z.nativeEnum(Platform),
  configData: PlatformConfigDataSchema
})

/**
 * 更新配置输入验证
 */
export const UpdateConfigInputSchema = BaseConfigSchema.partial().extend({
  configData: PlatformConfigDataSchema.optional()
})

// 类型推导
export type CreateConfigInput = z.infer<typeof CreateConfigInputSchema>
export type UpdateConfigInput = z.infer<typeof UpdateConfigInputSchema>
```

### 3.2 Validation Functions

```typescript
/**
 * 验证配置数据格式
 */
export function validateConfigData(
  platform: Platform,
  data: unknown
): { success: true; data: PlatformConfigData } | { success: false; error: string } {
  const result = PlatformConfigDataSchema.safeParse(data)
  
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map(i => i.message).join(', ')
    }
  }
  
  // 验证platform与configData.type匹配
  const typeMap: Record<Platform, string> = {
    [Platform.WECHAT]: 'wechat',
    [Platform.WEIBO]: 'weibo',
    [Platform.DOUYIN]: 'douyin',
    [Platform.XIAOHONGSHU]: 'xiaohongshu'
  }
  
  if (result.data.type !== typeMap[platform]) {
    return {
      success: false,
      error: `配置数据类型与平台不匹配: ${result.data.type} vs ${platform}`
    }
  }
  
  return { success: true, data: result.data }
}
```

---

## 4. Data Relationships

### 4.1 Entity Relationship Diagram

```
┌─────────────────────┐
│       User          │
│  id (PK)            │
│  email              │
│  ...                │
└─────────┬───────────┘
          │
          │ 1:N
          │
          ▼
┌──────────────────────────────┐
│  PlatformPublishConfig       │
│  id (PK)                     │
│  userId (FK) ───────────────►│
│  platform                    │
│  configName                  │
│  configData (JSON)           │
│  ...                         │
└──────────────────────────────┘

约束: UNIQUE(userId, platform, configName)
```

### 4.2 Configuration与其他实体的关系

**与PlatformAccount的关系**:
- **无直接关联**: 配置是平台级别的,不绑定到具体账号
- **使用方式**: 发布时同时选择 "账号" + "配置"
- **灵活性**: 一个配置可用于该平台的任意账号

**与ContentPlatform的关系(发布记录)**:
- **无直接外键**: 配置与发布记录解耦
- **快照存储**: 发布时将配置数据作为JSON快照存储在ContentPlatform表
- **好处**: 删除配置不影响历史发布记录,便于审计

---

## 5. Data Access Patterns

### 5.1 常见查询

```typescript
// 1. 获取用户在某平台的所有配置(按创建时间倒序)
prisma.platformPublishConfig.findMany({
  where: {
    userId: 'user-123',
    platform: Platform.WECHAT
  },
  orderBy: { createdAt: 'desc' }
})

// 2. 获取用户的默认配置
prisma.platformPublishConfig.findFirst({
  where: {
    userId: 'user-123',
    platform: Platform.WECHAT,
    isDefault: true
  }
})

// 3. 检查配置名是否已存在
prisma.platformPublishConfig.findUnique({
  where: {
    unique_user_platform_config: {
      userId: 'user-123',
      platform: Platform.WECHAT,
      configName: '技术文章配置'
    }
  }
})

// 4. 创建配置
prisma.platformPublishConfig.create({
  data: {
    userId: 'user-123',
    platform: Platform.WECHAT,
    configName: '技术文章配置',
    description: '用于发布技术类文章',
    configData: {
      type: 'wechat',
      author: 'SocialWiz团队',
      contentSourceUrl: 'https://socialwiz.com',
      needOpenComment: true,
      onlyFansCanComment: false
    }
  }
})

// 5. 更新使用次数(事务安全)
prisma.platformPublishConfig.update({
  where: { id: 'config-123' },
  data: {
    usageCount: { increment: 1 }
  }
})
```

### 5.2 性能优化

**索引利用**:
- `idx_user_platform` 覆盖了最常见的查询: `WHERE userId = ? AND platform = ?`
- 唯一索引 `unique_user_platform_config` 加速配置名重复检查

**JSON字段查询**:
- PostgreSQL支持JSON字段的GIN索引,但当前场景不需要(查询都基于userId+platform)
- 如需按configData内容查询,可添加: `CREATE INDEX idx_config_data ON platform_publish_configs USING GIN (configData);`

---

## 6. Data Integrity Rules

### 6.1 业务规则

1. **配置名唯一性**: 同一用户在同一平台下不能有重名配置
2. **默认配置唯一性**: 同一用户在同一平台最多只有一个默认配置(应用层控制)
3. **平台类型验证**: platform字段必须是有效的Platform枚举值
4. **配置数据格式**: configData必须符合对应平台的Zod schema
5. **用户隔离**: 用户只能访问自己创建的配置

### 6.2 实施层级

- **数据库层**: 外键约束、唯一约束、NOT NULL约束
- **应用层(Service)**: 默认配置唯一性、配置数据格式验证、业务逻辑验证
- **API层**: 请求体验证(Zod)、权限校验(userId匹配)

---

## 7. Migration Strategy

### 7.1 初始迁移

```bash
# 生成迁移
npx prisma migrate dev --name add_platform_publish_config

# 应用迁移
npx prisma migrate deploy
```

### 7.2 回滚计划

如果需要回滚:

```sql
-- 1. 备份数据(可选)
CREATE TABLE platform_publish_configs_backup AS 
SELECT * FROM platform_publish_configs;

-- 2. 删除表
DROP TABLE platform_publish_configs;

-- 3. 恢复Prisma schema
-- (手动移除model定义)
```

---

## 8. Testing Considerations

### 8.1 测试数据

```typescript
// 测试用配置示例
export const mockWechatConfig: PlatformPublishConfig = {
  id: 'config-123',
  userId: 'user-123',
  platform: Platform.WECHAT,
  configName: '测试配置',
  description: '用于单元测试',
  configData: {
    type: 'wechat',
    author: '测试作者',
    contentSourceUrl: 'https://example.com',
    needOpenComment: true,
    onlyFansCanComment: false
  },
  isDefault: true,
  usageCount: 5,
  createdAt: new Date('2026-01-17'),
  updatedAt: new Date('2026-01-17')
}
```

### 8.2 测试场景

- ✅ 创建配置后可以查询到
- ✅ 配置名重复时创建失败
- ✅ 更新配置后updatedAt自动更新
- ✅ 删除用户时配置级联删除
- ✅ 设置默认配置时取消其他默认配置
- ✅ 类型安全: configData符合平台schema

---

## Summary

本数据模型设计实现了:

✅ **类型安全**: 通过TypeScript接口 + Zod验证实现编译时和运行时双重保护  
✅ **灵活扩展**: JSON字段存储平台特定配置,新增平台无需数据库迁移  
✅ **性能优化**: 合理的索引设计覆盖常见查询模式  
✅ **数据完整性**: 唯一约束、外键约束、级联删除保证数据一致性  
✅ **解耦设计**: 配置与账号解耦,配置与发布记录解耦,提高灵活性

**下一步**: 基于此数据模型实现API端点(contracts/api.yaml)和服务层代码。
