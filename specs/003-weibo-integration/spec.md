# Feature Specification: 微博平台接入

**Feature Branch**: `003-weibo-integration`  
**Created**: 2025-01-13  
**Last Updated**: 2026-01-17  
**Status**: 🟡 Development In Progress (核心功能已完成，待测试验证)  
**Input**: User description: "开始接入微博平台"  
**Progress**: ~95% (核心功能完成，待环境配置和测试)

## 平台接入架构说明 *(mandatory)*

### 用户维度配置原则

所有社交媒体平台的APP_ID和APP_SECRET**必须与用户维度绑定**，而不是在系统环境变量中配置：

1. **用户独立配置**：每个用户可以配置自己的微博应用凭证
2. **多账号支持**：同一用户可以连接多个微博账号，每个账号独立管理
3. **OAuth统一流程**：
   - 对于支持OAuth的平台（如微博），用户通过OAuth授权获取access_token
   - OAuth过程中仍需用户事先在平台开发者中心创建应用，获得APP_ID和APP_SECRET
   - 系统使用用户提供的APP_ID和APP_SECRET发起OAuth授权请求
4. **手动配置方案**：
   - 对于不支持OAuth或个人开发者限制的平台（如微信公众号），用户手动输入APP_ID和APP_SECRET
   - 系统使用这些凭证直接调用平台API获取access_token
5. **数据隔离**：每个用户的平台凭证和token信息完全隔离，确保安全性

### 微博接入特点

微博支持OAuth 2.0授权，但本质上仍需要：
1. 用户在微博开放平台创建应用，获取APP_ID（App Key）和APP_SECRET（App Secret）
2. 配置回调地址到本应用
3. 用户在本应用中提供APP_ID和APP_SECRET
4. 系统使用这些凭证发起OAuth授权流程
5. 用户完成授权后，系统获取access_token并保存

**关键区别**：
- ❌ 错误：将APP_ID和APP_SECRET配置在系统环境变量（.env文件）中，所有用户共用
- ✅ 正确：每个用户独立配置自己的APP_ID和APP_SECRET，存储在数据库中与用户关联

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 微博应用配置 (Priority: P0)

用户需要先配置自己的微博应用凭证（APP_ID和APP_SECRET），才能连接微博账号。

**Why this priority**: 这是所有后续功能的前提，必须首先实现。

**Independent Test**: 用户在设置页面输入微博应用的APP_ID和APP_SECRET，系统验证并保存配置。

**Acceptance Scenarios**:

1. **Given** 用户已登录SocialWiz，**When** 用户进入平台管理页面，**Then** 显示"添加微博应用"按钮
2. **Given** 用户点击"添加微博应用"，**When** 显示配置表单，**Then** 要求输入APP_ID、APP_SECRET和应用名称（可选）
3. **Given** 用户输入了有效的APP_ID和APP_SECRET，**When** 用户点击"保存"，**Then** 系统验证凭证有效性并保存到数据库（与当前用户关联）
4. **Given** 用户输入了无效的凭证，**When** 系统验证失败，**Then** 显示错误提示和配置指引链接
5. **Given** 用户已配置微博应用，**When** 用户查看平台管理页面，**Then** 显示已配置的应用信息（APP_ID部分隐藏显示）
6. **Given** 用户已配置微博应用，**When** 用户点击"编辑"或"删除"，**Then** 可以更新或删除配置

**配置指引说明**：
- 引导用户访问微博开放平台（https://open.weibo.com）
- 创建网站应用并获取APP_ID和APP_SECRET
- 配置回调地址为：`https://your-domain.com/api/platforms/weibo/callback`

---

### User Story 2 - 微博账号OAuth授权连接 (Priority: P1)

用户配置好微博应用后，需要通过OAuth授权连接具体的微博账号。

**Why this priority**: 账号授权是平台接入的基础功能，必须实现。

**Independent Test**: 用户点击"连接微博"按钮，跳转到微博授权页面，完成授权后返回应用，系统保存授权信息。

**Acceptance Scenarios**:

1. **Given** 用户已配置微博应用，**When** 用户在平台管理页面点击"连接微博账号"，**Then** 系统使用用户配置的APP_ID发起OAuth授权，跳转到微博授权页面
2. **Given** 用户在微博授权页面完成授权，**When** 微博回调到应用，**Then** 系统使用用户配置的APP_SECRET交换code获取access_token，保存到数据库（与用户和应用配置关联）
3. **Given** 用户已连接微博账号，**When** 用户查看平台管理页面，**Then** 显示微博账号已连接状态、账号信息（昵称、头像）和关联的应用配置
4. **Given** 用户已连接微博账号，**When** 用户点击"断开连接"，**Then** 系统清除该账号的授权信息（不影响应用配置）
5. **Given** 用户配置了多个微博应用，**When** 用户连接账号时，**Then** 可以选择使用哪个应用配置进行授权

