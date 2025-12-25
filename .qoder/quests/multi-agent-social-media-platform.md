# 多智能体社交媒体统一管理平台设计文档

## 项目概述

### 项目背景
在当今社交媒体营销环境中,运营人员需要同时管理多个平台账号(微信公众号、微博、抖音、小红书等),面临内容创作效率低、多平台发布繁琐、数据分析分散等痛点。本项目旨在构建一个集成多种国产AI大模型的社交媒体统一管理平台,实现智能化内容创作、一键多平台发布、全方位数据分析的完整解决方案。

### 核心价值
- 统一管理多个社交媒体平台账号,降低操作复杂度
- 集成多种AI大模型,提供智能化内容创作能力
- 自动化内容分发,提升发布效率
- 集中式数据分析,提供全局运营洞察

### 技术栈选型

#### 前端技术栈
- Next.js 14 (App Router) - 服务端渲染和路由管理
- React 18 - UI组件库
- TypeScript - 类型安全
- Tailwind CSS - 原子化CSS框架
- Stylus (CSS Modules) - 组件级复杂样式
- Zustand - 轻量级状态管理
- Ant Design Icons - 图标库
- Swiper - 轮播组件
- ECharts - 数据可视化图表
- React Hook Form + Zod - 表单处理和校验

#### 后端技术栈
- Next.js API Routes / Server Actions - 服务端接口
- Prisma - ORM数据库操作
- PostgreSQL - 主数据库
- Redis - 缓存和会话管理
- Bull - 任务队列(定时发布)

#### AI集成方案
- OpenAI SDK 兼容接口 - 统一AI调用接口
- 支持模型:
  - DeepSeek V3 - 文本生成
  - Qwen (通义千问) - 文本生成
  - DALL-E / Stable Diffusion - 图片生成
- 流式响应支持 - 提升用户体验

#### 第三方平台集成
- 微信公众号 API
- 微博开放平台 API
- 抖音开放平台 API
- 小红书开放平台 API
- OAuth 2.0 认证流程

## 系统架构设计

### 整体架构

```mermaid
graph TB
    subgraph 客户端层
        A[Web前端 Next.js]
    end
    
    subgraph API网关层
        B[Next.js API Routes]
        C[Server Actions]
    end
    
    subgraph 业务服务层
        D[用户管理服务]
        E[平台账号服务]
        F[内容管理服务]
        G[AI生成服务]
        H[发布服务]
        I[数据分析服务]
    end
    
    subgraph AI服务层
        J[AI模型路由器]
        K[DeepSeek API]
        L[Qwen API]
        M[图片生成API]
    end
    
    subgraph 社交平台层
        N[微信公众号API]
        O[微博API]
        P[抖音API]
        Q[小红书API]
    end
    
    subgraph 数据层
        R[(PostgreSQL)]
        S[(Redis)]
    end
    
    subgraph 任务队列
        T[Bull Queue]
    end
    
    A --> B
    A --> C
    B --> D
    B --> E
    B --> F
    C --> F
    C --> H
    F --> G
    G --> J
    J --> K
    J --> L
    J --> M
    H --> N
    H --> O
    H --> P
    H --> Q
    H --> T
    T --> N
    T --> O
    T --> P
    T --> Q
    D --> R
    E --> R
    F --> R
    I --> R
    D --> S
    E --> S
    I --> N
    I --> O
    I --> P
    I --> Q
```

### 项目目录结构

