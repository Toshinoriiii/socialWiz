// mastra/mcp/index.ts

import { MCPClient } from '@mastra/mcp'

/**
 * MCP 客户端单例类
 * 使用单例模式管理 MCP 客户端连接，确保全局只有一个实例
 */
class MCPClientManager {
  private static instance: MCPClientManager | null = null;
  private mcpClient: MCPClient | null = null;
  private toolsCache: Record<string, any> | null = null;

  /**
   * 私有构造函数，防止外部直接实例化
   */
  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  /**
   * 初始化 MCP 客户端
   */
  private initClient(): MCPClient {
    if (this.mcpClient) {
      return this.mcpClient;
    }

    const apiKey = process.env.ALIYUN_BAILIAN_MCP_API_KEY;
    const searchUrl = process.env.ALIYUN_BAILIAN_MCP_SEARCH_URL;
    const imageUrl = process.env.ALIYUN_BAILIAN_MCP_IMAGE_URL;

    if (!apiKey || !searchUrl || !imageUrl) {
      throw new Error(
        'Missing required MCP configuration. Please set ALIYUN_BAILIAN_MCP_API_KEY, ALIYUN_BAILIAN_MCP_SEARCH_URL, and ALIYUN_BAILIAN_MCP_IMAGE_URL environment variables.'
      );
    }

    console.log('[MCPClientManager] Initializing MCP client...');

    // 使用 Mastra MCPClient 连接远程 MCP 服务
    this.mcpClient = new MCPClient({
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
    });

    console.log('[MCPClientManager] MCP client initialized successfully');
    return this.mcpClient;
  }

  /**
   * 获取 MCP 客户端实例
   */
  public getClient(): MCPClient {
    return this.initClient();
  }

  /**
   * 获取所有 MCP 工具（带缓存）
   */
  public async getTools(): Promise<Record<string, any>> {
    // 如果已经缓存，直接返回
    if (this.toolsCache) {
      console.log('[MCPClientManager] Returning cached tools');
      return this.toolsCache;
    }

    console.log('[MCPClientManager] Loading tools from MCP servers...');
    const client = this.getClient();
    this.toolsCache = await client.getTools();
    
    const toolNames = Object.keys(this.toolsCache);
    console.log(`[MCPClientManager] Loaded ${toolNames.length} tools:`, toolNames);
    
    return this.toolsCache;
  }

  /**
   * 清空缓存（用于重新加载工具）
   */
  public clearCache(): void {
    console.log('[MCPClientManager] Clearing tools cache');
    this.toolsCache = null;
  }

  /**
   * 重置客户端（用于重新连接）
   */
  public reset(): void {
    console.log('[MCPClientManager] Resetting MCP client');
    this.mcpClient = null;
    this.toolsCache = null;
  }
}

/**
 * 获取 MCP 客户端单例
 * @deprecated 请使用 getMCPTools() 代替
 */
export function getMCPClient(): MCPClient {
  return MCPClientManager.getInstance().getClient();
}

/**
 * 获取所有 MCP 工具（推荐使用）
 * 带缓存，避免重复加载
 */
export async function getMCPTools(): Promise<Record<string, any>> {
  return MCPClientManager.getInstance().getTools();
}

/**
 * 清空工具缓存
 */
export function clearMCPCache(): void {
  MCPClientManager.getInstance().clearCache();
}

/**
 * 重置 MCP 客户端
 */
export function resetMCPClient(): void {
  MCPClientManager.getInstance().reset();
}
