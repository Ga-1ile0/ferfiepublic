-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PARENT', 'KID');

-- CreateEnum
CREATE TYPE "AllowanceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ChoreStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'COMPLETED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ALLOWANCE', 'CHORE_REWARD', 'GIFT_CARD_PURCHASE', 'TOKEN_TRADE', 'NFT_TRADE', 'TOKEN_TRANSFER', 'DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('USDC', 'EURC', 'CADC', 'BRZ', 'IDRX', 'ETH', 'USD');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('ask', 'bid', 'listing', 'offer');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('basic', 'english', 'criteria');

-- CreateTable
CREATE TABLE "OrderV2" (
    "id" TEXT NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL,
    "closingDate" TIMESTAMP(3),
    "listingTime" INTEGER NOT NULL,
    "expirationTime" INTEGER NOT NULL,
    "orderHash" TEXT NOT NULL,
    "maker" JSONB NOT NULL,
    "taker" JSONB,
    "protocolData" JSONB NOT NULL,
    "protocolAddress" TEXT NOT NULL,
    "currentPrice" BIGINT NOT NULL,
    "makerFees" JSONB NOT NULL,
    "takerFees" JSONB NOT NULL,
    "side" "OrderSide" NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "cancelled" BOOLEAN NOT NULL,
    "finalized" BOOLEAN NOT NULL,
    "markedInvalid" BOOLEAN NOT NULL,
    "clientSignature" TEXT,
    "remainingQuantity" INTEGER NOT NULL,
    "nftContractAddress" TEXT,
    "nftTokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderV2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "address" TEXT NOT NULL,
    "privateKey" TEXT,
    "privateKeyDownloaded" BOOLEAN NOT NULL DEFAULT false,
    "familyAddress" TEXT,
    "recoveryPhrase" TEXT,
    "dek" TEXT,
    "image" TEXT,
    "role" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "TokenType" NOT NULL DEFAULT 'USDC',
    "currencyAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT NOT NULL,
    "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allowance" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" "AllowanceFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "nextDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Allowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "reward" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "ChoreStatus" NOT NULL DEFAULT 'ACTIVE',
    "evidence" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "assignmentType" TEXT,
    "familyId" TEXT,
    "isFirstToComplete" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "TransactionType" NOT NULL,
    "hash" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT,
    "userId" TEXT NOT NULL,
    "familyId" TEXT,
    "orderHash" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardAmount" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "giftCardId" TEXT NOT NULL,

    CONSTRAINT "GiftCardAmount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardPurchase" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,

    CONSTRAINT "GiftCardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenTrade" (
    "id" TEXT NOT NULL,
    "fromAmount" DOUBLE PRECISION NOT NULL,
    "fromToken" TEXT NOT NULL,
    "toAmount" DOUBLE PRECISION NOT NULL,
    "toToken" TEXT NOT NULL,
    "exchangeRate" DOUBLE PRECISION,
    "usdBuyPrice" DOUBLE PRECISION,
    "usdSellPrice" DOUBLE PRECISION,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,

    CONSTRAINT "TokenTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "tradingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nftEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giftCardsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxTradeAmount" DOUBLE PRECISION,
    "maxNftTradeAmount" DOUBLE PRECISION,
    "maxGiftCardAmount" DOUBLE PRECISION,
    "requireGiftCardApproval" BOOLEAN NOT NULL DEFAULT true,
    "cryptoTransferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxTransferAmount" DOUBLE PRECISION,
    "allowedRecipientAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recipientNicknames" JSONB,
    "includeFamilyWallet" BOOLEAN NOT NULL DEFAULT true,
    "allowedTokenSymbols" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedNftSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedGiftCardCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidebarOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Menu',
    "link" TEXT NOT NULL DEFAULT '#',
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SidebarOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildAuthCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "childId" TEXT NOT NULL,

    CONSTRAINT "ChildAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tokens" (
    "id" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "image" TEXT NOT NULL,

    CONSTRAINT "Tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenRate" (
    "id" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "usdPrice" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NftCollection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "slug" TEXT,
    "creator" TEXT,
    "tokenCount" TEXT,
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyId" TEXT NOT NULL,

    CONSTRAINT "NftCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderV2_orderHash_key" ON "OrderV2"("orderHash");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_address_key" ON "User"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_userId_key" ON "Permission"("userId");

-- CreateIndex
CREATE INDEX "SidebarOption_userId_idx" ON "SidebarOption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAuthCode_code_key" ON "ChildAuthCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAuthCode_childId_key" ON "ChildAuthCode"("childId");

-- CreateIndex
CREATE INDEX "TokenRate_contract_timestamp_idx" ON "TokenRate"("contract", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "NftCollection_familyId_contractAddress_key" ON "NftCollection"("familyId", "contractAddress");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Family" ADD CONSTRAINT "Family_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allowance" ADD CONSTRAINT "Allowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chore" ADD CONSTRAINT "Chore_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderHash_fkey" FOREIGN KEY ("orderHash") REFERENCES "OrderV2"("orderHash") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardAmount" ADD CONSTRAINT "GiftCardAmount_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardPurchase" ADD CONSTRAINT "GiftCardPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardPurchase" ADD CONSTRAINT "GiftCardPurchase_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenTrade" ADD CONSTRAINT "TokenTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidebarOption" ADD CONSTRAINT "SidebarOption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAuthCode" ADD CONSTRAINT "ChildAuthCode_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NftCollection" ADD CONSTRAINT "NftCollection_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
