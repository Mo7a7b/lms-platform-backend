-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastVerificationSentAt" TIMESTAMP(3),
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpiry" TIMESTAMP(3);