---

### User Story 3 - 发布内容到微博 (Priority: P1)

用户需要将创建的内容发布到微博平台。

**Why this priority**: 内容发布是核心功能，是用户使用平台的主要目的。

**Independent Test**: 用户选择微博平台并发布内容，系统调用微博 API 发布内容，返回发布结果。

**Acceptance Scenarios**:

1. **Given** 用户已连接微博账号并创建了内容，**When** 用户选择发布到微博，**Then** 系统调用微博 API 发布内容，返回发布成功结果
2. **Given** 用户发布的内容超过微博限制（如文字超过2000字），**When** 系统验证内容，**Then** 提示用户内容不符合微博限制，需要调整
3. **Given** 用户发布内容时微博 API 返回错误，**When** 系统处理错误，**Then** 显示用户友好的错误提示（技术细节记录在日志中），允许用户重试

---

### User Story 4 - Token 刷新机制 (Priority: P2)

系统需要自动刷新过期的微博 access_token，确保账号持续可用。

**Why this priority**: Token 过期会导致发布失败，需要实现自动刷新机制保证服务可用性。

**Independent Test**: 当 access_token 过期时，系统优先尝试使用 refresh_token 刷新（如果存在），否则引导用户重新授权。

**Acceptance Scenarios**:

1. **Given** 用户的 access_token 即将过期且存在 refresh_token，**When** 系统检测到 token 过期，**Then** 系统自动使用 refresh_token 刷新 token
2. **Given** 用户的 access_token 过期但不存在 refresh_token（Web 应用场景），**When** 系统检测到 token 过期，**Then** 标记账号为需要重新授权，提示用户重新连接
3. **Given** refresh_token 也过期或无效，**When** 系统尝试刷新 token 失败，**Then** 标记账号为需要重新授权，提示用户重新连接
4. **Given** 用户在发布内容时 token 过期，**When** 系统检测到 token 无效，**Then** 优先尝试刷新 token（如果可能），否则返回需要重新授权的错误

---

### Edge Cases

- 如果微博 API 返回频率限制错误，如何处理？→ 实现重试机制，延迟后重试
- 如果用户取消授权，如何处理？→ 检测 token 失效，标记账号为断开状态
- 如果网络请求失败，如何处理？→ 实现重试机制，记录错误日志
- 如果图片上传失败，如何处理？→ 图片上传功能暂不考虑，后续迭代
- 如果需要批量发布多条内容或多个账号？→ 批量发布功能暂不支持，后续迭代
- 如果内容包含敏感词被微博拒绝，如何处理？→ 返回用户友好的错误提示（如"内容不符合平台规范"），技术细节（错误码、具体原因）记录在日志中，允许用户修改内容

## Requirements *(mandatory)*

### Functional Requirements

**应用配置管理**：
- **FR-001**: 系统必须提供微博应用配置界面，允许用户输入APP_ID和APP_SECRET
- **FR-002**: 系统必须将用户的微博应用配置存储在数据库中，与用户ID关联
- **FR-003**: 系统必须加密存储APP_SECRET，确保安全性
- **FR-004**: 系统必须支持用户查看、编辑、删除自己的微博应用配置
- **FR-005**: 系统必须验证APP_ID和APP_SECRET的有效性（可通过测试OAuth流程验证）
- **FR-006**: 系统必须支持同一用户配置多个微博应用

**OAuth授权流程**：
- **FR-007**: 系统必须实现微博 OAuth 2.0 授权流程，使用用户配置的APP_ID发起授权请求
- **FR-008**: 系统必须使用用户配置的APP_SECRET交换access_token
- **FR-009**: 系统必须将获取的access_token和refresh_token存储在数据库中，与用户ID和应用配置ID关联
- **FR-010**: 系统必须支持同一用户连接多个微博账号（使用不同或相同的应用配置）

**内容发布**：
- **FR-011**: 系统必须实现微博内容发布接口调用，使用关联的access_token
- **FR-012**: 系统必须验证内容是否符合微博限制（文字长度、图片数量等）
- **FR-013**: 系统必须支持发布纯文字内容（图片和视频功能暂不考虑，后续迭代）
- **FR-014**: 系统必须支持用户选择发布到哪个已连接的微博账号

