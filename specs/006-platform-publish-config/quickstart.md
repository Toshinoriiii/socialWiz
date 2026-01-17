# Quick Start: 平台发布配置管理

**Feature**: 006-platform-publish-config  
**Phase**: 1 (Design & Contracts)  
**Date**: 2026-01-17

## Overview

本文档提供平台发布配置管理功能的快速开始指南,帮助开发者快速理解功能、设置环境并运行示例代码。

---

## 1. 功能简介

### 1.1 什么是平台发布配置?

平台发布配置允许用户为不同的社交媒体平台(微信、微博、抖音、小红书)创建预设的发布参数,例如:

- **微信公众号**: 作者名、原文链接、留言设置
- **微博**: 可见范围、评论/转发权限
- **抖音/小红书**: 隐私设置、互动权限等

### 1.2 核心特性

✅ **多配置管理**: 一个平台可以创建多个配置,适应不同发布场景  
✅ **快速复用**: 发布内容时选择配置,自动填充参数  
✅ **平台解耦**: 配置不绑定账号,可用于该平台的任意账号  
✅ **类型安全**: TypeScript + Zod 双重验证  
✅ **灵活扩展**: JSON 字段存储,新增平台无需数据库迁移

---

## 2. 前置准备

### 2.1 环境要求

- Node.js 18+
- PostgreSQL 14+
- Redis (可选,用于缓存)
- Next.js 14+
- Prisma 5+

### 2.2 依赖安装

```bash
# 已在项目中安装,无需额外操作
# 关键依赖:
# - @prisma/client
# - zod
# - react-hook-form
# - @hookform/resolvers
```

---

## 3. 数据库设置

### 3.1 运行迁移

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 创建数据库迁移
npx prisma migrate dev --name add_platform_publish_config

# 3. 应用迁移(生产环境)
npx prisma migrate deploy
```

### 3.2 验证表创建

```bash
# 连接数据库查看表结构
psql -d socialwiz -c "\d platform_publish_configs"
```

预期输出:
```
Table "public.platform_publish_configs"
Column       | Type                     | Nullable
-------------+--------------------------+----------
id           | text                     | not null
userId       | text                     | not null
platform     | text                     | not null
configName   | text                     | not null
description  | text                     |
configData   | jsonb                    | not null
isDefault    | boolean                  | not null
usageCount   | integer                  | not null
createdAt    | timestamp(3)             | not null
updatedAt    | timestamp(3)             | not null

Indexes:
  "platform_publish_configs_pkey" PRIMARY KEY (id)
  "unique_user_platform_config" UNIQUE (userId, platform, configName)
  "idx_user_platform" (userId, platform)
```

---

## 4. API 快速测试

### 4.1 启动开发服务器

```bash
npx next dev
```

服务器启动在 `http://localhost:3000`

### 4.2 获取 JWT Token

```bash
# 1. 登录获取token(假设已有用户)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# 响应:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... }
# }

# 2. 将token保存到环境变量
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 4.3 创建配置

```bash
# 创建微信公众号配置
curl -X POST http://localhost:3000/api/platforms/publish-configs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "platform": "WECHAT",
    "configName": "技术文章配置",
    "description": "用于发布技术类文章",
    "configData": {
      "type": "wechat",
      "author": "SocialWiz团队",
      "contentSourceUrl": "https://socialwiz.com",
      "needOpenComment": true,
      "onlyFansCanComment": false
    }
  }'
```

预期响应:
```json
{
  "id": "cm5a3b2c1d0e1f2g3h4i5j6k",
  "userId": "user-123",
  "platform": "WECHAT",
  "configName": "技术文章配置",
  "description": "用于发布技术类文章",
  "configData": {
    "type": "wechat",
    "author": "SocialWiz团队",
    "contentSourceUrl": "https://socialwiz.com",
    "needOpenComment": true,
    "onlyFansCanComment": false
  },
  "isDefault": false,
  "usageCount": 0,
  "createdAt": "2026-01-17T10:00:00.000Z",
  "updatedAt": "2026-01-17T10:00:00.000Z"
}
```

### 4.4 获取配置列表

```bash
# 获取所有配置
curl -X GET http://localhost:3000/api/platforms/publish-configs \
  -H "Authorization: Bearer $TOKEN"

