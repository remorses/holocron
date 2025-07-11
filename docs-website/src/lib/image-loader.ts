import { prisma } from 'db'
import { getKeyForMediaAsset, s3 } from '../lib/s3'
import { getCacheTagForMediaAsset } from '../lib/cache-tags'

export async function imageLoader({ request }) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    const siteBranch = await prisma.siteBranch.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            site: {
                include: {
                    locales: true,
                },
            },
        },
    })
    if (!siteBranch) {
        return new Response('Not Found', { status: 404 })
    }

    const slug = new URL(request.url).pathname
    const siteId = siteBranch.siteId

    const mediaAsset = await prisma.mediaAsset.findFirst({
        where: {
            slug,
            branchId: siteBranch.branchId,
        },
    })
    if (!mediaAsset) {
        return new Response('Not Found', { status: 404 })
    }
    const key = getKeyForMediaAsset({
        siteId,
        slug,
    })
    const file = s3.file(key)
    const [stat, blob] = await Promise.all([file.stat(), file.blob()])
    console.log(`media asset content type for ${key}: ${stat.type}`)
    return new Response(blob, {
        headers: {
            'Content-Type': stat.type,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Cache-Tag': getCacheTagForMediaAsset({
                branchId: siteBranch.branchId,
                slug,
            }),
            'Content-Length': stat.size.toString(),
        },
    })
}