```
socialWiz/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 认证路由组
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/              # 主应用路由组
│   │   │   ├── layout.tsx            # 主布局(包含顶部导航、侧边栏)
│   │   │   ├── page.tsx              # 首页 - 数据概览
│   │   │   ├── publish/
│   │   │   │   └── page.tsx          # 内容发布页
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx          # 数据分析页
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx          # 日程管理页
│   │   │   └── settings/
│   │   │       └── page.tsx          # 账户设置页
│   │   ├── api/                      # API路由
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── callback/         # OAuth回调
│   │   │   ├── platforms/            # 平台账号管理
│   │   │   ├── content/              # 内容CRUD
│   │   │   ├── ai/                   # AI生成接口
│   │   │   ├── publish/              # 发布接口
│   │   │   └── analytics/            # 数据分析接口
│   │   ├── layout.tsx                # 根布局
│   │   └── globals.css               # 全局样式
│   ├── components/                   # React组件
│   │   ├── common/                   # 通用组件
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── Card/
│   │   ├── layout/                   # 布局组件
│   │   │   ├── Header/
│   │   │   ├── Sidebar/
│   │   │   └── TabNav/
│   │   ├── dashboard/                # 首页组件
│   │   │   ├── StatsCard/
│   │   │   └── ContentGrid/
│   │   ├── publish/                  # 发布页组件
│   │   │   ├── AIWritingPanel/
│   │   │   ├── ContentEditor/
│   │   │   └── PlatformSelector/
│   │   ├── analytics/                # 分析页组件
│   │   │   ├── MetricsCard/
│   │   │   ├── TrendChart/
│   │   │   └── PlatformComparison/
│   │   └── settings/                 # 设置页组件
│   │       ├── ProfileForm/
│   │       └── PlatformBinding/
│   ├── lib/                          # 核心逻辑库
│   │   ├── services/                 # 业务服务
│   │   │   ├── auth.service.ts
│   │   │   ├── platform.service.ts
│   │   │   ├── content.service.ts
│   │   │   ├── ai.service.ts
│   │   │   ├── publish.service.ts
│   │   │   └── analytics.service.ts
│   │   ├── integrations/             # 第三方集成
│   │   │   ├── wechat/
│   │   │   ├── weibo/
│   │   │   ├── douyin/
│   │   │   └── xiaohongshu/
│   │   ├── ai/                       # AI集成
│   │   │   ├── model-router.ts       # AI模型路由
│   │   │   ├── deepseek.ts
│   │   │   ├── qwen.ts
│   │   │   └── image-gen.ts
│   │   ├── queue/                    # 任务队列
│   │   │   └── publish-queue.ts
│   │   ├── db/                       # 数据库
│   │   │   ├── prisma.ts
│   │   │   └── redis.ts
│   │   └── utils/                    # 工具函数
│   │       ├── validation.ts
│   │       ├── date.ts
│   │       └── format.ts
│   ├── stores/                       # Zustand状态管理
│   │   ├── user.store.ts
│   │   ├── platform.store.ts
│   │   ├── content.store.ts
│   │   └── analytics.store.ts
│   ├── types/                        # TypeScript类型定义
│   │   ├── user.types.ts
│   │   ├── platform.types.ts
│   │   ├── content.types.ts
│   │   └── analytics.types.ts
│   └── config/                       # 配置文件
│       ├── ai.config.ts
│       ├── platform.config.ts
│       └── app.config.ts
├── prisma/                           # Prisma数据库
│   ├── schema.prisma
│   └── migrations/
├── public/                           # 静态资源
├── .env.local                        # 环境变量
├── next.config.js                    # Next.js配置
├── tailwind.config.js                # Tailwind配置
├── tsconfig.json                     # TypeScript配置
└── package.json                      # 项目依赖
```

## 数据库设计

### 核心数据模型

#### 用户表 (User)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 用户唯一标识 | 主键, UUID |
| email | String | 邮箱 | 唯一, 必填 |
| password | String | 密码哈希 | 必填 |
| name | String | 用户名 | 必填 |
| avatar | String | 头像URL | 可选 |
| createdAt | DateTime | 创建时间 | 自动生成 |
| updatedAt | DateTime | 更新时间 | 自动更新 |

#### 平台账号表 (PlatformAccount)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 账号唯一标识 | 主键, UUID |
| userId | String | 关联用户ID | 外键 |
| platform | Enum | 平台类型 | WECHAT/WEIBO/DOUYIN/XIAOHONGSHU |
| platformUserId | String | 平台用户ID | 必填 |
| platformUsername | String | 平台用户名 | 必填 |
| accessToken | String | 访问令牌(加密) | 必填 |
| refreshToken | String | 刷新令牌(加密) | 可选 |
| tokenExpiry | DateTime | 令牌过期时间 | 可选 |
| isConnected | Boolean | 是否已连接 | 默认true |
| createdAt | DateTime | 创建时间 | 自动生成 |
| updatedAt | DateTime | 更新时间 | 自动更新 |

#### 内容表 (Content)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 内容唯一标识 | 主键, UUID |
| userId | String | 创建者ID | 外键 |
| title | String | 标题 | 必填 |
| content | Text | 内容正文 | 必填 |
| coverImage | String | 封面图URL | 可选 |
| images | String[] | 配图URL数组 | 可选 |
| status | Enum | 状态 | DRAFT/SCHEDULED/PUBLISHED/FAILED |
| aiGenerated | Boolean | 是否AI生成 | 默认false |
| aiModel | String | 使用的AI模型 | 可选 |
| scheduledAt | DateTime | 定时发布时间 | 可选 |
| publishedAt | DateTime | 实际发布时间 | 可选 |
| createdAt | DateTime | 创建时间 | 自动生成 |
| updatedAt | DateTime | 更新时间 | 自动更新 |

