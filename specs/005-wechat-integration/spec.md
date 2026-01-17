# Feature Specification: 微信公众号平台接入

**Feature Branch**: `005-wechat-integration`  
**Created**: 2026-01-15  
**Last Updated**: 2026-01-17  
**Status**: 🟡 Planning  
**Input**: User description: "新建一个迭代005 接入微信公众号平台 并在测试页面验证"  
**Progress**: 0% (计划阶段)

## 平台接入架构说明 *(mandatory)*

### 用户维度配置原则

所有社交媒体平台的APP_ID和APP_SECRET**必须与用户维度绑定**，而不是在系统环境变量中配置：

1. **用户独立配置**：每个用户可以配置自己的微信公众号凭证
2. **多账号支持**：同一用户可以连接多个微信公众号，每个公众号独立管理
3. **手动配置方案**：
   - 由于个人开发者限制，无法实现OAuth授权流程
   - 用户必须手动输入公众号的AppID和Secret
   - 系统使用这些凭证直接调用`/cgi-bin/token`接口获取access_token
4. **数据隔离**：每个用户的公众号凭证和token信息完全隔离，确保安全性

### 微信公众号接入特点

微信公众号不支持个人开发者的OAuth授权，必须采用手动配置方式：
1. 用户在微信公众平台获取公众号的AppID和Secret
2. 配置IP白名单和安全域名
3. 用户在本应用中提供AppID和Secret
4. 系统使用这些凭证调用`/cgi-bin/token`接口获取access_token
5. access_token有效期为7200秒（2小时），需要实现自动刷新

**关键区别**：
- ❌ 错误：将AppID和Secret配置在系统环境变量（.env文件）中，所有用户共用
- ✅ 正确：每个用户独立配置自己的AppID和Secret，存储在数据库中与用户关联

# 重要技术约束 *(mandatory)*

### 个人开发者限制

由于本项目开发者是个人身份，存在以下技术约束：

1. **无法实现标准OAuth流程**：个人开发者无法在自己的网站中唤起微信公众号的OAuth授权流程，因为这需要微信公众平台认证的网站应用资质
2. **用户维度配置**：用户必须手动输入其公众号的AppID和Secret，系统将其存储在数据库中与用户关联
3. **企业主体账号限制**：只有企业主体注册的公众号才支持内容发布能力，个人主体的公众号无法使用发布接口
4. **IP白名单配置**：用户需要在微信公众号后台配置本应用服务器的IP地址白名单
5. **安全域名配置**：用户需要在微信公众号后台配置本应用的安全域名

### 微信公众号API调用机制

微信公众号的大多数API接口调用都需要传入`access_token`参数：

1. **获取access_token**：调用`/cgi-bin/token`接口，需要传入：
   - `appid`：公众号的AppID（从用户配置中获取）
   - `secret`：公众号的Secret（从用户配置中获取，需要解密）
   - 返回的`access_token`有效期为7200秒（2小时）

2. **使用access_token**：所有业务API（如发布、素材管理等）都需要在请求中附带`access_token`参数

3. **token刷新策略**：
   - 每个公众号的`access_token`是唯一的，重复获取会导致上次的token失效
   - 需要实现中控服务器统一管理token，避免多个服务器获取导致token失效
   - 建议提前5分钟刷新token，避免临界时间调用失败
   - 每个用户的公众号token独立管理，互不影响

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 微信公众号手动配置 (Priority: P1)

用户需要手动输入微信公众号的AppID和Secret，将公众号连接到SocialWiz平台。

**Why this priority**: 由于个人开发者限制，无法实现标准OAuth授权，必须采用手动配置方式。**此配置与用户维度绑定**，每个用户配置自己的公众号凭证。

**Independent Test**: 用户在平台管理页面输入AppID和Secret，系统验证配置有效性并保存到数据库（与用户ID关联）。

**Acceptance Scenarios**:

1. **Given** 用户已登录SocialWiz，**When** 用户在平台管理页面点击"添加微信公众号"，**Then** 显示配置表单，要求输入AppID、Secret和公众号名称（可选）
2. **Given** 用户输入了AppID和Secret，**When** 用户点击"验证并保存"，**Then** 系统调用微信API获取access_token验证配置有效性，并将配置保存到数据库（与当前用户ID关联）
3. **Given** 配置验证成功，**When** 系统获取到access_token，**Then** 保存配置信息并显示连接成功
4. **Given** 配置验证失败（错误的AppID/Secret或IP白名单未配置），**When** 系统检测到错误，**Then** 显示具体的错误原因和配置指引
5. **Given** 用户已配置微信公众号，**When** 用户查看平台管理页面，**Then** 显示公众号名称、类型（订阅号/服务号）、主体类型（个人/企业）等信息，AppID部分隐藏显示
6. **Given** 用户已配置微信公众号，**When** 用户点击"断开连接"，**Then** 系统清除配置信息和缓存的access_token（仅删除该用户的配置）
7. **Given** 用户配置了多个微信公众号，**When** 用户查看平台管理页面，**Then** 分别显示每个公众号的配置和状态

