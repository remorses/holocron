
> db@ get-diff /Users/morse/Documents/GitHub/fumabase/db
> pnpm prisma migrate diff --exit-code --script --from-url $DATABASE_URL_IPV4 --to-schema-datamodel schema.prisma

-- CreateEnum
CREATE TYPE "public"."ChatType" AS ENUM ('hidden', 'website');

-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "type" "public"."ChatType" NOT NULL DEFAULT 'website';
 ELIFECYCLE  Command failed with exit code 2.
