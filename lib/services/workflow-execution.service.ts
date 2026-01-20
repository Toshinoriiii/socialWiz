// lib/services/workflow-execution.service.ts

import { PrismaClient } from '@prisma/client'
import { mastra } from '@/mastra'
import type { WorkflowInput, WorkflowOutput } from '@/types/workflow.types'

const prisma = new PrismaClient()

/**
 * Workflow 执行服务
 * 负责执行和监控 Workflow
 */
export class WorkflowExecutionService {
  /**
   * 执行内容创作工作流
   */
  async executeContentCreationWorkflow(input: WorkflowInput): Promise<WorkflowOutput> {
    const startTime = Date.now()

    // 创建 Workflow 执行记录
    const execution = await prisma.workflowExecution.create({
      data: {
        requestId: input.requestId,
        workflowId: 'content-creation-workflow',
        status: 'RUNNING',
        input: input as any,
        startedAt: new Date(),
      },
    })

    try {
      // 执行 Workflow
      const workflow = mastra.getWorkflow('contentCreationWorkflow')

      if (!workflow) {
        throw new Error('Workflow not found: contentCreationWorkflow')
      }

      // 创建运行实例并执行
      const run = await workflow.createRunAsync();
      const result = await run.start({
        inputData: {
          prompt: input.prompt,
          platform: input.platform,
          style: input.style,
        },
        initialState: {
          requestId: input.requestId,
          userId: input.userId,
        },
      })

      const duration = Date.now() - startTime

      // 更新执行记录
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          output: result as any,
          completedAt: new Date(),
          duration,
        },
      })

      return {
        success: true,
        content: result.output?.rawContent?.body,
        imageUrl: result.output?.imageData?.url,
      }
    } catch (error) {
      const duration = Date.now() - startTime

      // 更新执行记录为失败状态
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : '未知错误',
          completedAt: new Date(),
          duration,
        },
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : '工作流执行失败',
      }
    }
  }

  /**
   * 获取 Workflow 执行状态
   */
  async getExecutionStatus(requestId: string) {
    return prisma.workflowExecution.findUnique({
      where: { requestId },
      include: {
        steps: {
          orderBy: {
            startedAt: 'asc',
          },
        },
      },
    })
  }

  /**
   * 记录 Step 执行
   */
  async recordStepExecution(
    executionId: string,
    stepData: {
      stepId: string
      stepName: string
      status: 'RUNNING' | 'COMPLETED' | 'FAILED'
      input?: any
      output?: any
      error?: string
      duration?: number
    }
  ) {
    return prisma.workflowStepExecution.create({
      data: {
        executionId,
        stepId: stepData.stepId,
        stepName: stepData.stepName,
        status: stepData.status,
        input: stepData.input,
        output: stepData.output,
        error: stepData.error,
        duration: stepData.duration,
        completedAt: stepData.status !== 'RUNNING' ? new Date() : undefined,
      },
    })
  }
}

export const workflowExecutionService = new WorkflowExecutionService()
