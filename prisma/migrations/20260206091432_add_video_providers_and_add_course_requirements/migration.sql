/*
  Warnings:

  - Added the required column `description` to the `Video` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration` to the `Video` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "VideoProvider" AS ENUM ('Mux', 'Youtube');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "requirements" TEXT[],
ADD COLUMN     "whatYouWillLearn" TEXT[];

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "duration" INTEGER NOT NULL,
ADD COLUMN     "provider" "VideoProvider" NOT NULL DEFAULT 'Mux',
ALTER COLUMN "url" DROP DEFAULT,
ALTER COLUMN "url" SET DATA TYPE TEXT;
