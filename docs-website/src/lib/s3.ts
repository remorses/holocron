import { S3Client } from 'lean-s3'
import { env } from './env'

export const s3 = new S3Client({
    endpoint: env.R2_URL!,
    region: 'auto',
    bucket: 'fumabase-uploads',
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
})

export function getKeyForMediaAsset({ siteId, tabId, slug }) {
    const key = `site/${siteId}/tab/${tabId}/mediaAssets${slug}`
    return key
}

export function getCacheTagForMediaAsset({ siteId, tabId, slug }) {
    return `mediaAsset:site:${siteId}:tab:${tabId}:${slug}`
}
