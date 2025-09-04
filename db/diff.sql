-- CreateEnum
CREATE TYPE "public"."SiteVisibility" AS ENUM ('private', 'public');

-- AlterTable
ALTER TABLE "public"."Site" ADD COLUMN     "visibility" "public"."SiteVisibility" NOT NULL DEFAULT 'private';

