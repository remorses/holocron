import { S3Client } from 'lean-s3'
import { env } from './env'

export const s3 = new S3Client({
    endpoint: env.R2_URL!,
    region: 'auto',
    bucket: 'fumabase-uploads',
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
})

export function getKeyForMediaAsset({ siteId, slug }) {
    const key = `site/${siteId}/mediaAssets${slug.startsWith('/') ? slug : '/' + slug}`
    return key
}

export function parseKeyForMediaAsset(key: string): {
    siteId?: string
    branchId?: string
} {
    const match = key.match(/^site\/([^/]+)\//)
    if (!match) return {}
    const [, siteId] = match
    return { siteId }
}

export function getCacheTagForMediaAsset({ siteId, slug }) {
    return `mediaAsset:site:${siteId}:${slug}`
}
