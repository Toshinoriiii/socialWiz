-- CreateEnum
CREATE TYPE "ContentGenerationStatus" AS ENUM ('PENDING', 'SEARCHING', 'CREATING', 'GENERATING_IMAGE', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'RETRYING');

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "contentType" TEXT;

-- CreateTable
CREATE TABLE "ContentGenerationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "platform" "Platform",
    "style" TEXT,
    "status" "ContentGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentGenerationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "imageUrl" TEXT,
    "imagePrompt" TEXT,
    "platform" "Platform",
    "searchResults" JSONB,
    "rating" INTEGER,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "currentStep" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "errorStep" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowStepExecution" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "status" "StepExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "WorkflowStepExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentGenerationRequest_userId_idx" ON "ContentGenerationRequest"("userId");

-- CreateIndex
CREATE INDEX "ContentGenerationRequest_status_idx" ON "ContentGenerationRequest"("status");

-- CreateIndex
CREATE INDEX "ContentGenerationRequest_createdAt_idx" ON "ContentGenerationRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedContent_requestId_key" ON "GeneratedContent"("requestId");

-- CreateIndex
CREATE INDEX "GeneratedContent_requestId_idx" ON "GeneratedContent"("requestId");

-- CreateIndex
CREATE INDEX "GeneratedContent_createdAt_idx" ON "GeneratedContent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowExecution_requestId_key" ON "WorkflowExecution"("requestId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_requestId_idx" ON "WorkflowExecution"("requestId");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "WorkflowExecution_workflowId_idx" ON "WorkflowExecution"("workflowId");

-- CreateIndex
CREATE INDEX "WorkflowStepExecution_executionId_idx" ON "WorkflowStepExecution"("executionId");

-- CreateIndex
CREATE INDEX "WorkflowStepExecution_stepId_idx" ON "WorkflowStepExecution"("stepId");

-- AddForeignKey
ALTER TABLE "ContentGenerationRequest" ADD CONSTRAINT "ContentGenerationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ContentGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ContentGenerationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
