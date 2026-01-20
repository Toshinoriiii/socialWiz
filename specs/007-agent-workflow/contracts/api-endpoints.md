# API Endpoints Contract

**Date**: 2026-01-20  
**Purpose**: 定义内容生成相关的 API 端点规范

## Base URL

```
http://localhost:3000/api
```

---

## 1. 创建内容生成任务

### Endpoint
```
POST /content/generate
```

### Description
创建一个新的内容生成任务,系统将异步执行 AI Workflow 生成内容

### Authentication
需要用户登录 (通过 session 或 JWT)

### Request Headers
```
Content-Type: application/json
Cookie: session=xxx (或 Authorization: Bearer <token>)
```

### Request Body

```typescript
{
  "prompt": string,           // 必填,1-500字符
  "platform"?: "weibo" | "wechat" | "generic",  // 可选,默认 generic
  "style"?: string            // 可选,内容风格描述
}
```

### Request Example

```json
{
  "prompt": "春节营销活动创意",
  "platform": "weibo",
  "style": "轻松幽默,年轻化"
}
```

### Response (Success - 202 Accepted)

```typescript
{
  "success": true,
  "data": {
    "requestId": string,      // 内容生成请求 ID
    "status": "PENDING",      // 初始状态
    "message": "Content generation started"
  }
}
```

### Response Example

```json
{
  "success": true,
  "data": {
    "requestId": "clx1234567890",
    "status": "PENDING",
    "message": "Content generation started"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Prompt is required and must be between 1-500 characters"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 429 Too Many Requests
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create content generation request"
  }
}
```

---

## 2. 查询内容生成状态

### Endpoint
```
GET /content/generate/:requestId
```

### Description
查询指定内容生成任务的状态和结果

### Authentication
需要用户登录,且只能查询自己的请求

### Path Parameters
- `requestId`: 内容生成请求 ID

### Response (Success - 200 OK)

```typescript
{
  "success": true,
  "data": {
    "requestId": string,
    "status": "PENDING" | "SEARCHING" | "CREATING" | "GENERATING_IMAGE" | "COMPLETED" | "FAILED",
    "currentStep"?: string,     // 当前执行的步骤
    "progress"?: number,        // 进度百分比 0-100
    "content"?: {               // 生成的内容 (COMPLETED 时存在)
      "title"?: string,
      "body": string,
      "tags"?: string[],
      "imageUrl"?: string,
      "imagePrompt"?: string
    },
    "error"?: string,           // 错误信息 (FAILED 时存在)
    "createdAt": string,
    "updatedAt": string
  }
}
```

### Response Examples

#### Pending/In Progress
```json
{
  "success": true,
  "data": {
    "requestId": "clx1234567890",
    "status": "CREATING",
    "currentStep": "content-creation",
    "progress": 60,
    "createdAt": "2026-01-20T10:00:00Z",
    "updatedAt": "2026-01-20T10:00:30Z"
  }
}
```

#### Completed
```json
{
  "success": true,
  "data": {
    "requestId": "clx1234567890",
    "status": "COMPLETED",
    "progress": 100,
    "content": {
      "title": "春节营销活动创意方案",
      "body": "春节是一年中最重要的传统节日...",
      "tags": ["春节", "营销", "创意"],
      "imageUrl": "https://api.stability.ai/...",
      "imagePrompt": "Chinese New Year celebration with red lanterns..."
    },
    "createdAt": "2026-01-20T10:00:00Z",
    "updatedAt": "2026-01-20T10:01:00Z"
  }
}
```

#### Failed
```json
{
  "success": true,
  "data": {
    "requestId": "clx1234567890",
    "status": "FAILED",
    "error": "Image generation service unavailable",
    "currentStep": "image-generation",
    "createdAt": "2026-01-20T10:00:00Z",
    "updatedAt": "2026-01-20T10:00:45Z"
  }
}
```

### Error Responses

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Content generation request not found"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to access this request"
  }
}
```

---

## 3. 流式获取生成进度 (Server-Sent Events)

### Endpoint
```
GET /content/generate/:requestId/stream
```

### Description
通过 Server-Sent Events (SSE) 实时接收内容生成进度和结果

### Authentication
需要用户登录

### Response (Success - 200 OK)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Stream Format

```typescript
// 事件类型
type SSEEvent = 
  | { event: 'status', data: { status: string, step?: string } }
  | { event: 'progress', data: { progress: number, message: string } }
  | { event: 'content_chunk', data: { chunk: string } }
  | { event: 'completed', data: { content: ContentOutput } }
  | { event: 'error', data: { error: string } }