#### 内容平台关联表 (ContentPlatform)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 唯一标识 | 主键, UUID |
| contentId | String | 内容ID | 外键 |
| platformAccountId | String | 平台账号ID | 外键 |
| platformContentId | String | 平台内容ID | 可选 |
| publishStatus | Enum | 发布状态 | PENDING/SUCCESS/FAILED |
| errorMessage | String | 错误信息 | 可选 |
| publishedUrl | String | 发布后的URL | 可选 |
| createdAt | DateTime | 创建时间 | 自动生成 |

#### 数据分析表 (Analytics)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 唯一标识 | 主键, UUID |
| contentPlatformId | String | 内容平台关联ID | 外键 |
| platformAccountId | String | 平台账号ID | 外键 |
| date | DateTime | 统计日期 | 必填 |
| views | Int | 浏览量 | 默认0 |
| likes | Int | 点赞数 | 默认0 |
| comments | Int | 评论数 | 默认0 |
| shares | Int | 转发数 | 默认0 |
| followers | Int | 粉丝数 | 默认0 |
| engagementRate | Float | 互动率 | 默认0 |
| createdAt | DateTime | 创建时间 | 自动生成 |

#### AI生成记录表 (AIGenerationLog)

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | String | 唯一标识 | 主键, UUID |
| userId | String | 用户ID | 外键 |
| model | String | AI模型 | 必填 |
| prompt | Text | 提示词 | 必填 |
| generatedContent | Text | 生成内容 | 必填 |
| type | Enum | 生成类型 | TEXT/IMAGE |
| tokensUsed | Int | 消耗Token数 | 可选 |
| duration | Int | 生成耗时(ms) | 可选 |
| createdAt | DateTime | 创建时间 | 自动生成 |

### 数据关系图

```mermaid
erDiagram
    User ||--o{ PlatformAccount : "拥有"
    User ||--o{ Content : "创建"
    User ||--o{ AIGenerationLog : "产生"
    Content ||--o{ ContentPlatform : "发布到"
    PlatformAccount ||--o{ ContentPlatform : "接收"
    PlatformAccount ||--o{ Analytics : "统计"
    ContentPlatform ||--o| Analytics : "对应"
    
    User {
        String id PK
        String email
        String password
        String name
        String avatar
        DateTime createdAt
        DateTime updatedAt
    }
    
    PlatformAccount {
        String id PK
        String userId FK
        Enum platform
        String platformUserId
        String platformUsername
        String accessToken
        String refreshToken
        DateTime tokenExpiry
        Boolean isConnected
        DateTime createdAt
        DateTime updatedAt
    }
    
    Content {
        String id PK
        String userId FK
        String title
        Text content
        String coverImage
        String[] images
        Enum status
        Boolean aiGenerated
        String aiModel
        DateTime scheduledAt
        DateTime publishedAt
        DateTime createdAt
        DateTime updatedAt
    }
    
    ContentPlatform {
        String id PK
        String contentId FK
        String platformAccountId FK
        String platformContentId
        Enum publishStatus
        String errorMessage
        String publishedUrl
        DateTime createdAt
    }
    
    Analytics {
        String id PK
        String contentPlatformId FK
        String platformAccountId FK
        DateTime date
        Int views
        Int likes
        Int comments
        Int shares
        Int followers
        Float engagementRate
        DateTime createdAt
    }
    
    AIGenerationLog {
        String id PK
        String userId FK
        String model
        Text prompt
        Text generatedContent
        Enum type
        Int tokensUsed
        Int duration
        DateTime createdAt
    }
```

## 核心功能设计

### 1. 用户管理模块

#### 1.1 用户注册

**流程描述**
1. 用户填写注册表单(邮箱、密码、用户名)
2. 前端进行表单校验(React Hook Form + Zod)
3. 提交到服务端Server Action
4. 服务端校验邮箱唯一性
5. 密码使用bcrypt进行哈希加密
6. 创建用户记录到数据库
7. 返回注册成功,自动登录

**数据校验规则**

| 字段 | 规则 |
|------|------|
| 邮箱 | 必填、格式正确、数据库唯一 |
| 密码 | 必填、最少8位、包含大小写字母和数字 |
| 用户名 | 必填、2-20字符 |

**安全措施**
- 密码使用bcrypt加密存储
- 邮箱唯一性检查
- 注册频率限制(Rate Limiting)
- CSRF保护

