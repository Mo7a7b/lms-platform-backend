/*
  Warnings:

  - The values [Mux] on the enum `VideoProvider` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VideoProvider_new" AS ENUM ('Cloudinary', 'Youtube');
ALTER TABLE "public"."Video" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "Video" ALTER COLUMN "provider" TYPE "VideoProvider_new" USING ("provider"::text::"VideoProvider_new");
ALTER TYPE "VideoProvider" RENAME TO "VideoProvider_old";
ALTER TYPE "VideoProvider_new" RENAME TO "VideoProvider";
DROP TYPE "public"."VideoProvider_old";
ALTER TABLE "Video" ALTER COLUMN "provider" SET DEFAULT 'Cloudinary';
COMMIT;

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "publicId" TEXT DEFAULT 'external_url',
ALTER COLUMN "provider" SET DEFAULT 'Cloudinary';
