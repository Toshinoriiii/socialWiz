-- CreateTable
CREATE TABLE "platform_publish_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "configName" TEXT NOT NULL,
    "description" VARCHAR(500),
    "configData" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_publish_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_user_platform" ON "platform_publish_configs"("userId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_publish_configs_userId_platform_configName_key" ON "platform_publish_configs"("userId", "platform", "configName");

-- AddForeignKey
ALTER TABLE "platform_publish_configs" ADD CONSTRAINT "platform_publish_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