# 获取微信平台的配置
curl -X GET "http://localhost:3000/api/platforms/publish-configs?platform=WECHAT" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.5 更新配置

```bash
# 更新配置名称
curl -X PUT http://localhost:3000/api/platforms/publish-configs/CONFIG_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "configName": "技术文章配置v2"
  }'
```

### 4.6 设为默认配置

```bash
curl -X POST http://localhost:3000/api/platforms/publish-configs/CONFIG_ID/set-default \
  -H "Authorization: Bearer $TOKEN"
```

### 4.7 删除配置

```bash
curl -X DELETE http://localhost:3000/api/platforms/publish-configs/CONFIG_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. 前端集成示例

### 5.1 在发布页面中使用配置

```typescript
// app/(dashboard)/publish/page.tsx

'use client'

import { useState, useEffect } from 'react'
import { Platform } from '@/types/platform.types'
import type { PlatformPublishConfig } from '@/types/platform-config.types'

export default function PublishPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(Platform.WECHAT)
  const [configs, setConfigs] = useState<PlatformPublishConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)

  // 1. 加载配置列表
  useEffect(() => {
    async function loadConfigs() {
      const res = await fetch(`/api/platforms/publish-configs?platform=${selectedPlatform}`)
      const data = await res.json()
      setConfigs(data.configs)
    }
    loadConfigs()
  }, [selectedPlatform])

  // 2. 选择配置后自动填充表单
  function handleConfigSelect(configId: string) {
    setSelectedConfig(configId)
    const config = configs.find(c => c.id === configId)
    if (config && config.configData.type === 'wechat') {
      // 自动填充表单字段
      setFormData({
        ...formData,
        author: config.configData.author || '',
        contentSourceUrl: config.configData.contentSourceUrl || ''
      })
    }
  }

  return (
    <div>
      <h1>发布内容</h1>
      
      {/* 配置选择器 */}
      <select onChange={(e) => handleConfigSelect(e.target.value)}>
        <option value="">不使用配置</option>
        {configs.map(config => (
          <option key={config.id} value={config.id}>
            {config.configName}
            {config.isDefault && ' (默认)'}
          </option>
        ))}
      </select>

      {/* 发布表单 */}
      <form>
        {/* ... 表单字段 */}
      </form>
    </div>
  )
}
```

### 5.2 配置管理对话框

```typescript
// components/dashboard/PlatformConfigDialog.tsx

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateConfigInputSchema } from '@/lib/validators/platform-config.validator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

