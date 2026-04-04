
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { webSearchAgent } from './agents/web-search-agent';
import { contentCreationAgent } from './agents/content-creation-agent';
import { imagePromptAgent } from './agents/image-prompt-agent';
import { contentMixAgent } from './agents/content-mix-agent';
import { socialMediaAgent } from './agents/social-media-agent';
import { intentRouterAgent } from './agents/intent-router-agent';
import { imageGenerationAgent } from './agents/image-generation-agent';
import { contentFormatterAgent } from './agents/content-formatter-agent';
import { getMCPTools } from './mcp';

// 创建 Mastra 实例的异步初始化函数
async function createMastraInstance() {
  try {
    await getMCPTools()
    console.log('[Mastra] MCP tools loaded successfully')
  } catch (error) {
    console.warn('[Mastra] Failed to load MCP tools, continuing without them:', error)
  }

  return new Mastra({
    agents: {
      intentRouterAgent,
      webSearchAgent,
      contentCreationAgent,
      imagePromptAgent,
      contentMixAgent,
      socialMediaAgent,
      imageGenerationAgent,
      contentFormatterAgent,
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