#### 1.2 用户登录

**流程描述**
1. 用户输入邮箱和密码
2. 前端表单校验
3. 提交到认证API
4. 服务端查询用户并验证密码
5. 验证成功后生成JWT Token
6. Token存储在HttpOnly Cookie中
7. 返回用户信息并跳转到首页

**会话管理**
- 使用JWT Token进行会话管理
- Token存储在HttpOnly Cookie中(防止XSS攻击)
- 设置合理的过期时间(7天)
- 支持刷新Token机制
- Redis存储活跃会话列表

**安全措施**
- 密码错误次数限制(5次锁定账号30分钟)
- 登录日志记录(IP地址、设备信息)
- 双因素认证(可选功能)

#### 1.3 用户信息管理

**可编辑字段**
- 用户名
- 头像(上传到云存储服务)
- 个人简介
- 通知偏好设置

**头像上传流程**
1. 前端选择图片文件
2. 客户端进行图片压缩和裁剪
3. 上传到对象存储服务(如阿里云OSS)
4. 获取图片URL并更新用户信息

#### 1.4 平台账号管理

**支持平台**
- 微信公众号
- 微博
- 抖音
- 小红书

**OAuth授权流程**

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant B as 后端
    participant P as 社交平台
    
    U->>F: 点击绑定平台按钮
    F->>B: 请求OAuth授权URL
    B->>B: 生成state参数(防CSRF)
    B->>F: 返回授权URL
    F->>P: 重定向到平台授权页
    U->>P: 确认授权
    P->>B: 回调带code和state
    B->>B: 验证state参数
    B->>P: 使用code换取access_token
    P->>B: 返回access_token和用户信息
    B->>B: 加密存储token
    B->>B: 创建PlatformAccount记录
    B->>F: 重定向回前端并提示成功
    F->>U: 显示绑定成功
```

**平台账号管理功能**
- 添加平台账号(OAuth授权)
- 删除平台账号(解绑)
- 查看平台账号状态(已连接/已失效)
- 重新授权(Token过期时)
- 批量授权管理

**Token管理策略**
- Token加密存储在数据库中
- 定期检查Token有效性
- Token过期前自动刷新(使用refresh_token)
- Token失效时提示用户重新授权

### 2. 内容发布模块

#### 2.1 内容编辑器

**编辑器功能**
- 富文本编辑(支持Markdown或所见即所得)
- 标题和正文输入
- 图片上传和管理
  - 支持拖拽上传
  - 支持粘贴上传
  - 图片压缩和格式转换
  - 图片裁剪和编辑
- 话题标签添加(支持热门话题推荐)
- 实时字数统计
- 自动草稿保存(每30秒)

**内容草稿管理**
- 自动保存草稿到本地LocalStorage
- 定期同步到服务器(每2分钟)
- 草稿列表展示
- 草稿删除和恢复
- 草稿搜索和筛选

#### 2.2 AI内容生成

**AI写作助手功能**

**文本生成流程**
1. 用户选择内容模板或输入提示词
2. 选择AI模型(DeepSeek/Qwen)
3. 配置生成参数(语气、长度、风格)
4. 提交生成请求到AI服务
5. 流式返回生成内容(SSE或WebSocket)
6. 用户可选择使用生成内容或继续优化

**预设写作模板**

| 模板名称 | 适用场景 | 提示词示例 |
|----------|----------|------------|
| 产品推广 | 新品发布、促销活动 | 突出产品特点和优势,吸引用户购买 |
| 活动宣传 | 线上/线下活动 | 强调活动亮点,引导用户参与 |
| 节日祝福 | 节日营销 | 温馨祝福,传递品牌温度 |
| 知识分享 | 专业内容输出 | 深入浅出,提供实用干货 |
| 用户故事 | 案例展示 | 真实案例,情感共鸣 |
| 行业资讯 | 新闻快讯 | 客观报道,快速传递信息 |

**图片生成功能**
1. 用户输入图片描述
2. 选择图片风格(写实、插画、抽象等)
3. 选择图片尺寸(适配不同平台)
4. 提交到图片生成API
5. 生成多个候选图片供选择
6. 图片自动上传到对象存储

**AI模型路由策略**
- 支持在应用内切换不同AI模型
- 根据任务类型智能推荐模型
  - 营销文案: DeepSeek(创意性强)
  - 专业知识: Qwen(准确性高)
- 模型性能和成本监控
- 支持自定义模型API Key
- 模型调用失败时自动降级

**生成内容优化**
- AI生成内容可编辑修改
- 支持重新生成
- 支持继续生成(追加内容)
- 支持风格调整(正式/活泼/专业)
- 生成历史记录保存

#### 2.3 平台选择与适配

**多平台选择**
- 复选框选择发布平台
- 显示各平台连接状态
- 未连接平台提示授权
- 支持全选/反选

**平台内容适配规则**

| 平台 | 字数限制 | 图片数量 | 特殊要求 |
|------|----------|----------|----------|
| 微信公众号 | 无限制 | 无限制 | 支持富文本、需封面图 |
| 微博 | 2000字 | 9张 | 支持话题标签、@用户 |
| 抖音 | 2000字 | 9张 | 需视频或图片、支持定位 |
| 小红书 | 1000字 | 9张 | 必须有图片、支持话题 |

**智能适配功能**
- 根据平台规则自动截断或警告超长内容
- 图片数量超限时提示选择
- 微信公众号自动提取首图作为封面
- 话题标签格式自动转换
- 平台禁用词检测和提示

#### 2.4 发布策略

**立即发布**
1. 验证内容完整性
2. 验证选择的平台账号有效性
3. 并发调用各平台发布API
4. 实时返回发布状态
5. 记录发布结果和内容URL

**定时发布**
1. 用户设置发布时间
2. 内容保存为SCHEDULED状态
3. 任务添加到Bull队列
4. 定时任务到期时执行发布
5. 发布完成后更新状态并通知用户

**发布任务队列设计**
- 使用Bull队列管理定时任务
- 支持任务优先级
- 任务失败自动重试(最多3次)
- 重试间隔:1分钟、5分钟、15分钟
- 任务执行日志记录

**发布状态跟踪**

```mermaid
stateDiagram-v2
    [*] --> DRAFT: 创建内容
    DRAFT --> SCHEDULED: 设置定时发布
    DRAFT --> PUBLISHING: 立即发布
    SCHEDULED --> PUBLISHING: 定时触发
    PUBLISHING --> PUBLISHED: 全部成功
    PUBLISHING --> PARTIAL_SUCCESS: 部分成功
    PUBLISHING --> FAILED: 全部失败
    PARTIAL_SUCCESS --> RETRY: 重试失败项
    FAILED --> RETRY: 重试
    RETRY --> PUBLISHED: 成功
    RETRY --> FAILED: 仍然失败
    PUBLISHED --> [*]
    FAILED --> [*]
