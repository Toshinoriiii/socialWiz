-- CreateEnum
CREATE TYPE "PublishJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "contentId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "PublishJobStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "platformPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publish_jobs_userId_idx" ON "publish_jobs"("userId");

-- CreateIndex
CREATE INDEX "publish_jobs_platformAccountId_idx" ON "publish_jobs"("platformAccountId");

-- CreateIndex
CREATE INDEX "publish_jobs_status_idx" ON "publish_jobs"("status");

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
