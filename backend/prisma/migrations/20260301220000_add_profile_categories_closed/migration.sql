-- AlterEnum
ALTER TYPE "JobStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "availability" BOOLEAN;

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetToken_key" ON "User"("passwordResetToken");

-- CreateTable
CREATE TABLE "TradespersonCategory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" "TradeCategory" NOT NULL,

    CONSTRAINT "TradespersonCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradespersonCategory_userId_category_key" ON "TradespersonCategory"("userId", "category");

-- AddForeignKey
ALTER TABLE "TradespersonCategory" ADD CONSTRAINT "TradespersonCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
