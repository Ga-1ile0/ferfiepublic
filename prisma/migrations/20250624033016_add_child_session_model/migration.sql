/*
  Warnings:

  - You are about to drop the column `browserName` on the `ChildSession` table. All the data in the column will be lost.
  - You are about to drop the column `browserVersion` on the `ChildSession` table. All the data in the column will be lost.
  - You are about to drop the column `deviceType` on the `ChildSession` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `ChildSession` table. All the data in the column will be lost.
  - You are about to drop the column `lastActiveAt` on the `ChildSession` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ChildSession` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ChildSession" DROP COLUMN "browserName",
DROP COLUMN "browserVersion",
DROP COLUMN "deviceType",
DROP COLUMN "expiresAt",
DROP COLUMN "lastActiveAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "deviceName" DROP NOT NULL;
