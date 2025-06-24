-- CreateTable
CREATE TABLE "ChildSession" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "browserName" TEXT NOT NULL,
    "browserVersion" TEXT,
    "ipAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "childId" TEXT NOT NULL,

    CONSTRAINT "ChildSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildSession_sessionToken_key" ON "ChildSession"("sessionToken");

-- CreateIndex
CREATE INDEX "ChildSession_childId_idx" ON "ChildSession"("childId");

-- CreateIndex
CREATE INDEX "ChildSession_sessionToken_idx" ON "ChildSession"("sessionToken");

-- AddForeignKey
ALTER TABLE "ChildSession" ADD CONSTRAINT "ChildSession_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
