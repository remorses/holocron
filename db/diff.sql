
> db@ get-diff /Users/morse/Documents/GitHub/fumabase/db
> pnpm prisma migrate diff --exit-code --script --from-url $DATABASE_URL_IPV4 --to-schema-datamodel schema.prisma

-- AlterTable
ALTER TABLE "public"."Site" ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "Site_metadata_idx" ON "public"."Site" USING GIN ("metadata" jsonb_path_ops);
 ELIFECYCLE  Command failed with exit code 2.
