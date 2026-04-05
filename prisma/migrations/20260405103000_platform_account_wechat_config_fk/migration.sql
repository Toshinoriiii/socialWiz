-- AlterTable
ALTER TABLE "PlatformAccount" ADD COLUMN "wechatAccountConfigId" TEXT;

-- CreateIndex
CREATE INDEX "PlatformAccount_wechatAccountConfigId_idx" ON "PlatformAccount"("wechatAccountConfigId");

-- AddForeignKey
ALTER TABLE "PlatformAccount" ADD CONSTRAINT "PlatformAccount_wechatAccountConfigId_fkey" FOREIGN KEY ("wechatAccountConfigId") REFERENCES "wechat_account_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
