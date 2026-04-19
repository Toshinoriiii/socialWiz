-- CreateTable
CREATE TABLE "user_engagement_daily_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "collections" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_engagement_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_engagement_daily_snapshots_userId_day_key" ON "user_engagement_daily_snapshots"("userId", "day");

-- CreateIndex
CREATE INDEX "user_engagement_daily_snapshots_userId_day_idx" ON "user_engagement_daily_snapshots"("userId", "day");

-- AddForeignKey
ALTER TABLE "user_engagement_daily_snapshots" ADD CONSTRAINT "user_engagement_daily_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