---

## User Story 2 - 公众号配置指引 (Priority: P1)

系统需要提供详细的配置指引，帮助用户完成微信公众号后台的必要配置。

**Why this priority**: 配置正确性直接影响API调用成功率，必须提供清晰的指引。

**Independent Test**: 用户查看配置指引，按步骤完成微信公众号后台配置。

**Acceptance Scenarios**:

1. **Given** 用户点击"如何配置"链接，**When** 系统显示配置指引，**Then** 包含以下步骤：
   - 如何获取AppID和Secret
   - 如何配置IP白名单（显示当前服务器IP）
   - 如何配置安全域名（显示当前域名）
   - 如何确认公众号主体类型（个人/企业）
2. **Given** 用户的公众号是个人主体，**When** 系统检测到公众号类型，**Then** 显示警告信息：个人公众号不支持发布功能
3. **Given** 用户配置时IP白名单未添加，**When** API调用返回IP白名单错误，**Then** 显示具体错误和配置指引链接

---

### User Story 3 - 发布内容到微信公众号 (Priority: P1)

用户需要将创建的内容发布到微信公众号平台。

**Why this priority**: 内容发布是核心功能，是用户使用平台的主要目的。

**Independent Test**: 用户选择微信公众号平台并发布内容，系统使用该用户配置的AppID/Secret自动获取access_token并调用发布API。

**Acceptance Scenarios**:

1. **Given** 用户已配置微信公众号（企业主体）并创建了内容，**When** 用户选择发布到微信公众号，**Then** 系统使用该用户配置的凭证获取access_token，调用发布API
2. **Given** access_token已缓存且有效，**When** 用户发布内容，**Then** 直接使用缓存的token，无需重新获取
3. **Given** access_token已过期或即将过期，**When** 系统检测到token状态，**Then** 使用用户配置的凭证自动调用token接口刷新，然后执行发布
3. **Given** 用户的公众号是个人主体，**When** 用户尝试发布，**Then** 阻止发布并提示：个人公众号不支持发布功能，建议升级为企业主体
4. **Given** 用户发布的内容超过微信限制，**When** 系统验证内容，**Then** 提示具体超出的限制（如文字超过20000字）
5. **Given** 用户发布内容时微信API返回错误，**When** 系统处理错误，**Then** 根据错误码显示对应的友好提示和解决方案

---

### User Story 4 - 测试页面验证功能 (Priority: P1)

开发团队需要在测试页面验证微信公众号接入功能是否正常工作。

**Why this priority**: 测试页面验证是确保功能正确性的关键步骤，必须在开发完成后进行验证。

**Independent Test**: 在测试页面完成授权连接、内容发布等功能的端到端测试，验证所有功能正常工作。

**Acceptance Scenarios**:

1. **Given** 开发团队已完成微信公众号接入功能，**When** 在测试页面测试授权连接，**Then** 授权流程正常工作，账号成功连接
2. **Given** 开发团队已完成内容发布功能，**When** 在测试页面测试内容发布，**Then** 内容成功发布到微信公众号，返回正确的发布结果
3. **Given** 测试页面，**When** 测试错误处理场景，**Then** 错误提示友好明确，日志记录完整

---

### User Story 5 - Access Token自动管理机制 (Priority: P2)

系统需要在后端自动管理access_token的生命周期，确保API调用成功率。前端无需关心token状态。

**Why this priority**: Token过期会导致发布失败，需要实现智能的token管理机制。采用透明代理模式，前端开发者无需关心token细节。

**Independent Test**: 系统在token过期前自动刷新，前端调用API无感知，避免调用失败。

**Acceptance Scenarios**:

1. **Given** 系统首次获取access_token，**When** 调用成功，**Then** 缓存token和过期时间（7200秒）到Redis，使用`wechat:token:{userId}:{configId}`作为key
2. **Given** 缓存的access_token剩余有效期少于300秒，**When** 需要调用API，**Then** 先自动刷新token再执行调用，前端无感知
3. **Given** 获取token时返回IP白名单错误（错误码：40164），**When** 系统处理错误，**Then** 显示：请在微信公众号后台配置IP白名单，并显示当前服务器IP
4. **Given** 获取token时返回AppID或Secret错误，**When** 系统处理错误，**Then** 提示用户检查配置并提供重新配置入口
5. **Given** 多个请求并发需要token，**When** 系统检测到并发，**Then** 使用分布式锁（`wechat:lock:{userId}:{configId}`）确保只有一个请求获取token，其他请求等待并使用缓存结果
6. **Given** 前端调用微信相关API（如发布接口），**When** 后端API中间件拦截请求，**Then** 自动注入有效的access_token，前端无需传递token参数

