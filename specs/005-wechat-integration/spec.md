# Feature Specification: 微信公众号平台接入

**Feature Branch**: `005-wechat-integration`  
**Created**: 2026-01-15  
**Last Updated**: 2026-01-15  
**Status**: 🟡 Planning  
**Input**: User description: "新建一个迭代005 接入微信公众号平台 并在测试页面验证"  
**Progress**: 0% (计划阶段)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 微信公众号账号授权连接 (Priority: P1)

用户需要将微信公众号账号连接到 SocialWiz 平台，以便后续发布内容到微信公众号。

**Why this priority**: 账号授权是平台接入的基础功能，必须首先实现。

**Independent Test**: 用户点击"连接微信公众号"按钮，跳转到微信授权页面，完成授权后返回应用，系统保存授权信息。

**Acceptance Scenarios**:

1. **Given** 用户已登录 SocialWiz，**When** 用户在设置页面点击"连接微信公众号"，**Then** 系统跳转到微信 OAuth 授权页面
2. **Given** 用户在微信授权页面完成授权，**When** 微信回调到应用，**Then** 系统获取并保存 access_token，完成账号连接
3. **Given** 用户已连接微信公众号账号，**When** 用户查看设置页面，**Then** 显示微信公众号账号已连接状态和账号信息
4. **Given** 用户已连接微信公众号账号，**When** 用户点击"断开连接"，**Then** 系统清除授权信息，账号断开连接

---

### User Story 2 - 发布内容到微信公众号 (Priority: P1)

用户需要将创建的内容发布到微信公众号平台。

**Why this priority**: 内容发布是核心功能，是用户使用平台的主要目的。

**Independent Test**: 用户选择微信公众号平台并发布内容，系统调用微信 API 发布内容，返回发布结果。

**Acceptance Scenarios**:

1. **Given** 用户已连接微信公众号账号并创建了内容，**When** 用户选择发布到微信公众号，**Then** 系统调用微信 API 发布内容，返回发布成功结果
2. **Given** 用户发布的内容超过微信限制（如文字超过限制），**When** 系统验证内容，**Then** 提示用户内容不符合微信限制，需要调整
3. **Given** 用户发布内容时微信 API 返回错误，**When** 系统处理错误，**Then** 显示用户友好的错误提示（技术细节记录在日志中），允许用户重试

---

### User Story 3 - 测试页面验证功能 (Priority: P1)

开发团队需要在测试页面验证微信公众号接入功能是否正常工作。

**Why this priority**: 测试页面验证是确保功能正确性的关键步骤，必须在开发完成后进行验证。

**Independent Test**: 在测试页面完成授权连接、内容发布等功能的端到端测试，验证所有功能正常工作。

**Acceptance Scenarios**:

1. **Given** 开发团队已完成微信公众号接入功能，**When** 在测试页面测试授权连接，**Then** 授权流程正常工作，账号成功连接
2. **Given** 开发团队已完成内容发布功能，**When** 在测试页面测试内容发布，**Then** 内容成功发布到微信公众号，返回正确的发布结果
3. **Given** 测试页面，**When** 测试错误处理场景，**Then** 错误提示友好明确，日志记录完整

---

### User Story 4 - Token 刷新机制 (Priority: P2)

系统需要自动刷新过期的微信 access_token，确保账号持续可用。

**Why this priority**: Token 过期会导致发布失败，需要实现自动刷新机制保证服务可用性。

**Independent Test**: 当 access_token 过期时，系统优先尝试使用 refresh_token 刷新（如果存在），否则引导用户重新授权。

**Acceptance Scenarios**:

1. **Given** 用户的 access_token 即将过期且存在 refresh_token，**When** 系统检测到 token 过期，**Then** 系统自动使用 refresh_token 刷新 token
2. **Given** 用户的 access_token 过期但不存在 refresh_token，**When** 系统检测到 token 过期，**Then** 标记账号为需要重新授权，提示用户重新连接
3. **Given** refresh_token 也过期或无效，**When** 系统尝试刷新 token 失败，**Then** 标记账号为需要重新授权，提示用户重新连接

---

### Edge Cases

- 如果微信 API 返回频率限制错误，如何处理？→ 实现重试机制，延迟后重试
- 如果用户取消授权，如何处理？→ 检测 token 失效，标记账号为断开状态
- 如果网络请求失败，如何处理？→ 实现重试机制，记录错误日志
- 如果图片上传失败，如何处理？→ 图片上传功能暂不考虑，后续迭代
- 如果内容包含敏感词被微信拒绝，如何处理？→ 返回用户友好的错误提示（如"内容不符合平台规范"），技术细节（错误码、具体原因）记录在日志中，允许用户修改内容

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须实现微信公众号 OAuth 2.0 授权流程
- **FR-002**: 系统必须保存用户的 access_token 和 refresh_token（如果可用）
- **FR-003**: 系统必须实现微信公众号内容发布接口调用（暂不支持批量发布，仅支持单条内容发布到单个公众号）
- **FR-004**: 系统必须验证内容是否符合微信限制（文字长度、图片数量等）
- **FR-005**: 系统必须支持发布纯文字内容（图片和视频功能暂不考虑，后续迭代）
- **FR-006**: 系统必须实现 access_token 自动刷新机制：如果存在 refresh_token 则尝试刷新，否则引导用户重新授权
- **FR-007**: 系统必须处理微信 API 错误响应，提供用户友好的错误提示（技术细节记录在日志中，开发者可通过开发者工具查看）
- **FR-008**: 系统必须实现 API 调用频率限制处理（重试、延迟）
- **FR-009**: 系统必须支持用户断开微信公众号账号连接
- **FR-010**: 系统必须获取并保存微信公众号信息（公众号名称、头像等）
- **FR-011**: 系统必须提供测试页面用于验证微信公众号接入功能
- **FR-012**: 测试页面必须支持授权连接、内容发布、错误处理等功能的端到端测试

### Key Entities *(include if feature involves data)*

- **PlatformAccount**: 平台账号信息，包含 access_token、refresh_token、过期时间等
- **Content**: 内容实体，包含文字、图片、视频等
- **ContentPlatform**: 内容发布记录，关联内容和平台账号
- **PublishResult**: 发布结果，包含发布状态、平台 post ID 等

## Clarifications

### Session 2026-01-15

- Q: 微信公众号平台接入是否需要实现所有 API 功能？ → A: 优先实现核心功能（授权、发布），其他功能（数据获取、分析）可以后续迭代
- Q: Token 刷新机制如何处理？微信是否支持 refresh_token？ → A: 需要调研微信 API 的 token 刷新机制
- Q: 内容发布接口选择哪个？微信提供了哪些发布接口？ → A: 需要调研微信 API 文档，确定合适的发布接口
- Q: 图片上传流程如何处理？ → A: 暂时不考虑图片上传功能，仅支持纯文字内容发布，图片功能后续迭代
- Q: 测试页面的具体实现方式？ → A: 需要创建专门的测试页面，支持功能验证和调试

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能够成功连接微信公众号账号，授权流程完成率达到 95% 以上
- **SC-002**: 内容发布到微信公众号的成功率达到 90% 以上（排除内容限制导致的失败）
- **SC-003**: Token 刷新机制能够自动处理 90% 以上的 token 过期情况
- **SC-004**: API 错误处理覆盖所有常见错误场景，错误提示友好明确
- **SC-005**: 测试页面能够完整验证所有功能，测试通过率达到 100%
- **SC-006**: 系统符合 Constitution 原则，通过代码审查
