// mastra/mcp/aliyun-bailian-client.ts

import { MCPClient } from '@mastra/mcp'

/**
 * 创建阿里云百炼 MCP 客户端实例
 * 使用 Mastra 官方 MCPClient 连接远程 MCP 服务器
 */
export function createAliyunBailianMCPClient() {
  const apiKey = process.env.ALIYUN_BAILIAN_MCP_API_KEY
  const searchUrl = process.env.ALIYUN_BAILIAN_MCP_SEARCH_URL
  const imageUrl = process.env.ALIYUN_BAILIAN_MCP_IMAGE_URL

  if (!apiKey || !searchUrl || !imageUrl) {
    throw new Error(
      'Missing required MCP configuration. Please set ALIYUN_BAILIAN_MCP_API_KEY, ALIYUN_BAILIAN_MCP_SEARCH_URL, and ALIYUN_BAILIAN_MCP_IMAGE_URL environment variables.'
    )
  }

  // 使用 Mastra MCPClient 连接远程 MCP 服务
  const mcpClient = new MCPClient({
    id: 'aliyun-bailian-mcp',
    servers: {
      webSearch: {
        url: new URL(searchUrl),
        requestInit: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      },
      imageGeneration: {
        url: new URL(imageUrl),
        requestInit: {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      },
    },
    timeout: 30000,
  })

  return mcpClient
}
