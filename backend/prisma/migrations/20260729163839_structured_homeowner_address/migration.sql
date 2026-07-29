-- AlterTable
ALTER TABLE "User" DROP COLUMN "address",
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "addressPostcode" TEXT;