---

#### Edge Cases

- 如果微信API返回频率限制错误，如何处理？→ 实现重试机制，延迟后重试，记录限流日志
- 如果用户修改了公众号后台的AppSecret，如何处理？→ 系统检测到token获取失败，提示用户更新配置
- 如果用户的公众号从企业降级为个人，如何处理？→ 发布时检测账号类型，阻止发布并提示
- 如果服务器IP地址变更，如何处理？→ 检测到IP白名单错误时，显示新的IP地址和配置指引
- 如果网络请求失败，如何处理？→ 实现指数退避重试机制（最多3次），记录错误日志
- 如果图片上传失败，如何处理？→ 图片上传功能暂不考虑，后续迭代实现media_id获取
- 如果内容包含敏感词被微信拒绝，如何处理？→ 返回用户友好的错误提示（如"内容不符合平台规范"），技术细节记录在日志中
- 如果用户配置了多个公众号，如何处理？→ 支持多账号配置，每个账号独立管理token
- 如果access_token被其他系统获取导致失效，如何处理？→ 检测到token失效错误时自动重新获取

## Requirements *(mandatory)*

### Functional Requirements

**公众号配置管理**：
- **FR-001**: 系统必须提供手动配置表单，接收用户输入的AppID和Secret
- **FR-002**: 系统必须将用户的微信公众号配置存储在数据库中，与用户ID关联
- **FR-003**: 系统必须加密存储AppSecret，确保安全性
- **FR-004**: 系统必须在保存配置前验证AppID和Secret的有效性（调用/cgi-bin/token接口）
- **FR-005**: 系统必须支持用户查看、编辑、删除自己的微信公众号配置
- **FR-006**: 系统必须支持同一用户配置多个微信公众号
- **FR-007**: 系统必须确保用户只能访问自己的配置，不能查看或修改其他用户的配置

**Token管理**：
- **FR-008**: 系统必须实现WechatTokenService服务类，负责token生命周期管理（获取、缓存、刷新、分布式锁）
- **FR-009**: 系统必须将access_token缓存到Redis，使用`wechat:token:{userId}:{configId}`作为缓存key，设置过期时间为7000秒
- **FR-010**: 系统必须在API调用前自动检查access_token有效期，当剩余有效期<300秒时主动刷新
- **FR-011**: 系统必须使用分布式锁（`wechat:lock:{userId}:{configId}`）防止并发获取access_token导致token失效
- **FR-012**: 系统必须实现API中间件，自动为所有微信API调用注入有效的access_token（透明代理模式）
- **FR-013**: 前端调用微信相关API时无需关心token状态，后端自动处理token获取和刷新
- **FR-014**: 系统必须检测公众号主体类型（个人/企业），个人主体禁止使用发布功能

**内容发布**：
- **FR-015**: 系统必须实现微信公众号内容发布接口调用，使用对应用户配置的token
- **FR-016**: 系统必须在发布前验证内容是否符合微信限制（文字长度、图片数量等）
- **FR-017**: 系统必须支持发布纯文字内容（图片和视频功能需要media_id，暂不考虑）
- **FR-018**: 系统必须支持用户选择发布到哪个已配置的公众号

**错误处理**：
- **FR-019**: 系统必须处理微信API错误响应，根据错误码提供具体的解决方案：
  - 40001（AppSecret错误）：提示检查配置
  - 40164（IP白名单错误）：显示当前IP和配置指引
  - 48001（无权限）：提示企业主体限制
  - 其他错误：显示友好提示并记录日志
- **FR-020**: 系统必须实现API调用重试机制（网络错误重试3次，指数退避）
- **FR-021**: 系统必须获取并显示微信公众号信息（公众号名称、类型、主体类型等）

**配置指引**：
- **FR-022**: 系统必须提供详细的配置指引文档，包括：
  - AppID和Secret获取步骤
  - IP白名单配置步骤（显示当前服务器IP）
  - 安全域名配置步骤
  - 主体类型说明
- **FR-023**: 系统必须提供测试页面用于验证微信公众号接入功能
- **FR-024**: 测试页面必须支持手动配置、token获取、内容发布、错误处理等功能的端到端测试

### Key Entities *(include if feature involves data)*

