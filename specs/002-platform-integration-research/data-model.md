# Data Model: 多平台接入调研

**Feature**: 002-platform-integration-research  
**Date**: 2025-01-05

## Overview

此功能主要是文档调研工作，不涉及数据库实体。但调研结果会为后续的平台集成功能提供数据模型设计参考。

## 调研数据结构

### Platform API Research (调研文档结构)

**类型**: 文档数据结构（用于组织调研信息）

**描述**: 每个平台的API调研结果

**结构**:
- **平台名称**: 微信公众号/微博/抖音/小红书
- **官方文档**: 文档URL和版本信息
- **认证方式**: OAuth流程、Token管理
- **API能力**: 
  - 内容发布接口
  - 数据获取接口
  - 用户管理接口
  - 其他功能接口
- **限制条件**: 
  - API调用频率限制
  - 内容格式限制
  - 权限要求
- **开发者要求**: 认证流程、申请要求

### Platform Comparison (对比分析结构)

**类型**: 对比分析文档

**描述**: 各平台API能力的多维度对比

**对比维度**:
- **认证方式**: OAuth版本、Token类型、刷新机制
- **发布接口**: 支持的内容类型、参数格式、响应格式
- **数据接口**: 可获取的数据类型、接口格式
- **限制条件**: 频率限制、内容限制、权限限制
- **开发者要求**: 认证难度、申请流程、费用

### Integration Architecture (技术方案结构)

**类型**: 技术架构文档

**描述**: 统一的多平台集成技术方案

**架构组件**:
- **统一接口层**: 定义统一的API接口规范
- **平台适配器**: 各平台的适配器实现
- **认证管理器**: 统一的OAuth流程处理
- **错误处理器**: 统一的错误处理和重试机制
- **Token管理器**: 统一的Token存储和刷新

## 后续数据模型参考

调研完成后，平台集成功能将需要以下数据模型（参考现有设计文档）：

### PlatformAccount (平台账号)

**位置**: `prisma/schema.prisma` (已存在)

**字段**:
- `platform`: 平台类型（WECHAT/WEIBO/DOUYIN/XIAOHONGSHU）
- `accessToken`: 访问令牌（加密存储）
- `refreshToken`: 刷新令牌（加密存储）
- `tokenExpiry`: 令牌过期时间
- `isConnected`: 是否已连接

### Platform Integration Service (平台集成服务)

**位置**: `lib/services/platform.service.ts` (待创建)

**功能**:
- 统一的平台接口调用
- OAuth流程处理
- Token管理和刷新
- 错误处理和重试

### Platform Adapters (平台适配器)

**位置**: `lib/integrations/{platform}/` (待创建)

**结构**:
- `wechat/adapter.ts` - 微信公众号适配器
- `weibo/adapter.ts` - 微博适配器
- `douyin/adapter.ts` - 抖音适配器
- `xiaohongshu/adapter.ts` - 小红书适配器

## 文档输出结构

### 调研报告文档

```
docs/platform-integration/research/
├── wechat-api-research.md
├── weibo-api-research.md
├── douyin-api-research.md
└── xiaohongshu-api-research.md
```

### 对比分析文档

```
docs/platform-integration/comparison/
└── platform-api-comparison.md
```

### 技术方案文档

```
docs/platform-integration/technical-plan/
└── integration-architecture.md
```

## Dependencies

- **现有数据模型**: PlatformAccount (prisma/schema.prisma)
- **现有服务**: AuthService (lib/services/auth.service.ts) - 用于参考认证流程
- **文档模板**: 需要创建统一的文档模板

## 验证规则

1. **调研完整性**: 每个平台必须包含所有必需信息
2. **文档准确性**: 信息必须基于官方文档，标注验证状态
3. **对比有效性**: 对比分析必须覆盖所有关键维度
4. **方案可行性**: 技术方案必须考虑实际开发可行性