```

**发布失败处理**
- 记录详细错误信息
- 按平台分别显示失败原因
- 支持重新发布失败项
- 常见失败原因:
  - Token过期 → 提示重新授权
  - 内容违规 → 显示平台审核意见
  - 网络超时 → 自动重试
  - 频率限制 → 延迟重试

#### 2.5 内容管理

**内容列表展示**
- 瀑布流布局展示已发布内容
- 按平台筛选
- 按发布状态筛选(草稿/已发布/定时发布)
- 按发布时间排序
- 内容搜索(标题/正文关键词)

**单个内容卡片信息**
- 内容标题和预览
- 发布的平台图标
- 发布时间
- 关键数据指标(浏览量、点赞、评论)
- 操作按钮(查看详情、编辑、删除)

**内容详情页**
- 完整内容展示
- 各平台发布状态
- 各平台数据统计
- 跳转到原始链接
- 内容编辑和重新发布

### 3. 数据分析模块

#### 3.1 数据采集

**数据同步策略**
- 定时任务每小时同步一次最新数据
- 调用各平台数据统计API
- 数据存储到Analytics表
- 增量更新,减少API调用次数

**采集指标**

| 指标类型 | 具体指标 | 说明 |
|----------|----------|------|
| 内容指标 | 浏览量、点赞数、评论数、转发数 | 单条内容表现 |
| 账号指标 | 粉丝数、粉丝增长、总浏览量 | 账号整体表现 |
| 互动指标 | 互动率、平均互动时长 | 用户参与度 |
| 转化指标 | 点击量、转化率 | 营销效果 |

**数据缓存策略**
- 实时数据缓存1小时(Redis)
- 历史汇总数据缓存24小时
- 用户查询时优先读取缓存
- 缓存失效时异步更新

#### 3.2 数据可视化

**关键指标卡片**
- 4个核心指标卡片:总粉丝数、互动增长率、内容发布量、转化率
- 显示数值和环比变化
- 使用颜色区分增长/下降(绿色/红色)
- 迷你图表展示趋势

**流量趋势图表**
- 使用ECharts渲染交互式图表
- 支持多种图表类型切换:
  - 折线图:趋势分析
  - 柱状图:数据对比
  - 面积图:累积效果
  - 饼图:占比分析
- 时间维度选择:7天、30天、90天
- 支持多指标叠加显示
- 图表交互:悬停查看详情、缩放、下载

**平台对比分析**
- 并排展示各平台关键指标
- 柱状图对比浏览量、互动率
- 雷达图展示多维度表现
- 识别表现最好/最差的平台

**内容排行榜**
- 按浏览量排序的Top10内容
- 按互动率排序的Top10内容
- 显示内容标题、平台、数据
- 点击查看内容详情

#### 3.3 AI智能分析

**一键AI分析功能**
1. 用户点击"AI一键分析"按钮
2. 系统收集选定时间段的全部数据
3. 构建数据分析提示词
4. 调用AI模型进行分析
5. 流式返回分析结果
6. 展示分析报告

**AI分析维度**
- 数据趋势分析:识别上升/下降趋势
- 异常检测:发现数据异常波动
- 平台对比:分析各平台表现差异
- 内容洞察:识别高表现内容特征
- 优化建议:提供可执行的改进方案

**分析提示词模板**
```
分析以下社交媒体数据,提供专业的运营洞察:

