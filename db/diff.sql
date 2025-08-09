-- AlterTable
ALTER TABLE "MarkdownPage" ALTER COLUMN "githubSha" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SiteBranch" DROP COLUMN "trieveDatasetId",
DROP COLUMN "trieveReadApiKey";

