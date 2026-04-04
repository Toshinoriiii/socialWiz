-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WECHAT', 'WEIBO', 'DOUYIN', 'XIAOHONGSHU');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "AIGenerationType" AS ENUM ('TEXT', 'IMAGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "platformUsername" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isConnected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "images" TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiModel" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_platforms" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "platformAccountId" TEXT,
    "wechatConfigId" TEXT,
    "platformContentId" TEXT,
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "publishedUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Analytics" (
    "id" TEXT NOT NULL,
    "contentPlatformId" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGenerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "generatedContent" TEXT NOT NULL,
    "type" "AIGenerationType" NOT NULL,
    "tokensUsed" INTEGER,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIGenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wechat_account_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "accountName" TEXT,
    "accountType" TEXT,
    "subjectType" TEXT,
    "canPublish" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wechat_account_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "PlatformAccount_userId_idx" ON "PlatformAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_userId_platform_key" ON "PlatformAccount"("userId", "platform");

-- CreateIndex
CREATE INDEX "Content_userId_status_idx" ON "Content"("userId", "status");

-- CreateIndex
CREATE INDEX "Content_scheduledAt_idx" ON "Content"("scheduledAt");

-- CreateIndex
CREATE INDEX "content_platforms_contentId_idx" ON "content_platforms"("contentId");

-- CreateIndex
CREATE INDEX "content_platforms_platformAccountId_idx" ON "content_platforms"("platformAccountId");

-- CreateIndex
CREATE INDEX "content_platforms_wechatConfigId_idx" ON "content_platforms"("wechatConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "Analytics_contentPlatformId_key" ON "Analytics"("contentPlatformId");

-- CreateIndex
CREATE INDEX "Analytics_platformAccountId_date_idx" ON "Analytics"("platformAccountId", "date");

-- CreateIndex
CREATE INDEX "AIGenerationLog_userId_idx" ON "AIGenerationLog"("userId");

-- CreateIndex
CREATE INDEX "AIGenerationLog_createdAt_idx" ON "AIGenerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "wechat_account_configs_userId_idx" ON "wechat_account_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "wechat_account_configs_userId_appId_key" ON "wechat_account_configs"("userId", "appId");

-- AddForeignKey
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_platforms" ADD CONSTRAINT "content_platforms_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_platforms" ADD CONSTRAINT "content_platforms_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_platforms" ADD CONSTRAINT "content_platforms_wechatConfigId_fkey" FOREIGN KEY ("wechatConfigId") REFERENCES "wechat_account_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_contentPlatformId_fkey" FOREIGN KEY ("contentPlatformId") REFERENCES "content_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Analytics" ADD CONSTRAINT "Analytics_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "PlatformAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIGenerationLog" ADD CONSTRAINT "AIGenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wechat_account_configs" ADD CONSTRAINT "wechat_account_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