时间范围: [日期范围]
平台数据:
- 微信: 粉丝[数量],浏览量[数量],互动率[百分比]
- 微博: 粉丝[数量],浏览量[数量],互动率[百分比]
...

请从以下角度分析:
1. 整体趋势判断
2. 各平台表现对比
3. 异常数据说明
4. 优化建议(具体可执行)

要求:
- 结论基于数据支撑
- 建议具体可落地
- 语言简洁专业
```

**分析结果展示**
- Markdown格式渲染
- 关键数据高亮显示
- 支持导出分析报告(PDF/Word)
- 历史分析记录保存

#### 3.4 数据导出

**导出功能**
- 导出格式:Excel、CSV、PDF
- 导出内容:
  - 原始数据表格
  - 图表截图
  - AI分析报告
- 导出时间范围自定义
- 导出平台选择

### 4. 日程管理模块

#### 4.1 日历视图

**日历展示**
- 月视图:显示整月的定时发布安排
- 周视图:显示本周详细计划
- 日视图:显示单日所有任务
- 今日高亮显示
- 已发布内容标记为灰色

**日历单元格信息**
- 日期数字
- 当日计划数量
- 计划内容标题(截断显示)
- 计划状态颜色标识
  - 蓝色:即将发布(24小时内)
  - 绿色:待发布
  - 灰色:已发布
  - 红色:发布失败

#### 4.2 发布计划列表

**列表展示字段**
- 内容标题
- 目标平台
- 计划发布时间
- 当前状态
- 操作按钮(编辑、删除、立即发布)

**列表操作**
- 按时间排序
- 按平台筛选
- 按状态筛选
- 批量操作(批量删除、批量修改时间)

#### 4.3 快速排期

**拖拽排期功能**
- 从草稿箱拖拽内容到日历
- 自动设置为定时发布
- 拖拽调整发布时间
- 支持批量排期

**智能排期建议**
- 基于历史数据分析最佳发布时间
- 考虑平台用户活跃时段
- 避免发布时间过于集中
- AI生成排期方案

### 5. 多AI模型集成

#### 5.1 AI模型配置

**支持的AI模型**

| 模型名称 | 提供商 | 用途 | 特点 |
|----------|--------|------|------|
| DeepSeek V3 | DeepSeek | 文本生成 | 创意性强、推理能力优秀 |
| Qwen (通义千问) | 阿里云 | 文本生成 | 中文理解好、知识库丰富 |
| DALL-E 3 | OpenAI | 图片生成 | 图像质量高、理解准确 |
| Stable Diffusion | Stability AI | 图片生成 | 开源免费、风格多样 |

**模型配置方式**
- 用户在设置页面配置API Key
- 每个模型单独配置
- 支持自定义API端点(适配国内镜像)
- 测试连接验证配置正确性

**模型参数配置**
- Temperature:控制创意度(0-1)
- Max Tokens:最大生成长度
- Top P:采样策略
- Frequency Penalty:重复惩罚
- Presence Penalty:多样性惩罚

#### 5.2 模型路由器设计

**智能路由策略**

```mermaid
graph TD
    A[AI生成请求] --> B{任务类型判断}
    B -->|文本生成| C{内容类型}
    B -->|图片生成| D{用户偏好}
    C -->|营销文案| E[DeepSeek]
    C -->|专业知识| F[Qwen]
    C -->|用户自选| G[指定模型]
    D -->|高质量| H[DALL-E 3]
    D -->|快速生成| I[Stable Diffusion]
    E --> J[执行生成]
    F --> J
    G --> J
    H --> J
    I --> J
    J --> K{生成成功?}
    K -->|是| L[返回结果]
    K -->|否| M{重试次数<3}
    M -->|是| N[降级到备用模型]
    M -->|否| O[返回错误]
    N --> J
