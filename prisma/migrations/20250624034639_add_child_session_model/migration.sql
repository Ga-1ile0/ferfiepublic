-- DropIndex
DROP INDEX "ChildSession_sessionToken_idx";

-- AlterTable
ALTER TABLE "ChildSession" ADD COLUMN     "userAgent" TEXT;