export function PlatformConfigDialog({ platform, open, onOpenChange }) {
  const form = useForm({
    resolver: zodResolver(CreateConfigInputSchema),
    defaultValues: {
      platform,
      configName: '',
      description: '',
      configData: {
        type: platform.toLowerCase(),
        // 平台特定默认值
      }
    }
  })

  const onSubmit = async (data) => {
    const res = await fetch('/api/platforms/publish-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (res.ok) {
      alert('配置创建成功')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建 {platform} 配置</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="configName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>配置名称</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="例如: 技术文章配置" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>配置描述</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="描述配置用途" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 平台特定字段 */}
            {platform === 'WECHAT' && (
              <>
                <FormField
                  control={form.control}
                  name="configData.author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>作者</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="SocialWiz团队" />
                      </FormControl>
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
                        <Input {...field} type="url" placeholder="https://socialwiz.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <Button type="submit">创建配置</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 6. 服务层代码示例

### 6.1 配置管理服务

```typescript
// lib/services/platform-config.service.ts

import { prisma } from '@/lib/db/prisma'
import { Platform } from '@/types/platform.types'
import type { PlatformPublishConfig, CreateConfigInput, UpdateConfigInput } from '@/types/platform-config.types'
import { validateConfigData } from '@/lib/validators/platform-config.validator'

export class PlatformConfigService {
  /**
   * 获取用户的所有配置
   */
  static async getUserConfigs(
    userId: string,
    platform?: Platform
  ): Promise<PlatformPublishConfig[]> {
    return await prisma.platformPublishConfig.findMany({
      where: {
        userId,
        ...(platform && { platform })
      },
      orderBy: { createdAt: 'desc' }
    })
  }

  /**
   * 创建配置
   */
  static async createConfig(
    userId: string,
    input: CreateConfigInput
  ): Promise<PlatformPublishConfig> {
    // 1. 验证配置数据
    const validation = validateConfigData(input.platform, input.configData)
    if (!validation.success) {
      throw new Error(`配置数据验证失败: ${validation.error}`)
    }

    // 2. 检查配置名是否重复
    const existing = await prisma.platformPublishConfig.findUnique({
      where: {
        unique_user_platform_config: {
          userId,
          platform: input.platform,
          configName: input.configName
        }
      }
    })

    if (existing) {
      throw new Error('配置名称已存在')
    }

    // 3. 创建配置
    return await prisma.platformPublishConfig.create({
      data: {
        userId,
        platform: input.platform,
        configName: input.configName,
        description: input.description,
        configData: input.configData
      }
    })
  }

  /**
   * 更新配置
   */
  static async updateConfig(
    userId: string,
    configId: string,
    input: UpdateConfigInput
  ): Promise<PlatformPublishConfig> {
    // 1. 检查配置是否存在且属于该用户
    const config = await this.getConfigById(userId, configId)
    if (!config) {
      throw new Error('配置不存在或无权访问')
    }

    // 2. 如果更新configData,需要验证
    if (input.configData) {
      const validation = validateConfigData(config.platform, input.configData)
      if (!validation.success) {
        throw new Error(`配置数据验证失败: ${validation.error}`)
      }
    }

    // 3. 更新配置
    return await prisma.platformPublishConfig.update({
      where: { id: configId },
      data: input
    })
  }

  /**
   * 设为默认配置
   */
  static async setDefault(
    userId: string,
    configId: string
  ): Promise<PlatformPublishConfig> {
    const config = await this.getConfigById(userId, configId)
    if (!config) {
      throw new Error('配置不存在或无权访问')
    }

    // 取消该平台其他默认配置
    await prisma.platformPublishConfig.updateMany({
      where: {
        userId,
        platform: config.platform,
        isDefault: true,
        id: { not: configId }
      },
      data: { isDefault: false }
    })

    // 设置当前配置为默认
    return await prisma.platformPublishConfig.update({
      where: { id: configId },
      data: { isDefault: true }
    })
  }

  /**
   * 删除配置
   */
  static async deleteConfig(userId: string, configId: string): Promise<void> {
    const config = await this.getConfigById(userId, configId)
    if (!config) {
      throw new Error('配置不存在或无权访问')
    }

    await prisma.platformPublishConfig.delete({
      where: { id: configId }
    })
  }

  /**
   * 获取单个配置(带权限校验)
   */
  static async getConfigById(
    userId: string,
    configId: string
  ): Promise<PlatformPublishConfig | null> {
    return await prisma.platformPublishConfig.findFirst({
      where: {
        id: configId,
        userId  // 确保只能访问自己的配置
      }
    })
  }
}
```

---

## 7. 常见问题

### Q1: 如何添加新平台的配置字段?

1. 在 `types/platform-config.types.ts` 添加新平台接口
2. 在 `lib/validators/platform-config.validator.ts` 添加对应的 Zod schema
3. 在 `config/platform.config.ts` 添加平台字段定义
4. 创建平台特定的表单组件 `components/dashboard/platform-config-fields/NewPlatformConfigFields.tsx`

### Q2: 配置数据如何在发布时使用?

配置数据会在发布时作为快照存储在 `ContentPlatform` 表的JSON字段中,而不是存储配置ID引用。这样即使删除配置,历史发布记录也不受影响。

### Q3: 如何保证配置数据的类型安全?

使用三层保障:
1. **TypeScript接口** - 编译时类型检查
2. **Zod Schema** - 运行时数据验证
3. **Discriminated Unions** - 通过type字段进行类型收窄

---

## 8. 下一步

- ✅ 数据模型已设计完成 → [data-model.md](./data-model.md)
- ✅ API契约已定义完成 → [contracts/api.yaml](./contracts/api.yaml)
- 🔄 **接下来**: 运行 `/speckit.tasks` 生成任务分解,开始编码实现

---

## 9. 相关文档

- [Feature Spec](./spec.md) - 功能规格说明
- [Research](./research.md) - 技术研究和决策
- [Data Model](./data-model.md) - 详细数据模型
- [API Contracts](./contracts/api.yaml) - OpenAPI规范

---

**Last Updated**: 2026-01-17  
**Status**: Ready for implementation