```

**模型调用封装**
- 统一的AI服务接口
- 屏蔽不同模型API差异
- 自动处理流式响应
- 错误处理和重试机制
- 调用日志记录

**模型性能监控**
- 记录每次调用的响应时间
- 记录Token消耗量
- 统计成功率和失败率
- 成本分析(按模型统计)
- 性能报表展示

#### 5.3 成本控制

**用量限制**
- 单用户每日调用次数限制
- 单次生成Token上限
- 月度总消耗限额
- 超限后禁止调用或降级服务

**成本优化策略**
- 缓存常见提示词的生成结果
- 对相似请求去重
- 低峰时段批量生成优惠
- 鼓励用户使用成本更低的模型

## 安全性设计

### 1. 身份认证与授权

**JWT Token管理**
- Token包含用户ID、角色、过期时间
- Token签名使用环境变量中的密钥
- HttpOnly Cookie防止XSS攻击
- CSRF Token防护

**权限控制**
- 基于用户ID的资源隔离
- 用户只能访问自己的数据
- API路由中间件验证Token
- Server Actions自动注入用户上下文

### 2. 数据安全

**敏感数据加密**
- 平台账号的access_token使用AES加密存储
- 用户密码使用bcrypt哈希
- 环境变量存储加密密钥
- 传输层使用HTTPS

**SQL注入防护**
- 使用Prisma ORM防止SQL注入
- 参数化查询
- 输入验证和清洗

**XSS防护**
- React自动转义输出
- 用户生成内容使用DOMPurify清洗
- CSP(内容安全策略)配置

### 3. 第三方平台安全

**OAuth安全实践**
- 使用state参数防CSRF
- PKCE增强授权码流程
- Token加密存储
- 及时刷新过期Token

**API调用安全**
- 限制API调用频率(Rate Limiting)
- 重试策略防止雪崩
- 敏感操作二次确认
- 异常流量监控

### 4. 内容安全

**内容审核**
- 接入第三方内容审核API
- 识别违禁词和敏感内容
- 发布前预审核
- 审核不通过时提示修改

**数据备份**
- 数据库每日自动备份
- 重要操作记录日志
- 支持内容恢复

## 性能优化

### 1. 前端性能

**Next.js优化**
- 使用Server Components减少客户端JS
- 动态导入非关键组件
- 图片使用next/image自动优化
- 路由预加载(Link prefetch)

**代码分割**
- 按路由自动分割
- 第三方库按需加载
- 组件级代码分割

**缓存策略**
- 静态资源CDN加速
- API响应缓存(SWR策略)
- LocalStorage缓存用户偏好

### 2. 后端性能

**数据库优化**
- 关键字段建立索引
  - User.email
  - PlatformAccount.userId
  - Content.userId + status
  - Analytics.platformAccountId + date
- 使用数据库连接池
- 避免N+1查询(Prisma include优化)
- 分页查询大数据集

**缓存策略**
- Redis缓存热点数据
  - 用户信息(5分钟)
  - 平台账号列表(10分钟)
  - 数据分析结果(1小时)
- 缓存穿透保护(Null值缓存)
- 缓存雪崩保护(过期时间加随机偏移)

**异步处理**
- 定时发布使用任务队列
- 数据同步异步执行
- 图片上传异步处理
- AI生成异步响应(SSE)

### 3. AI服务优化

**流式响应**
- AI文本生成使用Server-Sent Events
- 边生成边展示,提升体验
- 支持生成过程中断

**并发控制**
- 限制同时进行的AI调用数量
- 排队机制(超过限制时排队)
- 优先级队列(付费用户优先)

## 部署方案

### 开发环境

**本地开发配置**
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- pnpm包管理器

**环境变量配置**
```
DATABASE_URL=postgresql://user:password@localhost:5432/socialwiz
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key

# AI模型API密钥
DEEPSEEK_API_KEY=your-deepseek-key
QWEN_API_KEY=your-qwen-key
OPENAI_API_KEY=your-openai-key