**Token管理**：
- **FR-015**: 系统必须实现 access_token 自动刷新机制：如果存在 refresh_token 则尝试刷新，否则引导用户重新授权
- **FR-016**: 系统必须处理微博 API 错误响应，提供用户友好的错误提示（技术细节记录在日志中）
- **FR-017**: 系统必须实现 API 调用频率限制处理（重试、延迟）
- **FR-018**: 系统必须获取并保存微博用户信息（用户名、头像等）

**配置指引**：
- **FR-019**: 系统必须提供详细的微博应用配置指引，包括：
  - 如何在微博开放平台创建应用
  - 如何获取APP_ID和APP_SECRET
  - 如何配置回调地址
  - 常见问题解答

### Key Entities *(include if feature involves data)*

- **WeiboAppConfig**: 微博应用配置（用户维度）
  - id: 配置ID
  - userId: 关联的用户ID
  - appId: APP_ID（明文存储）
  - appSecret: APP_SECRET（加密存储）
  - appName: 应用名称（用户自定义，可选）
  - callbackUrl: 回调地址
  - createdAt: 创建时间
  - updatedAt: 更新时间

- **PlatformAccount**: 平台账号信息（用户维度）
  - id: 账号ID
  - userId: 关联的用户ID
  - appConfigId: 关联的应用配置ID（外键到WeiboAppConfig）
  - platform: 平台类型（weibo）
  - platformUserId: 微博用户ID
  - platformUsername: 微博用户名
  - avatar: 头像URL
  - accessToken: 访问令牌（加密存储）
  - refreshToken: 刷新令牌（加密存储，如果可用）
  - tokenExpiry: token过期时间
  - status: 账号状态（active/expired/revoked）
  - createdAt: 创建时间
  - updatedAt: 更新时间

- **Content**: 内容实体，包含文字、图片、视频等

- **ContentPlatform**: 内容发布记录
  - id: 记录ID
  - contentId: 关联的内容ID
  - platformAccountId: 关联的平台账号ID（外键到PlatformAccount）
  - publishStatus: 发布状态（pending/success/failed）
  - platformPostId: 平台返回的帖子ID
  - publishedAt: 发布时间
  - errorMessage: 错误信息（如果失败）

- **PublishResult**: 发布结果，包含发布状态、平台 post ID 等

## Clarifications

### Session 2025-01-13

- Q: 微博平台接入是否需要实现所有 API 功能？ → A: 优先实现核心功能（应用配置、OAuth授权、发布），其他功能（数据获取、分析）可以后续迭代
- Q: APP_ID和APP_SECRET应该如何存储？ → A: 必须与用户维度绑定，存储在数据库中，SECRET需要加密存储
- Q: 是否支持多用户使用同一个微博应用？ → A: 不支持，每个用户必须配置自己的微博应用凭证，确保数据隔离和安全性
- Q: 是否支持一个用户连接多个微博账号？ → A: 支持，用户可以配置多个微博应用，每个应用可以连接不同的微博账号
- Q: Token 刷新机制如何处理？微博是否支持 refresh_token？ → A: 根据调研，微博仅移动应用 SDK 支持 refresh_token，Web 应用需要重新授权。需要实现 token 过期检测和重新授权流程
- Q: Token 刷新机制实现方式？ → A: 混合方案 - 如果存在 refresh_token 则尝试刷新，否则引导重新授权
- Q: 内容发布接口选择哪个？statuses/share 还是其他接口？ → A: 需要根据实际需求选择，statuses/share 是分享链接接口，可能需要使用 statuses/update 或其他接口发布纯内容
- Q: 图片上传流程如何处理？ → A: 暂时不考虑图片上传功能，仅支持纯文字内容发布，图片功能后续迭代
- Q: 错误提示的详细程度？ → A: 显示用户友好的错误提示，技术细节（错误码、详细原因）记录在日志中，开发者可通过开发者工具查看
- Q: 视频内容支持？ → A: 暂不考虑视频功能，仅支持纯文字内容发布，视频功能后续迭代
- Q: 批量发布支持？ → A: 暂不支持批量发布，仅支持单条内容发布到单个微博账号，批量功能后续迭代

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能够成功连接微博账号，授权流程完成率达到 95% 以上
- **SC-002**: 内容发布到微博的成功率达到 90% 以上（排除内容限制导致的失败）
- **SC-003**: Token 刷新机制能够自动处理 90% 以上的 token 过期情况
- **SC-004**: API 错误处理覆盖所有常见错误场景，错误提示友好明确
- **SC-005**: 系统符合 Constitution 原则，通过代码审查
