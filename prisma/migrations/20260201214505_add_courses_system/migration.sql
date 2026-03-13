/*
  Warnings:

  - You are about to drop the column `sortOrder` on the `Chapter` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Chapter_sortOrder_key";

-- AlterTable
ALTER TABLE "Chapter" DROP COLUMN "sortOrder";

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "isFreePreview" BOOLEAN NOT NULL DEFAULT false;
