// mastra/mcp/tools.ts

import { createAliyunBailianMCPClient } from './aliyun-bailian-client'

/**
 * 获取阿里云百炼 MCP 所有 Tools
 * 使用 Mastra MCPClient 自动列出并返回 MCP 服务提供的所有工具
 */
export async function getMCPTools() {
  const mcpClient = createAliyunBailianMCPClient()
  
  // 使用 MCPClient.getTools() 自动获取所有 MCP 服务器提供的工具
  const tools = await mcpClient.getTools()
  
  return tools
}
