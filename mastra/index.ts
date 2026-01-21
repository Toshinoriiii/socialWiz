
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { createOpenAI } from '@ai-sdk/openai';
import { webSearchAgent } from './agents/web-search-agent';
import { contentCreationAgent } from './agents/content-creation-agent';
import { imagePromptAgent } from './agents/image-prompt-agent';
import { contentMixAgent } from './agents/content-mix-agent';
import { socialMediaAgent } from './agents/social-media-agent';
import { intentRouterAgent } from './agents/intent-router-agent';
import { getMCPClient } from './mcp';

// 创建 DeepSeek LLM 实例
const deepseek = createOpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// 创建 Mastra 实例的异步初始化函数
async function createMastraInstance() {
  let mcpTools = {};
  
  try {
    // 尝试初始化 MCP 客户端
    const mcpClient = getMCPClient();
    mcpTools = await mcpClient.getTools();
    console.log('MCP tools loaded successfully');
  } catch (error) {
    console.warn('Failed to load MCP tools, continuing without them:', error);
  }

  return new Mastra({
    agents: { 
      intentRouterAgent,
      webSearchAgent,
      contentCreationAgent,
      imagePromptAgent,
      contentMixAgent,
      socialMediaAgent,
    },
    tools: mcpTools,
    llms: {
      deepseek: deepseek('deepseek-chat'),
    },
    storage: new LibSQLStore({
      // stores observability, scores, ... into memory storage, if it needs to persist, change to file:../mastra.db
      url: ":memory:",
    }),
    logger: new PinoLogger({
      name: 'Mastra',
      level: 'info',
    }),
    telemetry: {
      // Telemetry is deprecated and will be removed in the Nov 4th release
      enabled: false, 
    },
    observability: {
      // Enables DefaultExporter and CloudExporter for AI tracing
      default: { enabled: true }, 
    },
  });
}

// 导出 Mastra 实例
export const mastra = await createMastraInstance();
