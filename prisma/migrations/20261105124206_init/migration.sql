-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'WRONG_ITEM', 'SIZE_ISSUE', 'NOT_AS_DESCRIBED', 'CHANGED_MIND');

-- CreateEnum
CREATE TYPE "ResolutionType" AS ENUM ('REFUND', 'REPLACEMENT', 'STORE_CREDIT');

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "orderNumber" TEXT NOT NULL,
    "itemSku" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "ResolutionType",
    "refundAmount" DECIMAL(12,2),
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnNote" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_reference_key" ON "ReturnRequest"("reference");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderNumber_itemSku_idx" ON "ReturnRequest"("orderNumber", "itemSku");

-- AddForeignKey
ALTER TABLE "ReturnNote" ADD CONSTRAINT "ReturnNote_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
