-- AlterTable
ALTER TABLE "Incident" ADD COLUMN     "platformId" TEXT NOT NULL DEFAULT 'default-platform';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformId" TEXT NOT NULL DEFAULT 'default-platform';
