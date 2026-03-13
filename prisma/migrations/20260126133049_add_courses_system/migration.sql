/*
  Warnings:

  - Added the required column `price` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "status" "CourseStatus" NOT NULL DEFAULT 'draft';
