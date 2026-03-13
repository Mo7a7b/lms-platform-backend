/*
  Warnings:

  - The values [draft,published] on the enum `CourseStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[sortOrder]` on the table `Chapter` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sortOrder` to the `Chapter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `enrollmentsNumber` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CourseStatus_new" AS ENUM ('Draft', 'Published');
ALTER TABLE "public"."Course" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Course" ALTER COLUMN "status" TYPE "CourseStatus_new" USING ("status"::text::"CourseStatus_new");
ALTER TYPE "CourseStatus" RENAME TO "CourseStatus_old";
ALTER TYPE "CourseStatus_new" RENAME TO "CourseStatus";
DROP TYPE "public"."CourseStatus_old";
ALTER TABLE "Course" ALTER COLUMN "status" SET DEFAULT 'Draft';
COMMIT;

-- AlterTable
ALTER TABLE "Chapter" ADD COLUMN     "sortOrder" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "enrollmentsNumber" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_sortOrder_key" ON "Chapter"("sortOrder");
