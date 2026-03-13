/*
  Warnings:

  - You are about to drop the column `isFreePreview` on the `Video` table. All the data in the column will be lost.
  - The `url` column on the `Video` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `order` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "isFreePreview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Video" DROP COLUMN "isFreePreview",
ADD COLUMN     "order" INTEGER NOT NULL,
DROP COLUMN "url",
ADD COLUMN     "url" JSONB NOT NULL DEFAULT '{"url": "","publicId":""}';
