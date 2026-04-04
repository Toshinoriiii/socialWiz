-- CreateTable
CREATE TABLE "weibo_app_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "appSecret" TEXT NOT NULL,
    "appName" TEXT,
    "callbackUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weibo_app_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "weibo_app_configs_userId_appId_key" ON "weibo_app_configs"("userId", "appId");

-- CreateIndex
CREATE INDEX "weibo_app_configs_userId_idx" ON "weibo_app_configs"("userId");

-- AddForeignKey
ALTER TABLE "weibo_app_configs" ADD CONSTRAINT "weibo_app_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "PlatformAccount_userId_platform_key";

-- AlterTable
ALTER TABLE "PlatformAccount" ADD COLUMN     "weiboAppConfigId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_userId_platform_platformUserId_key" ON "PlatformAccount"("userId", "platform", "platformUserId");

-- CreateIndex
CREATE INDEX "PlatformAccount_weiboAppConfigId_idx" ON "PlatformAccount"("weiboAppConfigId");

-- AddForeignKey
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_weiboAppConfigId_fkey" FOREIGN KEY ("weiboAppConfigId") REFERENCES "weibo_app_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
