/*
  Warnings:

  - A unique constraint covering the columns `[checkoutId]` on the table `Enrollment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `checkoutId` to the `Enrollment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "checkoutId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isStripeConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripeAccountId" TEXT DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_checkoutId_key" ON "Enrollment"("checkoutId");
