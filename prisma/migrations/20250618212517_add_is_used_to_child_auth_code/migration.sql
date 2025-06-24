-- AlterTable
ALTER TABLE "ChildAuthCode" ADD COLUMN     "isUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "giftCardCountry" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN     "giftCardEmail" TEXT,
ALTER COLUMN "giftCardsEnabled" SET DEFAULT false;
