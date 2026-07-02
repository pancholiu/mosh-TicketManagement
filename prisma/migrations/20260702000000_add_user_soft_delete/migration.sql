-- AlterTable
ALTER TABLE "User" ADD COLUMN "banned" BOOLEAN,
ADD COLUMN "banReason" TEXT,
ADD COLUMN "banExpires" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);
