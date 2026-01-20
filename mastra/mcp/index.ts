// mastra/mcp/index.ts

import { MCPClient } from '@mastra/mcp'

/**
 * 全局 MCP 客户端实例缓存
 */
let mcpClientInstance: MCPClient | null = null;

/**
 * 创建阿里云百炼 MCP 客户端实例
 * 使用 Mastra 官方 MCPClient 连接远程 MCP 服务器
 */
function createAliyunBailianMCPClient(): MCPClient {
  const apiKey = process.env.ALIYUN_BAILIAN_MCP_API_KEY
  const searchUrl = process.env.ALIYUN_BAILIAN_MCP_SEARCH_URL
  const imageUrl = process.env.ALIYUN_BAILIAN_MCP_IMAGE_URL

  if (!apiKey || !searchUrl || !imageUrl) {
    throw new Error(
      'Missing required MCP configuration. Please set ALIYUN_BAILIAN_MCP_API_KEY, ALIYUN_BAILIAN_MCP_SEARCH_URL, and ALIYUN_BAILIAN_MCP_IMAGE_URL environment variables.'
    )
  }

  // 使用 Mastra MCPClient 连接远程 MCP 服务
  // 根据文档，SSE 连接需要同时配置 requestInit 和 eventSourceInit
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
        // SSE 连接必须配置 eventSourceInit
        eventSourceInit: {
          fetch(input: Request | URL | string, init?: RequestInit) {
            const headers = new Headers(init?.headers || {});
            headers.set('Authorization', `Bearer ${apiKey}`);
            headers.set('Content-Type', 'application/json');
            return fetch(input, {
              ...init,
              headers,
            });
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
        // SSE 连接必须配置 eventSourceInit
        eventSourceInit: {
          fetch(input: Request | URL | string, init?: RequestInit) {
            const headers = new Headers(init?.headers || {});
            headers.set('Authorization', `Bearer ${apiKey}`);
            headers.set('Content-Type', 'application/json');
            return fetch(input, {
              ...init,
              headers,
            });
          },
        },
      },
    },
    timeout: 30000,
  })

  return mcpClient
}

/**
 * 获取 MCP 客户端实例（懒加载、单例模式）
 * 只在真正需要时才初始化
 */
export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = createAliyunBailianMCPClient();
  }
  return mcpClientInstance;
}