- **WechatAccountConfig**: 微信公众号配置（用户维度）
  - id: 配置ID
  - userId: 关联的用户ID
  - appId: 公众号AppID（明文存储）
  - appSecret: 公众号Secret（加密存储）
  - accountName: 公众号名称（用户自定义或系统获取）
  - accountType: 账号类型（订阅号/服务号）
  - subjectType: 主体类型（个人/企业）
  - canPublish: 是否支持发布（企业主体为true）
  - createdAt: 创建时间
  - updatedAt: 更新时间

- **WechatAccessToken**: Access Token缓存（Redis）
  - key: `wechat:token:{userId}:{configId}`
  - accessToken: token值
  - expiresAt: 过期时间戳
  - appId: 关联的AppID

- **Content**: 内容实体，包含文字、图片、视频等

- **ContentPlatform**: 内容发布记录
  - id: 记录ID
  - contentId: 关联的内容ID
  - wechatConfigId: 关联的微信配置ID（外键到WechatAccountConfig）
  - publishStatus: 发布状态（pending/success/failed）
  - platformPostId: 微信返回的文章ID
  - publishedAt: 发布时间
  - errorMessage: 错误信息（如果失败）

- **PublishResult**: 发布结果
  - status: 发布状态（成功/失败）
  - platformPostId: 微信返回的文章ID
  - errorCode: 错误码（如果失败）
  - errorMessage: 错误信息

## Clarifications

### Session 2026-01-15

- Q: 微信公众号平台接入是否需要实现所有API功能？ → A: 优先实现核心功能（配置、发布），其他功能（数据获取、分析）可以后续迭代
- Q: 为什么不能使用OAuth授权流程？ → A: 个人开发者无法在网站中唤起微信公众号OAuth授权，需要企业资质和微信认证
- Q: 如何获取access_token？ → A: 使用/cgi-bin/token接口，传入用户手动输入的appid和secret
- Q: access_token如何刷新？微信是否支持refresh_token？ → A: 微信公众号不使用refresh_token机制，直接重新调用/cgi-bin/token接口获取新token
- Q: 如何防止token被频繁刷新导致失效？ → A: 使用Redis缓存token，配合分布式锁确保同一时间只有一个请求获取token
- Q: 个人公众号能否发布内容？ → A: 不能，只有企业主体的公众号才支持发布接口
- Q: 如何检测公众号主体类型？ → A: 需要调研是否有API可以查询，或者要求用户手动确认
- Q: IP白名单和安全域名如何配置？ → A: 需要在配置指引中明确说明，用户必须在微信公众号后台手动配置
- Q: 图片上传流程如何处理？ → A: 暂时不考虑图片上传功能，仅支持纯文字内容发布，图片功能需要先获取media_id
- Q: 测试页面的具体实现方式？ → A: 创建专门的测试页面，支持配置输入、token获取、内容发布等功能验证

### Session 2026-01-17

- Q: Access Token应该存储在哪里（数据库、Redis、localStorage）？ → A: 纯后端存储（Redis），不存储在数据库（因为有时效性），不存储在前端localStorage（安全性考虑）
- Q: 前端如何知道Token状态并调用API？ → A: 透明代理模式 - 前端直接调用业务API，后端自动检查/刷新token，前端无需感知token管理细节
- Q: 后端Token管理服务的架构设计？ → A: Token服务 + 中间件模式 - TokenService管理token生命周期（获取、缓存、刷新、分布式锁），API中间件自动注入token
- Q: Redis缓存Key的命名规则？ → A: 使用 `wechat:token:{userId}:{configId}` 格式，确保每个用户的每个公众号配置都有独立的token缓存
- Q: Token刷新的触发时机？ → A: 提前刷新模式 - 当token剩余有效期 < 300秒（5分钟）时主动刷新，避免临界时间调用失败

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户能够成功配置微信公众号（输入AppID和Secret），配置验证成功率达到95%以上
- **SC-002**: 配置指引清晰完整，用户能够在10分钟内完成微信公众号后台配置（IP白名单、安全域名）
- **SC-003**: access_token自动管理机制稳定，token有效期内API调用成功率达到99%以上
- **SC-004**: 系统能够在token过期前自动刷新，避免因token过期导致的调用失败
- **SC-005**: 内容发布到微信公众号的成功率达到90%以上（排除企业主体限制和内容限制导致的失败）
- **SC-006**: API错误处理覆盖所有常见错误场景（40001、40164、48001等），每个错误都有对应的解决方案提示
- **SC-007**: 系统能够准确识别并阻止个人主体公众号的发布操作，提示转换为企业主体
- **SC-008**: 测试页面能够完整验证所有功能（配置、token获取、发布、错误处理），测试通过率达到100%
- **SC-009**: 系统符合Constitution原则，通过代码审查，敏感配置信息（Secret）加密存储