# 社交平台配置
WECHAT_APP_ID=your-wechat-appid
WECHAT_APP_SECRET=your-wechat-secret
WEIBO_APP_KEY=your-weibo-key
WEIBO_APP_SECRET=your-weibo-secret
DOUYIN_CLIENT_KEY=your-douyin-key
DOUYIN_CLIENT_SECRET=your-douyin-secret
XIAOHONGSHU_APP_ID=your-xiaohongshu-id
XIAOHONGSHU_APP_SECRET=your-xiaohongshu-secret

# 对象存储配置
OSS_ACCESS_KEY=your-oss-key
OSS_SECRET_KEY=your-oss-secret
OSS_BUCKET=your-bucket-name
OSS_REGION=your-region
```

### 生产环境部署

**推荐部署平台**
- Vercel(前端和API Routes)
- 阿里云/腾讯云(数据库、Redis、对象存储)
- Docker容器化部署(可选)

**部署架构**
```
用户 --> CDN(静态资源) --> Vercel(Next.js应用)
                              ↓
                          数据库(PostgreSQL)
                              ↓
                          缓存(Redis)
                              ↓
                        对象存储(OSS)
```

**CI/CD流程**
1. 代码提交到Git仓库
2. 自动运行测试
3. 构建Docker镜像(可选)
4. 自动部署到Vercel或服务器
5. 数据库迁移自动执行
6. 部署完成通知

### 监控与日志

**应用监控**
- 错误追踪(Sentry)
- 性能监控(Vercel Analytics)
- 日志聚合(CloudWatch/阿里云日志)

**关键指标监控**
- API响应时间
- 数据库连接数
- Redis内存使用
- AI调用成功率
- 第三方平台API可用性

## 用户界面设计

### 页面结构

#### 全局布局
- 顶部导航栏:LOGO、通知、用户头像、设置
- 标签式导航:首页、内容发布、数据分析、日程管理、账户设置
- 左侧边栏:平台管理、快捷操作
- 主内容区:根据当前页面动态渲染
- 右侧边栏:热门话题、草稿箱、快速操作

#### 响应式设计
- 移动端(< 768px):隐藏侧边栏,使用抽屉菜单
- 平板端(768px - 1024px):左侧边栏缩小,右侧边栏隐藏
- 桌面端(> 1024px):完整三栏布局

### 组件设计规范

**设计原则**
- 遵循Material Design设计语言
- 保持组件一致性和可复用性
- 无障碍访问支持(ARIA属性)
- 深色模式支持(可选)

**颜色规范**
- 主色调:蓝色(#3B82F6)
- 成功:绿色(#10B981)
- 警告:黄色(#F59E0B)
- 错误:红色(#EF4444)
- 灰度:Tailwind默认灰度

**组件库**
- 基于Shadcn UI和Radix UI构建
- 自定义组件使用Tailwind + Stylus混合方案
- 复杂交互组件使用Stylus模块化样式

### 用户体验优化

**加载状态**
- Skeleton屏显示加载占位符
- 按钮点击后显示loading状态
- 长时间操作显示进度条

**错误处理**
- 友好的错误提示信息
- 提供解决方案建议
- 错误边界捕获组件崩溃

**空状态设计**
- 首次使用引导
- 空列表提示和引导操作
- 插图 + 文案提升体验

**通知系统**
- Toast消息提示(成功/错误/警告)
- 浏览器通知(定时发布完成)
- 站内消息中心

## 测试策略

### 单元测试
- 使用Jest + React Testing Library
- 覆盖关键业务逻辑函数
- 覆盖React组件交互
- 目标覆盖率:80%

### 集成测试
- 测试API端点
- 测试数据库操作
- 测试第三方服务集成

### E2E测试
- 使用Playwright
- 覆盖核心用户流程:
  - 注册登录流程
  - 平台授权流程
  - 内容发布流程
  - AI生成流程

## 后续扩展方向

### 功能扩展
- 团队协作功能(多用户管理同一账号)
- 内容素材库(图片、模板复用)
- 评论管理(集中回复各平台评论)
- 竞品分析(监控竞争对手内容)
- 营销活动管理(活动策划和效果追踪)

### 技术扩展
- 移动端App(React Native)
- 浏览器插件(快速发布)
- AI训练(基于用户历史内容微调模型)
- 更多平台接入(LinkedIn、Facebook等)

### 商业化扩展
- 免费版 + 付费高级版
- 按AI调用量计费
- 企业定制化部署
- API开放平台