```

### Event Examples

#### Status Update
```
event: status
data: {"status":"SEARCHING","step":"web-search"}

```

#### Progress Update
```
event: progress
data: {"progress":30,"message":"Searching for relevant information..."}

```

#### Content Chunk (Streaming)
```
event: content_chunk
data: {"chunk":"春节是中国最重要的传统节日..."}

```

#### Completed
```
event: completed
data: {"content":{"title":"春节营销活动创意方案","body":"...","imageUrl":"..."}}

```

#### Error
```
event: error
data: {"error":"Image generation service unavailable"}

```

---

## 4. 获取用户的内容生成历史

### Endpoint
```
GET /content/history
```

### Description
获取当前用户的内容生成历史记录

### Authentication
需要用户登录

### Query Parameters
- `page`: 页码,默认 1
- `limit`: 每页数量,默认 10,最大 50
- `status`: 过滤状态,可选值: `PENDING`, `COMPLETED`, `FAILED`, `ALL` (默认)

### Response (Success - 200 OK)

```typescript
{
  "success": true,
  "data": {
    "requests": Array<{
      "requestId": string,
      "prompt": string,
      "platform"?: string,
      "status": string,
      "createdAt": string,
      "hasContent": boolean    // 是否已生成内容
    }>,
    "pagination": {
      "page": number,
      "limit": number,
      "total": number,
      "totalPages": number
    }
  }
}
```

### Response Example

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "requestId": "clx1234567890",
        "prompt": "春节营销活动创意",
        "platform": "weibo",
        "status": "COMPLETED",
        "createdAt": "2026-01-20T10:00:00Z",
        "hasContent": true
      },
      {
        "requestId": "clx0987654321",
        "prompt": "新产品发布文案",
        "platform": "wechat",
        "status": "FAILED",
        "createdAt": "2026-01-19T15:30:00Z",
        "hasContent": false
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

---

## 5. 重新生成内容

### Endpoint
```
POST /content/generate/:requestId/retry
```

### Description
重新执行失败的或用户不满意的内容生成任务

### Authentication
需要用户登录,且只能重试自己的请求

### Path Parameters
- `requestId`: 原请求 ID

### Request Body (Optional)

```typescript
{
  "modifyPrompt"?: string,    // 可选,修改后的提示词
  "modifyStyle"?: string      // 可选,修改后的风格
}
```

### Response (Success - 202 Accepted)

```json
{
  "success": true,
  "data": {
    "requestId": "clx1234567890",  // 使用相同的 requestId
    "status": "PENDING",
    "message": "Content generation restarted"
  }
}
```

---

## 6. 删除内容生成记录

### Endpoint
```
DELETE /content/generate/:requestId
```

### Description
删除指定的内容生成记录(包括生成的内容和 Workflow 执行记录)

### Authentication
需要用户登录,且只能删除自己的记录

### Path Parameters
- `requestId`: 请求 ID

### Response (Success - 200 OK)

```json
{
  "success": true,
  "message": "Content generation request deleted successfully"
}
```

### Error Responses

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Content generation request not found"
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You don't have permission to delete this request"
  }
}
```

---

## 7. 提交内容反馈

### Endpoint
```
POST /content/generate/:requestId/feedback
```

### Description
用户对生成的内容提交评分和反馈

### Authentication
需要用户登录

### Path Parameters
- `requestId`: 请求 ID

### Request Body

```typescript
{
  "rating": number,        // 必填,1-5 星
  "feedback"?: string      // 可选,文字反馈
}
```

### Request Example

```json
{
  "rating": 4,
  "feedback": "内容不错,但图片风格可以更年轻化一些"
}
```

### Response (Success - 200 OK)

```json
{
  "success": true,
  "message": "Feedback submitted successfully"
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Rating must be between 1 and 5"
  }
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_INPUT` | 400 | 请求参数不合法 |
| `UNAUTHORIZED` | 401 | 未登录或认证失败 |
| `FORBIDDEN` | 403 | 无权访问该资源 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 外部服务不可用 |

---

## Rate Limiting

- 每个用户每分钟最多创建 **5 个**内容生成请求
- 每个用户每小时最多创建 **50 个**内容生成请求
- 超出限制返回 `429 Too Many Requests`

---

## API 版本

当前版本: **v1**

未来如果 API 有重大变更,将通过路径版本化:
```
/api/v2/content/generate
```

---

**API 契约完成日期**: 2026-01-20  
**下一步**: 创建 Quickstart Guide
