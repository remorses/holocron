import { S3Client } from 'lean-s3'
import { AwsClient } from 'aws4fetch'

import { env } from './env'
let aws4fetch = new AwsClient({
  accessKeyId: env.R2_ACCESS_KEY_ID!,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  service: 's3',
  region: '',
})

const bucket = 'fumabase-uploads'
export async function getPresignedUrl({ key, headers, method = 'PUT', expiresInSeconds = 900 }) {
  if (key.startsWith('/')) {
    key = key.slice(1)
  }
  const url = `${env.R2_URL!}/${bucket}/${key}?X-Amz-Expires=${expiresInSeconds}`
  const { url: presigned } = await aws4fetch.sign(new Request(url, { headers, method }), {
    aws: { signQuery: true, allHeaders: true },
  })

  return presigned
}

export const s3 = new S3Client({
  endpoint: env.R2_URL!,
  region: 'auto',
  bucket,
  accessKeyId: env.R2_ACCESS_KEY_ID!,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
})

export function getKeyForMediaAsset({ siteId, slug }) {
  if (!slug.startsWith('/')) slug = '/' + slug
  const key = `site/${siteId}/mediaAssets${slug}`
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
