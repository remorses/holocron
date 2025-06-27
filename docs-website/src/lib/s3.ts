import { S3Client } from 'lean-s3'
import { env } from './env'

export const s3 = new S3Client({
    endpoint: env.R2_URL!,
    region: 'auto',
    bucket: 'fumabase-uploads',
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
})

export function getKeyForMediaAsset({ siteId, branchId, slug }) {
    const key = `site/${siteId}/branch/${branchId}/mediaAssets${slug}`
    return key
}

export function getCacheTagForMediaAsset({ siteId, branchId, slug }) {
    return `mediaAsset:site:${siteId}:branch:${branchId}:${slug}`
}
