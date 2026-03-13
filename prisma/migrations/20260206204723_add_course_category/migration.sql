/*
  Warnings:

  - You are about to drop the column `tags` on the `Course` table. All the data in the column will be lost.
  - Added the required column `category` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM ('Programming', 'Design', 'Business', 'Marketing', 'Health', 'Productivity', 'Languages', 'Mathematics', 'Science', 'Engineering', 'Electronics', 'Cooking', 'Music', 'Writing', 'History', 'Law');

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "tags",
ADD COLUMN     "category" "CourseCategory" NOT NULL;
