# Feature Specification: 微博平台接入

**Feature Branch**: `003-weibo-integration`  
**Created**: 2025-01-13  
**Last Updated**: 2025-01-13  
**Status**: 🟡 Development In Progress (核心功能已完成，待测试验证)  
**Input**: User description: "开始接入微博平台"  
**Progress**: ~95% (核心功能完成，待环境配置和测试)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 微博账号授权连接 (Priority: P1)

用户需要将微博账号连接到 SocialWiz 平台，以便后续发布内容到微博。

**Why this priority**: 账号授权是平台接入的基础功能，必须首先实现。

**Independent Test**: 用户点击"连接微博"按钮，跳转到微博授权页面，完成授权后返回应用，系统保存授权信息。

**Acceptance Scenarios**:

1. **Given** 用户已登录 SocialWiz，**When** 用户在设置页面点击"连接微博"，**Then** 系统跳转到微博 OAuth 授权页面
2. **Given** 用户在微博授权页面完成授权，**When** 微博回调到应用，**Then** 系统获取并保存 access_token，完成账号连接
3. **Given** 用户已连接微博账号，**When** 用户查看设置页面，**Then** 显示微博账号已连接状态和账号信息
4. **Given** 用户已连接微博账号，**When** 用户点击"断开连接"，**Then** 系统清除授权信息，账号断开连接

---

### User Story 2 - 发布内容到微博 (Priority: P1)

用户需要将创建的内容发布到微博平台。

**Why this priority**: 内容发布是核心功能，是用户使用平台的主要目的。

**Independent Test**: 用户选择微博平台并发布内容，系统调用微博 API 发布内容，返回发布结果。

**Acceptance Scenarios**:

1. **Given** 用户已连接微博账号并创建了内容，**When** 用户选择发布到微博，**Then** 系统调用微博 API 发布内容，返回发布成功结果
2. **Given** 用户发布的内容超过微博限制（如文字超过2000字），**When** 系统验证内容，**Then** 提示用户内容不符合微博限制，需要调整
3. **Given** 用户发布内容时微博 API 返回错误，**When** 系统处理错误，**Then** 显示用户友好的错误提示（技术细节记录在日志中），允许用户重试

---

### User Story 3 - Token 刷新机制 (Priority: P2)

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

- **FR-001**: 系统必须实现微博 OAuth 2.0 授权流程
- **FR-002**: 系统必须保存用户的 access_token 和 refresh_token（如果可用）
- **FR-003**: 系统必须实现微博内容发布接口调用（暂不支持批量发布，仅支持单条内容发布到单个微博账号）
- **FR-004**: 系统必须验证内容是否符合微博限制（文字长度、图片数量等）
- **FR-005**: 系统必须支持发布纯文字内容（图片和视频功能暂不考虑，后续迭代）
- **FR-006**: 系统必须实现 access_token 自动刷新机制：如果存在 refresh_token 则尝试刷新，否则引导用户重新授权
- **FR-007**: 系统必须处理微博 API 错误响应，提供用户友好的错误提示（技术细节记录在日志中，开发者可通过开发者工具查看）
- **FR-008**: 系统必须实现 API 调用频率限制处理（重试、延迟）
- **FR-009**: 系统必须支持用户断开微博账号连接
- **FR-010**: 系统必须获取并保存微博用户信息（用户名、头像等）

### Key Entities *(include if feature involves data)*

- **PlatformAccount**: 平台账号信息，包含 access_token、refresh_token、过期时间等
- **Content**: 内容实体，包含文字、图片、视频等
- **ContentPlatform**: 内容发布记录，关联内容和平台账号
- **PublishResult**: 发布结果，包含发布状态、平台 post ID 等

## Clarifications

### Session 2025-01-13

- Q: 微博平台接入是否需要实现所有 API 功能？ → A: 优先实现核心功能（授权、发布），其他功能（数据获取、分析）可以后续迭代
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
