-- CreateEnum
CREATE TYPE "TradeCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'PAINTING_DECORATING', 'CARPENTRY', 'ROOFING', 'PLASTERING', 'TILING', 'FLOORING', 'HEATING_BOILERS', 'GARDENING_LANDSCAPING', 'CLEANING', 'REMOVALS', 'BUILDING_CONSTRUCTION', 'LOCKSMITH', 'OTHER_NOT_SURE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOMEOWNER', 'TRADESPERSON');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobResponseStatus" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "address" TEXT,
    "townOrCity" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TradeCategory" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "locationText" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "homeownerId" INTEGER NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobResponse" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "tradespersonId" INTEGER NOT NULL,
    "response" "JobResponseStatus" NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JobResponse_jobId_tradespersonId_key" ON "JobResponse"("jobId", "tradespersonId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_homeownerId_fkey" FOREIGN KEY ("homeownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobResponse" ADD CONSTRAINT "JobResponse_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobResponse" ADD CONSTRAINT "JobResponse_tradespersonId_fkey" FOREIGN KEY ("tradespersonId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
