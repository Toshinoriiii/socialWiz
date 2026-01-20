# Feature Specification: AI Content Creation Workflow

**Feature Branch**: `007-agent-workflow`  
**Created**: 2026-01-20  
**Status**: Draft  
**Input**: 用户输入提示词->调用联网搜索agent->将结果给内容图文创作agent 生成文案内容->根据文案内容给 图片提示词agent->调用生图mcp->将文案内容和图片内容混合输出

## Clarifications

### Session 2026-01-20

- Q: 阿里云百炼 MCP 服务接入方式 → A: 通过 MCP 协议标准接入阿里云百炼服务
- Q: 阿里云百炼 MCP 服务范围 → A: 联网搜索和生图都使用阿里云百炼 MCP
- Q: MCP 客户端实现方式 → A: MCP 客户端已在远程部署,Agent 中通过远程调用使用
- Q: MCP 远程调用方式 → A: HTTP API
- Q: 阿里云百炼 MCP 认证方式 → A: API Key

## User Scenarios & Testing

### User Story 1 - AI 辅助内容创作 (Priority: P1)

用户想要快速创建社交媒体内容,包括文案和配图。用户只需输入一个主题或提示词,系统自动通过 AI Agent 完成联网搜索、内容创作、图片生成,最终输出完整的图文内容。

**Why this priority**: 这是核心功能,直接解决用户创作内容的核心需求,能够显著提升创作效率。

**Independent Test**: 用户输入 "春节营销活动" -> 系统输出包含文案和图片的完整内容 -> 用户可直接发布或编辑

**Acceptance Scenarios**:

1. **Given** 用户在内容编辑页面, **When** 输入 "春节营销活动" 并点击 "AI 生成", **Then** 系统调用搜索 Agent 获取春节相关信息
2. **Given** 搜索 Agent 返回春节相关资料, **When** 传递给内容创作 Agent, **Then** 生成适合社交媒体的营销文案
3. **Given** 文案内容生成完成, **When** 传递给图片提示词 Agent, **Then** 生成适合的图片描述提示词
4. **Given** 图片提示词生成完成, **When** 调用生图 MCP, **Then** 返回生成的图片 URL
5. **Given** 文案和图片都生成完成, **When** 系统混合输出, **Then** 用户看到完整的图文内容预览

---

### User Story 2 - 多平台内容适配 (Priority: P2)

用户希望针对不同的社交平台(微博、微信等)生成不同风格的内容。系统能够根据目标平台的特性调整文案长度、风格和图片尺寸。

**Why this priority**: 增强系统实用性,不同平台有不同的内容要求,自动适配能节省用户时间。

**Independent Test**: 用户选择 "微博" 平台 -> 输入 "产品发布" -> 系统生成符合微博特性的短文案和方形配图

**Acceptance Scenarios**:

1. **Given** 用户选择目标平台为 "微博", **When** 输入创作主题, **Then** 内容 Agent 生成 140 字以内的简洁文案
2. **Given** 用户选择目标平台为 "微信", **When** 输入创作主题, **Then** 内容 Agent 生成长图文内容

---

### User Story 3 - 内容迭代优化 (Priority: P3)

用户对 AI 生成的内容不满意,可以提供反馈并重新生成,或者针对特定部分进行优化。

**Why this priority**: 提升用户体验,AI 生成的内容可能不总是完美,需要支持迭代优化。

**Independent Test**: 用户对生成的文案点击 "重新生成" -> 系统基于原始搜索结果生成新版本文案

**Acceptance Scenarios**:

1. **Given** 用户对生成的文案不满意, **When** 点击 "重新生成文案", **Then** 内容 Agent 生成新的版本
2. **Given** 用户对图片风格不满意, **When** 调整图片提示词并重新生成, **Then** 生图 MCP 返回新图片

---

### Edge Cases

- 阿里云百炼 MCP 搜索服务未能找到相关信息时如何处理?
- 阿里云百炼 MCP 生图服务不可用或超时如何处理?
- 阿里云百炼 MCP API Key 认证失败时如何处理?
- 远程 MCP 客户端连接失败或网络超时时如何处理?
- 用户输入的提示词过于模糊或不明确时如何引导?
- Workflow 某个步骤失败时如何回滚或重试?
- 并发请求过多时如何进行队列管理?
- 阿里云百炼 MCP 服务配额用尽时如何提示用户?

## Requirements

### Functional Requirements

- **FR-001**: 系统必须提供 Web Search Agent,通过阿里云百炼 MCP 服务的 HTTP API 实现联网搜索功能,使用 API Key 认证
- **FR-002**: 系统必须提供 Content Creation Agent,能够根据搜索结果生成社交媒体文案
- **FR-003**: 系统必须提供 Image Prompt Agent,能够根据文案内容生成图片描述提示词
- **FR-004**: 系统必须集成阿里云百炼 MCP 服务的生图功能,通过 HTTP API 调用远程部署的 MCP 客户端,支持文生图功能
- **FR-005**: 系统必须实现 Workflow,串联上述 Agents 和 Tools
- **FR-006**: 系统必须支持流式输出,实时显示生成进度
- **FR-007**: 系统必须提供错误处理机制,当某个步骤失败时能够给出清晰的错误提示
- **FR-008**: 系统必须支持生成内容的存储,用户可以查看历史生成记录
- **FR-009**: 系统必须支持用户对生成内容进行编辑和保存
- **FR-010**: 生成的内容必须包含文案文本和至少一张配图
- **FR-011**: 系统必须通过环境变量管理阿里云百炼 MCP 服务的 API Key,不得硬编码

### Key Entities

- **ContentGenerationRequest**: 用户的内容生成请求,包含提示词、目标平台、风格偏好等
- **SearchResult**: 阿里云百炼 MCP 服务返回的搜索结果,包含标题、摘要、来源等
- **GeneratedContent**: 内容创作 Agent 生成的文案,包含标题、正文、标签等
- **ImagePrompt**: 图片提示词 Agent 生成的图片描述
- **GeneratedImage**: 阿里云百炼 MCP 服务返回的图片信息,包含 URL、尺寸等
- **ContentOutput**: 最终混合输出的完整内容,包含文案和图片
- **MCPServiceConfig**: 阿里云百炼 MCP 服务配置,包含 API 端点 URL、API Key、超时设置等

## Success Criteria

### Measurable Outcomes

- **SC-001**: 用户从输入提示词到获得完整图文内容的时间不超过 60 秒(正常网络情况下)
- **SC-002**: Workflow 成功率达到 95% 以上(排除外部服务故障)
- **SC-003**: 生成的文案内容与用户输入的主题相关度达到 90% 以上(通过用户反馈评估)
- **SC-004**: 系统支持至少 10 个并发内容生成请求
- **SC-005**: 用户对生成内容的满意度达到 80% 以上(通过满意度调查)
