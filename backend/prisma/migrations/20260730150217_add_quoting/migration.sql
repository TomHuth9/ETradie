-- AlterEnum
ALTER TYPE "JobResponseStatus" ADD VALUE 'QUOTED';
ALTER TYPE "JobResponseStatus" ADD VALUE 'NOT_SELECTED';

-- AlterTable
ALTER TABLE "JobResponse" ADD COLUMN     "message" TEXT,
ADD COLUMN     "price" DECIMAL(10,2);
